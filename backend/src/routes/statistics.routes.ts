import { Router } from "express";
import { getTopClassrooms } from "../controllers/statistics.controller";
import { authenticate, requireAdmin } from "../middleware/auth";

const router = Router();

// Admin 전용
router.get("/top-classrooms", authenticate, requireAdmin, getTopClassrooms);

export default router;
