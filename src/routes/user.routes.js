import express from "express";
import { signup, login, refreshToken, getAllUsers } from "../controllers/user.controller.js";
import { verifyToken, authorizeRoles } from "../middlewares/auth.middleware.js";
import { addToBlacklist } from "../utils/tokenBlacklist.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/refresh-token", refreshToken);

// ✅ LOGOUT
router.post("/logout", verifyToken, (req, res) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  addToBlacklist(token);
  res.status(200).json({ message: "Logged out successfully" });
});

// ✅ Protected Routes
router.get("/profile", verifyToken, (req, res) => {
  res.json({ message: "Profile accessed", user: req.user });
});

// ✅ Get all users (Admin only)
router.get("/", verifyToken, authorizeRoles("admin"), getAllUsers);

// ✅ Only Admin Access
router.get(
  "/admin/dashboard",
  verifyToken,
  authorizeRoles("admin"),
  (req, res) => {
    res.json({ message: "Welcome Admin Dashboard" });
  }
);

// ✅ Only Restaurant Owners
router.get(
  "/restaurant/dashboard",
  verifyToken,
  authorizeRoles("restaurant"),
  (req, res) => {
    res.json({ message: "Welcome Restaurant Dashboard" });
  }
);

export default router;