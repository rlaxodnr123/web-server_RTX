import { Router } from "express";
import {
  createWaitlist,
  getMyWaitlist,
} from "../controllers/waitlist.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/", authenticate, createWaitlist);
router.get("/my", authenticate, getMyWaitlist);

export default router;
