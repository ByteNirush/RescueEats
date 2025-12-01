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

    // Return essential game data in a consistent format
    res.json({
      success: true,
      coins: game.coins,
      xp: game.xp,
      level: game.level,
      dailyStreak: game.dailyStreak,
      lastLoginDate: game.lastLoginDate,
      currentEnergy: game.currentEnergy,
      maxEnergy: game.maxEnergy,
      game: game, // Full game object for backward compatibility
    });
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
    console.log(`[DailyReward] User ${userId} attempting to claim reward`);

    let game = await Game.findOne({ user: userId });

    if (!game) {
      console.log(`[DailyReward] Creating new game profile for user ${userId}`);
      game = await Game.create({ user: userId });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset to midnight for accurate comparison
    console.log(`[DailyReward] Today: ${today.toISOString()}`);
    console.log(`[DailyReward] Last login: ${game.lastLoginDate}`);

    // Check if already claimed today
    if (game.lastLoginDate) {
      const lastLoginDate = new Date(game.lastLoginDate);
      lastLoginDate.setHours(0, 0, 0, 0);

      if (lastLoginDate.getTime() === today.getTime()) {
        console.log(`[DailyReward] Already claimed today for user ${userId}`);
        return res.json({
          success: false,
          message: "Already claimed today!",
          canClaimToday: false,
          nextClaimDate: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          game: {
            coins: game.coins,
            xp: game.xp,
            level: game.level,
            dailyStreak: game.dailyStreak,
            lastLoginDate: game.lastLoginDate,
          },
        });
      }
    }

    // Calculate streak
    let newStreak = 1;
    if (game.lastLoginDate) {
      const lastLoginDate = new Date(game.lastLoginDate);
      lastLoginDate.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const wasYesterday = lastLoginDate.getTime() === yesterday.getTime();

      if (wasYesterday) {
        // Continue streak
        newStreak = game.dailyStreak + 1;
      } else {
        // Streak broken, reset to 1
        newStreak = 1;
      }
    }

    // Calculate current day (1-7 cycle)
    const currentDay = ((newStreak - 1) % 7) + 1;

    // Reward schedule based on day
    const rewardSchedule = [
      { day: 1, coins: 50, xp: 10 },
      { day: 2, coins: 75, xp: 15 },
      { day: 3, coins: 100, xp: 20 },
      { day: 4, coins: 150, xp: 25 },
      { day: 5, coins: 200, xp: 30 },
      { day: 6, coins: 300, xp: 40 },
      { day: 7, coins: 500, xp: 50 },
    ];

    const todayReward = rewardSchedule[currentDay - 1];

    // Update game state
    game.dailyStreak = newStreak;
    game.lastLogin = today.toDateString(); // Keep for backward compatibility
    game.lastLoginDate = today;
    game.coins += todayReward.coins;
    game.xp += todayReward.xp;
    game.level = Math.floor(game.xp / 100) + 1;

    // Update login history (keep last 7 entries)
    game.loginHistory.push({
      date: today,
      day: currentDay,
      claimed: true,
      reward: todayReward.coins,
    });

    // Keep only last 7 entries
    if (game.loginHistory.length > 7) {
      game.loginHistory = game.loginHistory.slice(-7);
    }

    await game.save();

    console.log(
      `[DailyReward] Successfully claimed! Day ${currentDay}, Streak ${newStreak}, Reward: ${todayReward.coins} coins`
    );

    res.json({
      success: true,
      message: "Daily reward claimed!",
      reward: {
        day: currentDay,
        coins: todayReward.coins,
        xp: todayReward.xp,
      },
      newStreak: newStreak,
      game: {
        coins: game.coins,
        xp: game.xp,
        level: game.level,
        dailyStreak: game.dailyStreak,
        lastLoginDate: game.lastLoginDate,
      },
    });
  } catch (err) {
    console.error("[DailyReward] Error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * Get Daily Reward Status (without claiming)
 * GET /api/game/daily-reward/status
 */
export const getDailyRewardStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    let game = await Game.findOne({ user: userId });

    if (!game) game = await Game.create({ user: userId });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if can claim today - if lastLoginDate is today, already claimed
    let canClaimToday = true;
    if (game.lastLoginDate) {
      const lastLoginDate = new Date(game.lastLoginDate);
      lastLoginDate.setHours(0, 0, 0, 0);
      // If last login was today, cannot claim again
      canClaimToday = lastLoginDate.getTime() !== today.getTime();
      console.log(
        `[getDailyRewardStatus] User ${userId}: lastLogin=${lastLoginDate.toISOString()}, today=${today.toISOString()}, canClaim=${canClaimToday}`
      );
    }

    // Calculate current streak
    let currentStreak = game.dailyStreak || 0;
    if (game.lastLoginDate && canClaimToday) {
      const lastLoginDate = new Date(game.lastLoginDate);
      lastLoginDate.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const wasYesterday = lastLoginDate.getTime() === yesterday.getTime();

      if (!wasYesterday && currentStreak > 0) {
        // Streak would be broken
        currentStreak = 0;
      }
    }

    // Calculate current day (1-7)
    const nextStreak = canClaimToday ? currentStreak + 1 : currentStreak;
    const currentDay = ((nextStreak - 1) % 7) + 1;

    // Reward schedule
    const rewardSchedule = [
      { day: 1, coins: 50, xp: 10 },
      { day: 2, coins: 75, xp: 15 },
      { day: 3, coins: 100, xp: 20 },
      { day: 4, coins: 150, xp: 25 },
      { day: 5, coins: 200, xp: 30 },
      { day: 6, coins: 300, xp: 40 },
      { day: 7, coins: 500, xp: 50 },
    ];

    // Build rewards array with claim status
    const rewards = rewardSchedule.map((reward, index) => {
      const dayNumber = index + 1;
      let claimed = false;

      if (canClaimToday) {
        claimed = dayNumber < currentDay;
      } else {
        claimed = dayNumber <= currentDay;
      }

      return {
        day: dayNumber,
        coins: reward.coins,
        xp: reward.xp,
        claimed: claimed,
        isCurrentDay: dayNumber === currentDay && canClaimToday,
        isLocked: dayNumber > currentDay,
      };
    });

    res.json({
      success: true,
      canClaimToday,
      currentStreak: currentStreak,
      currentDay: currentDay,
      nextReward: rewardSchedule[currentDay - 1],
      rewards: rewards,
      lastClaimDate: game.lastLoginDate,
    });
  } catch (err) {
    console.error("getDailyRewardStatus:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Get Daily Reward History (last 7 days)
 * GET /api/game/daily-reward/history
 */
export const getDailyRewardHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const game = await Game.findOne({ user: userId });

    if (!game) {
      return res.json({
        success: true,
        history: [],
      });
    }

    res.json({
      success: true,
      history: game.loginHistory || [],
    });
  } catch (err) {
    console.error("getDailyRewardHistory:", err);
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
    const existing = game.achievements.find((a) => a.id === achievementId);
    if (existing) {
      return res.json({ success: false, message: "Already unlocked" });
    }

    // Add achievement
    game.achievements.push({
      id: achievementId,
      unlockedAt: new Date(),
      reward,
    });

    // Add reward coins
    if (reward > 0) {
      game.coins += reward;
    }

    await game.save();

    res.json({
      success: true,
      game,
      achievement: { id: achievementId, reward },
    });
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
      game.currentEnergy < game.maxEnergy ? 30 - minutesSinceLastUpdate : null;

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
