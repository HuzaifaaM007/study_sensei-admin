"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { slugify } from "@/lib/utils";
import { LEVELS, type Course, type CourseOverview, type Subject } from "@/lib/types";
import { useToast } from "@/components/Toast";
import {
  Alert, Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, LoadingBlock, Modal, PageHeader, Select, Textarea,
} from "@/components/ui";

interface FormState {
  subjectMode: "existing" | "new";
  subjectId: string;
  newSubjectName: string;
  newSubjectSlug: string;
  sourceName: string;
  title: string;
  description: string;
  level: string;
  sourceUrl: string;
  attribution: string;
}

const emptyForm: FormState = {
  subjectMode: "existing",
  subjectId: "",
  newSubjectName: "",
  newSubjectSlug: "",
  sourceName: "Manual Entry",
  title: "",
  description: "",
  level: "beginner",
  sourceUrl: "internal://studysensei/manual",
  attribution: "Study Sensei",
};

function CoursesContent() {
  const toast = useToast();
  const params = useSearchParams();
  const [courses, setCourses] = useState<CourseOverview[] | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [subjectFilter, setSubjectFilter] = useState(params.get("subject") ?? "");
  const [search, setSearch] = useState("");

  const [editing, setEditing] = useState<Course | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<Course | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([api.get<CourseOverview[]>("/admin/courses"), api.get<Subject[]>("/catalog/subjects")]);
      setCourses(c.data);
      setSubjects(s.data);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const subjectName = useMemo(() => {
    const map = new Map(subjects.map((s) => [s.subject_id, s.name]));
    return (id: string) => map.get(id) ?? "Unknown subject";
  }, [subjects]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (courses ?? []).filter(
      (course) =>
        (!subjectFilter || course.subject_id === subjectFilter) &&
        (!term || course.title.toLowerCase().includes(term) || course.description.toLowerCase().includes(term))
    );
  }, [courses, subjectFilter, search]);

  const openCreate = () => {
    setForm({ ...emptyForm, subjectId: subjectFilter || subjects[0]?.subject_id || "", subjectMode: subjects.length ? "existing" : "new" });
    setFormError(null);
    setEditing("new");
  };

  const openEdit = (course: Course) => {
    setForm({
      ...emptyForm,
      title: course.title,
      description: course.description,
      level: course.level,
      sourceUrl: course.source_url,
      attribution: course.attribution,
    });
    setFormError(null);
    setEditing(course);
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setFormError(null);
    if (!form.title.trim()) return setFormError("Title is required.");
    if (!form.description.trim()) return setFormError("Description is required.");
    if (!form.attribution.trim()) return setFormError("Attribution is required.");

    setSaving(true);
    try {
      if (editing === "new") {
        let subjectSlug: string;
        let subjectNameValue: string;
        if (form.subjectMode === "existing") {
          const subject = subjects.find((s) => s.subject_id === form.subjectId);
          if (!subject) {
            setSaving(false);
            return setFormError("Pick a subject, or switch to creating a new one.");
          }
          subjectSlug = subject.slug;
          subjectNameValue = subject.name;
        } else {
          if (!form.newSubjectName.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.newSubjectSlug)) {
            setSaving(false);
            return setFormError("A new subject needs a name and a valid slug (lowercase letters, numbers, hyphens).");
          }
          subjectSlug = form.newSubjectSlug;
          subjectNameValue = form.newSubjectName.trim();
        }
        await api.post("/catalog/courses", {
          subject_slug: subjectSlug,
          subject_name: subjectNameValue,
          source_name: form.sourceName.trim() || "Manual Entry",
          title: form.title.trim(),
          description: form.description.trim(),
          level: form.level,
          source_url: form.sourceUrl.trim() || "internal://studysensei/manual",
          attribution: form.attribution.trim(),
        });
        toast.success(`Course "${form.title.trim()}" created. Open it to add lessons.`);
      } else if (editing) {
        await api.patch(`/catalog/courses/${editing.course_id}`, {
          title: form.title.trim(),
          description: form.description.trim(),
          level: form.level,
          source_url: form.sourceUrl.trim(),
          attribution: form.attribution.trim(),
        });
        toast.success("Course updated.");
      }
      setEditing(null);
      await load();
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
      await api.delete(`/catalog/courses/${deleting.course_id}`);
      toast.success(`Course "${deleting.title}" deleted.`);
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  };

  if (loadError) return <Alert>{loadError}</Alert>;
  if (!courses) return <LoadingBlock />;

  return (
    <>
      <PageHeader
        title="Courses"
        subtitle="Each course belongs to a subject and contains lessons."
        action={<Button onClick={openCreate}>New course</Button>}
      />

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="w-full sm:w-64">
          <Select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.subject_id} value={s.subject_id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-full sm:w-72">
          <Input placeholder="Search title or description" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={courses.length === 0 ? "No courses yet" : "No courses match your filters"}
          hint={courses.length === 0 ? "Create one, or upload a PDF book." : undefined}
          action={courses.length === 0 ? <Button onClick={openCreate}>New course</Button> : undefined}
        />
      ) : (
        <div className="space-y-3">
          {visible.map((course) => (
            <Card key={course.course_id} className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/dashboard/courses/${course.course_id}`} className="font-semibold hover:underline">
                    {course.title}
                  </Link>
                  <Badge tone={course.level}>{course.level}</Badge>
                  <Badge>
                    {course.chapter_count} {course.chapter_count === 1 ? "chapter" : "chapters"} · {course.lesson_count}{" "}
                    {course.lesson_count === 1 ? "lesson" : "lessons"}
                  </Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-textSecondary">{course.description}</p>
                <p className="mt-1 text-xs text-textSecondary">
                  {subjectName(course.subject_id)} · {course.attribution}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Link href={`/dashboard/courses/${course.course_id}`} className="text-accentPurple hover:opacity-80">
                  Chapters
                </Link>
                <Link href={`/dashboard/lessons?course_id=${course.course_id}`} className="text-accentGreen hover:opacity-80">
                  Lessons
                </Link>
                <Link href={`/dashboard/courses/${course.course_id}#videos`} className="text-accentOrange hover:opacity-80">
                  Videos
                </Link>
                <button onClick={() => openEdit(course)} className="text-accentBlue hover:opacity-80">
                  Edit
                </button>
                <button onClick={() => setDeleting(course)} className="text-accentPink hover:opacity-80">
                  Delete
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <Modal title={editing === "new" ? "New course" : "Edit course"} onClose={() => setEditing(null)} wide>
          <div className="space-y-4">
            {editing === "new" && (
              <div className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex gap-2 text-sm">
                  <button
                    onClick={() => set("subjectMode", "existing")}
                    disabled={subjects.length === 0}
                    className={form.subjectMode === "existing" ? "font-semibold text-textPrimary" : "text-textSecondary disabled:opacity-40"}
                  >
                    Existing subject
                  </button>
                  <span className="text-textSecondary">/</span>
                  <button
                    onClick={() => set("subjectMode", "new")}
                    className={form.subjectMode === "new" ? "font-semibold text-textPrimary" : "text-textSecondary"}
                  >
                    New subject
                  </button>
                </div>
                {form.subjectMode === "existing" ? (
                  <Field label="Subject">
                    <Select value={form.subjectId} onChange={(e) => set("subjectId", e.target.value)}>
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
                        value={form.newSubjectName}
                        onChange={(e) => {
                          const name = e.target.value;
                          setForm((f) => ({ ...f, newSubjectName: name, newSubjectSlug: slugify(name) }));
                        }}
                        placeholder="Mobile Development"
                      />
                    </Field>
                    <Field label="Subject slug">
                      <Input value={form.newSubjectSlug} onChange={(e) => set("newSubjectSlug", e.target.value)} />
                    </Field>
                  </div>
                )}
              </div>
            )}

            <Field label="Title">
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Introduction to Databases" />
            </Field>
            <Field label="Description">
              <Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Level">
                <Select value={form.level} onChange={(e) => set("level", e.target.value)}>
                  {LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Attribution" hint="Who wrote or owns this material.">
                <Input value={form.attribution} onChange={(e) => set("attribution", e.target.value)} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Source URL">
                <Input value={form.sourceUrl} onChange={(e) => set("sourceUrl", e.target.value)} />
              </Field>
              {editing === "new" && (
                <Field label="Source name">
                  <Input value={form.sourceName} onChange={(e) => set("sourceName", e.target.value)} />
                </Field>
              )}
            </div>
            {formError && <Alert>{formError}</Alert>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={save} loading={saving}>
                {editing === "new" ? "Create course" : "Save changes"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete course?"
          loading={deleteBusy}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
          message={
            <>
              This permanently deletes <b className="text-textPrimary">{deleting.title}</b> and <b className="text-accentPink">all of its chapters and lessons</b>.
              Quizzes students already took are kept. This cannot be undone.
            </>
          }
        />
      )}
    </>
  );
}

export default function CoursesPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <CoursesContent />
    </Suspense>
  );
}
