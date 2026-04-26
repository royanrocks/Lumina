import { Router } from "express";
import { z } from "zod";
import { signInWithPhone } from "../services/authService";

const signInSchema = z.object({
  phone: z.string().min(8).max(20),
  name: z.string().min(1).max(120).optional()
});

export const authRouter = Router();

authRouter.post("/phone-signin", async (req, res, next) => {
  try {
    const parsed = signInSchema.parse(req.body);
    const result = await signInWithPhone(parsed.phone);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});
