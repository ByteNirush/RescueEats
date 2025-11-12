import express from "express";
import { signup, login, refreshToken } from "../controllers/user.controller.js";
import { verifyToken, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/refresh-token", refreshToken);

// ✅ Protected Routes
router.get("/profile", verifyToken, (req, res) => {
  res.json({ message: "Profile accessed", user: req.user });
});

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
