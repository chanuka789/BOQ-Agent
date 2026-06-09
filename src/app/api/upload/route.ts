import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { addActivityLog } from "@/lib/db/activity";
import { assertProjectAccess } from "@/lib/db/projects";
import { createProjectFile } from "@/lib/db/files";
import { updateProjectStatus } from "@/lib/db/projects";
import { createTemplateRecordForFile } from "@/lib/db/templates";
import { getCurrentAppUser } from "@/lib/db/users";

const clientPayloadSchema = z.object({
  projectId: z.string().uuid(),
  fileRole: z.enum(["source_document", "boq_template"]),
  fileType: z.string().min(2),
  sizeBytes: z.number().nonnegative().optional()
});

const tokenPayloadSchema = clientPayloadSchema.extend({
  userId: z.string().uuid()
});

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const user = await getCurrentAppUser();

        if (!user) {
          throw new Error("You must be signed in to upload files.");
        }

        const parsed = clientPayloadSchema.parse(JSON.parse(clientPayload ?? "{}"));

        await assertProjectAccess(parsed.projectId, user.id);

        return {
          allowedContentTypes: [
            "application/pdf",
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
        if (!tokenPayload) {
          throw new Error("Vercel Blob upload callback is missing token payload.");
        }

        const parsed = tokenPayloadSchema.parse(JSON.parse(tokenPayload));
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
              : "file.uploaded",
          details: {
            pathname: blob.pathname,
            url: blob.url,
            contentType: blob.contentType
          }
        });
      }
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create upload token.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
