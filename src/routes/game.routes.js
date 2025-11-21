import express from "express";
import {
  initGame,
  updateScore,
  dailyReward,
  getLeaderboard,
  buyPowerup,
} from "../controllers/game.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

// All routes require authentication
router.post("/init", verifyToken, initGame);
router.post("/update-score", verifyToken, updateScore);
router.post("/daily-reward", verifyToken, dailyReward);
router.get("/leaderboard", verifyToken, getLeaderboard);
router.post("/buy-powerup", verifyToken, buyPowerup);

export default router;
