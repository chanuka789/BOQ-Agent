import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { after } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "@/lib/db/client";
import { getCurrentAppUser } from "@/lib/db/users";
import { analyzePreviousBoqUpload, getPreviousBoqUploadById } from "@/lib/knowledge/analyze-app-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clientPayloadSchema = z.object({
  fileName: z.string().min(1),
  measurementStandard: z.string().optional()
});

function assertConfigured() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is missing. Add it to the deployment to upload files.");
  }
}

export async function GET() {
  try {
    assertConfigured();
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json({ ready: false, error: "Sign in required." }, { status: 401 });
    }
    return NextResponse.json({ ready: true });
  } catch (error) {
    return NextResponse.json(
      { ready: false, error: error instanceof Error ? error.message : "Not ready" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    assertConfigured();
    const body = (await request.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const user = await getCurrentAppUser();
        if (!user) throw new Error("You must be signed in to upload files.");
        const parsed = clientPayloadSchema.parse(JSON.parse(clientPayload ?? "{}"));
        return {
          allowedContentTypes: [
            "application/pdf",
            "application/octet-stream",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel.sheet.macroEnabled.12"
          ],
          maximumSizeInBytes: 1024 * 1024 * 500,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            userId: user.id,
            fileName: parsed.fileName,
            measurementStandard: parsed.measurementStandard ?? null
          })
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        try {
          const payload = JSON.parse(tokenPayload ?? "{}") as {
            userId?: string;
            fileName?: string;
            measurementStandard?: string | null;
          };
          const sql = getSql();
          const rows = (await sql`
            insert into previous_boq_uploads (
              uploaded_by, file_name, storage_url, measurement_standard, status
            )
            values (
              ${payload.userId ?? null},
              ${payload.fileName ?? blob.pathname.split("/").pop() ?? blob.pathname},
              ${blob.url},
              ${payload.measurementStandard ?? null},
              'uploaded'
            )
            returning id
          `) as Array<{ id: string }>;

          const uploadId = rows[0]?.id;
          if (uploadId) {
            after(async () => {
              const upload = await getPreviousBoqUploadById(uploadId);
              if (upload) await analyzePreviousBoqUpload(upload);
            });
          }
        } catch (error) {
          console.error("App-wide previous BOQ save failed:", error);
        }
      }
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 400 }
    );
  }
}
