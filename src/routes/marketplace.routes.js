import express from "express";
import {
  createMarketplaceItem,
  getMarketplaceItems,
  getMarketplaceItemById,
  updateMarketplaceItem,
  deleteMarketplaceItem,
  getMyMarketplaceItems,
  applyDiscountToMarketplaceItem,
  getPendingDiscountItems,
  getDiscountedItems,
  getUserCanceledOrders,
  purchaseMarketplaceItem,
} from "../controllers/marketplace.controller.js";
import { verifyToken, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public routes - Browse marketplace (must be first)
router.get("/", getMarketplaceItems);

// Restaurant-only routes - Specific paths BEFORE /:id to avoid conflicts
router.get(
  "/my-items/list",
  verifyToken,
  authorizeRoles("restaurant"),
  getMyMarketplaceItems
);

// Get pending discount items (Marketplace screen)
router.get(
  "/pending/list",
  verifyToken,
  authorizeRoles("restaurant"),
  getPendingDiscountItems
);

// Get discounted items (Canceled Dashboard)
router.get(
  "/discounted/list",
  verifyToken,
  authorizeRoles("restaurant"),
  getDiscountedItems
);

// Get user's canceled orders (Customer cancellation screen)
router.get(
  "/my-cancellations",
  verifyToken,
  authorizeRoles("user"),
  getUserCanceledOrders
);

// Single item by ID - MUST come after specific paths
router.get("/:id", getMarketplaceItemById);

router.post(
  "/",
  verifyToken,
  authorizeRoles("restaurant"),
  createMarketplaceItem
);

// Apply discount and move to Canceled Dashboard
router.post(
  "/:id/apply-discount",
  verifyToken,
  authorizeRoles("restaurant"),
  applyDiscountToMarketplaceItem
);

// Purchase marketplace item (User only)
router.post(
  "/:id/purchase",
  verifyToken,
  authorizeRoles("user"),
  purchaseMarketplaceItem
);

router.patch(
  "/:id",
  verifyToken,
  authorizeRoles("restaurant"),
  updateMarketplaceItem
);

router.delete(
  "/:id",
  verifyToken,
  authorizeRoles("restaurant"),
  deleteMarketplaceItem
);

export default router;
