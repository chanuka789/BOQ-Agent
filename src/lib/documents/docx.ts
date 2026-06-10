import "server-only";

type MammothModule = {
  extractRawText(input: { buffer: Buffer }): Promise<{ value?: string }>;
};

async function importMammoth(): Promise<MammothModule> {
  // @ts-ignore - dependency is declared in package.json and may not exist until install.
  return (await import("mammoth")) as MammothModule;
}

export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await importMammoth();
    const result = await mammoth.extractRawText({ buffer });
    return (result.value ?? "").replace(/\s+/g, " ").trim();
  } catch (error) {
    console.error("DOCX extraction failed:", error);
    return "";
  }
}
