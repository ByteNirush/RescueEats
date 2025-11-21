const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const game = require("../controllers/game.controller");

router.get("/init", auth, game.initGame);
router.post("/update", auth, game.updateScore);
router.post("/daily", auth, game.dailyReward);
router.get("/leaderboard", auth, game.leaderboard);

module.exports = router;
