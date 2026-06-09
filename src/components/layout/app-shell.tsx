"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  BookMarked,
  Brain,
  ClipboardList,
  Cpu,
  Download,
  FileCheck2,
  FileQuestion,
  FileSearch,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  Library,
  Moon,
  Plus,
  Settings,
  Sparkles,
  Table2,
  Trash2,
  UploadCloud
} from "lucide-react";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: React.ReactNode;
  userName: string;
  userEmail: string;
};

const projectNav = [
  { label: "Upload documents", icon: UploadCloud, segment: "upload" },
  { label: "Previous BOQs", icon: Library, segment: "previous-boqs" },
  { label: "Document review", icon: FileSearch, segment: "document-review" },
  { label: "BOQ rule library", icon: BookMarked, segment: "rules" },
  { label: "Generate BOQ", icon: Sparkles, segment: "generate" },
  { label: "BOQ review", icon: Table2, segment: "boq-review" },
  { label: "Query register", icon: FileQuestion, segment: "queries" },
  { label: "Assumption register", icon: ClipboardList, segment: "assumptions" },
  { label: "Export", icon: Download, segment: "export" },
  { label: "Project settings", icon: Settings, segment: "settings" }
];

export function AppShell({ children, userName, userEmail }: AppShellProps) {
  try {
    const pathname = usePathname();
    const projectMatch = pathname.match(
      /\/projects\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:\/|$)/
    );
    const projectId = projectMatch?.[1];

    return (
      <div className="min-h-screen lg:grid lg:grid-cols-[264px_1fr]">
        <aside className="border-b border-[#123d6c] bg-[#063b71] text-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-[264px] lg:border-b-0 lg:border-r">
          <div className="flex h-16 items-center gap-3 border-b border-white/12 px-5">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/12 text-white">
              <FileCheck2 size={19} aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-white">
                AI BOQ Agent
              </p>
              <p className="text-xs text-white/70">Descriptions + units</p>
            </div>
          </div>

          <nav className="flex gap-1 overflow-x-auto px-3 py-3 lg:block lg:space-y-1 lg:overflow-visible">
            <SidebarLink
              href="/dashboard"
              active={pathname === "/dashboard"}
              icon={LayoutDashboard}
            >
              Dashboard
            </SidebarLink>
            <SidebarLink
              href="/projects/new"
              active={pathname === "/projects/new"}
              icon={Plus}
            >
              New project
            </SidebarLink>

            <div className="hidden px-3 pb-2 pt-5 text-[11px] font-extrabold uppercase text-white/55 lg:block">
              Project workflow
            </div>

            {projectNav.map((item) => {
              const href = projectId
                ? `/projects/${projectId}/${item.segment}`
                : "/dashboard";
              const active = pathname === href;

              return (
                <SidebarLink
                  key={item.segment}
                  href={href}
                  active={active}
                  icon={item.icon}
                  muted={!projectId}
                >
                  {item.label}
                </SidebarLink>
              );
            })}

            <div className="hidden px-3 pb-2 pt-5 text-[11px] font-extrabold uppercase text-white/55 lg:block">
              Workspace
            </div>
            <SidebarLink
              href="/knowledge-base"
              active={pathname.startsWith("/knowledge-base")}
              icon={Brain}
            >
              Knowledge base
            </SidebarLink>
            <SidebarLink
              href="/recycle-bin"
              active={pathname === "/recycle-bin"}
              icon={Trash2}
            >
              Recycle Bin
            </SidebarLink>
            <SidebarLink
              href="/settings/ai"
              active={pathname === "/settings/ai"}
              icon={Cpu}
            >
              AI models
            </SidebarLink>
            <SidebarLink
              href="/settings"
              active={pathname === "/settings"}
              icon={Settings}
            >
              Settings
            </SidebarLink>
          </nav>
        </aside>

        <div className="lg:col-start-2">
          <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-4 border-b border-[var(--border)] bg-white/92 px-4 backdrop-blur md:px-6">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[var(--foreground)]">
                {userName}
              </p>
              <p className="truncate text-xs text-[var(--muted)]">{userEmail}</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] md:flex">
                <Gauge size={15} aria-hidden="true" />
                AI cost: $0.00
              </div>
              <button
                className="btn btn-secondary h-9 min-h-9 w-9 px-0"
                type="button"
                aria-label="Toggle dark mode"
                title="Toggle dark mode"
                disabled
              >
                <Moon size={16} aria-hidden="true" />
              </button>
              <UserButton />
            </div>
          </header>
          <main className="px-4 py-6 md:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return (
      <div className="p-6 max-w-xl mx-auto mt-12 bg-red-50 border border-red-200 text-red-700 rounded-lg font-mono text-xs">
        <h1 className="text-sm font-bold uppercase text-red-800">App Shell Client Error</h1>
        <p className="mt-2 font-bold">{error instanceof Error ? error.name : "Error"}: {message}</p>
        {error instanceof Error && error.stack ? (
          <pre className="mt-4 p-2 bg-red-100/60 rounded overflow-auto max-h-60 whitespace-pre-wrap">{error.stack}</pre>
        ) : null}
      </div>
    );
  }
}

function SidebarLink({
  href,
  active,
  icon: Icon,
  muted,
  children
}: {
  href: string;
  active: boolean;
  muted?: boolean;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition lg:w-full",
        active
          ? "bg-[#0b61b3] text-white shadow-sm"
          : "text-white/82 hover:bg-white/10 hover:text-white",
        muted && "opacity-45"
      )}
    >
      <Icon size={17} aria-hidden="true" />
      <span className="whitespace-nowrap">{children}</span>
    </Link>
  );
}
