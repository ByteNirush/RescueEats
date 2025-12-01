/**
 * Migration Script: Add Delivery/Pickup Support
 *
 * This script updates existing restaurants and orders with the new
 * supportsDelivery, supportsPickup, and orderType fields.
 *
 * Run with: node migrate_delivery_pickup.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/rescueeats";

async function migrate() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const db = mongoose.connection.db;

    // Update all existing restaurants to support both delivery and pickup by default
    console.log("\n1. Updating restaurants with delivery/pickup support...");
    const restaurantResult = await db.collection("restaurants").updateMany(
      {
        $or: [
          { supportsDelivery: { $exists: false } },
          { supportsPickup: { $exists: false } },
        ],
      },
      {
        $set: {
          supportsDelivery: true,
          supportsPickup: true,
        },
      }
    );
    console.log(`   - Updated ${restaurantResult.modifiedCount} restaurants`);

    // Update all existing orders to have orderType 'delivery' by default
    console.log("\n2. Updating orders with default orderType...");
    const orderResult = await db
      .collection("orders")
      .updateMany(
        { orderType: { $exists: false } },
        { $set: { orderType: "delivery" } }
      );
    console.log(`   - Updated ${orderResult.modifiedCount} orders`);

    // Display summary
    console.log("\n=== Migration Summary ===");
    console.log(`Restaurants updated: ${restaurantResult.modifiedCount}`);
    console.log(`Orders updated: ${orderResult.modifiedCount}`);
    console.log("\n✅ Migration completed successfully!");

    await mongoose.connection.close();
    console.log("Database connection closed.");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrate();
