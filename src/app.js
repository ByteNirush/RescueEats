import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";
import passport from "passport";
import helmet from "helmet";
import connectDB from "./config/db.js";
import userRoutes from "./routes/user.routes.js";
import authRoutes from "./routes/auth.routes.js";
import orderRoutes from "./routes/order.routes.js";
import "./config/passport.js"; // import passport config
import restaurantRoutes from "./routes/restaurant.routes.js";
import gameRoutes from "./routes/game.routes.js";
import marketplaceRoutes from "./routes/marketplace.routes.js";
import { apiLimiter, authLimiter } from "./middlewares/rateLimiter.js";

dotenv.config();
connectDB();

const app = express();

// Security headers
app.use(helmet());

// CORS - Allow all origins for development
app.use(
  cors({
    origin: true, // Allow all origins (for mobile and web)
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  })
);

app.use(express.json());

// Session middleware for Passport
app.use(
  session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Apply rate limiting to all API routes
app.use("/api/", apiLimiter);

// Apply strict rate limiting to auth routes
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

// Routes
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/restaurants", restaurantRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/marketplace", marketplaceRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    message: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

export default app;
