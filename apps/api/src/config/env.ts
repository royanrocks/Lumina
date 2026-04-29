import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 8080),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  openAiApiKey: process.env.OPENAI_API_KEY,
  redisUrl: process.env.REDIS_URL,
  redisToken: process.env.REDIS_TOKEN,
  infobipUrl: process.env.INFOBIP_URL,
  infobipApiKey: process.env.INFOBIP_API_KEY
};
