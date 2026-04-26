import { Router, type Request, type Response } from "express";
import { query } from "../db/client";
import { requireAuth } from "../middleware/auth";
import { getMoodColorFromScore, hasTextUnlock } from "../services/socialService";
import { publishNudgeNotification } from "../services/notificationService";

type FriendRow = {
  id: string;
  name: string | null;
  phone: string;
  fulfillment_score: number | null;
};

type DiscoveryRow = {
  id: string;
  name: string | null;
  altruism_score: string;
};

type DiscoveryNudgeRow = {
  receiver_id: string;
};

type FriendProfileRow = {
  id: string;
  name: string | null;
  phone: string;
  fulfillment_score: number | null;
  mood_color: string | null;
  created_at: string;
};

type NotificationRow = {
  id: string;
  sender_name: string | null;
  actor_id: string;
  type: string;
  created_at: string;
  read_at: string | null;
};

export const socialRouter = Router();

socialRouter.get("/friends", requireAuth, async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userId = req.user.userId;
  const result = await query<FriendRow>(
    `
      SELECT
        f.friend_id AS id,
        u.name,
        u.phone,
        p.fulfillment_score
      FROM friend_links f
      JOIN users u ON u.id = f.friend_id
      LEFT JOIN LATERAL (
        SELECT fulfillment_score
        FROM pulse_entries
        WHERE user_id = f.friend_id
        ORDER BY created_at DESC
        LIMIT 1
      ) p ON TRUE
      WHERE f.user_id = $1
      ORDER BY u.name NULLS LAST, u.created_at DESC
    `,
    [userId]
  );

  res.json({
    friends: result.rows.map((r) => ({
      id: r.id,
      name: r.name ?? "Friend",
      phone: r.phone,
      latest_score: r.fulfillment_score === null ? null : Number(r.fulfillment_score),
      mood_color: getMoodColorFromScore(r.fulfillment_score === null ? null : Number(r.fulfillment_score))
    }))
  });
});

socialRouter.get("/friends/:friendId/profile", requireAuth, async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userId = req.user.userId;
  const friendId = req.params.friendId;
  const relation = await query<{ one: number }>(
    `SELECT 1 AS one FROM friend_links WHERE user_id = $1 AND friend_id = $2`,
    [userId, friendId]
  );
  if ((relation.rowCount ?? 0) === 0) {
    return res.status(403).json({ error: "This profile is only visible for connected friends." });
  }

  const profileResult = await query<FriendProfileRow>(
    `
      SELECT
        u.id,
        u.name,
        u.phone,
        p.fulfillment_score,
        p.mood_color,
        p.created_at
      FROM users u
      LEFT JOIN LATERAL (
        SELECT fulfillment_score, mood_color, created_at
        FROM pulse_entries
        WHERE user_id = u.id
        ORDER BY created_at DESC
        LIMIT 1
      ) p ON TRUE
      WHERE u.id = $1
      LIMIT 1
    `,
    [friendId]
  );
  if ((profileResult.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: "Friend not found." });
  }

  const row = profileResult.rows[0];
  return res.json({
    profile: {
      id: row.id,
      name: row.name ?? "Friend",
      phone: row.phone,
      latestMood: {
        score: row.fulfillment_score === null ? null : Number(row.fulfillment_score),
        color: row.mood_color ?? getMoodColorFromScore(row.fulfillment_score === null ? null : Number(row.fulfillment_score)),
        capturedAt: row.created_at ?? null
      }
    }
  });
});

socialRouter.post("/friends/add", requireAuth, async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userId = req.user.userId;
  const { phone, nickname } = req.body as { phone?: string; nickname?: string };

  if (!phone) {
    return res.status(400).json({ error: "phone is required" });
  }

  const found = await query<{ id: string }>(`SELECT id FROM users WHERE phone = $1 LIMIT 1`, [phone]);
  if (found.rowCount === 0) {
    return res.status(404).json({ error: "No user found with that phone number" });
  }

  const friendId = found.rows[0].id;
  if (friendId === userId) {
    return res.status(400).json({ error: "Cannot add yourself" });
  }

  await query(
    `
      INSERT INTO friend_links (user_id, friend_id)
      VALUES ($1, $2), ($2, $1)
      ON CONFLICT (user_id, friend_id) DO NOTHING
    `,
    [userId, friendId]
  );

  if (nickname && nickname.trim()) {
    await query(
      `
        UPDATE users
        SET name = COALESCE(NULLIF(TRIM(name), ''), $1),
            updated_at = NOW()
        WHERE id = $2
      `,
      [nickname.trim(), friendId]
    );
  }

  return res.status(201).json({ success: true, friendId });
});

socialRouter.post("/nudge", requireAuth, async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const senderId = req.user.userId;
  const { friendId } = req.body as { friendId?: string };

  if (!friendId) {
    return res.status(400).json({ error: "friendId is required" });
  }

  const relation = await query<{ one: number }>(
    `SELECT 1 AS one FROM friend_links WHERE user_id = $1 AND friend_id = $2`,
    [senderId, friendId]
  );
  if (relation.rowCount === 0) {
    return res.status(403).json({ error: "You can only nudge connected friends" });
  }

  await query(
    `
      INSERT INTO nudges (sender_id, receiver_id)
      VALUES ($1, $2)
    `,
    [senderId, friendId]
  );

  await publishNudgeNotification(senderId, friendId, "friend");
  return res.status(201).json({ message: "Nudge sent." });
});

socialRouter.get("/text-eligibility/:friendId", requireAuth, async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userId = req.user.userId;
  const friendId = req.params.friendId;

  const unlocked = await hasTextUnlock(userId, friendId);
  return res.json({
    userId,
    friendId,
    requiredDays: 100,
    unlocked
  });
});

socialRouter.get("/discovery", async (_req, res) => {
  const result = await query<DiscoveryRow>(
    `
      SELECT
        u.id,
        u.name,
        COUNT(n.id)::text AS altruism_score
      FROM users u
      LEFT JOIN nudges n ON n.sender_id = u.id
      GROUP BY u.id
      ORDER BY COUNT(n.id) DESC, u.created_at DESC
      LIMIT 100
    `
  );

  const mood = await query<{ user_id: string; fulfillment_score: number }>(
    `
      SELECT DISTINCT ON (user_id) user_id, fulfillment_score
      FROM pulse_entries
      ORDER BY user_id, created_at DESC
    `
  );
  const moodMap = new Map<string, number>(mood.rows.map((row) => [row.user_id, Number(row.fulfillment_score)]));

  return res.json({
    discovery: result.rows.map((r) => ({
      id: r.id,
      name: r.name ?? "Anonymous",
      mood_color: getMoodColorFromScore(moodMap.get(r.id) ?? null),
      altruism_score: Number(r.altruism_score)
    }))
  });
});

socialRouter.post("/discovery/nudge", requireAuth, async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const senderId = req.user.userId;
  const { receiverId } = req.body as { receiverId?: string };
  if (!receiverId) {
    return res.status(400).json({ error: "receiverId is required" });
  }
  if (receiverId === senderId) {
    return res.status(400).json({ error: "You cannot thumbs-up yourself." });
  }

  const todayResult = await query<DiscoveryNudgeRow>(
    `
      SELECT receiver_id
      FROM nudges
      WHERE sender_id = $1
        AND receiver_id = $2
        AND DATE(created_at) = CURRENT_DATE
      LIMIT 1
    `,
    [senderId, receiverId]
  );
  if ((todayResult.rowCount ?? 0) > 0) {
    return res.status(409).json({ error: "You already gave this person a thumbs-up today." });
  }

  await query(
    `
      INSERT INTO nudges (sender_id, receiver_id)
      VALUES ($1, $2)
    `,
    [senderId, receiverId]
  );
  await publishNudgeNotification(senderId, receiverId, "discovery");
  return res.status(201).json({ message: "Daily thumbs-up sent." });
});

socialRouter.get("/notifications", requireAuth, async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userId = req.user.userId;
  const result = await query<NotificationRow>(
    `
      SELECT
        n.id,
        COALESCE(n.sender_id, n.actor_id) AS actor_id,
        COALESCE(n.type, n.kind, 'friend') AS type,
        n.created_at,
        n.read_at,
        u.name AS sender_name
      FROM notifications n
      LEFT JOIN users u ON u.id = COALESCE(n.sender_id, n.actor_id)
      WHERE COALESCE(n.receiver_id, n.user_id) = $1
      ORDER BY n.created_at DESC
      LIMIT 50
    `,
    [userId]
  );

  return res.json({
    notifications: result.rows.map((row) => ({
      id: row.id,
      senderId: row.actor_id,
      senderName: row.sender_name ?? "Someone",
      type: row.type === "discovery" ? "discovery_nudge" : row.type,
      createdAt: row.created_at,
      read: Boolean(row.read_at)
    }))
  });
});

socialRouter.post("/notifications/read-all", requireAuth, async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  await query(
    `
      UPDATE notifications
      SET read_at = NOW()
      WHERE COALESCE(receiver_id, user_id) = $1
        AND read_at IS NULL
    `,
    [req.user.userId]
  );
  return res.json({ success: true });
});

socialRouter.get("/my-mood", requireAuth, async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const result = await query<{ fulfillment_score: number; mood_color: string; created_at: string }>(
    `
      SELECT fulfillment_score, mood_color, created_at
      FROM pulse_entries
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [req.user.userId]
  );
  if ((result.rowCount ?? 0) === 0) {
    return res.json({ mood: null });
  }
  const row = result.rows[0];
  return res.json({
    mood: {
      score: Number(row.fulfillment_score),
      color: row.mood_color ?? getMoodColorFromScore(Number(row.fulfillment_score)),
      capturedAt: row.created_at
    }
  });
});
