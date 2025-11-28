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
      .populate("user", "name email")
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

/**
 * Unlock Achievement
 * POST /api/game/achievements/unlock
 */
export const unlockAchievement = async (req, res) => {
  try {
    const userId = req.user.id;
    const { achievementId, reward = 0 } = req.body;

    let game = await Game.findOne({ user: userId });
    if (!game) game = await Game.create({ user: userId });

    // Check if already unlocked
    const existing = game.achievements.find(a => a.id === achievementId);
    if (existing) {
      return res.json({ success: false, message: "Already unlocked" });
    }

    // Add achievement
    game.achievements.push({
      id: achievementId,
      unlockedAt: new Date(),
      reward
    });

    // Add reward coins
    if (reward > 0) {
      game.coins += reward;
    }

    await game.save();

    res.json({ success: true, game, achievement: { id: achievementId, reward } });
  } catch (err) {
    console.error("unlockAchievement:", err);
    res.status(500).json({ message: err.message });
  }
};


/**
 * Get User Achievements
 * GET /api/game/achievements
 */
export const getAchievements = async (req, res) => {
  try {
    const userId = req.user.id;
    const game = await Game.findOne({ user: userId });

    if (!game) {
      return res.json({ success: true, achievements: [] });
    }

    res.json({ success: true, achievements: game.achievements });
  } catch (err) {
    console.error("getAchievements:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Get Energy Status
 * GET /api/game/energy
 */
export const getEnergy = async (req, res) => {
  try {
    const userId = req.user.id;
    let game = await Game.findOne({ user: userId });

    if (!game) {
      game = await Game.create({ user: userId });
    }

    // Regenerate energy based on time passed
    const now = new Date();
    const lastUpdate = new Date(game.lastEnergyUpdate);
    const minutesPassed = Math.floor((now - lastUpdate) / (1000 * 60));
    const energyToAdd = Math.floor(minutesPassed / 30); // 1 energy per 30 min

    if (energyToAdd > 0) {
      game.currentEnergy = Math.min(
        game.maxEnergy,
        game.currentEnergy + energyToAdd
      );
      game.lastEnergyUpdate = new Date(
        lastUpdate.getTime() + energyToAdd * 30 * 60 * 1000
      );
      await game.save();
    }

    // Calculate time until next energy
    const minutesSinceLastUpdate = Math.floor(
      (now - new Date(game.lastEnergyUpdate)) / (1000 * 60)
    );
    const minutesUntilNext =
      game.currentEnergy < game.maxEnergy
        ? 30 - minutesSinceLastUpdate
        : null;

    res.json({
      success: true,
      energy: {
        current: game.currentEnergy,
        max: game.maxEnergy,
        minutesUntilNext: minutesUntilNext,
      },
    });
  } catch (err) {
    console.error("getEnergy:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Use Energy (deduct 1 energy)
 * POST /api/game/energy/use
 */
export const useEnergy = async (req, res) => {
  try {
    const userId = req.user.id;
    let game = await Game.findOne({ user: userId });

    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    // Regenerate energy first
    const now = new Date();
    const lastUpdate = new Date(game.lastEnergyUpdate);
    const minutesPassed = Math.floor((now - lastUpdate) / (1000 * 60));
    const energyToAdd = Math.floor(minutesPassed / 30);

    if (energyToAdd > 0) {
      game.currentEnergy = Math.min(
        game.maxEnergy,
        game.currentEnergy + energyToAdd
      );
      game.lastEnergyUpdate = new Date(
        lastUpdate.getTime() + energyToAdd * 30 * 60 * 1000
      );
    }

    // Check if user has energy
    if (game.currentEnergy <= 0) {
      return res.status(400).json({
        success: false,
        message: "Not enough energy",
      });
    }

    // Deduct energy
    game.currentEnergy -= 1;
    await game.save();

    res.json({
      success: true,
      energy: {
        current: game.currentEnergy,
        max: game.maxEnergy,
      },
    });
  } catch (err) {
    console.error("useEnergy:", err);
    res.status(500).json({ message: err.message });
  }
};
