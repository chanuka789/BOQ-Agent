import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getSql } from "@/lib/db/client";
import type { AppUser } from "@/lib/db/types";

export async function getCurrentAppUser() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
  const name =
    clerkUser?.fullName ??
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") ??
    null;

  return upsertAppUser({
    clerkUserId: userId,
    email,
    name
  });
}

export async function requireCurrentAppUser() {
  const user = await getCurrentAppUser();

  if (!user) {
    redirect("/sign-in");
  }

  return user;
}

export async function upsertAppUser({
  clerkUserId,
  email,
  name
}: {
  clerkUserId: string;
  email: string;
  name: string | null;
}) {
  const sql = getSql();
  const rows = (await sql`
    insert into users (clerk_user_id, email, name)
    values (${clerkUserId}, ${email}, ${name})
    on conflict (clerk_user_id)
    do update set
      email = excluded.email,
      name = excluded.name,
      updated_at = now()
    returning id, clerk_user_id, email, name
  `) as AppUser[];

  return rows[0];
}
