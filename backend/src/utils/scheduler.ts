import cron from 'node-cron';
import pool from '../config/database';

let dbConnectionErrorLogged = false;

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
      // 데이터베이스 연결 오류는 처음 한 번만 로그 출력
      if (error.message?.includes('Access denied') || error.message?.includes('ECONNREFUSED')) {
        if (!dbConnectionErrorLogged) {
          console.error('Notification scheduler: Database connection failed. Please check your .env file and database credentials.');
          console.error('Error:', error.message);
          dbConnectionErrorLogged = true;
        }
        return; // 데이터베이스 연결 실패 시 스케줄러 실행 중단
      }
      console.error('Notification scheduler error:', error.message);
    }
  });

  console.log('Notification scheduler started');
}

