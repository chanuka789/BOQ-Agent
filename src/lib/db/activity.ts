import { getSql } from "@/lib/db/client";

export async function addActivityLog({
  projectId,
  userId,
  action,
  details
}: {
  projectId: string;
  userId: string | null;
  action: string;
  details?: Record<string, unknown>;
}) {
  const sql = getSql();

  await sql`
    insert into activity_log (project_id, user_id, action, details)
    values (${projectId}, ${userId}, ${action}, ${JSON.stringify(details ?? {})}::jsonb)
  `;
}
