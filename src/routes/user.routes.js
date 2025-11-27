// src/routes/user.routes.js
import express from "express";
import {
  getProfile,
  updateProfile,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  registerFcmToken,
  getUserStats
} from "../controllers/user.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { validateAddress, validateFcmToken } from "../middlewares/validators.js";

const router = express.Router();

// Profile
router.get("/me", verifyToken, getProfile);
router.patch("/me", verifyToken, updateProfile);

// Addresses
router.get("/me/addresses", verifyToken, getAddresses);
router.post("/me/addresses", verifyToken, validateAddress, addAddress);
router.put("/me/addresses/:addressId", verifyToken, validateAddress, updateAddress);
router.delete("/me/addresses/:addressId", verifyToken, deleteAddress);

// FCM Token
router.post("/fcm-token", verifyToken, validateFcmToken, registerFcmToken);

// Stats
router.get("/me/stats", verifyToken, getUserStats);

export default router;