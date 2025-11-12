import User from "../models/user.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// Signup Controller
export const signup = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Validation
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Validate phone format (basic check)
    if (phone.length < 10) {
      return res
        .status(400)
        .json({ message: "Phone number must be at least 10 digits" });
    }

    // Normalize email to lowercase for consistent checking
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedPhone = phone.trim();

    // Check existing user with proper case handling
    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { phone: normalizedPhone }],
    });

    if (existingUser) {
      if (existingUser.email === normalizedEmail) {
        return res.status(400).json({ message: "Email already registered" });
      }
      if (existingUser.phone === normalizedPhone) {
        return res
          .status(400)
          .json({ message: "Phone number already registered" });
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with normalized data
    const newUser = new User({
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      password: hashedPassword,
    });

    await newUser.save();

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
      },
    });
  } catch (error) {
    // Handle MongoDB duplicate key errors specifically
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        message: `${
          duplicateField.charAt(0).toUpperCase() + duplicateField.slice(1)
        } already exists`,
      });
    }

    console.error("Signup Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Login Controller
export const login = async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;

    // Validation
    if (!emailOrPhone || !password) {
      return res
        .status(400)
        .json({ message: "Email/Phone and Password are required" });
    }

    // Normalize input for consistent searching
    const normalizedInput = emailOrPhone.toLowerCase().trim();

    // Find user by email or phone with proper case handling
    const user = await User.findOne({
      $or: [
        { email: normalizedInput },
        { phone: emailOrPhone.trim() }, // Phone numbers don't need lowercase
      ],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check if JWT_SECRET exists
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "JWT configuration error" });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
