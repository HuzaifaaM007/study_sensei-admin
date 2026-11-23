"use client";
import { useCallback, useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { api, API_BASE_URL } from "@/lib/api";
import { errorMessage } from "@/lib/errors";

/** Same safety idea as the backend: allow normal formatting HTML, never scripts or event handlers. */
const schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "u", "mark", "small", "center"],
  attributes: {
    ...defaultSchema.attributes,
    img: ["src", "alt", "title", "width", "height"],
    td: ["align", "colSpan", "rowSpan"],
    th: ["align", "colSpan", "rowSpan"],
  },
};

/** Images are stored as "/storage/lesson_images/..."; show them from the backend in the preview. */
export function resolveMediaUrl(src?: string) {
  if (!src) return "";
  return src.startsWith("/") ? `${API_BASE_URL}${src}` : src;
}

export function LessonPreview({ markdown }: { markdown: string }) {
  if (!markdown.trim()) {
    return <p className="text-sm text-textSecondary">Nothing to preview yet. Start writing on the left.</p>;
  }
  return (
    <div className="lesson-preview">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
        components={{
          // eslint-disable-next-line @next/next/no-img-element
          img: ({ src, alt }) => <img src={resolveMediaUrl(typeof src === "string" ? src : undefined)} alt={alt ?? ""} />,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

type View = "write" | "split" | "preview";

export default function LessonEditor({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<View>("split");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  /** Replace the current selection, then put the cursor/selection where we want it. */
  const replaceSelection = useCallback(
    (build: (selected: string) => { text: string; selectStart: number; selectEnd: number }) => {
      const el = ref.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const selected = value.slice(start, end);
      const { text, selectStart, selectEnd } = build(selected);
      const next = value.slice(0, start) + text + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + selectStart, start + selectEnd);
      });
    },
    [value, onChange],
  );

  const wrap = (before: string, after: string, placeholder: string) =>
    replaceSelection((sel) => {
      const inner = sel || placeholder;
      return { text: before + inner + after, selectStart: before.length, selectEnd: before.length + inner.length };
    });

  /** Prefix every selected line (or the current line) with a marker, e.g. "## " or "- ". */
  const prefixLines = (marker: string | ((i: number) => string)) => {
    const el = ref.current;
    if (!el) return;
    const lineStart = value.lastIndexOf("\n", el.selectionStart - 1) + 1;
    const lineEndIdx = value.indexOf("\n", el.selectionEnd);
    const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
    const block = value.slice(lineStart, lineEnd);
    const lines = block.split("\n").map((line, i) => {
      const clean = line.replace(/^(#{1,6}\s+|[-*]\s+|\d+\.\s+|>\s?)/, "");
      return (typeof marker === "function" ? marker(i) : marker) + clean;
    });
    const text = lines.join("\n");
    onChange(value.slice(0, lineStart) + text + value.slice(lineEnd));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(lineStart, lineStart + text.length);
    });
  };

  /** Insert a block on its own lines (with blank lines around it). */
  const insertBlock = (block: string, selectFrom = 0, selectTo = 0) =>
    replaceSelection(() => {
      const el = ref.current!;
      const before = value.slice(0, el.selectionStart);
      const lead = before.length === 0 || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
      const text = `${lead}${block}\n\n`;
      return { text, selectStart: lead.length + selectFrom, selectEnd: lead.length + (selectTo || selectFrom) };
    });

  const insertLink = () =>
    replaceSelection((sel) => {
      const label = sel || "link text";
      const text = `[${label}](https://)`;
      return { text, selectStart: label.length + 3, selectEnd: text.length - 1 };
    });

  const insertTable = () => {
    const table = "| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| Cell | Cell | Cell |\n| Cell | Cell | Cell |";
    insertBlock(table, 2, 10);
  };

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post<{ url: string }>("/admin/lesson-images", form);
      const alt = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "image";
      insertBlock(`![${alt}](${data.url})`, 2, 2 + alt.length);
    } catch (err) {
      setUploadError(errorMessage(err, "Could not upload the image."));
    } finally {
      setUploading(false);
    }
  };

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadImage(file);
    e.target.value = "";
  };
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
    if (file) {
      e.preventDefault();
      uploadImage(file);
    }
  };
  const onDrop = (e: DragEvent<HTMLTextAreaElement>) => {
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
    if (file) {
      e.preventDefault();
      uploadImage(file);
    }
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const key = e.key.toLowerCase();
    if (key === "b") { e.preventDefault(); wrap("**", "**", "bold text"); }
    else if (key === "i") { e.preventDefault(); wrap("*", "*", "italic text"); }
    else if (key === "k") { e.preventDefault(); insertLink(); }
  };

  const tools: { label: string; title: string; onClick: () => void; className?: string }[] = [
    { label: "H1", title: "Main heading", onClick: () => prefixLines("# ") },
    { label: "H2", title: "Section heading", onClick: () => prefixLines("## ") },
    { label: "H3", title: "Sub-heading", onClick: () => prefixLines("### ") },
    { label: "B", title: "Bold (Ctrl+B)", onClick: () => wrap("**", "**", "bold text"), className: "font-bold" },
    { label: "I", title: "Italic (Ctrl+I)", onClick: () => wrap("*", "*", "italic text"), className: "italic" },
    { label: "U", title: "Underline", onClick: () => wrap("<u>", "</u>", "underlined text"), className: "underline" },
    { label: "S", title: "Strikethrough", onClick: () => wrap("~~", "~~", "struck text"), className: "line-through" },
    { label: "• List", title: "Bullet list", onClick: () => prefixLines("- ") },
    { label: "1. List", title: "Numbered list", onClick: () => prefixLines((i) => `${i + 1}. `) },
    { label: "❝ Quote", title: "Quote / note", onClick: () => prefixLines("> ") },
    { label: "</> Code", title: "Inline code", onClick: () => wrap("`", "`", "code") },
    { label: "Code block", title: "Code block", onClick: () => insertBlock("```python\n# your code here\n```", 10, 26) },
    { label: "🔗 Link", title: "Link (Ctrl+K)", onClick: insertLink },
    { label: uploading ? "Uploading…" : "🖼 Image", title: "Upload an image (you can also paste or drag one in)", onClick: () => fileRef.current?.click() },
    { label: "▦ Table", title: "Insert a table", onClick: insertTable },
    { label: "— Line", title: "Divider", onClick: () => insertBlock("---") },
  ];

  return (
    <div className="rounded-lg border border-border bg-background">
      <div className="flex flex-wrap items-center gap-1 border-b border-border p-2">
        {tools.map((t) => (
          <button
            key={t.label}
            type="button"
            title={t.title}
            onClick={t.onClick}
            disabled={t.label === "Uploading…"}
            className={`rounded-md px-2 py-1 text-xs text-textSecondary hover:bg-surfaceElevated hover:text-textPrimary disabled:opacity-50 ${t.className ?? ""}`}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex rounded-md border border-border p-0.5">
          {(["write", "split", "preview"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded px-2 py-0.5 text-xs capitalize ${view === v ? "bg-surfaceElevated font-semibold text-textPrimary" : "text-textSecondary"}`}
            >
              {v}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setShowHelp((s) => !s)} className="px-2 text-xs text-accentBlue hover:opacity-80">
          {showHelp ? "Hide help" : "Help"}
        </button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={onFile} />
      </div>

      {showHelp && (
        <div className="grid gap-x-6 gap-y-1 border-b border-border p-3 text-xs text-textSecondary sm:grid-cols-2">
          <span><code># Title</code>, <code>## Section</code>, <code>### Sub</code> headings</span>
          <span><code>**bold**</code>, <code>*italic*</code>, <code>~~strike~~</code></span>
          <span><code>- item</code> bullets, <code>1. item</code> numbered</span>
          <span><code>&gt; note</code> quote, <code>---</code> divider</span>
          <span><code>`code`</code> inline, <code>```python</code> … <code>```</code> block</span>
          <span><code>[text](https://…)</code> link, <code>![alt](url)</code> image</span>
          <span>Tables: <code>| a | b |</code> then <code>| --- | --- |</code></span>
          <span>HTML also works: <code>&lt;u&gt;</code>, <code>&lt;br&gt;</code>, <code>&lt;mark&gt;</code>, <code>&lt;table&gt;</code>… (scripts are removed)</span>
          <span className="sm:col-span-2">Paste or drag an image straight into the text box to upload it.</span>
        </div>
      )}
      {uploadError && <p className="border-b border-border px-3 py-2 text-xs text-accentPink">{uploadError}</p>}

      <div className={`grid ${view === "split" ? "lg:grid-cols-2" : "grid-cols-1"}`}>
        {view !== "preview" && (
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onDrop={onDrop}
            spellCheck
            placeholder={"# Lesson title\n\nStart writing… Use the toolbar above, or type Markdown directly."}
            className="min-h-[420px] w-full resize-y bg-transparent p-3 font-mono text-sm leading-6 text-textPrimary outline-none"
          />
        )}
        {view !== "write" && (
          <div className={`max-h-[620px] min-h-[420px] overflow-y-auto p-4 ${view === "split" ? "border-t border-border lg:border-l lg:border-t-0" : ""}`}>
            <p className="mb-3 text-[11px] uppercase tracking-wide text-textSecondary">Preview — how students will see it</p>
            <LessonPreview markdown={value} />
          </div>
        )}
      </div>
    </div>
  );
}
