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
} from "../controllers/marketplace.controller.js";
import { verifyToken, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public routes - Browse marketplace
router.get("/", getMarketplaceItems);
router.get("/:id", getMarketplaceItemById);

// Restaurant-only routes - Manage own items
router.get(
  "/my-items/list",
  verifyToken,
  authorizeRoles("restaurant"),
  getMyMarketplaceItems
);

// NEW: Get pending discount items (Marketplace screen)
router.get(
  "/pending/list",
  verifyToken,
  authorizeRoles("restaurant"),
  getPendingDiscountItems
);

// NEW: Get discounted items (Canceled Dashboard)
router.get(
  "/discounted/list",
  verifyToken,
  authorizeRoles("restaurant"),
  getDiscountedItems
);

router.post(
  "/",
  verifyToken,
  authorizeRoles("restaurant"),
  createMarketplaceItem
);

// NEW: Apply discount and move to Canceled Dashboard
router.post(
  "/:id/apply-discount",
  verifyToken,
  authorizeRoles("restaurant"),
  applyDiscountToMarketplaceItem
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
