"use client";
import LessonEditor from "@/components/LessonEditor";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { estimateMinutes, wordCount } from "@/lib/utils";
import { LEVELS, type Course, type Lesson } from "@/lib/types";
import { useToast } from "@/components/Toast";
import {
  Alert, Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, LoadingBlock, Modal, PageHeader, Select, Textarea,
} from "@/components/ui";

interface FormState {
  title: string;
  summary: string;
  contentText: string;
  orderIndex: number;
  estimatedMinutes: number;
  difficulty: string;
  quizEligible: boolean;
  audioEligible: boolean;
}

const emptyForm: FormState = {
  title: "",
  summary: "",
  contentText: "",
  orderIndex: 0,
  estimatedMinutes: 10,
  difficulty: "beginner",
  quizEligible: true,
  audioEligible: true,
};

function LessonsContent() {
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const courseId = params.get("course_id") ?? "";

  const [courses, setCourses] = useState<Course[] | null>(null);
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const [editing, setEditing] = useState<Lesson | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<Lesson | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    api
      .get<Course[]>("/catalog/courses")
      .then(({ data }) => setCourses(data))
      .catch((err) => setLoadError(errorMessage(err)));
  }, []);

  const loadLessons = useCallback(async () => {
    if (!courseId) {
      setLessons(null);
      return;
    }
    try {
      const { data } = await api.get<Lesson[]>(`/catalog/courses/${courseId}/lessons`);
      setLessons(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, [courseId]);

  useEffect(() => {
    setLessons(null);
    loadLessons();
  }, [loadLessons]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const openCreate = () => {
    const nextOrder = lessons && lessons.length ? Math.max(...lessons.map((l) => l.order_index)) + 1 : 0;
    setForm({ ...emptyForm, orderIndex: nextOrder });
    setFormError(null);
    setEditing("new");
  };

  const openEdit = (lesson: Lesson) => {
    setForm({
      title: lesson.title,
      summary: lesson.summary,
      contentText: lesson.content_text,
      orderIndex: lesson.order_index,
      estimatedMinutes: lesson.estimated_minutes,
      difficulty: lesson.difficulty,
      quizEligible: lesson.quiz_eligible,
      audioEligible: lesson.audio_eligible,
    });
    setFormError(null);
    setEditing(lesson);
  };

  const save = async () => {
    setFormError(null);
    if (!form.title.trim()) return setFormError("Title is required.");
    if (!form.summary.trim()) return setFormError("Summary is required. It is also what the audio narration reads.");
    if (!form.contentText.trim()) return setFormError("Lesson content is required.");

    const payload = {
      title: form.title.trim(),
      summary: form.summary.trim(),
      content_text: form.contentText,
      order_index: form.orderIndex,
      estimated_minutes: form.estimatedMinutes,
      difficulty: form.difficulty,
      quiz_eligible: form.quizEligible,
      audio_eligible: form.audioEligible,
    };

    setSaving(true);
    try {
      if (editing === "new") {
        await api.post("/catalog/lessons", { ...payload, course_id: courseId });
        toast.success("Lesson created.");
      } else if (editing) {
        await api.patch(`/catalog/lessons/${editing.lesson_id}`, payload);
        toast.success("Lesson updated.");
      }
      setEditing(null);
      await loadLessons();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.delete(`/catalog/lessons/${deleting.lesson_id}`);
      toast.success(`Lesson "${deleting.title}" deleted.`);
      setDeleting(null);
      await loadLessons();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  };

  /** Moves a lesson and renumbers everything 0..n-1 so the order is always unambiguous. */
  const move = async (index: number, direction: -1 | 1) => {
    if (!lessons) return;
    const target = index + direction;
    if (target < 0 || target >= lessons.length) return;
    const next = [...lessons];
    [next[index], next[target]] = [next[target], next[index]];
    setReordering(true);
    try {
      await Promise.all(
        next
          .map((lesson, position) => ({ lesson, position }))
          .filter(({ lesson, position }) => lesson.order_index !== position)
          .map(({ lesson, position }) => api.patch(`/catalog/lessons/${lesson.lesson_id}`, { order_index: position }))
      );
      await loadLessons();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setReordering(false);
    }
  };

  const chooseCourse = (id: string) => router.replace(id ? `/dashboard/lessons?course_id=${id}` : "/dashboard/lessons");

  if (loadError && !lessons) return <Alert>{loadError}</Alert>;
  if (!courses) return <LoadingBlock />;

  const course = courses.find((c) => c.course_id === courseId);

  return (
    <>
      <PageHeader
        title="Lessons"
        subtitle={course ? course.title : "Pick a course to manage its lessons."}
        action={courseId ? <Button onClick={openCreate}>New lesson</Button> : undefined}
      />

      <div className="mb-5 w-full sm:w-96">
        <Select value={courseId} onChange={(e) => chooseCourse(e.target.value)}>
          <option value="">Select a course...</option>
          {courses.map((c) => (
            <option key={c.course_id} value={c.course_id}>
              {c.title}
            </option>
          ))}
        </Select>
      </div>

      {!courseId ? (
        <EmptyState title="No course selected" hint="Choose a course above, or open one from the Courses page." />
      ) : !lessons ? (
        <LoadingBlock />
      ) : lessons.length === 0 ? (
        <EmptyState title="This course has no lessons yet" action={<Button onClick={openCreate}>New lesson</Button>} />
      ) : (
        <div className="space-y-3">
          {lessons.map((lesson, index) => (
            <Card key={lesson.lesson_id}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex flex-col">
                    <button
                      onClick={() => move(index, -1)}
                      disabled={reordering || index === 0}
                      className="text-textSecondary hover:text-textPrimary disabled:opacity-30"
                      aria-label="Move up"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => move(index, 1)}
                      disabled={reordering || index === lessons.length - 1}
                      className="text-textSecondary hover:text-textPrimary disabled:opacity-30"
                      aria-label="Move down"
                    >
                      ▼
                    </button>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">
                        {index + 1}. {lesson.title}
                      </p>
                      <Badge tone={lesson.difficulty}>{lesson.difficulty}</Badge>
                      <span className="text-xs text-textSecondary">{lesson.estimated_minutes} min</span>
                      {!lesson.quiz_eligible && <Badge>no quiz</Badge>}
                      {!lesson.audio_eligible && <Badge>no audio</Badge>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-textSecondary">{lesson.summary}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <button
                    onClick={() => setExpanded(expanded === lesson.lesson_id ? null : lesson.lesson_id)}
                    className="text-accentGreen hover:opacity-80"
                  >
                    {expanded === lesson.lesson_id ? "Hide" : "Preview"}
                  </button>
                  <button onClick={() => openEdit(lesson)} className="text-accentBlue hover:opacity-80">
                    Edit
                  </button>
                  <button onClick={() => setDeleting(lesson)} className="text-accentPink hover:opacity-80">
                    Delete
                  </button>
                </div>
              </div>
              {expanded === lesson.lesson_id && (
                <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-background p-4 font-mono text-xs text-textSecondary">
                  {lesson.content_text}
                </pre>
              )}
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <Modal title={editing === "new" ? "New lesson" : "Edit lesson"} onClose={() => setEditing(null)} extraWide>
          <div className="space-y-4">
            <Field label="Title">
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
            </Field>
            <Field label="Summary" hint="A sentence or two. The audio narration reads this, so keep it spoken-friendly.">
              <Textarea rows={2} value={form.summary} onChange={(e) => set("summary", e.target.value)} />
            </Field>
            <Field
              label="Lesson content"
              hint={`${wordCount(form.contentText)} words. Students read this and quizzes are generated from it. Keep each lesson under about 2,500 words.`}
            >
              <LessonEditor value={form.contentText} onChange={(next) => set("contentText", next)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Position">
                <Input type="number" min={0} value={form.orderIndex} onChange={(e) => set("orderIndex", Number(e.target.value))} />
              </Field>
              <Field label="Minutes">
                <div className="flex gap-2">
                  <Input type="number" min={1} value={form.estimatedMinutes} onChange={(e) => set("estimatedMinutes", Number(e.target.value))} />
                  <Button variant="secondary" onClick={() => set("estimatedMinutes", estimateMinutes(form.contentText))} title="Estimate from the word count">
                    Auto
                  </Button>
                </div>
              </Field>
              <Field label="Difficulty">
                <Select value={form.difficulty} onChange={(e) => set("difficulty", e.target.value)}>
                  {LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.quizEligible} onChange={(e) => set("quizEligible", e.target.checked)} />
                Students can generate quizzes
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.audioEligible} onChange={(e) => set("audioEligible", e.target.checked)} />
                Students can listen (audio)
              </label>
            </div>
            {formError && <Alert>{formError}</Alert>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={save} loading={saving}>
                {editing === "new" ? "Create lesson" : "Save changes"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete lesson?"
          loading={deleteBusy}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
          message={
            <>
              This permanently deletes <b className="text-textPrimary">{deleting.title}</b>. This cannot be undone.
            </>
          }
        />
      )}
    </>
  );
}

export default function LessonsPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <LessonsContent />
    </Suspense>
  );
}
