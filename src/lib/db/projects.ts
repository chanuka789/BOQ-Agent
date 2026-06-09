import { notFound } from "next/navigation";
import { getSql } from "@/lib/db/client";
import type {
  AppUser,
  MeasurementStandard,
  ProjectRole,
  ProjectRow
} from "@/lib/db/types";
import { requireCurrentAppUser } from "@/lib/db/users";

export async function getProjectsForCurrentUser() {
  const user = await requireCurrentAppUser();
  return getProjectsForUser(user.id);
}

export async function getProjectsForUser(userId: string) {
  const sql = getSql();
  const rows = (await sql`
    select
      p.*,
      pm.role,
      coalesce(file_counts.file_count, 0)::int as file_count,
      coalesce(item_counts.item_count, 0)::int as item_count
    from projects p
    join project_members pm on pm.project_id = p.id
    left join (
      select project_id, count(*) as file_count
      from project_files
      group by project_id
    ) file_counts on file_counts.project_id = p.id
    left join (
      select project_id, count(*) as item_count
      from boq_items
      group by project_id
    ) item_counts on item_counts.project_id = p.id
    where pm.user_id = ${userId} and p.deleted_at is null
    order by p.updated_at desc
  `) as ProjectRow[];

  return rows;
}

export async function getDeletedProjectsForUser(userId: string) {
  const sql = getSql();
  const rows = (await sql`
    select p.*, pm.role
    from projects p
    join project_members pm on pm.project_id = p.id
    where pm.user_id = ${userId} and p.deleted_at is not null
    order by p.deleted_at desc
  `) as ProjectRow[];

  return rows;
}

export async function softDeleteProject(projectId: string) {
  const sql = getSql();
  await sql`update projects set deleted_at = now(), updated_at = now() where id = ${projectId}`;
}

export async function restoreProject(projectId: string) {
  const sql = getSql();
  await sql`update projects set deleted_at = null, updated_at = now() where id = ${projectId}`;
}

/**
 * Permanently delete a project and all project-specific data. Returns the
 * storage URLs of project files so the caller can delete the blobs.
 * App-wide previous-BOQ knowledge is NOT touched here.
 */
export async function permanentlyDeleteProject(
  projectId: string
): Promise<{ storageUrls: string[] }> {
  const sql = getSql();
  const fileRows = (await sql`
    select storage_url from project_files where project_id = ${projectId}
  `) as Array<{ storage_url: string | null }>;
  const storageUrls = fileRows
    .map((r) => r.storage_url)
    .filter((url): url is string => Boolean(url));

  // ON DELETE CASCADE removes members, files, generations, items, queries,
  // assumptions, jobs, exports, logs, etc.
  await sql`delete from projects where id = ${projectId}`;

  return { storageUrls };
}

export async function createProjectForUser({
  user,
  name,
  clientName,
  projectType,
  scope,
  measurementStandard
}: {
  user: AppUser;
  name: string;
  clientName: string;
  projectType: string;
  scope: string;
  measurementStandard: MeasurementStandard;
}) {
  const sql = getSql();
  const rows = (await sql`
    insert into projects (
      name,
      client_name,
      project_type,
      scope,
      measurement_standard
    )
    values (${name}, ${clientName}, ${projectType}, ${scope}, ${measurementStandard})
    returning *
  `) as ProjectRow[];

  const project = rows[0];

  await sql`
    insert into project_members (project_id, user_id, role)
    values (${project.id}, ${user.id}, 'owner')
  `;

  return project;
}

export async function getProjectForCurrentUser(projectId: string) {
  const user = await requireCurrentAppUser();
  const project = await getProjectForUser(projectId, user.id);

  if (!project) {
    notFound();
  }

  return { project, user };
}

export async function getProjectForUser(projectId: string, userId: string) {
  const sql = getSql();
  const rows = (await sql`
    select p.*, pm.role
    from projects p
    join project_members pm on pm.project_id = p.id
    where p.id = ${projectId} and pm.user_id = ${userId}
    limit 1
  `) as (ProjectRow & { role: ProjectRole })[];

  return rows[0] ?? null;
}

export async function assertProjectAccess(projectId: string, userId: string) {
  const project = await getProjectForUser(projectId, userId);

  if (!project) {
    throw new Error("You do not have access to this project.");
  }

  return project;
}

export async function updateProjectStatus({
  projectId,
  status
}: {
  projectId: string;
  status: ProjectRow["status"];
}) {
  const sql = getSql();

  await sql`
    update projects
    set status = ${status}, updated_at = now()
    where id = ${projectId}
  `;
}

export async function updateProjectDetails({
  projectId,
  name,
  clientName,
  projectType,
  scope,
  measurementStandard
}: {
  projectId: string;
  name: string;
  clientName: string;
  projectType: string;
  scope: string;
  measurementStandard: MeasurementStandard;
}) {
  const sql = getSql();

  const rows = (await sql`
    update projects
    set
      name = ${name},
      client_name = ${clientName},
      project_type = ${projectType},
      scope = ${scope},
      measurement_standard = ${measurementStandard},
      updated_at = now()
    where id = ${projectId}
    returning *
  `) as ProjectRow[];

  return rows[0] ?? null;
}
