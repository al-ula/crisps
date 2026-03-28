import { convertFileSrc, isTauri } from "@tauri-apps/api/core";

const WINDOWS_DRIVE_PATH_RE = /^[a-z]:[\\/]/i;
const WINDOWS_UNC_PATH_RE = /^\\\\/;
const URL_SCHEME_RE = /^[a-z][a-z\d+.-]*:/i;

export function normalizeImageSrcForMarkdown(src: string): string {
  if (!src) return src;
  if (src.startsWith("file://")) return src;

  if (WINDOWS_UNC_PATH_RE.test(src)) {
    return `file://${encodeURI(src.slice(2).replace(/\\/g, "/"))}`;
  }

  if (WINDOWS_DRIVE_PATH_RE.test(src)) {
    return `file:///${encodeURI(src.replace(/\\/g, "/"))}`;
  }

  if (src.startsWith("/")) {
    return `file://${encodeURI(src)}`;
  }

  if (URL_SCHEME_RE.test(src)) return src;

  return src;
}

export function resolveImageSrcForDom(src: string): string {
  const localPath = getLocalImagePath(src);
  if (!localPath) return src;
  if (!isTauri()) return normalizeImageSrcForMarkdown(localPath);

  try {
    return convertFileSrc(localPath);
  } catch {
    return normalizeImageSrcForMarkdown(localPath);
  }
}

function getLocalImagePath(src: string): string | null {
  if (!src) return null;

  if (src.startsWith("file://")) {
    return fileUrlToPath(src);
  }

  if (
    WINDOWS_UNC_PATH_RE.test(src) ||
    WINDOWS_DRIVE_PATH_RE.test(src) ||
    src.startsWith("/")
  ) {
    return src;
  }

  return null;
}

function fileUrlToPath(src: string): string | null {
  try {
    const url = new URL(src);
    if (url.protocol !== "file:") return null;

    const pathname = decodeURIComponent(url.pathname);
    if (url.hostname) {
      return `//${url.hostname}${pathname}`;
    }

    if (/^\/[a-z]:/i.test(pathname)) {
      return pathname.slice(1);
    }

    return pathname;
  } catch {
    return null;
  }
}
