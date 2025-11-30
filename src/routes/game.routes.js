import express from "express";
import {
  initGame,
  updateScore,
  dailyReward,
  getDailyRewardStatus,
  getDailyRewardHistory,
  getLeaderboard,
  buyPowerup,
  unlockAchievement,
  getAchievements,
  getEnergy,
  useEnergy
} from "../controllers/game.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { validateAchievement } from "../middlewares/validators.js";

const router = express.Router();

// Initialize game profile
router.post("/init", verifyToken, initGame);

// Update score (coins + XP)
router.post("/update-score", verifyToken, updateScore);

// Daily login reward
router.get("/daily-reward/status", verifyToken, getDailyRewardStatus);
router.get("/daily-reward/history", verifyToken, getDailyRewardHistory);
router.post("/daily-reward", verifyToken, dailyReward);

// Leaderboard
router.get("/leaderboard", getLeaderboard);

// Buy powerup
router.post("/powerup/buy", verifyToken, buyPowerup);

// Achievements
router.get("/achievements", verifyToken, getAchievements);
router.post("/achievements/unlock", verifyToken, validateAchievement, unlockAchievement);

// Energy system
router.get("/energy", verifyToken, getEnergy);
router.post("/energy/use", verifyToken, useEnergy);

export default router;
