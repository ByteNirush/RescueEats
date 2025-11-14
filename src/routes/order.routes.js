import express from "express";
import {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  assignDeliveryPerson,
  cancelOrder,
  deleteOrder,
  paymentWebhook
} from "../controllers/order.controller.js";
import { verifyToken, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public: (in some systems creation needs auth)
router.post("/", verifyToken, authorizeRoles("user"), createOrder);

// Get orders (role-based)
router.get("/", verifyToken, getOrders);

// Single order
router.get("/:id", verifyToken, getOrderById);

// Update status (restaurant/admin/delivery)
router.patch("/:id/status", verifyToken, updateOrderStatus);

// Assign delivery (admin/restaurant)
router.post("/:id/assign", verifyToken, authorizeRoles("admin", "restaurant"), assignDeliveryPerson);

// Cancel (customer/admin/restaurant)
router.post("/:id/cancel", verifyToken, cancelOrder);

// Delete (admin)
router.delete("/:id", verifyToken, authorizeRoles("admin"), deleteOrder);

// Payment webhook (no auth; provider signs requests)
router.post("/webhook/payment", paymentWebhook);

export default router;
