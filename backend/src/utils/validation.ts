import pool from '../config/database';

export async function validateReservationTime(
  classroom_id: number,
  start_time: Date,
  end_time: Date,
  excludeReservationId?: number
): Promise<string | null> {
  // 시간 겹침 검증
  const [overlapping] = await pool.execute(
    `SELECT * FROM reservations 
     WHERE classroom_id = ? 
     AND status = 'active' 
     AND id != ?
     AND (
       (start_time < ? AND end_time > ?) OR
       (start_time >= ? AND start_time < ?) OR
       (end_time > ? AND end_time <= ?)
     )`,
    [classroom_id, excludeReservationId || 0, start_time, start_time, start_time, end_time, start_time, end_time]
  ) as any;

  if (overlapping.length > 0) {
    return 'This time slot is already reserved';
  }

  return null;
}

export async function validateActiveReservationLimit(user_id: number): Promise<string | null> {
  const [reservations] = await pool.execute(
    `SELECT * FROM reservations 
     WHERE user_id = ? 
     AND status = 'active' 
     AND start_time > NOW()`,
    [user_id]
  ) as any;

  if (reservations.length >= 3) {
    return 'Maximum 3 active reservations allowed';
  }

  return null;
}

export async function validateReservationDate(start_time: Date): Promise<string | null> {
  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  if (start_time <= now) {
    return 'Cannot make reservations in the past';
  }

  if (start_time > sevenDaysLater) {
    return 'Reservations can only be made up to 7 days in advance';
  }

  return null;
}

export function validateOneHourSlot(start_time: Date, end_time: Date): string | null {
  const diffMs = end_time.getTime() - start_time.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours !== 1) {
    return 'Reservations must be exactly 1 hour long';
  }

  return null;
}

export function validateOnTheHour(start_time: Date, end_time: Date): string | null {
  const startMinutes = start_time.getMinutes();
  const endMinutes = end_time.getMinutes();

  if (startMinutes !== 0 || endMinutes !== 0) {
    return 'Reservations must start and end on the hour';
  }

  return null;
}

