"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDuration, parseDuration, videoPreview } from "@/lib/utils";
import type { CourseVideo, VideoDetail } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { Alert, Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, LoadingBlock, Modal, Textarea } from "@/components/ui";

interface FormState {
  url: string;
  title: string;
  description: string;
  duration: string;
  attribution: string;
  transcript: string;
}

const emptyForm: FormState = { url: "", title: "", description: "", duration: "", attribution: "", transcript: "" };

const PROVIDER_LABEL: Record<CourseVideo["provider"], string> = { youtube: "YouTube", vimeo: "Vimeo", direct: "Video file" };

function Player({ src, kind }: { src: string; kind: "iframe" | "video" }) {
  return kind === "iframe" ? (
    <iframe
      src={src}
      title="Video preview"
      className="aspect-video w-full rounded-lg border border-border"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      allowFullScreen
    />
  ) : (
    <video src={src} controls className="aspect-video w-full rounded-lg border border-border bg-black" />
  );
}

export default function CourseVideos({ courseId }: { courseId: string }) {
  const toast = useToast();
  const [videos, setVideos] = useState<CourseVideo[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState<CourseVideo | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptDirty, setTranscriptDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [playing, setPlaying] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CourseVideo | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<CourseVideo[]>(`/catalog/courses/${courseId}/videos`);
      setVideos(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const openCreate = () => {
    setForm(emptyForm);
    setTranscriptDirty(false);
    setTranscriptLoading(false);
    setFormError(null);
    setEditing("new");
  };

  const openEdit = async (video: CourseVideo) => {
    setForm({
      url: video.source_url,
      title: video.title,
      description: video.description ?? "",
      duration: formatDuration(video.duration_seconds) ?? "",
      attribution: video.attribution ?? "",
      transcript: "",
    });
    setTranscriptDirty(false);
    setFormError(null);
    setEditing(video);
    if (video.has_transcript) {
      // The list does not carry transcripts (they can be long), so fetch this one.
      setTranscriptLoading(true);
      try {
        const { data } = await api.get<VideoDetail>(`/catalog/videos/${video.video_id}`);
        setForm((f) => ({ ...f, transcript: data.transcript ?? "" }));
      } catch (err) {
        setFormError(`Could not load the transcript: ${errorMessage(err)}`);
      } finally {
        setTranscriptLoading(false);
      }
    }
  };

  const loadTranscriptFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 500_000) return setFormError("That transcript file is too large (500 KB maximum).");
    set("transcript", await file.text());
    setTranscriptDirty(true);
    setFormError(null);
  };

  const preview = videoPreview(form.url);

  const save = async () => {
    setFormError(null);
    if (!form.url.trim()) return setFormError("Paste the video link.");
    if (!preview) return setFormError("That link is not supported. Use a YouTube or Vimeo link, or a direct .mp4 / .webm / .mov / .m3u8 link.");
    if (!form.title.trim()) return setFormError("Give the video a title.");
    const duration = parseDuration(form.duration);
    if (duration === undefined) return setFormError("Duration should look like 12:30 (minutes:seconds), or just a number of minutes.");

    const payload = {
      url: form.url.trim(),
      title: form.title.trim(),
      description: form.description.trim() || null,
      duration_seconds: duration,
      attribution: form.attribution.trim() || null,
      // When editing, leave the transcript alone unless it was changed here.
      ...(editing === "new" || transcriptDirty ? { transcript: form.transcript.trim() || null } : {}),
    };

    setSaving(true);
    try {
      if (editing === "new") {
        await api.post(`/catalog/courses/${courseId}/videos`, payload);
        toast.success(`Video "${payload.title}" added.`);
      } else if (editing) {
        await api.patch(`/catalog/videos/${editing.video_id}`, payload);
        toast.success("Video updated.");
      }
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    if (!videos) return;
    const target = index + direction;
    if (target < 0 || target >= videos.length) return;
    const ids = videos.map((v) => v.video_id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setBusy(true);
    try {
      const { data } = await api.put<CourseVideo[]>(`/catalog/courses/${courseId}/videos/order`, { video_ids: ids });
      setVideos(data);
    } catch (err) {
      toast.error(errorMessage(err));
      await load();
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`/catalog/videos/${deleting.video_id}`);
      toast.success(`Video "${deleting.title}" deleted.`);
      if (playing === deleting.video_id) setPlaying(null);
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="videos" className="mt-8 scroll-mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Videos{videos ? ` (${videos.length})` : ""}</h2>
          <p className="text-sm text-textSecondary">Links to YouTube or Vimeo videos, with an optional description and transcript.</p>
        </div>
        <Button onClick={openCreate}>Add video</Button>
      </div>

      {loadError ? (
        <Alert>{loadError}</Alert>
      ) : !videos ? (
        <LoadingBlock />
      ) : videos.length === 0 ? (
        <EmptyState
          title="No videos yet"
          hint="Add a link to a video. Use Unlisted on YouTube so students can watch it but it stays out of search."
          action={<Button onClick={openCreate}>Add video</Button>}
        />
      ) : (
        <div className="space-y-3">
          {videos.map((video, index) => {
            const preview = videoPreview(video.embed_url);
            const duration = formatDuration(video.duration_seconds);
            return (
              <Card key={video.video_id}>
                <div className="flex flex-wrap items-start gap-4">
                  <div className="h-20 w-36 shrink-0 overflow-hidden rounded-lg border border-border bg-surfaceElevated">
                    {video.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={video.thumbnail_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl text-textSecondary">▶</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">
                        {index + 1}. {video.title}
                      </p>
                      <Badge>{PROVIDER_LABEL[video.provider]}</Badge>
                      {duration && <span className="text-xs text-textSecondary">{duration}</span>}
                      {video.has_transcript && <Badge tone="intermediate">Transcript</Badge>}
                    </div>
                    {video.description && <p className="mt-1 line-clamp-2 text-sm text-textSecondary">{video.description}</p>}
                    {video.attribution && <p className="mt-1 text-xs text-textSecondary">Source: {video.attribution}</p>}
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <button
                      onClick={() => move(index, -1)}
                      disabled={busy || index === 0}
                      aria-label={`Move ${video.title} up`}
                      className="text-textSecondary hover:text-textPrimary disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => move(index, 1)}
                      disabled={busy || index === videos.length - 1}
                      aria-label={`Move ${video.title} down`}
                      className="text-textSecondary hover:text-textPrimary disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button onClick={() => setPlaying(playing === video.video_id ? null : video.video_id)} className="text-accentGreen hover:opacity-80">
                      {playing === video.video_id ? "Hide" : "Preview"}
                    </button>
                    <button onClick={() => openEdit(video)} className="text-accentBlue hover:opacity-80">
                      Edit
                    </button>
                    <button onClick={() => setDeleting(video)} className="text-accentPink hover:opacity-80">
                      Delete
                    </button>
                  </div>
                </div>
                {playing === video.video_id && preview && (
                  <div className="mt-4 max-w-2xl">
                    <Player src={preview.src} kind={preview.kind} />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {editing && (
        <Modal title={editing === "new" ? "Add video" : "Edit video"} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <Field label="Video link" hint="YouTube (Unlisted works best), Vimeo, or a direct .mp4 / .webm / .mov / .m3u8 link.">
              <Input value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
            </Field>
            {form.url.trim() && !preview && <Alert kind="warning">This link is not recognised as a YouTube, Vimeo or video file link.</Alert>}
            {preview && <Player src={preview.src} kind={preview.kind} />}
            <Field label="Title">
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
            </Field>
            <Field label="Description" hint="Optional.">
              <Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Duration" hint="Optional. 12:30, or just minutes.">
                <Input value={form.duration} onChange={(e) => set("duration", e.target.value)} placeholder="12:30" />
              </Field>
              <Field label="Source / credit" hint="Optional. Who made it, or the licence.">
                <Input value={form.attribution} onChange={(e) => set("attribution", e.target.value)} />
              </Field>
            </div>
            <Field label="Transcript" hint="Optional. Paste text, or load a .txt, .vtt or .srt file. Timed files (.vtt / .srt) keep their timestamps.">
              <Textarea
                rows={7}
                className="font-mono"
                disabled={transcriptLoading}
                value={transcriptLoading ? "Loading transcript..." : form.transcript}
                onChange={(e) => {
                  set("transcript", e.target.value);
                  setTranscriptDirty(true);
                }}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="cursor-pointer text-accentBlue hover:opacity-80">
                Load from file
                <input
                  type="file"
                  accept=".txt,.vtt,.srt,text/plain,text/vtt"
                  className="hidden"
                  onChange={(e) => {
                    loadTranscriptFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              {form.transcript && !transcriptLoading && (
                <button
                  type="button"
                  className="text-accentPink hover:opacity-80"
                  onClick={() => {
                    set("transcript", "");
                    setTranscriptDirty(true);
                  }}
                >
                  Remove transcript
                </button>
              )}
              <span className="text-xs text-textSecondary">{form.transcript.length.toLocaleString()} characters</span>
            </div>
            {formError && <Alert>{formError}</Alert>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={save} loading={saving} disabled={transcriptLoading}>
                {editing === "new" ? "Add video" : "Save changes"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete video?"
          confirmLabel="Delete video"
          loading={busy}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
          message={
            <>
              This removes <b className="text-textPrimary">{deleting.title}</b> and its transcript from the course. The video itself stays on{" "}
              {PROVIDER_LABEL[deleting.provider]}.
            </>
          }
        />
      )}
    </section>
  );
}
