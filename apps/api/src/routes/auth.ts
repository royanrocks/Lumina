import { Router } from "express";
import { z } from "zod";
import { requestOtp, verifyOtp } from "../services/authService";

const requestSchema = z.object({
  phone: z.string().min(8).max(20)
});

const verifySchema = z.object({
  phone: z.string().min(8).max(20),
  otp: z.string().length(6)
});

export const authRouter = Router();

authRouter.post("/request-otp", async (req, res, next) => {
  try {
    const parsed = requestSchema.parse(req.body);
    const { otp } = await requestOtp(parsed.phone);

    res.json({
      success: true,
      devOtp: otp
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/verify-otp", async (req, res, next) => {
  try {
    const parsed = verifySchema.parse(req.body);
    const result = await verifyOtp(parsed.phone, parsed.otp);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});
