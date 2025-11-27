import Restaurant from "../models/restaurant.model.js";

export const createRestaurant = async (req, res) => {
  try {
    const {
      name,
      description,
      address,
      phone,
      cuisines,
      image,
      openingTime,
      closingTime,
    } = req.body;


    if (!name || !address || !phone || !openingTime || !closingTime) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const ownerId = req.user.id;

    if (req.user.role === "restaurant") {
      const existingRestaurant = await Restaurant.findOne({
        owner: ownerId,
        isDeleted: false,
      });

      if (existingRestaurant) {
        return res.status(400).json({
          message: "You already own a restaurant. Only one restaurant per owner is allowed.",
        });
      }
    }


    const restaurant = await Restaurant.create({
      owner: ownerId,
      name,
      description,
      address,
      phone,
      cuisines,
      image,
      openingTime,
      closingTime,
    });

    res
      .status(201)
      .json({ message: "Restaurant created successfully", restaurant });
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
      Restaurant.find(filter)
        .skip(Number(skip))
        .limit(Number(limit))
        .sort({ createdAt: -1 }),
      Restaurant.countDocuments(filter),
    ]);


    res.json({
      restaurants,
      total: count,
      page: Number(page),
      pages: Math.ceil(count / limit),
    });
  } catch (err) {
    console.error("getRestaurants:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


// Get single restaurant
export const getRestaurantById = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id).populate(
      "owner",
      "name email phone"
    );
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
    if (
      req.user.role !== "admin" &&
      restaurant.owner.toString() !== req.user.id
    ) {
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


    if (
      req.user.role !== "admin" &&
      restaurant.owner.toString() !== req.user.id
    )
      return res.status(403).json({ message: "Access denied" });


    restaurant.isOpen = !restaurant.isOpen;
    await restaurant.save();


    res.json({
      message: `Restaurant is now ${restaurant.isOpen ? "OPEN" : "CLOSED"}`,
      restaurant,
    });
  } catch (err) {
    console.error("toggleStatus:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


// Get restaurant menu (Public)
export const getRestaurantMenu = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant || restaurant.isDeleted)
      return res.status(404).json({ message: "Restaurant not found" });


    res.json({
      restaurantId: restaurant._id,
      name: restaurant.name,
      menu: restaurant.menu,
    });
  } catch (err) {
    console.error("getRestaurantMenu:", err);
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


    if (
      req.user.role !== "admin" &&
      restaurant.owner.toString() !== req.user.id
    )
      return res.status(403).json({ message: "Access denied" });


    restaurant.menu.push({ name, price, description, image });
    await restaurant.save();


    res.json({ message: "Menu item added", restaurant });
  } catch (err) {
    console.error("addMenuItem:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


// Update menu item (Owner or Admin)
export const updateMenuItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { name, price, description, image, isAvailable, isVeg } = req.body;


    const restaurant = await Restaurant.findById(id);
    if (!restaurant || restaurant.isDeleted)
      return res.status(404).json({ message: "Restaurant not found" });


    if (
      req.user.role !== "admin" &&
      restaurant.owner.toString() !== req.user.id
    )
      return res.status(403).json({ message: "Access denied" });


    const menuItem = restaurant.menu.id(itemId);
    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }


    if (name) menuItem.name = name;
    if (price) menuItem.price = price;
    if (description) menuItem.description = description;
    if (image) menuItem.image = image;
    if (isAvailable !== undefined) menuItem.isAvailable = isAvailable;
    if (isVeg !== undefined) menuItem.isVeg = isVeg;


    await restaurant.save();


    res.json({ message: "Menu item updated", restaurant });
  } catch (err) {
    console.error("updateMenuItem:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


// Delete menu item (Owner or Admin)
export const deleteMenuItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;


    const restaurant = await Restaurant.findById(id);
    if (!restaurant || restaurant.isDeleted)
      return res.status(404).json({ message: "Restaurant not found" });


    if (
      req.user.role !== "admin" &&
      restaurant.owner.toString() !== req.user.id
    )
      return res.status(403).json({ message: "Access denied" });


    const menuItem = restaurant.menu.id(itemId);
    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }


    menuItem.deleteOne();
    await restaurant.save();


    res.json({ message: "Menu item deleted", restaurant });
  } catch (err) {
    console.error("deleteMenuItem:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


// Get restaurants owned by current user (Restaurant Owner)
export const getMyRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find({
      owner: req.user.id,
      isDeleted: false,
    }).sort({ createdAt: -1 });


    res.json({
      restaurants,
      count: restaurants.length,
    });
  } catch (err) {
    console.error("getMyRestaurants:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


// Assign owner to restaurant (ADMIN ONLY)
export const assignOwner = async (req, res) => {
  try {
    const { id } = req.params;
    const { ownerId } = req.body;


    if (!ownerId) {
      return res.status(400).json({ message: "Owner ID is required" });
    }


    const restaurant = await Restaurant.findById(id);
    if (!restaurant || restaurant.isDeleted) {
      return res.status(404).json({ message: "Restaurant not found" });
    }


    // Update owner
    restaurant.owner = ownerId;
    await restaurant.save();


    // Populate owner details for response
    await restaurant.populate("owner", "name email phone");


    res.json({
      message: "Owner assigned successfully",
      restaurant,
    });
  } catch (err) {
    console.error("assignOwner:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};



