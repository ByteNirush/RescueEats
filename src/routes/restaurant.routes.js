import express from "express";
import {
  createRestaurant,
  getRestaurants,
  getRestaurantById,
  updateRestaurant,
  deleteRestaurant,
  toggleStatus,
  addMenuItem
} from "../controllers/restaurant.controller.js";

import { verifyToken, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = express.Router();

// ADMIN: create restaurant
router.post("/", verifyToken, authorizeRoles("admin"), createRestaurant);

// PUBLIC: get restaurants
router.get("/", getRestaurants);

// PUBLIC: get single restaurant
router.get("/:id", getRestaurantById);

// OWNER / ADMIN: update restaurant
router.put("/:id", verifyToken, updateRestaurant);

// OWNER / ADMIN: toggle open/close
router.patch("/:id/toggle", verifyToken, toggleStatus);

// OWNER / ADMIN: add menu item
router.post("/:id/menu", verifyToken, addMenuItem);

// ADMIN: delete restaurant
router.delete("/:id", verifyToken, authorizeRoles("admin"), deleteRestaurant);

export default router;
