import cors from "cors";
import express from "express";

import { env } from "./config/env";
import { initializeSchema } from "./db/schema";
import { authRouter } from "./routes/auth";
import { personalityRouter } from "./routes/personality";
import { profileRouter } from "./routes/profile";
import { pulseRouter } from "./routes/pulse";
import { socialRouter } from "./routes/social";
import { supportRouter } from "./routes/support";

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: "5mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "lumina-api" });
});

app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/personality", personalityRouter);
app.use("/api/pulse", pulseRouter);
app.use("/api/social", socialRouter);
app.use("/api/support", supportRouter);

const bootstrap = async () => {
  await initializeSchema();
  app.listen(env.port, () => {
    console.log(`Lumina API running on port ${env.port}`);
  });
};

bootstrap().catch((error) => {
  console.error("Failed to start API:", error);
  process.exit(1);
});
