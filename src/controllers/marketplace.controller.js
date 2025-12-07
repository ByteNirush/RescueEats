import CanceledOrderMarketplace from "../models/canceledOrderMarketplace.model.js";
import Order from "../models/order.model.js";
import Restaurant from "../models/restaurant.model.js";
import mongoose from "mongoose";

/**
 * CANCELED FOOD ORDERS MARKETPLACE CONTROLLER
 *
 * This feature allows restaurants to automatically list canceled orders in a marketplace
 * when they cancel after cooking has started (accepted/preparing status).
 *
 * CRUD OPERATIONS:
 *
 * CREATE:
 *   POST /api/marketplace
 *   Body: { orderId, discountPercent, cancelReason }
 *   Auth: Restaurant only
 *
 * READ:
 *   GET /api/marketplace (public - browse all available items)
 *   GET /api/marketplace/:id (public - single item details)
 *   GET /api/marketplace/my-items/list (restaurant - own items)
 *
 * UPDATE:
 *   PATCH /api/marketplace/:id
 *   Body: { discountPercent?, availability?, expiresAt? }
 *   Auth: Restaurant only (must own item)
 *
 * DELETE:
 *   DELETE /api/marketplace/:id
 *   Auth: Restaurant only (must own item)
 *
 * AUTOMATIC MARKETPLACE CREATION:
 *   When a restaurant cancels an order via PATCH /api/orders/:orderId/cancel,
 *   the order is automatically added to the marketplace if it's in accepted/preparing status.
 *
 * TESTING:
 *   1. Create order as customer
 *   2. Accept/prepare order as restaurant
 *   3. Cancel order with discount via PATCH /api/orders/:orderId/cancel
 *   4. Verify marketplace entry created automatically
 *   5. Test CRUD operations on marketplace items
 */

/**
 * CREATE - Add a canceled order to the marketplace
 * POST /api/marketplace
 * Authenticated: Restaurant only
 */
export const createMarketplaceItem = async (req, res) => {
  try {
    const { orderId, discountPercent, cancelReason } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!orderId || discountPercent === undefined) {
      return res.status(400).json({
        message: "Order ID and discount percent are required",
      });
    }

    if (discountPercent < 0 || discountPercent > 100) {
      return res.status(400).json({
        message: "Discount percent must be between 0 and 100",
      });
    }

    // Find restaurant owned by this user
    const restaurant = await Restaurant.findOne({ owner: userId });
    if (!restaurant) {
      return res.status(403).json({
        message: "Not authorized as restaurant owner",
      });
    }

    // Find the order
    const order = await Order.findOne({
      _id: orderId,
      restaurant: restaurant._id,
    });

    if (!order) {
      return res.status(404).json({
        message: "Order not found or does not belong to your restaurant",
      });
    }

    // Check if order can be canceled
    // Only allow cancellation if order is in preparing/accepted state (food being cooked)
    if (!["accepted", "preparing"].includes(order.status)) {
      return res.status(400).json({
        message: "Order cannot be canceled at this stage",
      });
    }

    // Check if marketplace entry already exists
    const existingEntry = await CanceledOrderMarketplace.findOne({
      order: orderId,
    });

    if (existingEntry && !existingEntry.isDeleted) {
      return res.status(400).json({
        message: "This order is already in the marketplace",
      });
    }

    // Calculate discounted price
    const originalPrice = order.total;
    const discountAmount = (originalPrice * discountPercent) / 100;
    const discountedPrice = +(originalPrice - discountAmount).toFixed(2);

    // Update the order status
    order.status = "cancelled";
    order.isCanceled = true;
    order.canceledAt = new Date();
    order.cancelReason = cancelReason || "Restaurant canceled - food available";
    order.originalPrice = originalPrice;
    order.discountPercent = discountPercent;
    order.discountedPrice = discountedPrice;
    await order.save();

    // Create marketplace entry
    const marketplaceItem = await CanceledOrderMarketplace.create({
      order: order._id,
      restaurant: restaurant._id,
      originalCustomer: order.customer,
      items: order.items,
      originalPrice,
      discountPercent,
      discountedPrice,
      canceledAt: new Date(),
      cancelReason: cancelReason || "",
      availability: "available",
    });

    // Populate for response
    await marketplaceItem.populate("restaurant", "name image address phone");

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.emit("marketplace:new_item", {
        itemId: marketplaceItem._id,
        restaurantId: restaurant._id,
        discountPercent,
        discountedPrice,
      });
    }

    res.status(201).json({
      success: true,
      message: "Order added to marketplace successfully",
      marketplaceItem,
    });
  } catch (err) {
    console.error("createMarketplaceItem:", err);
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

/**
 * READ - Get all marketplace items (with filters)
 * GET /api/marketplace
 * Public access
 */
export const getMarketplaceItems = async (req, res) => {
  try {
    const {
      cuisine,
      minPrice,
      maxPrice,
      restaurantId,
      availability = "available",
      page = 1,
      limit = 20,
    } = req.query;

    const query = {
      isDeleted: false,
      availability,
    };

    // Filter by cuisine (need to join with restaurant)
    if (cuisine) {
      const restaurants = await Restaurant.find({
        cuisines: { $in: [cuisine] },
      }).select("_id");
      query.restaurant = { $in: restaurants.map((r) => r._id) };
    }

    // Filter by specific restaurant
    if (restaurantId) {
      query.restaurant = restaurantId;
    }

    // Filter by price range
    if (minPrice || maxPrice) {
      query.discountedPrice = {};
      if (minPrice) query.discountedPrice.$gte = parseFloat(minPrice);
      if (maxPrice) query.discountedPrice.$lte = parseFloat(maxPrice);
    }

    // Only show non-expired items for available status
    if (availability === "available") {
      query.expiresAt = { $gt: new Date() };
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      CanceledOrderMarketplace.find(query)
        .populate("restaurant", "name image cuisines address phone location")
        .sort({ canceledAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      CanceledOrderMarketplace.countDocuments(query),
    ]);

    res.json({
      success: true,
      items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("getMarketplaceItems:", err);
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

/**
 * READ - Get single marketplace item by ID
 * GET /api/marketplace/:id
 * Public access
 */
export const getMarketplaceItemById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid item ID" });
    }

    const item = await CanceledOrderMarketplace.findById(id)
      .populate("restaurant", "name image cuisines address phone location")
      .populate("order", "items notes deliveryAddress");

    if (!item || item.isDeleted) {
      return res.status(404).json({ message: "Marketplace item not found" });
    }

    res.json({
      success: true,
      item,
    });
  } catch (err) {
    console.error("getMarketplaceItemById:", err);
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

/**
 * UPDATE - Update marketplace item (discount, availability, etc.)
 * PATCH /api/marketplace/:id
 * Authenticated: Restaurant only (must own the item)
 */
export const updateMarketplaceItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { discountPercent, availability, expiresAt } = req.body;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid item ID" });
    }

    // Find restaurant owned by this user
    const restaurant = await Restaurant.findOne({ owner: userId });
    if (!restaurant) {
      return res.status(403).json({
        message: "Not authorized as restaurant owner",
      });
    }

    // Find the marketplace item
    const item = await CanceledOrderMarketplace.findOne({
      _id: id,
      restaurant: restaurant._id,
      isDeleted: false,
    });

    if (!item) {
      return res.status(404).json({
        message: "Marketplace item not found or access denied",
      });
    }

    // Update discount if provided
    if (discountPercent !== undefined) {
      if (discountPercent < 0 || discountPercent > 100) {
        return res.status(400).json({
          message: "Discount percent must be between 0 and 100",
        });
      }
      await item.updateDiscount(discountPercent);
    }

    // Update availability if provided
    if (availability !== undefined) {
      const validStatuses = ["available", "sold", "expired"];
      if (!validStatuses.includes(availability)) {
        return res.status(400).json({
          message: "Invalid availability status",
        });
      }

      item.availability = availability;
      item.statusUpdatedAt = new Date();

      // If marking as expired, use the markAsExpired method
      if (availability === "expired") {
        await item.markAsExpired();
      } else {
        await item.save();
      }
    }

    // Update expiration date if provided
    if (expiresAt !== undefined) {
      const expirationDate = new Date(expiresAt);
      if (isNaN(expirationDate.getTime())) {
        return res.status(400).json({ message: "Invalid expiration date" });
      }
      item.expiresAt = expirationDate;
      await item.save();
    }

    // Populate for response
    await item.populate("restaurant", "name image address phone");

    // Emit socket event
    if (req.io) {
      req.io.emit("marketplace:item_updated", {
        itemId: item._id,
        availability: item.availability,
        discountPercent: item.discountPercent,
        discountedPrice: item.discountedPrice,
      });
    }

    res.json({
      success: true,
      message: "Marketplace item updated successfully",
      item,
    });
  } catch (err) {
    console.error("updateMarketplaceItem:", err);
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

/**
 * APPLY DISCOUNT - Apply discount to pending item and move to Canceled Dashboard
 * POST /api/marketplace/:id/apply-discount
 * Authenticated: Restaurant only (must own the item)
 *
 * This is the key endpoint for the new flow:
 * 1. Restaurant cancels order → goes to Marketplace (pending_discount)
 * 2. Restaurant adds discount here → moves to Canceled Dashboard (discounted)
 */
export const applyDiscountToMarketplaceItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { discountPercent } = req.body;
    const userId = req.user.id;

    // Validate discount percent
    if (discountPercent === undefined || discountPercent === null) {
      return res.status(400).json({
        message: "Discount percent is required",
      });
    }

    if (discountPercent < 0 || discountPercent > 100) {
      return res.status(400).json({
        message: "Discount percent must be between 0 and 100",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid item ID" });
    }

    // Find restaurant owned by this user
    const restaurant = await Restaurant.findOne({ owner: userId });
    if (!restaurant) {
      return res.status(403).json({
        message: "Not authorized as restaurant owner",
      });
    }

    // Find the marketplace item (must be in pending_discount status)
    const item = await CanceledOrderMarketplace.findOne({
      _id: id,
      restaurant: restaurant._id,
      isDeleted: false,
      marketplaceStatus: "pending_discount",
    });

    if (!item) {
      return res.status(404).json({
        message:
          "Marketplace item not found, already processed, or access denied",
      });
    }

    // Apply discount and finalize (move to canceled dashboard)
    await item.applyDiscountAndFinalize(discountPercent);

    // Also update the original order with the discount
    const Order = mongoose.model("Order");
    await Order.findByIdAndUpdate(item.order, {
      discountPercent: discountPercent,
      discountedPrice: item.discountedPrice,
    });

    // Populate for response
    await item.populate("restaurant", "name image address phone");

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.emit("marketplace:item_discounted", {
        itemId: item._id,
        restaurantId: restaurant._id,
        discountPercent: item.discountPercent,
        discountedPrice: item.discountedPrice,
        marketplaceStatus: "discounted",
      });
    }

    res.json({
      success: true,
      message:
        "Discount applied successfully. Order moved to Canceled Dashboard.",
      item,
    });
  } catch (err) {
    console.error("applyDiscountToMarketplaceItem:", err);
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

/**
 * GET - Get pending discount items (Marketplace screen)
 * GET /api/marketplace/pending
 * Authenticated: Restaurant only
 */
export const getPendingDiscountItems = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    // Find restaurant owned by this user
    const restaurant = await Restaurant.findOne({ owner: userId });
    if (!restaurant) {
      return res.status(403).json({
        message: "Not authorized as restaurant owner",
      });
    }

    const query = {
      restaurant: restaurant._id,
      isDeleted: false,
      marketplaceStatus: "pending_discount",
    };

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      CanceledOrderMarketplace.find(query)
        .populate("order", "items notes deliveryAddress contactPhone")
        .populate("originalCustomer", "name phone")
        .sort({ canceledAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      CanceledOrderMarketplace.countDocuments(query),
    ]);

    res.json({
      success: true,
      items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("getPendingDiscountItems:", err);
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

/**
 * GET - Get discounted items (Canceled Dashboard)
 * GET /api/marketplace/discounted
 * Authenticated: Restaurant only
 */
export const getDiscountedItems = async (req, res) => {
  try {
    const userId = req.user.id;
    const { availability, page = 1, limit = 20 } = req.query;

    // Find restaurant owned by this user
    const restaurant = await Restaurant.findOne({ owner: userId });
    if (!restaurant) {
      return res.status(403).json({
        message: "Not authorized as restaurant owner",
      });
    }

    const query = {
      restaurant: restaurant._id,
      isDeleted: false,
      marketplaceStatus: "discounted",
      discountApplied: true,
    };

    // Optional filter by availability (available, sold, expired)
    if (availability) {
      query.availability = availability;
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      CanceledOrderMarketplace.find(query)
        .populate("order", "items notes deliveryAddress contactPhone")
        .populate("originalCustomer", "name phone")
        .sort({ discountAppliedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      CanceledOrderMarketplace.countDocuments(query),
    ]);

    res.json({
      success: true,
      items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("getDiscountedItems:", err);
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

/**
 * DELETE - Remove marketplace item (soft delete)
 * DELETE /api/marketplace/:id
 * Authenticated: Restaurant only (must own the item)
 */
export const deleteMarketplaceItem = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid item ID" });
    }

    // Find restaurant owned by this user
    const restaurant = await Restaurant.findOne({ owner: userId });
    if (!restaurant) {
      return res.status(403).json({
        message: "Not authorized as restaurant owner",
      });
    }

    // Find the marketplace item
    const item = await CanceledOrderMarketplace.findOne({
      _id: id,
      restaurant: restaurant._id,
    });

    if (!item) {
      return res.status(404).json({
        message: "Marketplace item not found or access denied",
      });
    }

    // Soft delete
    item.isDeleted = true;
    await item.save();

    // Emit socket event
    if (req.io) {
      req.io.emit("marketplace:item_deleted", {
        itemId: item._id,
      });
    }

    res.json({
      success: true,
      message: "Marketplace item deleted successfully",
    });
  } catch (err) {
    console.error("deleteMarketplaceItem:", err);
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

/**
 * Get restaurant's own marketplace items
 * GET /api/marketplace/my-items
 * Authenticated: Restaurant only
 */
export const getMyMarketplaceItems = async (req, res) => {
  try {
    const userId = req.user.id;
    const { availability, page = 1, limit = 20 } = req.query;

    // Find restaurant owned by this user
    const restaurant = await Restaurant.findOne({ owner: userId });
    if (!restaurant) {
      return res.status(403).json({
        message: "Not authorized as restaurant owner",
      });
    }

    const query = {
      restaurant: restaurant._id,
      isDeleted: false,
    };

    if (availability) {
      query.availability = availability;
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      CanceledOrderMarketplace.find(query)
        .populate("order", "items notes deliveryAddress contactPhone")
        .populate("originalCustomer", "name email phone")
        .sort({ canceledAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      CanceledOrderMarketplace.countDocuments(query),
    ]);

    res.json({
      success: true,
      items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("getMyMarketplaceItems:", err);
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

/**
 * GET - Get user's canceled orders (for customer view)
 * GET /api/marketplace/my-cancellations
 * Authenticated: User only
 */
export const getUserCanceledOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const query = {
      originalCustomer: userId,
      isDeleted: false,
      marketplaceStatus: "discounted", // Only show orders with discount applied
      discountApplied: true,
    };

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      CanceledOrderMarketplace.find(query)
        .populate("restaurant", "name image address phone")
        .populate("order", "items notes")
        .sort({ discountAppliedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      CanceledOrderMarketplace.countDocuments(query),
    ]);

    // Transform items for user view
    const transformedItems = items.map((item) => ({
      id: item._id,
      orderId: item.order?._id,
      restaurantName: item.restaurant?.name || "Unknown Restaurant",
      restaurantImage: item.restaurant?.image || "",
      items: item.items,
      originalPrice: item.originalPrice,
      discountPercent: item.discountPercent,
      discountedPrice: item.discountedPrice,
      cancelReason: item.cancelReason,
      canceledAt: item.canceledAt,
      discountAppliedAt: item.discountAppliedAt,
      expiresAt: item.expiresAt,
      availability: item.availability,
    }));

    res.json({
      success: true,
      items: transformedItems,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("getUserCanceledOrders:", err);
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

/**
 * Background job to auto-expire old marketplace items
 * Should be called periodically (e.g., via cron job)
 */
export const autoExpireMarketplaceItems = async () => {
  try {
    const now = new Date();

    const result = await CanceledOrderMarketplace.updateMany(
      {
        availability: "available",
        expiresAt: { $lt: now },
        isDeleted: false,
      },
      {
        $set: {
          availability: "expired",
          statusUpdatedAt: now,
        },
      }
    );

    console.log(
      `[Auto-Expire] Expired ${result.modifiedCount} marketplace items`
    );
    return result;
  } catch (err) {
    console.error("autoExpireMarketplaceItems:", err);
    throw err;
  }
};
