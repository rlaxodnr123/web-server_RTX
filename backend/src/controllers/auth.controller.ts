import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../config/database";
import { JWT_SECRET, JWT_EXPIRES_IN } from "../config/jwt";

export const register = async (req: Request, res: Response) => {
  try {
    const { student_id, password, name, role } = req.body;

    // 필수 필드 검증
    if (!student_id || !password || !name) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // 학번 중복 확인
    const [existingUser] = await pool.execute(
      "SELECT * FROM users WHERE student_id = ?",
      [student_id]
    );

    if (Array.isArray(existingUser) && existingUser.length > 0) {
      return res.status(400).json({ error: "Student ID already exists" });
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, 10);

    // 사용자 생성
    const [result] = (await pool.execute(
      "INSERT INTO users (student_id, password, name, role) VALUES (?, ?, ?, ?)",
      [student_id, hashedPassword, name, role || "student"]
    )) as any;

    // JWT 토큰 생성
    const token = jwt.sign(
      { id: result.insertId, role: role || "student" },
      JWT_SECRET as string,
      { expiresIn: JWT_EXPIRES_IN as any }
    );

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: result.insertId,
        student_id,
        name,
        role: role || "student",
      },
    });
  } catch (error: any) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { student_id, password } = req.body;

    if (!student_id || !password) {
      return res
        .status(400)
        .json({ error: "Student ID and password are required" });
    }

    // 사용자 조회
    const [users] = (await pool.execute(
      "SELECT * FROM users WHERE student_id = ?",
      [student_id]
    )) as any;

    if (users.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = users[0];

    // 비밀번호 확인
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // JWT 토큰 생성
    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET as string,
      { expiresIn: JWT_EXPIRES_IN as any }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        student_id: user.student_id,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
};

export const logout = async (req: Request, res: Response) => {
  // JWT는 stateless이므로 서버에서 별도 처리가 필요 없음
  // 클라이언트에서 토큰을 제거하면 됨
  res.json({ message: "Logout successful" });
};
