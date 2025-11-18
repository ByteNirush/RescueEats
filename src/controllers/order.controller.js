import Order from "../models/order.model.js";
import User from "../models/user.model.js";
import mongoose from "mongoose";

/**
 * Helper: calculates pricing: subtotal from items, then service, tax, delivery, discount
 * Pricing rules can be moved to a config or separate pricing service.
 */
const calculatePricing = ({ items, deliveryCharge = 0, taxRate = 0.13, serviceCharge = 0, discount = 0 }) => {
  const subtotal = items.reduce((sum, it) => sum + Number(it.price) * Number(it.qty), 0);
  const tax = +(subtotal * taxRate);
  const total = +(subtotal + tax + Number(serviceCharge) + Number(deliveryCharge) - Number(discount));
  return {
    subtotal: +subtotal.toFixed(2),
    tax: +tax.toFixed(2),
    serviceCharge: +Number(serviceCharge).toFixed(2),
    deliveryCharge: +Number(deliveryCharge).toFixed(2),
    discount: +Number(discount).toFixed(2),
    total: +Math.max(total, 0).toFixed(2)
  };
};

// Create new order (Customer)
export const createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      restaurant,
      items,
      paymentMethod = "cod",
      deliveryAddress,
      contactPhone,
      deliveryCharge = 0,
      taxRate = 0.13,
      serviceCharge = 0,
      discount = 0,
      notes = ""
    } = req.body;

    if (!restaurant || !Array.isArray(items) || items.length === 0 || !deliveryAddress || !contactPhone) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Basic items validation
    for (const it of items) {
      if (!it.name || !it.qty || !it.price) {
        return res.status(400).json({ message: "Each item must include name, qty and price" });
      }
    }

    const pricing = calculatePricing({ items, deliveryCharge, taxRate, serviceCharge, discount });

    const order = await Order.create({
      customer: userId,
      restaurant,
      items,
      deliveryAddress,
      contactPhone,
      paymentMethod,
      subtotal: pricing.subtotal,
      deliveryCharge: pricing.deliveryCharge,
      tax: pricing.tax,
      serviceCharge: pricing.serviceCharge,
      discount: pricing.discount,
      total: pricing.total,
      notes
    });

    // Emit real-time event: new order for restaurant dashboards
    if (req.io) req.io.to(`restaurant_${restaurant}`).emit("order:created", order);

    return res.status(201).json({ message: "Order created", order });
  } catch (err) {
    console.error("createOrder:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get all orders with pagination and role-based filtering
export const getOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (page - 1) * limit;
    const { id: userId, role } = req.user;

    const filter = { isDeleted: false };
    if (status) filter.status = status;

    if (role === "user") {
      filter.customer = userId;
    } else if (role === "restaurant") {
      filter.restaurant = userId; // assuming restaurant users have user._id equal to restaurant id; if restaurant is separate model, adjust
    } // admin can see all

    const [orders, count] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(Number(skip)).limit(Number(limit)).populate("customer restaurant deliveryPerson").lean(),
      Order.countDocuments(filter)
    ]);

    res.json({ orders, total: count, page: Number(page), pages: Math.ceil(count / limit) });
  } catch (err) {
    console.error("getOrders:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get single order
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid order id" });

    const order = await Order.findById(id).populate("customer restaurant deliveryPerson");
    if (!order || order.isDeleted) return res.status(404).json({ message: "Order not found" });

    // Authorization: customer can see own, restaurant can see their orders, admin can see all
    if (req.user.role === "user" && order.customer._id.toString() !== req.user.id) return res.status(403).json({ message: "Access denied" });
    if (req.user.role === "restaurant" && order.restaurant._id.toString() !== req.user.id) return res.status(403).json({ message: "Access denied" });

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
    const allowedStatuses = ["pending", "accepted", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"];
    if (!allowedStatuses.includes(status)) return res.status(400).json({ message: "Invalid status" });

    const order = await Order.findById(id);
    if (!order || order.isDeleted) return res.status(404).json({ message: "Order not found" });

    // Authorization:
    // - restaurant user can move order from pending->accepted->preparing->ready
    // - delivery person can set out_for_delivery -> delivered
    // - admin can do any
    const role = req.user.role;
    const userId = req.user.id;

    if (role === "restaurant") {
      if (order.restaurant.toString() !== userId) return res.status(403).json({ message: "Access denied" });
      const allowed = ["accepted", "preparing", "ready", "cancelled"];
      if (!allowed.includes(status)) return res.status(403).json({ message: "Restaurant cannot set that status" });
    } else if (role === "restaurant") {
      // redundant; kept for clarity
    } else if (role === "user") {
      // customers can cancel when pending
      if (status === "cancelled") {
        if (order.customer.toString() !== userId) return res.status(403).json({ message: "Access denied" });
        if (!["pending", "accepted"].includes(order.status)) return res.status(400).json({ message: "Cannot cancel at this stage" });
      } else {
        return res.status(403).json({ message: "Customers cannot change this status" });
      }
    } else if (role === "admin") {
      // allowed
    }

    order.status = status;
    if (typeof estimatedTimeMins !== "undefined") order.estimatedTimeMins = estimatedTimeMins;

    await order.save();

    // Emit event
    if (req.io) {
      req.io.to(`order_${order._id}`).emit("order:status_updated", { orderId: order._id, status: order.status });
      req.io.to(`customer_${order.customer}`).emit("order:status_updated", { orderId: order._id, status: order.status });
      req.io.to(`restaurant_${order.restaurant}`).emit("order:status_updated", { orderId: order._id, status: order.status });
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

    if (!mongoose.Types.ObjectId.isValid(deliveryPersonId)) return res.status(400).json({ message: "Invalid delivery person id" });

    const order = await Order.findById(id);
    if (!order || order.isDeleted) return res.status(404).json({ message: "Order not found" });

    // Only admin or restaurant owner can assign
    if (req.user.role === "restaurant" && order.restaurant.toString() !== req.user.id) return res.status(403).json({ message: "Access denied" });

    const user = await User.findById(deliveryPersonId);
    if (!user) return res.status(404).json({ message: "Delivery person not found" });

    order.deliveryPerson = user._id;
    await order.save();

    if (req.io) {
      req.io.to(`delivery_${user._id}`).emit("order:assigned", { orderId: order._id, order });
      req.io.to(`restaurant_${order.restaurant}`).emit("order:assigned", { orderId: order._id });
    }

    res.json({ message: "Delivery person assigned", order });
  } catch (err) {
    console.error("assignDeliveryPerson:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Cancel order (customer or admin)
export const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order || order.isDeleted) return res.status(404).json({ message: "Order not found" });

    // Only customer (if pending/accepted) or admin/restaurant (business rules) can cancel
    if (req.user.role === "user") {
      if (order.customer.toString() !== req.user.id) return res.status(403).json({ message: "Access denied" });
      if (!["pending", "accepted"].includes(order.status)) return res.status(400).json({ message: "Cannot cancel at this stage" });
      order.status = "cancelled";
    } else if (req.user.role === "restaurant") {
      if (order.restaurant.toString() !== req.user.id) return res.status(403).json({ message: "Access denied" });
      order.status = "cancelled";
    } else if (req.user.role === "admin") {
      order.status = "cancelled";
    }

    await order.save();

    if (req.io) {
      req.io.to(`customer_${order.customer}`).emit("order:cancelled", { orderId: order._id });
      req.io.to(`restaurant_${order.restaurant}`).emit("order:cancelled", { orderId: order._id });
    }

    // TODO: handle refunds if paymentStatus === "paid"
    res.json({ message: "Order cancelled", order });
  } catch (err) {
    console.error("cancelOrder:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Soft delete (admin)
export const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.role !== "admin") return res.status(403).json({ message: "Access denied" });

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
 * Payment webhook / callback placeholder
 * Payment providers will POST to this route notifying payment success/failure
 */
export const paymentWebhook = async (req, res) => {
  try {
    // Example payload handling (provider-specific)
    const { orderId, paymentReference, status } = req.body; // depends on provider
    if (!orderId) return res.status(400).json({ message: "Missing orderId" });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (status === "success" || status === "paid") {
      order.paymentStatus = "paid";
      order.paymentReference = paymentReference || order.paymentReference;
      await order.save();

      if (req.io) {
        req.io.to(`customer_${order.customer}`).emit("order:payment_received", { orderId: order._id });
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