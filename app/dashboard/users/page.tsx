"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/utils";
import type { StudentUser } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { Alert, Button, Card, ConfirmDialog, EmptyState, Input, LoadingBlock, PageHeader } from "@/components/ui";

export default function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<StudentUser[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<StudentUser | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (q: string) => {
    try {
      const { data } = await api.get<StudentUser[]>("/admin/users", { params: q ? { q } : {} });
      setUsers(data);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query, load]);

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`/admin/users/${deleting.user_id}`);
      toast.success(`Deleted ${deleting.email}.`);
      setDeleting(null);
      load(query.trim());
    } catch (err) {
      toast.error(errorMessage(err, "Could not delete this user."));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (u: StudentUser) => {
    try {
      await api.post(`/admin/users/${u.user_id}/verify`);
      toast.success(`${u.email} marked as verified.`);
      setUsers((list) => (list ? list.map((x) => (x.user_id === u.user_id ? { ...x, is_verified: true } : x)) : list));
    } catch (err) {
      toast.error(errorMessage(err, "Could not verify this user."));
    }
  };

  return (
    <>
      <PageHeader title="Users" subtitle="Student accounts. Admins are managed on the Child admins page." />
      <div className="space-y-4">
        <Input placeholder="Search by email or name" value={query} onChange={(e) => setQuery(e.target.value)} />
        {error && <Alert>{error}</Alert>}
        {users === null && !error && <LoadingBlock />}
        {users && users.length === 0 && <EmptyState title="No users found" />}
        {users && users.length > 0 && (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-textSecondary">
                <tr>
                  <th className="p-3">Email</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Email status</th>
                  <th className="p-3">Lectures</th>
                  <th className="p-3">Quizzes</th>
                  <th className="p-3">Joined</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.user_id} className="border-b border-border last:border-0">
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">{u.full_name ?? "-"}</td>
                    <td className="p-3">
                      {u.is_verified ? (
                        <span className="rounded-md bg-accentGreen/15 px-2 py-0.5 text-xs font-semibold text-accentGreen">Verified</span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <span className="rounded-md bg-accentOrange/15 px-2 py-0.5 text-xs font-semibold text-accentOrange">Not verified</span>
                          <button onClick={() => verify(u)} className="text-xs text-accentBlue hover:opacity-80">Mark verified</button>
                        </span>
                      )}
                    </td>
                    <td className="p-3">{u.lectures}</td>
                    <td className="p-3">{u.quizzes}</td>
                    <td className="p-3">{formatDate(u.created_at)}</td>
                    <td className="p-3 text-right">
                      <button onClick={() => setDeleting(u)} className="text-accentPink hover:opacity-80">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
      {deleting && (
        <ConfirmDialog
          title="Delete user"
          message={
            <>
              Permanently delete <b>{deleting.email}</b> with their {deleting.lectures} lectures, {deleting.quizzes} quizzes, planner items and
              notifications? This cannot be undone.
            </>
          }
          loading={busy}
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}
