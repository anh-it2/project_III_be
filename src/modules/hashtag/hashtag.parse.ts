// Mirrors FE project_III src/feature/hashtag/lib/parse.ts 1:1. Keep the
// regex byte-aligned with the FE so a tag the composer extracts is the same
// tag the BE persists, and a tag rendered by RichText resolves to the same
// /hashtags/:tag row.
const HASHTAG_RE = /#[\p{L}0-9_]+/gu;

export function extractHashtags(text: string | null | undefined): string[] {
  if (!text) return [];
  const out = new Set<string>();
  for (const m of text.matchAll(HASHTAG_RE)) {
    out.add(m[0].slice(1).toLowerCase());
  }
  return [...out];
}
