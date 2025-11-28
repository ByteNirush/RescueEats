import mongoose from "mongoose";

const AddressSchema = new mongoose.Schema({
  label: { type: String, required: true }, // "Home", "Office", etc.
  street: { type: String, required: true },
  city: { type: String, required: true },
  landmark: { type: String, default: "" },
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
  isDefault: { type: Boolean, default: false }
}, { _id: true });

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["user", "restaurant", "admin", "delivery"],
      default: "user"
    },

    // Address Management
    addresses: { type: [AddressSchema], default: [] },

    // Push Notifications
    fcmToken: { type: String, default: null },

    // Restaurant-specific (if role === "restaurant")
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", default: null }
  },
  { timestamps: true }
);

// Indexes
// Note: email and phone already have unique: true, which creates indexes automatically
userSchema.index({ role: 1 });

export default mongoose.model("User", userSchema);
