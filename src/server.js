import http from "http";
import app from "./app.js";
import { Server as IOServer } from "socket.io";

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Create socket.io server
const io = new IOServer(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Make io available to request handlers via middleware
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Socket connection handling
io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  // Example: join rooms for user/restaurant/order subscriptions
  socket.on("joinRoom", ({ type, id }) => {
    // type: 'customer', 'restaurant', 'order', 'delivery'
    if (type && id) {
      const roomName = type === "customer" ? `customer_${id}` :
                       type === "restaurant" ? `restaurant_${id}` :
                       type === "order" ? `order_${id}` :
                       `delivery_${id}`;
      socket.join(roomName);
      console.log(`${socket.id} joined ${roomName}`);
    }
  });

  socket.on("leaveRoom", ({ type, id }) => {
    const roomName = type === "customer" ? `customer_${id}` :
                     type === "restaurant" ? `restaurant_${id}` :
                     type === "order" ? `order_${id}` :
                     `delivery_${id}`;
    socket.leave(roomName);
  });

  socket.on("disconnect", () => console.log("🔌 Socket disconnected:", socket.id));
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});