import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { after } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { addActivityLog } from "@/lib/db/activity";
import { getSql } from "@/lib/db/client";
import { assertProjectAccess } from "@/lib/db/projects";
import { createProjectFile } from "@/lib/db/files";
import { updateProjectStatus } from "@/lib/db/projects";
import { createTemplateRecordForFile } from "@/lib/db/templates";
import { getCurrentAppUser } from "@/lib/db/users";
import { analyzePreviousBoqFile } from "@/lib/knowledge/analyze-previous-boq";
import type { ProjectRow } from "@/lib/db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

class UploadConfigurationError extends Error {}

const clientPayloadSchema = z.object({
  projectId: z.string().uuid(),
  fileRole: z.enum(["source_document", "boq_template", "previous_boq"]),
  fileType: z.string().min(2),
  sizeBytes: z.number().nonnegative().optional()
});

const tokenPayloadSchema = clientPayloadSchema.extend({
  userId: z.string().uuid()
});

function assertUploadConfiguration() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new UploadConfigurationError(
      "BLOB_READ_WRITE_TOKEN is missing in this Vercel deployment. Add the Blob read-write token to the Production environment and redeploy."
    );
  }
}

function parseJsonPayload<T>(
  payload: string | null | undefined,
  schema: z.ZodType<T>,
  label: string
) {
  if (!payload) {
    throw new Error(`${label} is missing.`);
  }

  try {
    return schema.parse(JSON.parse(payload));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`${label} is not valid JSON.`);
    }

    throw error;
  }
}

function formatUploadError(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues
      .map((issue) => {
        const field = issue.path.join(".") || "payload";
        return `${field}: ${issue.message}`;
      })
      .join("; ");
  }

  return error instanceof Error ? error.message : "Unable to create upload token.";
}

function logUploadError(context: string, error: unknown) {
  console.error(context, {
    message: formatUploadError(error),
    name: error instanceof Error ? error.name : "UnknownError",
    stack: error instanceof Error ? error.stack : undefined
  });
}

export async function GET(request: Request) {
  try {
    assertUploadConfiguration();

    const { searchParams } = new URL(request.url);
    const parsed = z
      .object({ projectId: z.string().uuid() })
      .parse({ projectId: searchParams.get("projectId") });

    const user = await getCurrentAppUser();

    if (!user) {
      return NextResponse.json(
        { ready: false, error: "You must be signed in to upload files." },
        { status: 401 }
      );
    }

    await assertProjectAccess(parsed.projectId, user.id);

    return NextResponse.json({ ready: true });
  } catch (error) {
    const message = formatUploadError(error);
    logUploadError("BOQ upload readiness check failed", error);

    return NextResponse.json(
      { ready: false, error: message },
      { status: error instanceof UploadConfigurationError ? 500 : 400 }
    );
  }
}

export async function POST(request: Request) {
  try {
    assertUploadConfiguration();

    const body = (await request.json()) as HandleUploadBody;
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const user = await getCurrentAppUser();

        if (!user) {
          throw new Error("You must be signed in to upload files.");
        }

        const parsed = parseJsonPayload(
          clientPayload,
          clientPayloadSchema,
          "Upload metadata"
        );

        await assertProjectAccess(parsed.projectId, user.id);

        return {
          allowedContentTypes: [
            "application/pdf",
            "application/octet-stream",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel.sheet.macroEnabled.12",
            "image/png",
            "image/jpeg"
          ],
          maximumSizeInBytes: 1024 * 1024 * 500,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            ...parsed,
            userId: user.id
          })
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        try {
          if (!tokenPayload) {
            throw new Error("Vercel Blob upload callback is missing token payload.");
          }

          const parsed = parseJsonPayload(
            tokenPayload,
            tokenPayloadSchema,
            "Upload callback metadata"
          );
          const file = await createProjectFile({
            projectId: parsed.projectId,
            uploadedBy: parsed.userId,
            fileName: blob.pathname.split("/").pop() ?? blob.pathname,
            fileType: parsed.fileRole,
            mimeType: blob.contentType ?? null,
            sizeBytes: parsed.sizeBytes ?? 0,
            storageUrl: blob.url
          });

          if (parsed.fileRole === "boq_template") {
            await createTemplateRecordForFile({
              projectId: parsed.projectId,
              file,
              parsedStructure: {
                status: "queued_for_parsing",
                source: "Vercel Blob upload callback"
              }
            });
          }

          // Previous BOQs are analysed so the agents can learn the firm's
          // house style. Run after the response so the upload returns quickly.
          if (parsed.fileRole === "previous_boq") {
            const sql = getSql();
            const projectRows = (await sql`
              select id, measurement_standard from projects where id = ${parsed.projectId} limit 1
            `) as Pick<ProjectRow, "id" | "measurement_standard">[];
            const project = projectRows[0];
            if (project) {
              after(() =>
                analyzePreviousBoqFile(project, file).catch((analysisError) =>
                  logUploadError("Previous BOQ analysis failed", analysisError)
                )
              );
            }
          }

          await updateProjectStatus({
            projectId: parsed.projectId,
            status: "documents_uploaded"
          });

          await addActivityLog({
            projectId: parsed.projectId,
            userId: parsed.userId,
            action:
              parsed.fileRole === "boq_template"
                ? "template.uploaded"
                : parsed.fileRole === "previous_boq"
                  ? "previous_boq.uploaded"
                  : "file.uploaded",
            details: {
              pathname: blob.pathname,
              url: blob.url,
              contentType: blob.contentType
            }
          });

          console.info("BOQ upload completed", {
            pathname: blob.pathname,
            contentType: blob.contentType,
            fileRole: parsed.fileRole,
            projectId: parsed.projectId
          });
        } catch (error) {
          logUploadError("BOQ upload metadata save failed", error);
        }
      }
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = formatUploadError(error);
    logUploadError("BOQ upload token route failed", error);

    return NextResponse.json(
      { error: message },
      { status: error instanceof UploadConfigurationError ? 500 : 400 }
    );
  }
}
