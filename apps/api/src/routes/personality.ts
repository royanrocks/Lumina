import { Router } from "express";

export const personalityRouter = Router();

const questions = [
  "I feel energized by social interaction.",
  "I prefer structured plans over spontaneous decisions.",
  "I process emotions by talking through them.",
  "I tend to reflect deeply before acting.",
  "I recover quickly from stressful situations."
];

personalityRouter.get("/questions", (_req, res) => {
  res.json({
    framework: "Big Five (lightweight MVP)",
    questions
  });
});
