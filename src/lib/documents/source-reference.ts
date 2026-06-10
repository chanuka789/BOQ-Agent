export function normalizeSourceReference(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export function sourceReferenceTokens(value: string | null | undefined): string[] {
  const raw = (value ?? "").toLowerCase().trim();
  if (!raw) return [];

  const tokens = new Set<string>();
  tokens.add(raw);

  const withoutExtension = raw.replace(/\.[a-z0-9]+$/i, "");
  tokens.add(withoutExtension);

  const fileName = withoutExtension.split(/[\\/]/).pop();
  if (fileName) tokens.add(fileName);

  const normalized = normalizeSourceReference(raw);
  if (normalized.length >= 3) tokens.add(normalized);

  const drawingLike = raw.match(/\b([a-z]{1,4})[-_\s]?(\d{2,5}[a-z]?)\b/i);
  if (drawingLike) {
    tokens.add(`${drawingLike[1]}${drawingLike[2]}`.toLowerCase());
  }

  return Array.from(tokens).filter((token) => token.length >= 3);
}

export function sourceReferencesMatch(candidate: string, knownToken: string): boolean {
  const candidateTokens = sourceReferenceTokens(candidate);
  const knownTokens = sourceReferenceTokens(knownToken);

  return candidateTokens.some((candidateToken) =>
    knownTokens.some(
      (known) =>
        candidateToken === known ||
        (candidateToken.length >= 5 && known.includes(candidateToken)) ||
        (known.length >= 5 && candidateToken.includes(known))
    )
  );
}
