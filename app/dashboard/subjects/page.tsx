"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { slugify } from "@/lib/utils";
import type { Course, Subject } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { Alert, Button, Card, ConfirmDialog, EmptyState, Field, Input, LoadingBlock, Modal, PageHeader, Textarea } from "@/components/ui";

interface FormState {
  slug: string;
  name: string;
  description: string;
}

const emptyForm: FormState = { slug: "", name: "", description: "" };

export default function SubjectsPage() {
  const toast = useToast();
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Subject | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<Subject | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([api.get<Subject[]>("/catalog/subjects"), api.get<Course[]>("/catalog/courses")]);
      setSubjects(s.data);
      setCourses(c.data);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const courseCounts = useMemo(() => {
    const counts = new Map<string, number>();
    courses.forEach((course) => counts.set(course.subject_id, (counts.get(course.subject_id) ?? 0) + 1));
    return counts;
  }, [courses]);

  const openCreate = () => {
    setForm(emptyForm);
    setSlugTouched(false);
    setFormError(null);
    setEditing("new");
  };

  const openEdit = (subject: Subject) => {
    setForm({ slug: subject.slug, name: subject.name, description: subject.description ?? "" });
    setFormError(null);
    setEditing(subject);
  };

  const save = async () => {
    setFormError(null);
    if (!form.name.trim()) return setFormError("Name is required.");
    if (editing === "new" && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) {
      return setFormError("Slug must use lowercase letters, numbers and single hyphens, for example web-development.");
    }
    setSaving(true);
    try {
      if (editing === "new") {
        await api.post("/catalog/subjects", {
          slug: form.slug,
          name: form.name.trim(),
          description: form.description.trim() || null,
        });
        toast.success(`Subject "${form.name.trim()}" created.`);
      } else if (editing) {
        await api.patch(`/catalog/subjects/${editing.subject_id}`, {
          name: form.name.trim(),
          description: form.description.trim(),
        });
        toast.success("Subject updated.");
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
      await api.delete(`/catalog/subjects/${deleting.subject_id}`);
      toast.success(`Subject "${deleting.name}" deleted.`);
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  };

  if (loadError) return <Alert>{loadError}</Alert>;
  if (!subjects) return <LoadingBlock />;

  return (
    <>
      <PageHeader
        title="Subjects"
        subtitle="Subjects group courses in the app, for example Web Technologies or OOP."
        action={<Button onClick={openCreate}>New subject</Button>}
      />

      {subjects.length === 0 ? (
        <EmptyState title="No subjects yet" hint="Create one, or upload a book and a subject is created for you." action={<Button onClick={openCreate}>New subject</Button>} />
      ) : (
        <div className="space-y-3">
          {subjects.map((subject) => (
            <Card key={subject.subject_id} className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold">
                  {subject.name} <span className="text-sm font-normal text-textSecondary">({subject.slug})</span>
                </p>
                {subject.description && <p className="mt-1 text-sm text-textSecondary">{subject.description}</p>}
                <p className="mt-1 text-xs text-textSecondary">{courseCounts.get(subject.subject_id) ?? 0} course(s)</p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Link href={`/dashboard/courses?subject=${subject.subject_id}`} className="text-accentGreen hover:opacity-80">
                  Courses
                </Link>
                <button onClick={() => openEdit(subject)} className="text-accentBlue hover:opacity-80">
                  Edit
                </button>
                <button onClick={() => setDeleting(subject)} className="text-accentPink hover:opacity-80">
                  Delete
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <Modal title={editing === "new" ? "New subject" : "Edit subject"} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <Field label="Name">
              <Input
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => ({ ...f, name, slug: editing === "new" && !slugTouched ? slugify(name) : f.slug }));
                }}
                placeholder="Web Technologies"
              />
            </Field>
            <Field label="Slug" hint={editing === "new" ? "Used in URLs. Cannot be changed later." : "The slug cannot be changed."}>
              <Input
                value={form.slug}
                disabled={editing !== "new"}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm((f) => ({ ...f, slug: e.target.value }));
                }}
                placeholder="web-technologies"
              />
            </Field>
            <Field label="Description (optional)">
              <Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </Field>
            {formError && <Alert>{formError}</Alert>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={save} loading={saving}>
                {editing === "new" ? "Create" : "Save changes"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete subject?"
          loading={deleteBusy}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
          message={
            <>
              This permanently deletes <b className="text-textPrimary">{deleting.name}</b>
              {(courseCounts.get(deleting.subject_id) ?? 0) > 0 && (
                <>
                  , its <b className="text-accentPink">{courseCounts.get(deleting.subject_id)} course(s)</b> and every lesson in them
                </>
              )}
              . This cannot be undone.
            </>
          }
        />
      )}
    </>
  );
}
