import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { assignWaitlistItem } from '../services/waitlist.service';

export const createWaitlist = async (req: AuthRequest, res: Response) => {
  try {
    const { classroom_id, start_time, end_time } = req.body;

    if (!classroom_id || !start_time || !end_time) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const start = new Date(start_time);
    const end = new Date(end_time);

    // 해당 시간대의 최대 대기 순위 조회
    const [maxPosition] = await pool.execute(
      `SELECT COALESCE(MAX(queue_position), 0) as max_pos FROM waitlist 
       WHERE classroom_id = ? AND start_time = ? AND end_time = ?`,
      [classroom_id, start, end]
    ) as any;

    const nextPosition = maxPosition[0].max_pos + 1;

    // 대기열 생성
    const [result] = await pool.execute(
      'INSERT INTO waitlist (classroom_id, user_id, start_time, end_time, queue_position) VALUES (?, ?, ?, ?, ?)',
      [classroom_id, req.user!.id, start, end, nextPosition]
    ) as any;

    res.status(201).json({
      message: 'Added to waitlist successfully',
      waitlist: {
        id: result.insertId,
        classroom_id,
        start_time,
        end_time,
        queue_position: nextPosition
      }
    });
  } catch (error: any) {
    console.error('Create waitlist error:', error);
    res.status(500).json({ error: 'Failed to add to waitlist' });
  }
};

export const getMyWaitlist = async (req: AuthRequest, res: Response) => {
  try {
    const [waitlist] = await pool.execute(
      `SELECT w.*, c.name as classroom_name, c.location 
       FROM waitlist w 
       JOIN classrooms c ON w.classroom_id = c.id 
       WHERE w.user_id = ? 
       AND w.status = 'waiting' 
       ORDER BY w.created_at ASC`,
      [req.user!.id]
    );

    res.json({ waitlist });
  } catch (error: any) {
    console.error('Get waitlist error:', error);
    res.status(500).json({ error: 'Failed to fetch waitlist' });
  }
};

