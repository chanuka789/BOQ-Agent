import "server-only";

export function getInternalWorkerSecret(): string {
  const secret = process.env.INTERNAL_WORKER_SECRET?.trim();
  if (!secret) {
    throw new Error("INTERNAL_WORKER_SECRET is required for internal worker routes.");
  }
  return secret;
}

export function isInternalWorkerSecretConfigured(): boolean {
  return Boolean(process.env.INTERNAL_WORKER_SECRET?.trim());
}

export function verifyInternalWorkerSecret(secret: string | null): void {
  if (secret !== getInternalWorkerSecret()) {
    throw new Error("Unauthorized");
  }
}
