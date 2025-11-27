// src/controllers/user.controller.js
import User from "../models/user.model.js";
import Game from "../models/game.model.js";

/**
 * Get User Profile
 * GET /api/users/me
 */
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Also get game stats
    const game = await Game.findOne({ user: req.user.id });

    res.json({
      success: true,
      user,
      game: game || { coins: 0, xp: 0, level: 1, mealsRescued: 0 }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Update User Profile
 * PATCH /api/users/me
 */
export const updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (phone) updates.phone = phone;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * Get User Addresses
 * GET /api/users/me/addresses
 */
export const getAddresses = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('addresses');
    res.json({
      success: true,
      addresses: user.addresses || []
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Add Address
 * POST /api/users/me/addresses
 */
export const addAddress = async (req, res) => {
  try {
    const { label, street, city, landmark, latitude, longitude, isDefault } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If this is set as default, unset all other defaults
    if (isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }

    // If this is the first address, make it default
    const makeDefault = user.addresses.length === 0 || isDefault;

    user.addresses.push({
      label,
      street,
      city,
      landmark: landmark || "",
      latitude: latitude || null,
      longitude: longitude || null,
      isDefault: makeDefault
    });

    await user.save();

    res.json({
      success: true,
      addresses: user.addresses
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * Update Address
 * PUT /api/users/me/addresses/:addressId
 */
export const updateAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const { label, street, city, landmark, latitude, longitude, isDefault } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    // If setting as default, unset all others
    if (isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }

    // Update fields
    if (label !== undefined) address.label = label;
    if (street !== undefined) address.street = street;
    if (city !== undefined) address.city = city;
    if (landmark !== undefined) address.landmark = landmark;
    if (latitude !== undefined) address.latitude = latitude;
    if (longitude !== undefined) address.longitude = longitude;
    if (isDefault !== undefined) address.isDefault = isDefault;

    await user.save();

    res.json({
      success: true,
      addresses: user.addresses
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * Delete Address
 * DELETE /api/users/me/addresses/:addressId
 */
export const deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    const wasDefault = address.isDefault;
    address.remove();

    // If we deleted the default address, make the first one default
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    res.json({
      success: true,
      addresses: user.addresses
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * Register FCM Token for Push Notifications
 * POST /api/users/fcm-token
 */
export const registerFcmToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;

    await User.findByIdAndUpdate(req.user.id, { fcmToken });

    res.json({ success: true, message: 'FCM token registered' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * Get User Stats (coins, meals rescued, etc.)
 * GET /api/users/me/stats
 */
export const getUserStats = async (req, res) => {
  try {
    const game = await Game.findOne({ user: req.user.id });

    if (!game) {
      return res.json({
        success: true,
        stats: {
          coins: 0,
          xp: 0,
          level: 1,
          mealsRescued: 0,
          dailyStreak: 0,
          achievements: []
        }
      });
    }

    res.json({
      success: true,
      stats: {
        coins: game.coins,
        xp: game.xp,
        level: game.level,
        mealsRescued: game.mealsRescued,
        dailyStreak: game.dailyStreak,
        achievements: game.achievements
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
