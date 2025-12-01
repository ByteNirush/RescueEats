import mongoose from "mongoose";

const MenuItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  description: { type: String, default: "" },
  image: { type: String, default: "" },
});

const RestaurantSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // restaurant user
    name: { type: String, required: true },
    description: { type: String, default: "" },
    address: { type: String, required: true },
    phone: { type: String, required: true },

    // GeoJSON location for map support
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
    },

    cuisines: { type: [String], default: [] },
    image: { type: String, default: "" },

    openingTime: { type: String, required: true }, // "10:00 AM"
    closingTime: { type: String, required: true }, // "10:00 PM"

    isOpen: { type: Boolean, default: true },

    // Delivery and Pickup Support
    supportsDelivery: { type: Boolean, default: true },
    supportsPickup: { type: Boolean, default: true },

    menu: { type: [MenuItemSchema], default: [] },

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Create 2dsphere index for location-based queries
RestaurantSchema.index({ location: "2dsphere" });

export default mongoose.model("Restaurant", RestaurantSchema);
