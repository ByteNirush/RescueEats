import Restaurant from "../models/restaurant.model.js";

// Create restaurant (ADMIN ONLY)
export const createRestaurant = async (req, res) => {
  try {
    const {
      owner,
      name,
      description,
      address,
      phone,
      cuisines,
      image,
      openingTime,
      closingTime
    } = req.body;

    if (!owner || !name || !address || !phone || !openingTime || !closingTime) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const restaurant = await Restaurant.create({
      owner,
      name,
      description,
      address,
      phone,
      cuisines,
      image,
      openingTime,
      closingTime
    });

    res.status(201).json({ message: "Restaurant created successfully", restaurant });
  } catch (err) {
    console.error("createRestaurant:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get all restaurants (pagination + filter)
export const getRestaurants = async (req, res) => {
  try {
    const { page = 1, limit = 20, cuisine, isOpen } = req.query;
    const skip = (page - 1) * limit;

    const filter = { isDeleted: false };

    if (cuisine) filter.cuisines = { $in: [cuisine] };
    if (isOpen !== undefined) filter.isOpen = isOpen === "true";

    const [restaurants, count] = await Promise.all([
      Restaurant.find(filter).skip(Number(skip)).limit(Number(limit)).sort({ createdAt: -1 }),
      Restaurant.countDocuments(filter)
    ]);

    res.json({
      restaurants,
      total: count,
      page: Number(page),
      pages: Math.ceil(count / limit)
    });
  } catch (err) {
    console.error("getRestaurants:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get single restaurant
export const getRestaurantById = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant || restaurant.isDeleted)
      return res.status(404).json({ message: "Restaurant not found" });

    res.json({ restaurant });
  } catch (err) {
    console.error("getRestaurantById:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Update restaurant (Owner or Admin)
export const updateRestaurant = async (req, res) => {
  try {
    const { id } = req.params;

    const restaurant = await Restaurant.findById(id);
    if (!restaurant || restaurant.isDeleted)
      return res.status(404).json({ message: "Restaurant not found" });

    // Auth: Only restaurant owner or admin
    if (req.user.role !== "admin" && restaurant.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    Object.assign(restaurant, req.body);
    await restaurant.save();

    res.json({ message: "Restaurant updated successfully", restaurant });
  } catch (err) {
    console.error("updateRestaurant:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Delete restaurant (soft delete)
export const deleteRestaurant = async (req, res) => {
  try {
    const { id } = req.params;

    const restaurant = await Restaurant.findById(id);
    if (!restaurant)
      return res.status(404).json({ message: "Restaurant not found" });

    if (req.user.role !== "admin")
      return res.status(403).json({ message: "Only admin can delete" });

    restaurant.isDeleted = true;
    await restaurant.save();

    res.json({ message: "Restaurant deleted" });
  } catch (err) {
    console.error("deleteRestaurant:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Toggle OPEN/CLOSED status
export const toggleStatus = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant || restaurant.isDeleted)
      return res.status(404).json({ message: "Restaurant not found" });

    if (req.user.role !== "admin" && restaurant.owner.toString() !== req.user.id)
      return res.status(403).json({ message: "Access denied" });

    restaurant.isOpen = !restaurant.isOpen;
    await restaurant.save();

    res.json({ message: `Restaurant is now ${restaurant.isOpen ? "OPEN" : "CLOSED"}`, restaurant });
  } catch (err) {
    console.error("toggleStatus:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Add menu item (Owner or Admin)
export const addMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, description, image } = req.body;

    const restaurant = await Restaurant.findById(id);
    if (!restaurant || restaurant.isDeleted)
      return res.status(404).json({ message: "Restaurant not found" });

    if (req.user.role !== "admin" && restaurant.owner.toString() !== req.user.id)
      return res.status(403).json({ message: "Access denied" });

    restaurant.menu.push({ name, price, description, image });
    await restaurant.save();

    res.json({ message: "Menu item added", restaurant });
  } catch (err) {
    console.error("addMenuItem:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
