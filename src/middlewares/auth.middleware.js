import jwt from "jsonwebtoken";
import { isBlacklisted } from "../utils/tokenBlacklist.js";

export const verifyToken = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "Access denied" });

  if (isBlacklisted(token))
    return res
      .status(401)
      .json({ message: "Token has been revoked. Please log in again." });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

// Role-based access
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: `Access denied: ${req.user.role} not authorized` });
    }
    next();
  };
};
