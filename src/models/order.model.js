import mongoose from "mongoose";

const OrderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: false }, // optional if you store product catalog
  name: { type: String, required: true },
  qty: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  notes: { type: String, default: "" }
});

const OrderSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true },
    items: { type: [OrderItemSchema], required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"],
      default: "pending"
    },
    deliveryPerson: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Pricing breakdown
    subtotal: { type: Number, required: true, min: 0 },
    deliveryCharge: { type: Number, required: true, min: 0, default: 0 },
    tax: { type: Number, required: true, min: 0, default: 0 },
    serviceCharge: { type: Number, required: true, min: 0, default: 0 },
    discount: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },

    // Payment
    paymentMethod: { type: String, enum: ["cod", "khalti", "esewa", "stripe"], default: "cod" },
    paymentStatus: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" },
    paymentReference: { type: String, default: null },

    // Address & contact
    deliveryAddress: { type: String, required: true },
    contactPhone: { type: String, required: true },

    notes: { type: String, default: "" },
    estimatedTimeMins: { type: Number, default: null },

    // soft delete
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// Indexes for quick queries
OrderSchema.index({ customer: 1, status: 1, createdAt: -1 });
OrderSchema.index({ restaurant: 1, status: 1, createdAt: -1 });

export default mongoose.model("Order", OrderSchema);
