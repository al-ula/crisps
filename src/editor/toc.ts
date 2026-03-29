export interface TocItem {
  id: string;
  text: string;
  level: number;
  index: number;
}

const FENCE_PATTERN = /^(```|~~~)/;
const HEADING_PATTERN = /^(#{1,6})[ \t]+(.+?)\s*$/;
const TRAILING_HASH_PATTERN = /(?:[ \t]+#+\s*)$/;

export function slugifyHeading(
  text: string,
  seen: Map<string, number>,
): string {
  const base =
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-") || "section";

  const count = (seen.get(base) ?? 0) + 1;
  seen.set(base, count);
  return count === 1 ? base : `${base}-${count}`;
}

export function extractToc(markdown: string): TocItem[] {
  const lines = markdown.split(/\r?\n/);
  const seen = new Map<string, number>();
  const items: TocItem[] = [];
  let inFrontmatter = false;
  let frontmatterResolved = false;
  let fenceMarker: string | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!frontmatterResolved) {
      frontmatterResolved = true;
      if (trimmed === "---") {
        inFrontmatter = true;
        continue;
      }
    }

    if (inFrontmatter) {
      if (trimmed === "---") {
        inFrontmatter = false;
      }
      continue;
    }

    const fenceMatch = line.match(FENCE_PATTERN);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (fenceMarker === marker) {
        fenceMarker = null;
      } else if (fenceMarker == null) {
        fenceMarker = marker;
      }
      continue;
    }

    if (fenceMarker) {
      continue;
    }

    const headingMatch = line.match(HEADING_PATTERN);
    if (!headingMatch) {
      continue;
    }

    const level = headingMatch[1].length;
    const text = headingMatch[2].replace(TRAILING_HASH_PATTERN, "").trim();
    if (!text) {
      continue;
    }

    items.push({
      id: slugifyHeading(text, seen),
      text,
      level,
      index: items.length,
    });
  }

  return items;
}
