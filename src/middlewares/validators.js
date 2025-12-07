// src/middlewares/validators.js
import { body, param, query, validationResult } from "express-validator";

// Middleware to handle validation errors
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: "Validation failed",
      errors: errors.array(),
    });
  }
  next();
};

// Order validation
export const validateOrder = [
  body("restaurantId").isMongoId().withMessage("Invalid restaurant ID"),
  body("items").isArray({ min: 1 }).withMessage("At least 1 item required"),
  // body('items.*.menuId').isMongoId().withMessage('Invalid menu item ID'),
  body("items.*").custom((item) => {
    const id = item.menuId || item.menuItem;
    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
      throw new Error("Invalid menu item ID");
    }
    return true;
  }),
  body("items.*.quantity")
    .isInt({ min: 1, max: 99 })
    .withMessage("Quantity must be between 1-99"),
  body("deliveryAddress")
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage("Address must be 5-200 characters"),
  body("contactPhone")
    .matches(/^98\d{8}$/)
    .withMessage("Invalid Nepal phone number (must be 98XXXXXXXX)"),
  body("paymentMethod")
    .isIn(["cod", "esewa", "khalti"])
    .withMessage("Invalid payment method"),
  handleValidationErrors,
];

// Cancel order validation (discount is now applied in Marketplace, not here)
export const validateCancelOrder = [
  param("orderId").isMongoId().withMessage("Invalid order ID"),
  body("cancelReason")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Cancel reason too long"),
  handleValidationErrors,
];

// Apply coins validation
export const validateApplyCoins = [
  param("id").isMongoId().withMessage("Invalid order ID"),
  body("coinsToUse")
    .isInt({ min: 100 })
    .withMessage("Minimum 100 coins required"),
  handleValidationErrors,
];

// Address validation
export const validateAddress = [
  body("label")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Label must be 1-50 characters"),
  body("street")
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage("Street must be 5-200 characters"),
  body("city")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("City must be 2-50 characters"),
  body("landmark")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Landmark too long"),
  body("isDefault")
    .optional()
    .isBoolean()
    .withMessage("isDefault must be boolean"),
  handleValidationErrors,
];

// FCM token validation
export const validateFcmToken = [
  body("fcmToken")
    .trim()
    .isLength({ min: 10 })
    .withMessage("Invalid FCM token"),
  handleValidationErrors,
];

// Search/filter validation
export const validateOrderFilters = [
  query("cuisine").optional().trim().isLength({ min: 2, max: 50 }),
  query("minPrice").optional().isFloat({ min: 0 }),
  query("maxPrice").optional().isFloat({ min: 0 }),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 50 }),
  handleValidationErrors,
];

// Achievement unlock validation
export const validateAchievement = [
  body("achievementId")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Invalid achievement ID"),
  body("reward")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Reward must be positive"),
  handleValidationErrors,
];
