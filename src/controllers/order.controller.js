import Order from "../models/order.model.js";
import User from "../models/user.model.js";
import Restaurant from "../models/restaurant.model.js";
import mongoose from "mongoose";

/**
 * Helper: calculates pricing: subtotal from items, then service, tax, delivery, discount
 * Pricing rules can be moved to a config or separate pricing service.
 */
const calculatePricing = ({
  items,
  deliveryCharge = 0,
  taxRate = 0.13,
  serviceCharge = 0,
  discount = 0,
}) => {
  const subtotal = items.reduce(
    (sum, it) => sum + Number(it.price) * Number(it.qty),
    0
  );
  const tax = +(subtotal * taxRate);
  const total = +(
    subtotal +
    tax +
    Number(serviceCharge) +
    Number(deliveryCharge) -
    Number(discount)
  );
  return {
    subtotal: +subtotal.toFixed(2),
    tax: +tax.toFixed(2),
    serviceCharge: +Number(serviceCharge).toFixed(2),
    deliveryCharge: +Number(deliveryCharge).toFixed(2),
    discount: +Number(discount).toFixed(2),
    total: +Math.max(total, 0).toFixed(2),
  };
};

// Create new order (Customer)
export const createOrder = async (req, res) => {
  try {
    const {
      restaurantId,
      items,
      paymentMethod,
      deliveryAddress,
      contactPhone,
      orderType = "delivery",
    } = req.body;

    if (!restaurantId || !items || items.length === 0)
      return res
        .status(400)
        .json({ message: "Restaurant and at least 1 item required" });

    // 1) Check Restaurant Exists
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant || restaurant.isDeleted)
      return res.status(404).json({ message: "Restaurant not found" });

    // 2) Validate order type is supported by restaurant
    if (orderType === "delivery" && !restaurant.supportsDelivery)
      return res
        .status(400)
        .json({ message: "Restaurant does not support delivery" });
    if (orderType === "pickup" && !restaurant.supportsPickup)
      return res
        .status(400)
        .json({ message: "Restaurant does not support pickup" });

    // 2) Validate Items from Restaurant Menu
    const orderItems = [];

    for (const item of items) {
      const menuItem = restaurant.menu.find(
        (m) => m._id.toString() === (item.menuId || item.menuItem) // Support both
      );

      if (!menuItem) {
        return res.status(400).json({
          message: `Menu item ${
            item.menuId || item.menuItem
          } does not belong to this restaurant`,
        });
      }

      const qty = item.quantity || 1;

      orderItems.push({
        productId: menuItem._id,
        name: menuItem.name,
        price: menuItem.price,
        image: menuItem.image, // Copy image
        qty: qty,
        notes: item.notes || "",
      });
    }

    // 3) Calculate Pricing
    const pricing = calculatePricing({
      items: orderItems,
      deliveryCharge: orderType === "pickup" ? 0 : 50, // No delivery charge for pickup
      taxRate: 0.0, // No tax for now or 0.13
    });

    // 4) Create Order
    const order = await Order.create({
      customer: req.user.id, // Fixed: use 'customer' instead of 'user'
      restaurant: restaurantId,
      items: orderItems,
      orderType, // Add order type (delivery or pickup)

      // Pricing fields required by schema
      subtotal: pricing.subtotal,
      tax: pricing.tax,
      deliveryCharge: pricing.deliveryCharge,
      serviceCharge: pricing.serviceCharge,
      discount: pricing.discount,
      total: pricing.total,

      paymentMethod,
      deliveryAddress,
      contactPhone, // Required field
      status: "pending",
    });

    // Emit real-time event: new order for restaurant dashboards
    if (req.io)
      req.io.to(`restaurant_${restaurantId}`).emit("order:created", order);

    res.status(201).json({
      message: "Order created successfully",
      order,
    });
  } catch (err) {
    console.error("createOrder:", err);
    if (err.name === "ValidationError") {
      return res
        .status(400)
        .json({ message: "Validation Error", error: err.message });
    }
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get all orders with pagination and role-based filtering
export const getOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (page - 1) * limit;
    const { id: userId, role } = req.user;

    // Debug logging
    console.log("[getOrders] Request from user:", { userId, role });

    const filter = { isDeleted: false };
    if (status) filter.status = status;

    if (role === "user") {
      filter.customer = userId;
      console.log("[getOrders] Filtering orders for customer:", userId);
    } else if (role === "restaurant") {
      const restaurant = await Restaurant.findOne({ owner: userId });
      if (restaurant) {
        filter.restaurant = restaurant._id;
        console.log("[getOrders] Filtering orders for restaurant:", restaurant._id);
      } else {
        console.log("[getOrders] No restaurant found for owner:", userId);
        return res.json({
          orders: [],
          total: 0,
          page: Number(page),
          pages: 0,
        });
      }
    } else {
      console.log("[getOrders] Admin/other role - returning all orders");
    }

    console.log("[getOrders] Final filter:", JSON.stringify(filter));

    const [orders, count] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit))
        .populate("customer restaurant deliveryPerson")
        .lean(),
      Order.countDocuments(filter),
    ]);

    console.log(`[getOrders] Found ${orders.length} orders for user ${userId} (role: ${role})`);

    res.json({
      orders,
      total: count,
      page: Number(page),
      pages: Math.ceil(count / limit),
    });
  } catch (err) {
    console.error("getOrders:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get single order
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid order id" });

    const order = await Order.findById(id).populate(
      "customer restaurant deliveryPerson"
    );
    if (!order || order.isDeleted)
      return res.status(404).json({ message: "Order not found" });

    // Authorization: customer can see own, restaurant can see their orders, admin can see all
    if (
      req.user.role === "user" &&
      order.customer._id.toString() !== req.user.id
    )
      return res.status(403).json({ message: "Access denied" });
    if (
      req.user.role === "restaurant" &&
      order.restaurant._id.toString() !== req.user.id
    )
      return res.status(403).json({ message: "Access denied" });

    res.json({ order });
  } catch (err) {
    console.error("getOrderById:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Update order status (restaurant, delivery person, admin)
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, estimatedTimeMins } = req.body;
    const allowedStatuses = [
      "pending",
      "accepted",
      "preparing",
      "ready",
      "out_for_delivery",
      "delivered",
      "cancelled",
    ];
    if (!allowedStatuses.includes(status))
      return res.status(400).json({ message: "Invalid status" });

    const order = await Order.findById(id);
    if (!order || order.isDeleted)
      return res.status(404).json({ message: "Order not found" });

    // Authorization:
    // - restaurant user can move order from pending->accepted->preparing->ready
    // - delivery person can set out_for_delivery -> delivered
    // - admin can do any
    const role = req.user.role;
    const userId = req.user.id;

    if (role === "restaurant") {
      if (order.restaurant.toString() !== userId)
        return res.status(403).json({ message: "Access denied" });
      const allowed = ["accepted", "preparing", "ready", "cancelled"];
      if (!allowed.includes(status))
        return res
          .status(403)
          .json({ message: "Restaurant cannot set that status" });
    } else if (role === "user") {
      if (status === "cancelled") {
        if (order.customer.toString() !== userId)
          return res.status(403).json({ message: "Access denied" });
        if (!["pending", "accepted"].includes(order.status))
          return res
            .status(400)
            .json({ message: "Cannot cancel at this stage" });
      } else {
        return res
          .status(403)
          .json({ message: "Customers cannot change this status" });
      }
    }

    order.status = status;
    if (typeof estimatedTimeMins !== "undefined")
      order.estimatedTimeMins = estimatedTimeMins;

    await order.save();

    // Emit event
    if (req.io) {
      req.io.to(`order_${order._id}`).emit("order:status_updated", {
        orderId: order._id,
        status: order.status,
      });
      req.io.to(`customer_${order.customer}`).emit("order:status_updated", {
        orderId: order._id,
        status: order.status,
      });
      req.io.to(`restaurant_${order.restaurant}`).emit("order:status_updated", {
        orderId: order._id,
        status: order.status,
      });
    }

    res.json({ message: "Order status updated", order });
  } catch (err) {
    console.error("updateOrderStatus:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Assign delivery person (restaurant or admin)
export const assignDeliveryPerson = async (req, res) => {
  try {
    const { id } = req.params;
    const { deliveryPersonId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(deliveryPersonId))
      return res.status(400).json({ message: "Invalid delivery person id" });

    const order = await Order.findById(id);
    if (!order || order.isDeleted)
      return res.status(404).json({ message: "Order not found" });

    // Only admin or restaurant owner can assign
    if (
      req.user.role === "restaurant" &&
      order.restaurant.toString() !== req.user.id
    )
      return res.status(403).json({ message: "Access denied" });

    const user = await User.findById(deliveryPersonId);
    if (!user)
      return res.status(404).json({ message: "Delivery person not found" });

    order.deliveryPerson = user._id;
    await order.save();

    if (req.io) {
      req.io
        .to(`delivery_${user._id}`)
        .emit("order:assigned", { orderId: order._id, order });
      req.io
        .to(`restaurant_${order.restaurant}`)
        .emit("order:assigned", { orderId: order._id });
    }

    res.json({ message: "Delivery person assigned", order });
  } catch (err) {
    console.error("assignDeliveryPerson:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Soft delete (admin)

export const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.role !== "admin")
      return res.status(403).json({ message: "Access denied" });

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.isDeleted = true;
    await order.save();

    res.json({ message: "Order deleted" });
  } catch (err) {
    console.error("deleteOrder:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * Payment webhook / callback with coin deduction and meals rescued tracking
 * Payment providers will POST to this route notifying payment success/failure
 */
export const paymentWebhook = async (req, res) => {
  try {
    // Example payload handling (provider-specific)
    const { orderId, paymentReference, status } = req.body; // depends on provider
    if (!orderId) return res.status(400).json({ message: "Missing orderId" });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Idempotency check - don't process if already processed
    if (order.paymentReference === paymentReference) {
      return res.json({ message: "Already processed" });
    }

    if (status === "success" || status === "paid") {
      order.paymentStatus = "paid";
      order.paymentReference = paymentReference || order.paymentReference;

      // Deduct coins if used (only on successful payment)
      if (order.coinsUsed > 0) {
        const Game = mongoose.model("Game");
        await Game.findOneAndUpdate(
          { user: order.customer },
          { $inc: { coins: -order.coinsUsed } }
        );
      }

      // Increment meals rescued counter
      if (order.isCanceled) {
        const Game = mongoose.model("Game");
        await Game.findOneAndUpdate(
          { user: order.customer },
          { $inc: { mealsRescued: 1 } }
        );
      }

      await order.save();

      if (req.io) {
        req.io
          .to(`customer_${order.customer}`)
          .emit("order:payment_received", { orderId: order._id });
      }

      return res.json({ message: "Payment recorded" });
    } else {
      order.paymentStatus = "failed";
      await order.save();
      return res.json({ message: "Payment failed recorded" });
    }
  } catch (err) {
    console.error("paymentWebhook:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * Cancel Order - Restaurant marks order as canceled and sets discount
 * POST /api/orders/:orderId/cancel
 */
export const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { discountPercent, cancelReason } = req.body;
    const userId = req.user.id;

    // Find user's restaurant
    const user = await User.findById(userId);
    if (!user || !user.restaurantId) {
      return res
        .status(403)
        .json({ message: "Not authorized as restaurant owner" });
    }

    // Find order
    const order = await Order.findOne({
      _id: orderId,
      restaurant: user.restaurantId,
      status: { $in: ["pending", "accepted"] },
    });

    if (!order) {
      return res
        .status(404)
        .json({ message: "Order not found or cannot be canceled" });
    }

    // Calculate discounted price
    const originalPrice = order.total;
    const discountAmount = (originalPrice * discountPercent) / 100;
    const discountedPrice = originalPrice - discountAmount;

    // Update order
    order.isCanceled = true;
    order.status = "cancelled";
    order.originalPrice = originalPrice;
    order.discountPercent = discountPercent;
    order.discountedPrice = discountedPrice;
    order.canceledAt = new Date();
    order.cancelReason = cancelReason || "Restaurant canceled";

    await order.save();

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.emit("canceled_order:new", {
        orderId: order._id,
        restaurantId: user.restaurantId,
        discountPercent: order.discountPercent,
        discountedPrice: order.discountedPrice,
      });
    }

    res.json({ success: true, order });
  } catch (err) {
    console.error("cancelOrder:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Get Canceled Orders - Browse marketplace
 * GET /api/orders/canceled?cuisine=Italian&minPrice=100&maxPrice=500&page=1&limit=20
 */
export const getCanceledOrders = async (req, res) => {
  try {
    const { cuisine, minPrice, maxPrice, page = 1, limit = 20 } = req.query;

    const query = {
      isCanceled: true,
      status: "cancelled",
      paymentStatus: "pending", // Only show unpurchased canceled orders
    };

    // Build filter
    if (cuisine) {
      const restaurants = await Restaurant.find({
        cuisines: { $in: [cuisine] },
      }).select("_id");
      query.restaurant = { $in: restaurants.map((r) => r._id) };
    }

    if (minPrice || maxPrice) {
      query.discountedPrice = {};
      if (minPrice) query.discountedPrice.$gte = parseFloat(minPrice);
      if (maxPrice) query.discountedPrice.$lte = parseFloat(maxPrice);
    }

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("restaurant", "name image cuisines address phone")
        .populate("items")
        .sort({ canceledAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Order.countDocuments(query),
    ]);

    res.json({
      success: true,
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("getCanceledOrders:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Apply Coins to Order - Calculate coin discount
 * POST /api/orders/:id/apply-coins
 */
export const applyCoins = async (req, res) => {
  try {
    const { id } = req.params;
    const { coinsToUse } = req.body;
    const userId = req.user.id;

    // Import coin calculator
    const { calculateCoinDiscount } = await import(
      "../utils/coinCalculator.js"
    );

    const order = await Order.findById(id);
    if (!order || order.customer.toString() !== userId) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.paymentStatus !== "pending") {
      return res
        .status(400)
        .json({ message: "Cannot apply coins to paid/failed orders" });
    }

    const Game = mongoose.model("Game");
    const game = await Game.findOne({ user: userId });
    if (!game) {
      return res.status(400).json({ message: "No game profile found" });
    }

    // Calculate coin discount
    const result = calculateCoinDiscount(order.total, coinsToUse, game.coins);

    // Update order (don't deduct coins yet - wait for payment success)
    order.coinsUsed = result.coinsUsed;
    order.coinDiscount = result.coinDiscount;
    order.total = result.newTotal;
    await order.save();

    res.json({
      success: true,
      ...result,
      remainingCoins: game.coins, // Don't subtract yet
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * Remove Coins from Order
 * POST /api/orders/:id/remove-coins
 */
export const removeCoins = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const order = await Order.findById(id);
    if (!order || order.customer.toString() !== userId) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.paymentStatus !== "pending") {
      return res
        .status(400)
        .json({ message: "Cannot modify paid/failed orders" });
    }

    // Restore original total
    const originalTotal = order.total + order.coinDiscount;

    order.coinsUsed = 0;
    order.coinDiscount = 0;
    order.total = originalTotal;
    await order.save();

    res.json({
      success: true,
      order,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
