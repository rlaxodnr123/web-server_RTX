import { Router } from "express";
import {
  createClassroom,
  getAllClassrooms,
  getClassroomById,
  updateClassroom,
  deleteClassroom,
  getAvailableClassrooms,
} from "../controllers/classroom.controller";
import { authenticate, requireAdmin } from "../middleware/auth";

const router = Router();

// Admin 전용
router.post("/", authenticate, requireAdmin, createClassroom);
router.put("/:id", authenticate, requireAdmin, updateClassroom);
router.delete("/:id", authenticate, requireAdmin, deleteClassroom);

// 모든 인증된 사용자
router.get("/available", authenticate, getAvailableClassrooms);
router.get("/", authenticate, getAllClassrooms);
router.get("/:id", authenticate, getClassroomById);

export default router;
