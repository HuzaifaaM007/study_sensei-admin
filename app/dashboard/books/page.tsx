"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { estimatePdfPages, formatBytes, slugify, titleFromFilename } from "@/lib/utils";
import { LEVELS, type BookChapter, type BookUploadResponse, type PdfInspection, type Subject } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { Alert, Button, Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";

const MAX_UPLOAD_MB = 50;

export default function BookUploadPage() {
  const toast = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [detectedPages, setDetectedPages] = useState<number | null>(null);

  const [subjectMode, setSubjectMode] = useState<"existing" | "new">("existing");
  const [subjectId, setSubjectId] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectSlug, setNewSubjectSlug] = useState("");

  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [level, setLevel] = useState<string>("beginner");
  const [attribution, setAttribution] = useState("");
  const [sourceName, setSourceName] = useState("Admin Upload");

  const [inspection, setInspection] = useState<PdfInspection | null>(null);
  const [mode, setMode] = useState<"count" | "size" | "bookmarks" | "manual">("count");
  const [pagesPerChapter, setPagesPerChapter] = useState(10);
  const [markdown, setMarkdown] = useState(true);
  const [maxWords, setMaxWords] = useState(1500);
  const [totalPages, setTotalPages] = useState(30);
  const [chapterCount, setChapterCount] = useState(3);
  const [chapters, setChapters] = useState<BookChapter[]>([{ title: "Chapter 1", start_page: 1, end_page: 10 }]);

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewKey, setPreviewKey] = useState(0);
  const [ticked, setTicked] = useState<Set<number>>(new Set());

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BookUploadResponse | null>(null);

  useEffect(() => {
    api
      .get<Subject[]>("/catalog/subjects")
      .then(({ data }) => {
        setSubjects(data);
        if (data.length) setSubjectId(data[0].subject_id);
        else setSubjectMode("new");
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const showPage = (page: number) => {
    setPreviewPage(Math.max(1, Math.floor(page) || 1));
    setPreviewKey((k) => k + 1); // reloads the viewer at the requested page
  };

  const chooseFile = async (selected: File | null) => {
    setPdfUrl(null);
    setInspection(null);
    setTicked(new Set());
    setFile(selected);
    setResult(null);
    setError(null);
    setDetectedPages(null);
    if (!selected) return;
    if (!/\.pdf$/i.test(selected.name)) {
      setError("Only PDF files are supported.");
      return;
    }
    if (selected.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setError(`This file is larger than ${MAX_UPLOAD_MB} MB. Split the PDF or upload fewer pages.`);
      return;
    }
    setPdfUrl(URL.createObjectURL(selected));
    setPreviewPage(1);
    if (!courseTitle) setCourseTitle(titleFromFilename(selected.name));
    const pages = await estimatePdfPages(selected);
    setDetectedPages(pages);
    if (pages) setTotalPages(pages);
    try {
      const form = new FormData();
      form.append("file", selected);
      const { data } = await api.post<PdfInspection>("/admin/books/inspect", form, { timeout: 2 * 60 * 1000 });
      setInspection(data);
      setTotalPages(data.total_pages);
      setDetectedPages(data.total_pages);
      if (data.outline.length > 0) setMode("bookmarks");
      if (!data.has_text) setError("This PDF seems to be scanned (no selectable text). It needs OCR before it can be imported.");
    } catch {
      // The estimate above still lets the admin continue.
    }
  };

  const tickLevel = (level: number) => {
    if (!inspection) return;
    const next = new Set<number>();
    inspection.outline.forEach((item, index) => {
      if (item.level === level) next.add(index);
    });
    setTicked(next);
  };

  const chaptersFromTicked = () => {
    if (!inspection) return;
    const picked = [...ticked]
      .map((index) => inspection.outline[index])
      .sort((x, y) => x.page - y.page)
      .filter((item, i, all) => i === 0 || item.page > all[i - 1].page);
    if (picked.length === 0) return setError("Tick at least one bookmark to start a chapter.");
    setError(null);
    setChapters(
      picked.map((item, i) => ({
        title: item.title,
        start_page: item.page,
        end_page: i + 1 < picked.length ? picked[i + 1].page - 1 : inspection.total_pages,
      }))
    );
  };

  const generateBySize = () => {
    const pages = Math.max(1, Math.floor(totalPages));
    const size = Math.max(1, Math.floor(pagesPerChapter));
    const next: BookChapter[] = [];
    for (let i = 0, start = 1; start <= pages; i++, start += size) {
      next.push({ title: `Chapter ${i + 1}`, start_page: start, end_page: Math.min(pages, start + size - 1) });
    }
    setChapters(next);
  };

  const generateChapters = () => {
    const pages = Math.max(1, Math.floor(totalPages));
    const count = Math.max(1, Math.min(Math.floor(chapterCount), pages));
    const size = Math.ceil(pages / count);
    const next: BookChapter[] = [];
    for (let i = 0, start = 1; start <= pages; i++, start += size) {
      next.push({ title: `Chapter ${i + 1}`, start_page: start, end_page: Math.min(pages, start + size - 1) });
    }
    setChapters(next);
  };

  const updateChapter = (index: number, patch: Partial<BookChapter>) =>
    setChapters((current) => current.map((chapter, i) => (i === index ? { ...chapter, ...patch } : chapter)));

  const validate = (): string | null => {
    if (!file) return "Choose a PDF file first.";
    if (!/\.pdf$/i.test(file.name)) return "Only PDF files are supported.";
    if (!courseTitle.trim()) return "Course title is required.";
    if (!courseDescription.trim()) return "Course description is required.";
    if (!attribution.trim()) return "Attribution is required (who wrote or owns this book).";
    if (subjectMode === "existing" && !subjectId) return "Pick a subject.";
    if (subjectMode === "new" && (!newSubjectName.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(newSubjectSlug))) {
      return "A new subject needs a name and a valid slug (lowercase letters, numbers, hyphens).";
    }
    if (chapters.length === 0) return "Add at least one chapter.";
    for (const [i, chapter] of chapters.entries()) {
      if (!chapter.title.trim()) return `Chapter ${i + 1} needs a title.`;
      if (!(chapter.start_page >= 1) || !(chapter.end_page >= chapter.start_page)) {
        return `Chapter ${i + 1}: pages must start at 1 or higher and the end page cannot be before the start page.`;
      }
    }
    return null;
  };

  const submit = async () => {
    const problem = validate();
    if (problem || !file) return setError(problem);
    setError(null);
    setResult(null);

    const subject = subjects.find((s) => s.subject_id === subjectId);
    const metadata = {
      subject_slug: subjectMode === "existing" ? subject!.slug : newSubjectSlug,
      subject_name: subjectMode === "existing" ? subject!.name : newSubjectName.trim(),
      subject_description: null,
      course_title: courseTitle.trim(),
      course_description: courseDescription.trim(),
      level,
      attribution: attribution.trim(),
      source_name: sourceName.trim() || "Admin Upload",
      markdown,
      max_words_per_lesson: maxWords,
      chapters: chapters.map((c) => ({ title: c.title.trim(), start_page: c.start_page, end_page: c.end_page })),
    };

    const formData = new FormData();
    formData.append("file", file);
    formData.append("metadata", JSON.stringify(metadata));

    setUploading(true);
    setProgress(0);
    try {
      const { data } = await api.post<BookUploadResponse>("/catalog/books/upload", formData, {
        timeout: 5 * 60 * 1000,
        onUploadProgress: (event) => event.total && setProgress(Math.round((event.loaded / event.total) * 100)),
      });
      setResult(data);
      toast.success(
        data.chapters_created !== undefined
          ? `Created "${data.title}" with ${data.chapters_created} chapters and ${data.lessons_created} lessons.`
          : `Created "${data.title}" with ${data.lessons_created} lessons.`
      );
    } catch (err) {
      setError(errorMessage(err, "Upload failed."));
    } finally {
      setUploading(false);
    }
  };

  const overlapping = chapters.some((a, i) => chapters.some((b, j) => i < j && a.start_page <= b.end_page && b.start_page <= a.end_page));

  return (
    <>
      <PageHeader
        title="Upload book"
        subtitle="Turn a PDF into a course. Each chapter's page range becomes a lesson (chapters over about 2,500 words are split into parts)."
      />

      <div className="grid gap-6 xl:grid-cols-2">
      <div className="min-w-0 space-y-6">
        <Card className="space-y-4">
          <h2 className="font-semibold">1. PDF file</h2>
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-textSecondary file:mr-4 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2 file:font-semibold file:text-black"
          />
          {file && (
            <p className="text-sm text-textSecondary">
              {file.name} · {formatBytes(file.size)}
              {detectedPages ? ` · about ${detectedPages} pages (estimated from the file)` : " · page count could not be read, enter it below"}
            </p>
          )}
          <Alert kind="info">
            The PDF needs selectable text. Scanned books (pictures of pages) contain no text and will be rejected until they are run through OCR.
          </Alert>
        </Card>

        <Card className="space-y-4">
          <h2 className="font-semibold">2. Subject and course</h2>
          <div className="flex gap-2 text-sm">
            <button
              onClick={() => setSubjectMode("existing")}
              disabled={subjects.length === 0}
              className={subjectMode === "existing" ? "font-semibold" : "text-textSecondary disabled:opacity-40"}
            >
              Existing subject
            </button>
            <span className="text-textSecondary">/</span>
            <button onClick={() => setSubjectMode("new")} className={subjectMode === "new" ? "font-semibold" : "text-textSecondary"}>
              New subject
            </button>
          </div>
          {subjectMode === "existing" ? (
            <Field label="Subject">
              <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                {subjects.map((s) => (
                  <option key={s.subject_id} value={s.subject_id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Subject name">
                <Input
                  value={newSubjectName}
                  onChange={(e) => {
                    setNewSubjectName(e.target.value);
                    setNewSubjectSlug(slugify(e.target.value));
                  }}
                  placeholder="Databases"
                />
              </Field>
              <Field label="Subject slug">
                <Input value={newSubjectSlug} onChange={(e) => setNewSubjectSlug(e.target.value)} />
              </Field>
            </div>
          )}
          <Field label="Course title">
            <Input value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} />
          </Field>
          <Field label="Course description">
            <Textarea rows={3} value={courseDescription} onChange={(e) => setCourseDescription(e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Level">
              <Select value={level} onChange={(e) => setLevel(e.target.value)}>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Attribution" hint="Author and publisher, or license.">
              <Input value={attribution} onChange={(e) => setAttribution(e.target.value)} />
            </Field>
            <Field label="Source name">
              <Input value={sourceName} onChange={(e) => setSourceName(e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="font-semibold">3. Chapters (page ranges)</h2>
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex flex-wrap gap-3 text-sm">
              {([
                ["count", "Number of chapters"],
                ["size", "Pages per chapter"],
                ["bookmarks", `PDF bookmarks${inspection ? ` (${inspection.outline.length})` : ""}`],
                ["manual", "Manual"],
              ] as const).map(([value, label]) => (
                <button key={value} onClick={() => setMode(value)} className={mode === value ? "font-semibold" : "text-textSecondary"}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              {mode !== "manual" && (
                <Field label="Total pages to use">
                  <Input type="number" min={1} value={totalPages} onChange={(e) => setTotalPages(Number(e.target.value))} className="w-28" />
                </Field>
              )}
              {mode === "count" && (
                <>
                  <Field label="How many chapters">
                    <Input type="number" min={1} value={chapterCount} onChange={(e) => setChapterCount(Number(e.target.value))} className="w-28" />
                  </Field>
                  <Button variant="secondary" onClick={generateChapters}>Create chapters</Button>
                </>
              )}
              {mode === "size" && (
                <>
                  <Field label="Pages in each chapter">
                    <Input type="number" min={1} value={pagesPerChapter} onChange={(e) => setPagesPerChapter(Number(e.target.value))} className="w-28" />
                  </Field>
                  <Button variant="secondary" onClick={generateBySize}>Create chapters</Button>
                </>
              )}
            </div>
            {mode === "bookmarks" && (
              <div className="space-y-2">
                {!inspection || inspection.outline.length === 0 ? (
                  <p className="text-sm text-textSecondary">This PDF has no bookmarks. Use another mode and the preview to find the pages.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-textSecondary">Tick every bookmark that starts a chapter:</span>
                      {[0, 1, 2].map((lvl) => (
                        <button key={lvl} onClick={() => tickLevel(lvl)} className="rounded border border-border px-2 py-0.5 hover:bg-surfaceElevated">
                          All level {lvl + 1}
                        </button>
                      ))}
                      <button onClick={() => setTicked(new Set())} className="text-textSecondary">Clear</button>
                    </div>
                    <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                      {inspection.outline.map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 border-b border-border px-2 py-1 text-sm last:border-0"
                          style={{ paddingLeft: 8 + item.level * 16 }}
                        >
                          <input
                            type="checkbox"
                            checked={ticked.has(index)}
                            onChange={() =>
                              setTicked((cur) => {
                                const next = new Set(cur);
                                if (next.has(index)) next.delete(index);
                                else next.add(index);
                                return next;
                              })
                            }
                          />
                          <span className="min-w-0 flex-1 truncate">{item.title}</span>
                          <button onClick={() => showPage(item.page)} className="text-accentBlue">
                            p.{item.page}
                          </button>
                        </div>
                      ))}
                    </div>
                    <Button variant="secondary" onClick={chaptersFromTicked} disabled={ticked.size === 0}>
                      Create chapters from {ticked.size} ticked
                    </Button>
                  </>
                )}
              </div>
            )}
            <p className="text-xs text-textSecondary">
              Pick how to divide the book, then rename chapters or adjust pages below. You always have the final say.
            </p>
          </div>

          <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={markdown} onChange={(e) => setMarkdown(e.target.checked)} />
              Keep headings, sub-headings, lists and code formatting
            </label>
            <Field label="Split a chapter into pages after about (words)" hint="Each lesson page stays near this length. 1,500 is about 10 minutes of reading.">
              <Input type="number" min={300} step={100} value={maxWords} onChange={(e) => setMaxWords(Number(e.target.value))} className="w-28" />
            </Field>
          </div>

          <div className="space-y-2">
            {chapters.map((chapter, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <Input
                  className="min-w-48 flex-1"
                  value={chapter.title}
                  onChange={(e) => updateChapter(index, { title: e.target.value })}
                  placeholder="Chapter title"
                />
                <Input
                  type="number"
                  min={1}
                  className="w-24"
                  value={chapter.start_page}
                  onChange={(e) => updateChapter(index, { start_page: Number(e.target.value) })}
                  aria-label="Start page"
                />
                <span className="text-textSecondary">to</span>
                <Input
                  type="number"
                  min={1}
                  className="w-24"
                  value={chapter.end_page}
                  onChange={(e) => updateChapter(index, { end_page: Number(e.target.value) })}
                  aria-label="End page"
                />
                <button onClick={() => showPage(chapter.start_page)} className="text-xs text-accentBlue" disabled={!pdfUrl}>
                  View
                </button>
                <button
                  onClick={() => setChapters((current) => current.filter((_, i) => i !== index))}
                  disabled={chapters.length === 1}
                  className="text-accentPink disabled:opacity-30"
                  aria-label="Remove chapter"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                const last = chapters[chapters.length - 1];
                const start = last ? last.end_page + 1 : 1;
                setChapters((current) => [...current, { title: `Chapter ${current.length + 1}`, start_page: start, end_page: start + 9 }]);
              }}
              className="text-sm text-accentBlue"
            >
              + Add chapter
            </button>
            {overlapping && <span className="text-xs text-accentOrange">Some page ranges overlap, so those pages will appear in more than one lesson.</span>}
          </div>
          <p className="text-xs text-textSecondary">
            Page numbers are PDF pages (1 = the first page of the file), not the numbers printed on the pages. A range past the end of the PDF is trimmed automatically.
          </p>
        </Card>

        {error && <Alert>{error}</Alert>}

        {uploading && (
          <Card>
            <p className="text-sm">{progress < 100 ? `Uploading... ${progress}%` : "Upload complete. Extracting text and creating lessons, this can take a minute..."}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surfaceElevated">
              <div className={`h-full bg-accentBlue transition-all ${progress >= 100 ? "animate-pulse" : ""}`} style={{ width: `${progress}%` }} />
            </div>
          </Card>
        )}

        {result && (
          <Alert kind="info">
            Created <b>{result.title}</b> with{" "}
            {result.chapters_created !== undefined && (
              <>
                <b>{result.chapters_created}</b> {result.chapters_created === 1 ? "chapter" : "chapters"} and{" "}
              </>
            )}
            <b>{result.lessons_created}</b> lessons.{" "}
            <Link href={`/dashboard/courses/${result.course_id}`} className="underline">
              View its chapters and pages
            </Link>{" "}
            or{" "}
            <Link href={`/dashboard/lessons?course_id=${result.course_id}`} className="underline">
              open its lessons
            </Link>{" "}
            to rename or review them.
          </Alert>
        )}

        {result && result.chapters_skipped && result.chapters_skipped.length > 0 && (
          <Alert kind="warning">
            No text was found in the page range of <b>{result.chapters_skipped.join(", ")}</b>, so no lessons were created for{" "}
            {result.chapters_skipped.length === 1 ? "it" : "them"}. Check the page numbers, or run the PDF through OCR if those pages are scans.
          </Alert>
        )}

        <Button onClick={submit} loading={uploading} className="w-full sm:w-auto">
          Upload and create course
        </Button>
      </div>
      <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">PDF preview</h2>
            {pdfUrl && (
              <div className="ml-auto flex items-center gap-2 text-sm">
                <span className="text-textSecondary">Go to page</span>
                <Input
                  type="number"
                  min={1}
                  className="w-24"
                  value={previewPage}
                  onChange={(e) => setPreviewPage(Number(e.target.value))}
                  onKeyDown={(e) => e.key === "Enter" && showPage(previewPage)}
                />
                <Button variant="secondary" onClick={() => showPage(previewPage)}>
                  Go
                </Button>
              </div>
            )}
          </div>
          {pdfUrl ? (
            <iframe
              key={previewKey}
              src={`${pdfUrl}#page=${previewPage}`}
              title="PDF preview"
              className="h-[75vh] w-full rounded-lg border border-border bg-white"
            />
          ) : (
            <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-textSecondary">
              Choose a PDF in step 1 and it appears here, so you can read the real pages and set each chapter&apos;s start and end.
            </p>
          )}
          <p className="text-xs text-textSecondary">
            The page numbers here are PDF pages (1 = the first page of the file). Use the &quot;View&quot; button on a chapter to jump to its first page.
            This preview is shown only in your browser; nothing is uploaded until you press Upload.
          </p>
        </Card>
      </div>
      </div>
    </>
  );
}
