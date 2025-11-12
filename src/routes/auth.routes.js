import express from "express";
import passport from "passport";
import jwt from "jsonwebtoken";

const router = express.Router();

// 1️⃣ Start Google OAuth Login
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// 2️⃣ Google OAuth Callback
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    const user = req.user;
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Redirect back to your frontend with the token
    res.redirect(`${process.env.CLIENT_URL}/auth/success?token=${token}`);
  }
);

export default router;
