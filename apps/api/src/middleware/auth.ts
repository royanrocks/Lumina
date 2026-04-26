import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const header = req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  const token = header.replace("Bearer ", "");
  try {
    const payload = jwt.verify(token, env.jwtSecret) as { userId: string };
    req.user = { userId: payload.userId };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};
