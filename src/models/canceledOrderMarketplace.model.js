import mongoose from "mongoose";

/**
 * Canceled Order Marketplace Model
 * When a restaurant cancels an order after cooking has started,
 * this creates a marketplace entry for discounted food items.
 */
const CanceledOrderMarketplaceSchema = new mongoose.Schema(
  {
    // Reference to the original order
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true, // Each order can only have one marketplace entry
    },

    // Restaurant that owns this canceled order
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },

    // Original customer (for reference, but not exposed publicly)
    originalCustomer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Item details (copied from order for quick access)
    items: [
      {
        name: { type: String, required: true },
        qty: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true, min: 0 },
        image: { type: String, default: "" },
        notes: { type: String, default: "" },
      },
    ],

    // Pricing Information
    originalPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    discountPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 20, // Default 20% discount
    },

    discountedPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    // Marketplace Status
    availability: {
      type: String,
      enum: ["available", "sold", "expired"],
      default: "available",
    },

    // Marketplace Flow Status
    // pending_discount: Just canceled, waiting for restaurant to add discount
    // discounted: Discount applied, moved to canceled dashboard (final list)
    marketplaceStatus: {
      type: String,
      enum: ["pending_discount", "discounted"],
      default: "pending_discount",
    },

    // Whether discount has been applied by restaurant
    discountApplied: {
      type: Boolean,
      default: false,
    },

    // When discount was applied
    discountAppliedAt: {
      type: Date,
      default: null,
    },

    // When the order was canceled and added to marketplace
    canceledAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    // Reason for cancellation (optional)
    cancelReason: {
      type: String,
      default: "",
    },

    // When it was marked as sold or expired
    statusUpdatedAt: {
      type: Date,
      default: null,
    },

    // Who purchased it (if sold)
    purchasedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Purchase date
    purchasedAt: {
      type: Date,
      default: null,
    },

    // Auto-expire after certain hours (default 24 hours)
    expiresAt: {
      type: Date,
      required: true,
      default: function () {
        return new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
      },
    },

    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Indexes for efficient queries
CanceledOrderMarketplaceSchema.index({ restaurant: 1, availability: 1 });
CanceledOrderMarketplaceSchema.index({ restaurant: 1, marketplaceStatus: 1 });
CanceledOrderMarketplaceSchema.index({ availability: 1, expiresAt: 1 });
CanceledOrderMarketplaceSchema.index({ discountedPrice: 1 });
CanceledOrderMarketplaceSchema.index({ canceledAt: -1 });
CanceledOrderMarketplaceSchema.index({
  marketplaceStatus: 1,
  discountApplied: 1,
});

// Virtual for checking if expired
CanceledOrderMarketplaceSchema.virtual("isExpired").get(function () {
  return this.expiresAt < new Date();
});

// Method to mark as sold
CanceledOrderMarketplaceSchema.methods.markAsSold = function (userId) {
  this.availability = "sold";
  this.purchasedBy = userId;
  this.purchasedAt = new Date();
  this.statusUpdatedAt = new Date();
  return this.save();
};

// Method to mark as expired
CanceledOrderMarketplaceSchema.methods.markAsExpired = function () {
  this.availability = "expired";
  this.statusUpdatedAt = new Date();
  return this.save();
};

// Method to update discount
CanceledOrderMarketplaceSchema.methods.updateDiscount = function (
  newDiscountPercent
) {
  this.discountPercent = newDiscountPercent;
  this.discountedPrice =
    this.originalPrice - (this.originalPrice * newDiscountPercent) / 100;
  return this.save();
};

// Method to apply discount and move to canceled dashboard
CanceledOrderMarketplaceSchema.methods.applyDiscountAndFinalize = function (
  discountPercent
) {
  this.discountPercent = discountPercent;
  this.discountedPrice =
    this.originalPrice - (this.originalPrice * discountPercent) / 100;
  this.discountApplied = true;
  this.discountAppliedAt = new Date();
  this.marketplaceStatus = "discounted";
  return this.save();
};

export default mongoose.model(
  "CanceledOrderMarketplace",
  CanceledOrderMarketplaceSchema
);
