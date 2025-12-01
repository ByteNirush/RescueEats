import express from "express";
import {
  createMarketplaceItem,
  getMarketplaceItems,
  getMarketplaceItemById,
  updateMarketplaceItem,
  deleteMarketplaceItem,
  getMyMarketplaceItems,
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

router.post(
  "/",
  verifyToken,
  authorizeRoles("restaurant"),
  createMarketplaceItem
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
