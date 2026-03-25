const FRONTMATTER_PREFIX = "---";

export interface FrontmatterParts {
  frontmatter: string;
  body: string;
}

export function splitFrontmatter(markdown: string): FrontmatterParts {
  if (!markdown.startsWith(`${FRONTMATTER_PREFIX}\n`)) {
    return { frontmatter: "", body: markdown };
  }

  const match = markdown.match(/^---\n[\s\S]*?\n---(?:\n{1,2})?/);
  if (!match) {
    return { frontmatter: "", body: markdown };
  }

  return {
    frontmatter: match[0],
    body: markdown.slice(match[0].length),
  };
}

export function joinFrontmatter(frontmatter: string, body: string): string {
  return frontmatter ? `${frontmatter}${body}` : body;
}
