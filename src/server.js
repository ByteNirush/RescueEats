import http from "http";
import app from "./app.js";
import { Server as IOServer } from "socket.io";

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Create socket.io server
const io = new IOServer(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// Make io available to request handlers via middleware
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Helper function to generate room names
const getRoomName = (type, id) => `${type}_${id}`;

// Socket connection handling
io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  socket.on("joinRoom", ({ type, id }) => {
    if (type && id) {
      const roomName = getRoomName(type, id);
      socket.join(roomName);
      console.log(`${socket.id} joined ${roomName}`);
    }
  });

  socket.on("leaveRoom", ({ type, id }) => {
    if (type && id) {
      const roomName = getRoomName(type, id);
      socket.leave(roomName);
    }
  });

  socket.on("disconnect", () =>
    console.log("🔌 Socket disconnected:", socket.id)
  );
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
