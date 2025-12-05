import express from "express";
import {
  createRestaurant,
  getRestaurants,
  getRestaurantById,
  updateRestaurant,
  deleteRestaurant,
  toggleStatus,
  addMenuItem,
  getRestaurantMenu,
  getMyRestaurants,
  assignOwner,
  getRestaurantRatings,
  getMenuItemRatings,
} from "../controllers/restaurant.controller.js";

import { verifyToken, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = express.Router();

// OWNER or ADMIN: create restaurant
router.post(
  "/",
  verifyToken,
  authorizeRoles("restaurant", "admin"),
  createRestaurant
);

// PUBLIC: get restaurants
router.get("/", getRestaurants);

// OWNER: get my restaurants (must be before /:id to avoid conflict)
router.get(
  "/my-restaurants",
  verifyToken,
  authorizeRoles("restaurant", "admin"),
  getMyRestaurants
);

// PUBLIC: get single restaurant
router.get("/:id", getRestaurantById);

// OWNER / ADMIN: update restaurant
router.put("/:id", verifyToken, updateRestaurant);

// ADMIN: assign owner to restaurant
router.post(
  "/:id/assign-owner",
  verifyToken,
  authorizeRoles("admin"),
  assignOwner
);

// OWNER / ADMIN: toggle open/close
router.patch("/:id/toggle", verifyToken, toggleStatus);

// PUBLIC: get restaurant menu
router.get("/:id/menu", getRestaurantMenu);

// OWNER / ADMIN: add menu item
router.post("/:id/menu", verifyToken, addMenuItem);

// PUBLIC: get restaurant ratings
router.get("/:id/ratings", getRestaurantRatings);

// PUBLIC: get menu item ratings
router.get("/:id/menu/:itemId/ratings", getMenuItemRatings);

// ADMIN: delete restaurant
router.delete("/:id", verifyToken, authorizeRoles("admin"), deleteRestaurant);

export default router;
