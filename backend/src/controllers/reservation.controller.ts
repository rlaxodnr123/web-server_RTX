import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import {
  validateReservationTime,
  validateActiveReservationLimit,
  validateReservationDate,
  validateOneHourSlot,
  validateOnTheHour
} from '../utils/validation';
import { io } from '../server';
import { assignWaitlistItem } from '../services/waitlist.service';

export const createReservation = async (req: AuthRequest, res: Response) => {
  try {
    const { classroom_id, start_time, end_time, participants } = req.body;

    if (!classroom_id || !start_time || !end_time) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const start = new Date(start_time);
    const end = new Date(end_time);

    // 1시간 단위 검증
    const oneHourError = validateOneHourSlot(start, end);
    if (oneHourError) {
      return res.status(400).json({ error: oneHourError });
    }

    // 정시 검증
    const onTheHourError = validateOnTheHour(start, end);
    if (onTheHourError) {
      return res.status(400).json({ error: onTheHourError });
    }

    // 날짜 검증 (과거, 7일 이내)
    const dateError = await validateReservationDate(start);
    if (dateError) {
      return res.status(400).json({ error: dateError });
    }

    // 개인당 활성 예약 3개 제한
    const limitError = await validateActiveReservationLimit(req.user!.id);
    if (limitError) {
      return res.status(400).json({ error: limitError });
    }

    // 겹침 검증
    const overlapError = await validateReservationTime(classroom_id, start, end);
    if (overlapError) {
      return res.status(400).json({ error: overlapError });
    }

    // 예약 생성
    const [result] = await pool.execute(
      'INSERT INTO reservations (classroom_id, user_id, start_time, end_time) VALUES (?, ?, ?, ?)',
      [classroom_id, req.user!.id, start, end]
    ) as any;

    const reservationId = result.insertId;

    // 참여자 추가
    if (participants && Array.isArray(participants)) {
      for (const studentId of participants) {
        const [users] = await pool.execute(
          'SELECT id FROM users WHERE student_id = ?',
          [studentId]
        ) as any;

        if (users.length > 0) {
          await pool.execute(
            'INSERT INTO reservation_participants (reservation_id, user_id) VALUES (?, ?)',
            [reservationId, users[0].id]
          );
        }
      }
    }

    // 예약 정보 조회 (강의실 정보 포함)
    const [reservations] = await pool.execute(
      `SELECT r.*, c.name as classroom_name, c.location, u.name as user_name 
       FROM reservations r 
       JOIN classrooms c ON r.classroom_id = c.id 
       JOIN users u ON r.user_id = u.id 
       WHERE r.id = ?`,
      [reservationId]
    ) as any;

    // Socket.io로 실시간 브로드캐스트
    io.to(`classroom:${classroom_id}`).emit('reservation:created', reservations[0]);

    res.status(201).json({
      message: 'Reservation created successfully',
      reservation: reservations[0]
    });
  } catch (error: any) {
    console.error('Create reservation error:', error);
    res.status(500).json({ error: 'Failed to create reservation' });
  }
};

export const getMyReservations = async (req: AuthRequest, res: Response) => {
  try {
    const [reservations] = await pool.execute(
      `SELECT DISTINCT r.*, c.name as classroom_name, c.location, u.name as user_name, u.student_id
       FROM reservations r 
       JOIN classrooms c ON r.classroom_id = c.id 
       JOIN users u ON r.user_id = u.id
       LEFT JOIN reservation_participants rp ON r.id = rp.reservation_id
       WHERE (r.user_id = ? OR rp.user_id = ?)
       AND r.status = 'active'
       ORDER BY r.start_time ASC`,
      [req.user!.id, req.user!.id]
    );

    res.json({ reservations });
  } catch (error: any) {
    console.error('Get reservations error:', error);
    res.status(500).json({ error: 'Failed to fetch reservations' });
  }
};

export const getClassroomTimeline = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const [reservations] = await pool.execute(
      `SELECT r.*, c.name as classroom_name, c.location, u.name as user_name, u.student_id
       FROM reservations r 
       JOIN classrooms c ON r.classroom_id = c.id 
       JOIN users u ON r.user_id = u.id
       WHERE r.classroom_id = ? 
       AND r.status = 'active'
       ORDER BY r.start_time ASC`,
      [id]
    );

    res.json({ reservations });
  } catch (error: any) {
    console.error('Get timeline error:', error);
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
};

export const cancelReservation = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // 예약 정보 조회
    const [reservations] = await pool.execute(
      'SELECT * FROM reservations WHERE id = ?',
      [id]
    ) as any;

    if (reservations.length === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    const reservation = reservations[0];

    // 본인 예약만 취소 가능
    if (reservation.user_id !== req.user!.id) {
      return res.status(403).json({ error: 'Cannot cancel other users\' reservations' });
    }

    // 취소 처리
    await pool.execute(
      'UPDATE reservations SET status = ? WHERE id = ?',
      ['cancelled', id]
    );

    // Socket.io로 실시간 브로드캐스트
    io.to(`classroom:${reservation.classroom_id}`).emit('reservation:cancelled', { id: parseInt(id) });

    // 대기열 1순위 확인 및 할당
    await assignWaitlistItem(reservation.classroom_id, reservation.start_time, reservation.end_time);

    res.json({ message: 'Reservation cancelled successfully' });
  } catch (error: any) {
    console.error('Cancel reservation error:', error);
    res.status(500).json({ error: 'Failed to cancel reservation' });
  }
};

