import { query } from "../db/client";

export function getMoodColorFromScore(score: number | null): string {
  if (score === null || Number.isNaN(score)) return "#EDEDED";
  if (score >= 70) return "#FFD700";
  if (score >= 45) return "#F4A261";
  return "#5DA9E9";
}

export async function hasTextUnlock(userId: string, friendId: string): Promise<boolean> {
  const result = await query<{ mutual_days: number }>(
    `
      SELECT LEAST(
        COALESCE((
          SELECT COUNT(DISTINCT DATE(created_at))::int
          FROM nudges
          WHERE sender_id = $1 AND receiver_id = $2
        ), 0),
        COALESCE((
          SELECT COUNT(DISTINCT DATE(created_at))::int
          FROM nudges
          WHERE sender_id = $2 AND receiver_id = $1
        ), 0)
      ) AS mutual_days
    `,
    [userId, friendId]
  );

  const mutualDays = Number(result.rows[0]?.mutual_days ?? 0);
  return mutualDays >= 100;
}
