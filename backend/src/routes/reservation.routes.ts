import { Router } from "express";
import {
  createReservation,
  getMyReservations,
  getClassroomTimeline,
  cancelReservation,
} from "../controllers/reservation.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/", authenticate, createReservation);
router.get("/my", authenticate, getMyReservations);
router.get("/classroom/:id", authenticate, getClassroomTimeline);
router.delete("/:id", authenticate, cancelReservation);

export default router;
