export interface User {
  id: number;
  student_id: string;
  password?: string;
  name: string;
  role: 'student' | 'admin';
  created_at: Date;
}

export interface Classroom {
  id: number;
  name: string;
  location: string;
  capacity: number;
  has_projector: boolean;
  has_whiteboard: boolean;
  created_at: Date;
}

export interface Reservation {
  id: number;
  classroom_id: number;
  user_id: number;
  start_time: Date;
  end_time: Date;
  status: 'active' | 'cancelled';
  created_at: Date;
  classroom?: Classroom;
  user?: User;
}

export interface ReservationParticipant {
  id: number;
  reservation_id: number;
  user_id: number;
  user?: User;
}

export interface Waitlist {
  id: number;
  classroom_id: number;
  user_id: number;
  start_time: Date;
  end_time: Date;
  queue_position: number;
  status: 'waiting' | 'assigned' | 'cancelled';
  created_at: Date;
}

export interface Notification {
  id: number;
  user_id: number;
  reservation_id: number | null;
  message: string;
  is_read: boolean;
  created_at: Date;
}

export interface CreateReservationDto {
  classroom_id: number;
  start_time: string;
  end_time: string;
  participants?: string[]; // student_ids
}
