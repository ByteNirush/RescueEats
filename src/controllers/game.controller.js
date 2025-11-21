// src/controllers/game.controller.js
import Game from "../models/game.model.js";
import User from "../models/user.model.js";

export const initGame = async (req, res) => {
  try {
    const userId = req.user.id;
    let game = await Game.findOne({ user: userId });

    if (!game) {
      game = await Game.create({ user: userId });
    }

    res.json({ success: true, game });
  } catch (err) {
    console.error("initGame:", err);
    res.status(500).json({ message: err.message });
  }
};

export const updateScore = async (req, res) => {
  try {
    const userId = req.user.id;
    const { coins, xp } = req.body;

    if (typeof coins !== "number" || typeof xp !== "number") {
      return res.status(400).json({ message: "coins and xp must be numbers" });
    }

    let game = await Game.findOne({ user: userId });
    if (!game) {
      game = await Game.create({
        user: userId,
        coins,
        xp,
        level: Math.floor(xp / 100) + 1,
      });
      return res.json({ success: true, game });
    }

    // Prevent negative cheating attempts
    if (coins < 0 || xp < 0) {
      return res.status(400).json({ message: "Invalid values" });
    }

    // To avoid users overwriting with lower values accidentally, set to max
    game.coins = Math.max(game.coins, coins);
    game.xp = Math.max(game.xp, xp);
    game.level = Math.floor(game.xp / 100) + 1;

    await game.save();

    res.json({ success: true, game });
  } catch (err) {
    console.error("updateScore:", err);
    res.status(500).json({ message: err.message });
  }
};

export const dailyReward = async (req, res) => {
  try {
    const userId = req.user.id;
    let game = await Game.findOne({ user: userId });

    if (!game) game = await Game.create({ user: userId });

    const today = new Date().toDateString();

    if (game.lastLogin === today) {
      return res.json({ success: false, message: "Already claimed" });
    }

    // Check if user logged in yesterday to maintain streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const wasYesterday = game.lastLogin === yesterday.toDateString();

    // Reward scaling: base 5 coins, +1 for streak every 3 days (example)
    const baseReward = 5;
    const streakBonus = Math.floor(game.dailyStreak / 3);
    const reward = baseReward + streakBonus;

    game.dailyStreak = wasYesterday ? game.dailyStreak + 1 : 1;
    game.lastLogin = today;
    game.coins += reward;

    await game.save();

    res.json({ success: true, reward, game });
  } catch (err) {
    console.error("dailyReward:", err);
    res.status(500).json({ message: err.message });
  }
};

export const getLeaderboard = async (req, res) => {
  try {
    const top = await Game.find()
      .populate("user", "name email") // adjust field names for your User model
      .sort({ coins: -1 })
      .limit(20)
      .exec();

    res.json({ success: true, leaderboard: top });
  } catch (err) {
    console.error("getLeaderboard:", err);
    res.status(500).json({ message: err.message });
  }
};

// Optional: purchase powerup endpoint (spend coins)
export const buyPowerup = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type } = req.body; // 'magnet'|'slow'|'doubleCoin'
    const costMap = { magnet: 10, slow: 8, doubleCoin: 12 };

    if (!["magnet", "slow", "doubleCoin"].includes(type)) {
      return res.status(400).json({ message: "Invalid powerup type" });
    }

    const cost = costMap[type];

    let game = await Game.findOne({ user: userId });
    if (!game) game = await Game.create({ user: userId });

    if (game.coins < cost) {
      return res.status(400).json({ message: "Not enough coins" });
    }

    game.coins -= cost;
    game.powerups[type] = (game.powerups[type] || 0) + 1;
    await game.save();

    res.json({ success: true, game });
  } catch (err) {
    console.error("buyPowerup:", err);
    res.status(500).json({ message: err.message });
  }
};
