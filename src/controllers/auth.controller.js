// src/controllers/auth.controller.js
import User from "../models/user.model.js";
import Game from "../models/game.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

/**
 * User Signup
 * POST /api/users/signup
 */
export const signup = async (req, res) => {
    try {
        const { name, email, phone, password, role } = req.body;

        // Validate required fields
        if (!name || !email || !phone || !password) {
            return res.status(400).json({
                message: "All fields are required: name, email, phone, password"
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ email }, { phone }]
        });

        if (existingUser) {
            return res.status(400).json({
                message: existingUser.email === email
                    ? "Email already registered"
                    : "Phone number already registered"
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await User.create({
            name,
            email,
            phone,
            password: hashedPassword,
            role: role || "user" // Default to "user" if not specified
        });

        // Initialize game stats for the user
        await Game.create({
            user: user._id,
            coins: 0,
            xp: 0,
            level: 1,
            mealsRescued: 0,
            dailyStreak: 0,
            achievements: []
        });

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        // Remove password from response
        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(201).json({
            success: true,
            message: "User registered successfully",
            token,
            user: userResponse
        });
    } catch (err) {
        console.error("Signup error:", err);
        res.status(500).json({ message: err.message });
    }
};

/**
 * User Login
 * POST /api/users/login
 */
export const login = async (req, res) => {
    try {
        const { emailOrPhone, password } = req.body;

        // Validate required fields
        if (!emailOrPhone || !password) {
            return res.status(400).json({
                message: "Email/Phone and password are required"
            });
        }

        // Find user by email or phone
        const user = await User.findOne({
            $or: [{ email: emailOrPhone }, { phone: emailOrPhone }]
        });

        if (!user) {
            return res.status(401).json({
                message: "Invalid credentials"
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({
                message: "Invalid credentials"
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        // Remove password from response
        const userResponse = user.toObject();
        delete userResponse.password;

        res.json({
            success: true,
            message: "Login successful",
            token,
            user: userResponse
        });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ message: err.message });
    }
};
