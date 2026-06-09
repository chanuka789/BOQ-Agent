import { CheckCircle2, Database, KeyRound, Server, UploadCloud } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/status-badge";
import { isDatabaseConfigured } from "@/lib/db/client";
import { getTemplateProfiles } from "@/lib/db/templates";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const env = [
    ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)],
    ["CLERK_SECRET_KEY", Boolean(process.env.CLERK_SECRET_KEY)],
    ["DATABASE_URL", isDatabaseConfigured()],
    ["BLOB_READ_WRITE_TOKEN", Boolean(process.env.BLOB_READ_WRITE_TOKEN)],
    ["OPENROUTER_API_KEY", Boolean(process.env.OPENROUTER_API_KEY)],
    ["OPENROUTER_MODEL", Boolean(process.env.OPENROUTER_MODEL)]
  ] as const;
  const profiles = isDatabaseConfigured()
    ? await getTemplateProfiles().catch(() => [])
    : [];

  return (
    <>
      <PageHeader
        title="Settings"
        description="Deployment configuration checklist for Vercel, Neon, Clerk, Vercel Blob, and OpenRouter."
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="space-y-5">
          <section className="panel p-5">
            <h2 className="text-base font-extrabold text-[var(--foreground)]">
              Environment variables
            </h2>
            <div className="mt-4 space-y-3">
              {env.map(([name, configured]) => (
                <div
                  key={name}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                >
                  <code className="text-xs font-bold">{name}</code>
                  <Badge tone={configured ? "success" : "warning"}>
                    {configured ? "Set" : "Missing"}
                  </Badge>
                </div>
              ))}
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="text-base font-extrabold text-[var(--foreground)]">
              Template profiles
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Add future client BOQ formats as template profile records, then
              map their headers and sheet rules without changing the review
              screens.
            </p>
            <div className="mt-4 space-y-3">
              {profiles.length === 0 ? (
                <div className="rounded-lg border border-[var(--border)] bg-[#f8fafc] px-3 py-3 text-sm text-[var(--muted)]">
                  No profiles loaded yet. Run{" "}
                  <code>database/seed_template_profiles.sql</code>.
                </div>
              ) : (
                profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="rounded-lg border border-[var(--border)] bg-white px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-extrabold text-[var(--foreground)]">
                        {profile.name}
                      </p>
                      <Badge tone="success">Active</Badge>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                      {profile.description}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <SetupCard
            icon={Database}
            title="Neon"
            body="Create a Neon Postgres database, run database/schema.sql, then database/seed_template_profiles.sql and database/seed_rules.sql."
          />
          <SetupCard
            icon={KeyRound}
            title="Clerk"
            body="Create a Clerk app, copy publishable and secret keys to Vercel, and set sign-in/sign-up URLs to /sign-in and /sign-up."
          />
          <SetupCard
            icon={UploadCloud}
            title="Vercel Blob"
            body="Create a Blob store in the Vercel project. Vercel injects BLOB_READ_WRITE_TOKEN when connected."
          />
          <SetupCard
            icon={Server}
            title="OpenRouter"
            body="Create an API key, confirm the MiniMax M3 model name, and set OPENROUTER_MODEL without hard-coding it in UI files."
          />
        </aside>
      </div>
    </>
  );
}

function SetupCard({
  icon: Icon,
  title,
  body
}: {
  icon: React.ElementType;
  title: string;
  body: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
          <Icon size={18} aria-hidden="true" />
        </div>
        <div>
          <p className="font-extrabold text-[var(--foreground)]">{title}</p>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{body}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs font-bold text-[var(--success)]">
        <CheckCircle2 size={14} aria-hidden="true" />
        Configure in provider dashboard, not in code
      </div>
    </div>
  );
}
