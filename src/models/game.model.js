// src/models/game.model.js
const mongoose = require("mongoose");

const GameSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },

  coins: { type: Number, default: 0 },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },

  dailyStreak: { type: Number, default: 0 },
  lastLogin: { type: String, default: "" },

  // Track inventory of powerups
  powerups: {
    magnet: { type: Number, default: 3 },
    slow: { type: Number, default: 3 },
    doubleCoin: { type: Number, default: 3 },
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

GameSchema.pre("save", function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Game", GameSchema);
