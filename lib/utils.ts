export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Same reading-speed estimate the backend uses for uploaded books (about 150 words per minute). */
export function estimateMinutes(text: string): number {
  return Math.max(1, Math.round(wordCount(text) / 150));
}

/**
 * Best-effort page count for a PDF, read straight from the file. Many modern PDFs hide their page
 * objects inside compressed streams, in which case this returns null and the user types the number.
 */
export async function estimatePdfPages(file: File): Promise<number | null> {
  try {
    const buffer = await file.arrayBuffer();
    const text = new TextDecoder("latin1").decode(buffer);
    const matches = text.match(/\/Type\s*\/Page(?![A-Za-z])/g);
    return matches && matches.length > 0 ? matches.length : null;
  } catch {
    return null;
  }
}

export function titleFromFilename(name: string): string {
  return name
    .replace(/\.pdf$/i, "")
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** "Pages 5-8 (4 pages)", "Page 7", or null when the range was never recorded. */
export function formatPageRange(start: number | null, end: number | null): string | null {
  if (start === null || end === null) return null;
  if (start === end) return `Page ${start}`;
  const count = end - start + 1;
  return `Pages ${start}\u2013${end} (${count} pages)`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Random password from characters that are easy to read aloud (no 0/O, 1/l/I). Uses rejection sampling so no character is favoured. */
export function generatePassword(length = 14): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const limit = Math.floor(0x100000000 / alphabet.length) * alphabet.length;
  let out = "";
  while (out.length < length) {
    const [n] = crypto.getRandomValues(new Uint32Array(1));
    if (n < limit) out += alphabet[n % alphabet.length];
  }
  return out;
}

/** 754 -> "12:34", 3725 -> "1:02:05". */
export function formatDuration(seconds: number | null): string | null {
  if (seconds === null || seconds === undefined) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** "12:30" -> 750, "1:02:05" -> 3725, "12" -> 720 (a single number is minutes). Empty -> null. Invalid -> undefined. */
export function parseDuration(text: string): number | null | undefined {
  const value = text.trim();
  if (!value) return null;
  const parts = value.split(":");
  if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return undefined;
  const nums = parts.map(Number);
  if (nums.length === 1) return nums[0] * 60;
  if (nums.slice(1).some((n) => n > 59)) return undefined;
  return nums.length === 2 ? nums[0] * 60 + nums[1] : nums[0] * 3600 + nums[1] * 60 + nums[2];
}

export interface VideoPreview {
  kind: "iframe" | "video";
  src: string;
  provider: "youtube" | "vimeo" | "direct";
}

/** Quick check of a pasted link so the form can show a preview. The server does the real validation. */
export function videoPreview(raw: string): VideoPreview | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);

  const youtubeHosts = ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"];
  if (host === "youtu.be" || youtubeHosts.includes(host)) {
    let id = "";
    if (host === "youtu.be") id = parts[0] ?? "";
    else if (url.pathname === "/watch") id = url.searchParams.get("v") ?? "";
    else if (parts.length > 1 && ["embed", "shorts", "live", "v"].includes(parts[0])) id = parts[1];
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? { kind: "iframe", provider: "youtube", src: `https://www.youtube.com/embed/${id}` } : null;
  }

  if (["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(host)) {
    const id = parts.find((p) => /^\d{6,12}$/.test(p));
    if (!id) return null;
    let hash = url.searchParams.get("h") ?? parts[parts.indexOf(id) + 1] ?? "";
    if (!/^[A-Za-z0-9]{8,16}$/.test(hash)) hash = "";
    return { kind: "iframe", provider: "vimeo", src: `https://player.vimeo.com/video/${id}${hash ? `?h=${hash}` : ""}` };
  }

  if (/\.(mp4|webm|mov|m3u8)$/i.test(url.pathname)) return { kind: "video", provider: "direct", src: url.toString() };
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
