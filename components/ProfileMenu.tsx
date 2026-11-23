"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { ROLE_ADMIN, type SessionUser } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { Alert, Button, Field, Input, Modal } from "@/components/ui";

const roleLabel = (role: string) => (role === ROLE_ADMIN ? "Main admin" : "Child admin");

function initials(user: SessionUser) {
  const source = (user.full_name || user.email).trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function ProfileSettings({ user, onClose, onNameSaved }: { user: SessionUser; onClose: () => void; onNameSaved: (name: string | null) => void }) {
  const toast = useToast();
  const [name, setName] = useState(user.full_name ?? "");
  const [nameBusy, setNameBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const saveName = async () => {
    setNameError(null);
    setNameBusy(true);
    try {
      const { data } = await api.patch<SessionUser>("/auth/me", { full_name: name.trim() || null });
      onNameSaved(data.full_name);
      toast.success("Profile updated.");
    } catch (err) {
      setNameError(errorMessage(err));
    } finally {
      setNameBusy(false);
    }
  };

  const changePassword = async () => {
    setPwError(null);
    if (!current) return setPwError("Enter your current password.");
    if (next.length < 8) return setPwError("The new password must be at least 8 characters.");
    if (next === current) return setPwError("The new password must be different from the current one.");
    if (next !== confirm) return setPwError("The new passwords do not match.");
    setPwBusy(true);
    try {
      await api.post("/auth/change-password", { current_password: current, new_password: next });
      toast.success("Password changed.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setPwError(errorMessage(err));
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <Modal title="Profile settings" onClose={onClose}>
      <div className="space-y-8">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Account</h3>
          {nameError && <Alert>{nameError}</Alert>}
          <Field label="Full name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </Field>
          <Field label="Email" hint="The email is your login and cannot be changed here.">
            <Input value={user.email} disabled />
          </Field>
          <Field label="Role">
            <Input value={roleLabel(user.role)} disabled />
          </Field>
          <Button onClick={saveName} loading={nameBusy} disabled={name.trim() === (user.full_name ?? "")}>
            Save changes
          </Button>
        </section>

        <section className="space-y-3 border-t border-border pt-6">
          <h3 className="text-sm font-semibold">Change password</h3>
          {pwError && <Alert>{pwError}</Alert>}
          <Field label="Current password">
            <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
          <Field label="New password" hint="At least 8 characters.">
            <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
          <Field label="Confirm new password">
            <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <Button onClick={changePassword} loading={pwBusy}>
            Update password
          </Button>
        </section>
      </div>
    </Modal>
  );
}

export default function ProfileMenu({ user, onLogout, onNameSaved }: { user: SessionUser; onLogout: () => void; onNameSaved: (name: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative ml-auto">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-accentPurple text-sm font-bold text-white transition hover:opacity-90"
      >
        {initials(user)}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-border bg-surface p-2 shadow-xl">
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-sm font-semibold">{user.full_name || "Admin"}</p>
            <p className="truncate text-xs text-textSecondary">{user.email}</p>
            <p className="mt-1 text-xs text-accentPurple">{roleLabel(user.role)}</p>
          </div>
          <button
            onClick={() => { setOpen(false); setSettings(true); }}
            className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surfaceElevated"
          >
            Profile settings
          </button>
          <button onClick={onLogout} className="w-full rounded-lg px-3 py-2 text-left text-sm text-accentPink hover:bg-surfaceElevated">
            Log out
          </button>
        </div>
      )}
      {settings && <ProfileSettings user={user} onClose={() => setSettings(false)} onNameSaved={onNameSaved} />}
    </div>
  );
}
