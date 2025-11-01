import pool from "../config/database";
import { io } from "../server";

export async function assignWaitlistItem(
  classroom_id: number,
  start_time: Date,
  end_time: Date
) {
  try {
    // 해당 시간대의 대기열 1순위 조회
    const [waitlistItems] = (await pool.execute(
      `SELECT * FROM waitlist 
       WHERE classroom_id = ? 
       AND start_time = ? 
       AND end_time = ? 
       AND status = 'waiting' 
       ORDER BY queue_position ASC 
       LIMIT 1`,
      [classroom_id, start_time, end_time]
    )) as any;

    if (waitlistItems.length === 0) {
      return null;
    }

    const waitlistItem = waitlistItems[0];

    // 예약 생성
    const [result] = (await pool.execute(
      "INSERT INTO reservations (classroom_id, user_id, start_time, end_time) VALUES (?, ?, ?, ?)",
      [classroom_id, waitlistItem.user_id, start_time, end_time]
    )) as any;

    // 대기열 상태 변경
    await pool.execute("UPDATE waitlist SET status = ? WHERE id = ?", [
      "assigned",
      waitlistItem.id,
    ]);

    // 알림 생성
    await pool.execute(
      "INSERT INTO notifications (user_id, reservation_id, message) VALUES (?, ?, ?)",
      [
        waitlistItem.user_id,
        result.insertId,
        "대기 중이던 예약이 자동으로 할당되었습니다.",
      ]
    );

    // Socket.io로 실시간 브로드캐스트
    io.to(`classroom:${classroom_id}`).emit("reservation:created", {
      id: result.insertId,
      classroom_id,
      user_id: waitlistItem.user_id,
      start_time,
      end_time,
    });

    return result.insertId;
  } catch (error: any) {
    console.error("Assign waitlist error:", error);
    return null;
  }
}
