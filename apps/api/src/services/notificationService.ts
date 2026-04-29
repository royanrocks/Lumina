import { env } from "../config/env";
import { query } from "../db/client";

type RedisLike = {
  publish: (channel: string, message: string) => Promise<number>;
};

let redisClient: RedisLike | null = null;

function normalizePhoneForSms(phone: string): string {
  const digits = phone.replace(/\D+/g, "");
  return digits ? `+${digits}` : "";
}

async function sendInfobipSms(toPhone: string, text: string): Promise<void> {
  if (!env.infobipUrl || !env.infobipApiKey) {
    return;
  }

  const baseUrl = env.infobipUrl.replace(/\/+$/, "");
  const endpoint = `${baseUrl}/sms/2/text/advanced`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `App ${env.infobipApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        messages: [
          {
            destinations: [{ to: toPhone }],
            text
          }
        ]
      })
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      console.error("Infobip SMS send failed:", response.status, details);
    }
  } catch (error) {
    console.error("Infobip SMS request error:", error);
  }
}

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
  const userLookup = await query<{ id: string; name: string | null; phone: string }>(
    `
      SELECT id, name, phone
      FROM users
      WHERE id IN ($1, $2)
    `,
    [senderId, receiverId]
  );
  const sender = userLookup.rows.find((row) => row.id === senderId);
  const receiver = userLookup.rows.find((row) => row.id === receiverId);
  const senderName = sender?.name?.trim() || "Someone";
  const messageText =
    type === "friend"
      ? `${senderName} gave you a thumbs-up in Lumina.`
      : `${senderName} gave you a discovery thumbs-up in Lumina.`;

  await query(
    `
      INSERT INTO notifications (user_id, actor_id, kind, message)
      VALUES ($1, $2, $3, $4)
    `,
    [receiverId, senderId, kind, messageText]
  );

  const receiverPhone = receiver ? normalizePhoneForSms(receiver.phone) : "";
  if (receiverPhone) {
    await sendInfobipSms(receiverPhone, messageText);
  }

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
