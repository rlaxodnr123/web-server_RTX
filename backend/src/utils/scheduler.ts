import cron from 'node-cron';
import pool from '../config/database';

export function startNotificationScheduler() {
  // 매 1분마다 실행
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const thirtyMinutesLater = new Date(now.getTime() + 30 * 60000);
      
      // 30분 후 시작하는 예약 조회
      const [reservations] = await pool.execute(
        `SELECT r.*, u.id as user_id, c.name as classroom_name 
         FROM reservations r 
         JOIN users u ON r.user_id = u.id 
         JOIN classrooms c ON r.classroom_id = c.id
         WHERE r.status = 'active' 
         AND r.start_time > ? 
         AND r.start_time <= ?
         AND NOT EXISTS (
           SELECT 1 FROM notifications n 
           WHERE n.reservation_id = r.id 
           AND n.message LIKE '%30분 후%'
         )`,
        [now, thirtyMinutesLater]
      ) as any;

      // 알림 생성
      for (const reservation of reservations) {
        const message = `${reservation.classroom_name} 강의실 예약이 30분 후 시작됩니다.`;
        await pool.execute(
          'INSERT INTO notifications (user_id, reservation_id, message) VALUES (?, ?, ?)',
          [reservation.user_id, reservation.id, message]
        );
        console.log(`Notification created for reservation ${reservation.id}`);
      }

      // 참여자들에게도 알림 전송
      for (const reservation of reservations) {
        const [participants] = await pool.execute(
          'SELECT user_id FROM reservation_participants WHERE reservation_id = ?',
          [reservation.id]
        ) as any;

        for (const participant of participants) {
          await pool.execute(
            'INSERT INTO notifications (user_id, reservation_id, message) VALUES (?, ?, ?)',
            [participant.user_id, reservation.id, `${reservation.classroom_name} 강의실 예약이 30분 후 시작됩니다. (참여자)`]
          );
        }
      }
    } catch (error: any) {
      console.error('Notification scheduler error:', error.message);
    }
  });

  console.log('Notification scheduler started');
}

