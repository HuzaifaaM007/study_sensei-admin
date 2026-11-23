"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDate, generatePassword } from "@/lib/utils";
import { ROLE_ADMIN, type AdminUser } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { useUser } from "@/components/UserContext";
import { Alert, Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, LoadingBlock, Modal, PageHeader } from "@/components/ui";

const MIN_PASSWORD = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormState {
  fullName: string;
  email: string;
  password: string;
  isActive: boolean;
}

const emptyForm: FormState = { fullName: "", email: "", password: "", isActive: true };

export default function ChildAdminsPage() {
  const me = useUser();
  const toast = useToast();
  const isMainAdmin = me.role === ROLE_ADMIN;

  const [admins, setAdmins] = useState<AdminUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState<AdminUser | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [disabling, setDisabling] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<AdminUser[]>("/admin/child-admins");
      setAdmins(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    if (isMainAdmin) load();
  }, [isMainAdmin, load]);

  if (!isMainAdmin) {
    return <Alert>Only the main admin can add, edit or remove child admins.</Alert>;
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const openCreate = () => {
    setForm(emptyForm);
    setShowPassword(false);
    setFormError(null);
    setEditing("new");
  };

  const openEdit = (admin: AdminUser) => {
    setForm({ fullName: admin.full_name ?? "", email: admin.email, password: "", isActive: admin.is_active });
    setShowPassword(false);
    setFormError(null);
    setEditing(admin);
  };

  const save = async () => {
    setFormError(null);
    const email = form.email.trim();
    if (!EMAIL_PATTERN.test(email)) return setFormError("Enter a valid email address.");
    const creating = editing === "new";
    if (creating && form.password.length < MIN_PASSWORD) return setFormError(`The password needs at least ${MIN_PASSWORD} characters.`);
    if (!creating && form.password && form.password.length < MIN_PASSWORD) {
      return setFormError(`The new password needs at least ${MIN_PASSWORD} characters, or leave it empty to keep the current one.`);
    }

    setSaving(true);
    try {
      if (creating) {
        await api.post("/admin/child-admins", { email, password: form.password, full_name: form.fullName.trim() || null });
        toast.success(`Child admin ${email} created. Share the password with them securely.`);
      } else if (editing) {
        await api.patch(`/admin/child-admins/${editing.user_id}`, {
          email,
          full_name: form.fullName.trim() || null,
          is_active: form.isActive,
          ...(form.password ? { password: form.password } : {}),
        });
        toast.success(form.password ? "Child admin updated. Their password was reset and they were signed out." : "Child admin updated.");
      }
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (admin: AdminUser, isActive: boolean) => {
    setBusy(true);
    try {
      await api.patch(`/admin/child-admins/${admin.user_id}`, { is_active: isActive });
      toast.success(isActive ? `${admin.email} can sign in again.` : `${admin.email} was disabled and signed out.`);
      setDisabling(null);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`/admin/child-admins/${deleting.user_id}`);
      toast.success(`Child admin ${deleting.email} deleted.`);
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  if (loadError) return <Alert>{loadError}</Alert>;
  if (!admins) return <LoadingBlock />;

  return (
    <>
      <PageHeader
        title="Child admins"
        subtitle="Child admins can manage subjects, courses, chapters, lessons and book uploads. Only you can add, edit or remove them."
        action={<Button onClick={openCreate}>New child admin</Button>}
      />

      {admins.length === 0 ? (
        <EmptyState
          title="No child admins yet"
          hint="Create one to let someone else manage content without sharing your account."
          action={<Button onClick={openCreate}>New child admin</Button>}
        />
      ) : (
        <div className="space-y-3">
          {admins.map((admin) => (
            <Card key={admin.user_id} className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{admin.full_name || "No name"}</p>
                  {admin.is_active ? (
                    <span className="rounded-md bg-accentGreen/15 px-2 py-0.5 text-xs font-semibold text-accentGreen">Active</span>
                  ) : (
                    <Badge>Disabled</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-textSecondary">{admin.email}</p>
                {admin.created_at && <p className="mt-1 text-xs text-textSecondary">Added {formatDate(admin.created_at)}</p>}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <button onClick={() => openEdit(admin)} className="text-accentBlue hover:opacity-80">
                  Edit
                </button>
                {admin.is_active ? (
                  <button onClick={() => setDisabling(admin)} className="text-accentOrange hover:opacity-80">
                    Disable
                  </button>
                ) : (
                  <button onClick={() => setActive(admin, true)} disabled={busy} className="text-accentGreen hover:opacity-80 disabled:opacity-50">
                    Enable
                  </button>
                )}
                <button onClick={() => setDeleting(admin)} className="text-accentPink hover:opacity-80">
                  Delete
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <Modal title={editing === "new" ? "New child admin" : "Edit child admin"} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <Field label="Full name">
              <Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Optional" />
            </Field>
            <Field label="Email" hint="They sign in to this panel with this email.">
              <Input type="email" autoComplete="off" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="name@example.com" />
            </Field>
            <Field
              label={editing === "new" ? "Password" : "New password"}
              hint={
                editing === "new"
                  ? `At least ${MIN_PASSWORD} characters. Share it with them securely; they can change it after signing in.`
                  : "Leave empty to keep the current password. Setting one signs them out everywhere."
              }
            >
              <div className="flex gap-2">
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                />
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    set("password", generatePassword());
                    setShowPassword(true);
                  }}
                >
                  Generate
                </Button>
                <Button variant="secondary" type="button" onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? "Hide" : "Show"}
                </Button>
              </div>
            </Field>
            {editing !== "new" && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} />
                Account is active (untick to block sign-in)
              </label>
            )}
            {formError && <Alert>{formError}</Alert>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={save} loading={saving}>
                {editing === "new" ? "Create child admin" : "Save changes"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {disabling && (
        <ConfirmDialog
          title="Disable child admin?"
          confirmLabel="Disable"
          loading={busy}
          onConfirm={() => setActive(disabling, false)}
          onCancel={() => setDisabling(null)}
          message={
            <>
              <b className="text-textPrimary">{disabling.email}</b> will be signed out right away and cannot sign in until you enable the account
              again. Nothing they created is removed.
            </>
          }
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete child admin?"
          loading={busy}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
          message={
            <>
              This permanently deletes the account <b className="text-textPrimary">{deleting.email}</b>. Courses and lessons they created are kept.
              This cannot be undone. To block someone without deleting them, use Disable instead.
            </>
          }
        />
      )}
    </>
  );
}
