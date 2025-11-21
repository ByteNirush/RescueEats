const express = require("express");
const router = express.Router();
const gameController = require("../controllers/game.controller");
const authMiddleware = require("../middleware/auth.middleware");

// All routes require authentication
router.use(authMiddleware);

router.post("/init", gameController.initGame);
router.post("/update-score", gameController.updateScore);
router.post("/daily-reward", gameController.dailyReward);
router.get("/leaderboard", gameController.getLeaderboard);
router.post("/buy-powerup", gameController.buyPowerup);

module.exports = router;
