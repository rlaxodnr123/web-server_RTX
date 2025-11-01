import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "classroom_reservation",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "+09:00", // 한국 시간대 설정
});

export default pool;
