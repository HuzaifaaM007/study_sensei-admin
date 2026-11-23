"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatPageRange } from "@/lib/utils";
import type { ChapterInfo, Course, CourseStructure } from "@/lib/types";
import CourseVideos from "@/components/CourseVideos";
import { useToast } from "@/components/Toast";
import { Alert, Badge, Button, Card, ConfirmDialog, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";

const linkButton =
  "inline-flex items-center justify-center rounded-lg bg-surfaceElevated px-4 py-2 text-sm font-semibold text-textPrimary transition hover:bg-border";

export default function CourseDetailPage() {
  const toast = useToast();
  const router = useRouter();
  const { courseId } = useParams<{ courseId: string }>();

  const [course, setCourse] = useState<Course | null>(null);
  const [structure, setStructure] = useState<CourseStructure | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [deletingChapter, setDeletingChapter] = useState<ChapterInfo | null>(null);
  const [deletingCourse, setDeletingCourse] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([
        api.get<Course>(`/catalog/courses/${courseId}`),
        api.get<CourseStructure>(`/admin/courses/${courseId}/structure`),
      ]);
      setCourse(c.data);
      setStructure(s.data);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  const confirmDeleteChapter = async () => {
    if (!deletingChapter) return;
    setBusy(true);
    try {
      const { data } = await api.delete<{ chapter_title: string; lessons_deleted: number }>(
        `/admin/courses/${courseId}/chapters/${encodeURIComponent(deletingChapter.chapter_key)}`
      );
      toast.success(`Chapter "${data.chapter_title}" deleted (${data.lessons_deleted} ${data.lessons_deleted === 1 ? "lesson" : "lessons"}).`);
      setDeletingChapter(null);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteCourse = async () => {
    if (!course) return;
    setBusy(true);
    try {
      await api.delete(`/catalog/courses/${course.course_id}`);
      toast.success(`Course "${course.title}" deleted.`);
      router.replace("/dashboard/courses");
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <div className="space-y-4">
        <Alert>{loadError}</Alert>
        <Link href="/dashboard/courses" className="text-sm text-accentBlue">
          ← Back to courses
        </Link>
      </div>
    );
  }
  if (!course || !structure) return <LoadingBlock />;

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  return (
    <>
      <Link href="/dashboard/courses" className="mb-3 inline-block text-sm text-textSecondary hover:text-textPrimary">
        ← Courses
      </Link>
      <PageHeader
        title={course.title}
        subtitle={course.description}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/lessons?course_id=${course.course_id}`} className={linkButton}>
              Manage lessons
            </Link>
            <Button variant="danger" onClick={() => setDeletingCourse(true)}>
              Delete course
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-textSecondary">Chapters</p>
          <p className="mt-1 text-3xl font-bold">{structure.chapter_count}</p>
        </Card>
        <Card>
          <p className="text-sm text-textSecondary">Lessons</p>
          <p className="mt-1 text-3xl font-bold">{structure.lesson_count}</p>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <p className="text-sm text-textSecondary">Level</p>
          <p className="mt-2">
            <Badge tone={course.level}>{course.level}</Badge>
          </p>
        </Card>
      </div>

      {structure.chapters.length > 0 && !structure.pages_recorded && (
        <div className="mb-4">
          <Alert kind="info">
            Page ranges are only saved for books uploaded after this feature was added. Chapters without a range were
            grouped from their lesson titles. Upload the book again to record its pages.
          </Alert>
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold">Chapters</h2>
      {structure.chapters.length === 0 ? (
        <EmptyState
          title="This course has no chapters yet"
          hint="Upload a PDF book to create chapters from page ranges, or add lessons by hand."
          action={
            <div className="flex justify-center gap-2">
              <Link href="/dashboard/books" className={linkButton}>
                Upload book
              </Link>
              <Link href={`/dashboard/lessons?course_id=${course.course_id}`} className={linkButton}>
                Add lessons
              </Link>
            </div>
          }
        />
      ) : (
        <div className="space-y-3">
          {structure.chapters.map((chapter) => {
            const pages = formatPageRange(chapter.start_page, chapter.end_page);
            return (
              <Card key={chapter.chapter_key}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">
                        {chapter.position}. {chapter.title}
                      </p>
                      {pages ? <Badge tone="intermediate">{pages}</Badge> : <Badge>Pages not recorded</Badge>}
                      <span className="text-xs text-textSecondary">{plural(chapter.lesson_count, "lesson")}</span>
                    </div>
                  </div>
                  <button onClick={() => setDeletingChapter(chapter)} className="text-sm text-accentPink hover:opacity-80">
                    Delete chapter
                  </button>
                </div>
                <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
                  {chapter.lessons.map((lesson) => (
                    <li key={lesson.lesson_id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0 truncate">{lesson.title}</span>
                      <span className="shrink-0 text-xs text-textSecondary">{lesson.estimated_minutes} min</span>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      <CourseVideos courseId={course.course_id} />

      {deletingChapter && (
        <ConfirmDialog
          title="Delete chapter?"
          confirmLabel="Delete chapter"
          loading={busy}
          onConfirm={confirmDeleteChapter}
          onCancel={() => setDeletingChapter(null)}
          message={
            <>
              This permanently deletes <b className="text-textPrimary">{deletingChapter.title}</b>
              {formatPageRange(deletingChapter.start_page, deletingChapter.end_page) && (
                <> ({formatPageRange(deletingChapter.start_page, deletingChapter.end_page)})</>
              )}{" "}
              and <b className="text-accentPink">{plural(deletingChapter.lesson_count, "lesson")}</b>. Quizzes students already took are kept. This
              cannot be undone.
            </>
          }
        />
      )}

      {deletingCourse && (
        <ConfirmDialog
          title="Delete course?"
          confirmLabel="Delete course"
          loading={busy}
          onConfirm={confirmDeleteCourse}
          onCancel={() => setDeletingCourse(false)}
          message={
            <>
              This permanently deletes <b className="text-textPrimary">{course.title}</b>, its{" "}
              <b className="text-accentPink">
                {plural(structure.chapter_count, "chapter")} and {plural(structure.lesson_count, "lesson")}
              </b>
              . Quizzes students already took are kept. This cannot be undone.
            </>
          }
        />
      )}
    </>
  );
}
