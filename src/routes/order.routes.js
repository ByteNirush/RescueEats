import express from "express";
import {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  assignDeliveryPerson,
  deleteOrder,
  paymentWebhook,
  getCanceledOrders,
  applyCoins,
  removeCoins,
  cancelOrder
} from "../controllers/order.controller.js";
import { verifyToken, authorizeRoles } from "../middlewares/auth.middleware.js";
import {
  validateOrder,
  validateCancelOrder,
  validateApplyCoins
} from "../middlewares/validators.js";
import { orderLimiter } from "../middlewares/rateLimiter.js";

const router = express.Router();

// Get canceled orders marketplace (public)
router.get("/canceled", getCanceledOrders);

// Create order (with validation and rate limiting)
router.post("/", verifyToken, authorizeRoles("user"), orderLimiter, validateOrder, createOrder);

// Get orders (role-based)
router.get("/", verifyToken, getOrders);

// Single order
router.get("/:id", verifyToken, getOrderById);

// Apply coins to order
router.post("/:id/apply-coins", verifyToken, authorizeRoles("user"), validateApplyCoins, applyCoins);

// Remove coins from order
router.post("/:id/remove-coins", verifyToken, authorizeRoles("user"), removeCoins);

// Update status (restaurant/admin/delivery)
router.patch("/:id/status", verifyToken, updateOrderStatus);

// Cancel order and add to marketplace (restaurant only)
router.patch("/:orderId/cancel", verifyToken, authorizeRoles("restaurant"), validateCancelOrder, cancelOrder);

// Assign delivery (admin/restaurant)
router.post("/:id/assign", verifyToken, authorizeRoles("admin", "restaurant"), assignDeliveryPerson);

// Delete (admin)
router.delete("/:id", verifyToken, authorizeRoles("admin"), deleteOrder);

// Payment webhook (no auth; provider signs requests)
router.post("/webhook/payment", paymentWebhook);

export default router;