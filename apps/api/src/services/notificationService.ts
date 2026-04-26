import { env } from "../config/env";
import { query } from "../db/client";

type RedisLike = {
  publish: (channel: string, message: string) => Promise<number>;
};

let redisClient: RedisLike | null = null;

async function getRedisClient(): Promise<RedisLike | null> {
  if (!env.redisUrl) {
    return null;
  }
  if (redisClient) {
    return redisClient;
  }
  try {
    const redisModule = await import("redis");
    const client = redisModule.createClient({ url: env.redisUrl });
    client.on("error", () => {
      // Keep API resilient if Redis has transient errors.
    });
    await client.connect();
    redisClient = client;
    return redisClient;
  } catch {
    return null;
  }
}

export async function publishNudgeNotification(
  senderId: string,
  receiverId: string,
  type: "friend" | "discovery"
) {
  const kind = type === "friend" ? "friend_nudge" : "discovery_nudge";
  await query(
    `
      INSERT INTO notifications (user_id, actor_id, kind, message)
      VALUES ($1, $2, $3, $4)
    `,
    [receiverId, senderId, kind, type === "friend" ? "A friend sent you a thumbs-up." : "You received a discovery thumbs-up."]
  );

  const eventPayload = {
    receiverId,
    senderId,
    type,
    createdAt: new Date().toISOString()
  };
  const client = await getRedisClient();
  if (!client) {
    return;
  }
  await client.publish(`lumina:notifications:${receiverId}`, JSON.stringify(eventPayload));
}
