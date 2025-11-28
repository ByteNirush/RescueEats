// src/models/game.model.js
import mongoose from "mongoose";

const AchievementSchema = new mongoose.Schema({
  id: { type: String, required: true }, // "catcher_100", "combo_15", etc.
  unlockedAt: { type: Date, default: Date.now },
  reward: { type: Number, default: 0 } // Coins rewarded
}, { _id: false });

const GameSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },

  coins: { type: Number, default: 0 },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },

  dailyStreak: { type: Number, default: 0 },
  lastLogin: { type: String, default: "" },

  // Meals Rescued Counter
  mealsRescued: { type: Number, default: 0 },

  // Achievements
  achievements: { type: [AchievementSchema], default: [] },

  // Track inventory of powerups
  powerups: {
    magnet: { type: Number, default: 3 },
    slow: { type: Number, default: 3 },
    doubleCoin: { type: Number, default: 3 },
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

GameSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes
// Note: user already has unique: true, which creates an index automatically
GameSchema.index({ coins: -1 }); // For leaderboard
GameSchema.index({ mealsRescued: -1 }); // For environmental impact stats

export default mongoose.model("Game", GameSchema);
