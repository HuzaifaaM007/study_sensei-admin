"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import type { AdminComment, DiscussionStats, DiscussionTopic } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { Alert, Badge, Button, Card, ConfirmDialog, EmptyState, Input, LoadingBlock, PageHeader, Select } from "@/components/ui";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "");

export default function DiscussionsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<"comments" | "topics">("comments");
  const [stats, setStats] = useState<DiscussionStats | null>(null);
  const [comments, setComments] = useState<AdminComment[] | null>(null);
  const [topics, setTopics] = useState<DiscussionTopic[] | null>(null);
  const [q, setQ] = useState("");
  const [targetType, setTargetType] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ kind: "comment" | "topic"; id: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, c, t] = await Promise.all([
        api.get<DiscussionStats>("/admin/discussion-stats"),
        api.get<AdminComment[]>("/admin/comments", { params: { q: q || undefined, target_type: targetType || undefined } }),
        api.get<{ topics: DiscussionTopic[] }>("/discussions", { params: { q: q || undefined, limit: 200 } }),
      ]);
      setStats(s.data);
      setComments(c.data);
      setTopics(t.data.topics);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [q, targetType]);

  useEffect(() => {
    const id = setTimeout(load, 300);
    return () => clearTimeout(id);
  }, [load]);

  const remove = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await api.delete(pending.kind === "comment" ? `/comments/${pending.id}` : `/discussions/${pending.id}`);
      toast.success(pending.kind === "comment" ? "Comment removed." : "Discussion removed.");
      setPending(null);
      load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const moderate = async (t: DiscussionTopic, patch: { is_pinned?: boolean; is_closed?: boolean }) => {
    try {
      await api.patch(`/discussions/${t.topic_id}`, patch);
      load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Discussions" subtitle="Student comments on courses, lessons and videos, plus the open discussion board. Remove anything that breaks the rules." />
      {error && <Alert>{error}</Alert>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Comments", stats?.comments],
          ["Discussions", stats?.topics],
          ["Likes", stats?.likes],
          ["On lessons", stats?.by_target?.lesson ?? 0],
        ].map(([label, value]) => (
          <Card key={String(label)} className="p-4">
            <p className="text-xs uppercase tracking-wide text-textSecondary">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value ?? "—"}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-border p-1">
          {(["comments", "topics"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
                    className={`rounded-md px-3 py-1.5 text-sm ${tab === t ? "bg-surfaceElevated font-semibold" : "text-textSecondary"}`}>
              {t === "comments" ? "Comments" : "Discussion board"}
            </button>
          ))}
        </div>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search text" className="max-w-xs" />
        {tab === "comments" && (
          <Select value={targetType} onChange={(e) => setTargetType(e.target.value)} className="max-w-[180px]">
            <option value="">All places</option>
            <option value="course">Courses</option>
            <option value="lesson">Lessons</option>
            <option value="video">Videos</option>
            <option value="topic">Discussion board</option>
          </Select>
        )}
      </div>

      {tab === "comments" ? (
        !comments ? <LoadingBlock /> : comments.length === 0 ? (
          <EmptyState title="No comments" hint="Comments students post on courses, lessons and videos appear here." />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-textSecondary">
                <tr>{["Comment", "By", "Where", "When", ""].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {comments.map((c) => (
                  <tr key={c.comment_id} className="border-b border-border/60 last:border-0 align-top">
                    <td className="max-w-[360px] px-4 py-2">
                      {c.is_reply && <span className="mr-1 text-xs text-textSecondary">↳</span>}
                      <span className="whitespace-pre-wrap break-words">{c.body}</span>
                    </td>
                    <td className="px-4 py-2 text-textSecondary">
                      {c.author.name}{c.author.is_admin && <Badge tone="purple"> admin</Badge>}
                    </td>
                    <td className="px-4 py-2">
                      <Badge>{c.target_type}</Badge>
                      <span className="ml-2 text-textSecondary">{c.target_title}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-textSecondary">{when(c.created_at)}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => setPending({ kind: "comment", id: c.comment_id, label: c.body })} className="text-accentPink hover:opacity-80">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )
      ) : (
        !topics ? <LoadingBlock /> : topics.length === 0 ? (
          <EmptyState title="No discussions" hint="Students have not started any discussions yet." />
        ) : (
          <div className="space-y-3">
            {topics.map((t) => (
              <Card key={t.topic_id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {t.is_pinned && <Badge tone="orange">Pinned</Badge>}
                      {t.is_closed && <Badge>Closed</Badge>}
                      {t.tag && <Badge tone="blue">{t.tag}</Badge>}
                      <h3 className="font-semibold">{t.title}</h3>
                    </div>
                    <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-textSecondary">{t.body}</p>
                    <p className="mt-2 text-xs text-textSecondary">
                      {t.author.name} · {when(t.created_at)} · {t.reply_count} repl{t.reply_count === 1 ? "y" : "ies"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="ghost" onClick={() => moderate(t, { is_pinned: !t.is_pinned })}>{t.is_pinned ? "Unpin" : "Pin"}</Button>
                    <Button variant="ghost" onClick={() => moderate(t, { is_closed: !t.is_closed })}>{t.is_closed ? "Reopen" : "Close"}</Button>
                    <Button variant="danger" onClick={() => setPending({ kind: "topic", id: t.topic_id, label: t.title })}>Remove</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {pending && (
        <ConfirmDialog
          title={pending.kind === "comment" ? "Remove this comment?" : "Remove this discussion?"}
          message={pending.kind === "comment" ? `"${pending.label.slice(0, 140)}" will be hidden for everyone.` : `"${pending.label}" and all its replies will be deleted.`}
          confirmLabel="Remove"
          loading={busy}
          onConfirm={remove}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
