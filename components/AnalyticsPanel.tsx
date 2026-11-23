"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import type { CourseAnalytics, CourseAnalyticsResponse, RegistrationAnalytics } from "@/lib/types";
import { Alert, Card, EmptyState, LoadingBlock } from "@/components/ui";

const LEVEL_STYLE: Record<string, string> = {
  High: "bg-accentGreen/15 text-accentGreen",
  Medium: "bg-accentBlue/15 text-accentBlue",
  Low: "bg-accentOrange/15 text-accentOrange",
  None: "bg-surfaceElevated text-textSecondary",
};
const LEVEL_COLOR: Record<string, string> = {
  High: "#06D6A0",
  Medium: "#3A86FF",
  Low: "#FB8500",
  None: "#4A4A4A",
};

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-textSecondary">{label}</p>
      <p className="mt-1 truncate text-2xl font-semibold" title={String(value)}>{value}</p>
      {hint && <p className="mt-1 truncate text-xs text-textSecondary" title={hint}>{hint}</p>}
    </Card>
  );
}

function RegistrationChart({ data }: { data: RegistrationAnalytics }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 240, L = 36, R = 12, T = 12, B = 28;
  const pts = data.series;
  const maxNew = Math.max(1, ...pts.map((p) => p.new_users));
  const maxTotal = Math.max(1, ...pts.map((p) => p.total_users));
  const x = (i: number) => L + (pts.length <= 1 ? 0 : (i / (pts.length - 1)) * (W - L - R));
  const yTotal = (v: number) => T + (1 - v / maxTotal) * (H - T - B);
  const barW = Math.max(2, ((W - L - R) / pts.length) * 0.6);
  const yNew = (v: number) => T + (1 - v / maxNew) * (H - T - B);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i)},${yTotal(p.total_users)}`).join(" ");
  const tick = Math.max(1, Math.ceil(pts.length / 6));
  const h = hover !== null ? pts[hover] : null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-textSecondary">
        <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-accentPurple/70" /> New sign-ups per day</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-4 bg-accentGreen" /> Total students</span>
        {h && (
          <span className="ml-auto text-textPrimary">
            {h.date}: <b>{h.new_users}</b> new · <b>{h.total_users}</b> total
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={T + f * (H - T - B)} y2={T + f * (H - T - B)} stroke="#2E2E2E" />
            <text x={L - 6} y={T + f * (H - T - B) + 4} textAnchor="end" fontSize="10" fill="#A0A0A0">
              {Math.round(maxTotal * (1 - f))}
            </text>
          </g>
        ))}
        {pts.map((p, i) => (
          <rect key={p.date} x={x(i) - barW / 2} y={yNew(p.new_users)} width={barW} height={H - B - yNew(p.new_users)}
                fill="#9B5DE5" opacity={hover === i ? 1 : 0.6} rx="1" />
        ))}
        <path d={line} fill="none" stroke="#06D6A0" strokeWidth="2" />
        {pts.map((p, i) =>
          i % tick === 0 ? (
            <text key={p.date} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#A0A0A0">{p.date.slice(5)}</text>
          ) : null
        )}
        {pts.map((p, i) => (
          <rect key={`h${p.date}`} x={x(i) - (W - L - R) / pts.length / 2} y={T} width={(W - L - R) / pts.length}
                height={H - T - B} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
      <p className="mt-1 text-xs text-textSecondary">Bars use the busiest day as scale (max {maxNew}); the line is the running total.</p>
    </div>
  );
}

function BarList({ rows, value, format, colorBy }: {
  rows: CourseAnalytics[]; value: (c: CourseAnalytics) => number; format: (c: CourseAnalytics) => string; colorBy?: boolean;
}) {
  const max = Math.max(1, ...rows.map(value));
  return (
    <ul className="space-y-2.5">
      {rows.map((c) => (
        <li key={c.course_id}>
          <div className="flex justify-between gap-3 text-sm">
            <span className="truncate" title={c.title}>{c.title}</span>
            <span className="shrink-0 text-textSecondary">{format(c)}</span>
          </div>
          <div className="mt-1 h-2 rounded bg-surfaceElevated">
            <div className="h-2 rounded" style={{ width: `${(value(c) / max) * 100}%`, background: colorBy ? LEVEL_COLOR[c.level] : "#3A86FF" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function AnalyticsPanel() {
  const [days, setDays] = useState(30);
  const [reg, setReg] = useState<RegistrationAnalytics | null>(null);
  const [courses, setCourses] = useState<CourseAnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<"engagement" | "avg_score" | "learners">("engagement");

  useEffect(() => {
    api.get<RegistrationAnalytics>("/admin/analytics/registrations", { params: { days } })
      .then((r) => { setReg(r.data); setError(null); })
      .catch((e) => setError(errorMessage(e)));
  }, [days]);
  useEffect(() => {
    api.get<CourseAnalyticsResponse>("/admin/analytics/courses")
      .then((r) => setCourses(r.data))
      .catch((e) => setError(errorMessage(e)));
  }, []);

  const rows = useMemo(() => {
    const list = [...(courses?.courses ?? [])];
    list.sort((a, b) => (b[sort] ?? -1) - (a[sort] ?? -1));
    return list;
  }, [courses, sort]);
  const scored = useMemo(() => rows.filter((c) => c.avg_score !== null).sort((a, b) => (b.avg_score ?? 0) - (a.avg_score ?? 0)), [rows]);

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Students" value={reg?.total_students ?? "—"} />
        <Stat label={`New (last ${days} days)`} value={reg?.new_in_period ?? "—"} />
        <Stat label="Most popular course" value={courses?.summary.most_popular ?? "—"} />
        <Stat label="Quiz attempts" value={courses?.summary.total_attempts ?? "—"} hint={`${courses?.summary.total_views ?? 0} lesson views`} />
      </div>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">User registrations</h2>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}
                  className="rounded-lg border border-border bg-surfaceElevated px-2 py-1 text-sm">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
        </div>
        {reg ? <RegistrationChart data={reg} /> : <LoadingBlock />}
      </Card>

      {!courses ? <LoadingBlock /> : rows.length === 0 ? (
        <EmptyState title="No courses yet" hint="Course analytics appear once courses exist." />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="mb-1 font-semibold">Course engagement</h2>
              <p className="mb-4 text-xs text-textSecondary">Lesson views + 2 × quiz attempts. Green = high, blue = medium, orange = low, grey = none.</p>
              <BarList rows={rows.slice(0, 10)} value={(c) => c.engagement} format={(c) => `${c.engagement} · ${c.level}`} colorBy />
            </Card>
            <Card className="p-5">
              <h2 className="mb-1 font-semibold">Average quiz score</h2>
              <p className="mb-4 text-xs text-textSecondary">Highest to lowest. Courses with no attempts are not shown.</p>
              {scored.length ? (
                <BarList rows={scored.slice(0, 10)} value={(c) => c.avg_score ?? 0} format={(c) => `${c.avg_score}%`} />
              ) : <p className="text-sm text-textSecondary">No quiz attempts yet.</p>}
              {courses.summary.highest_score && (
                <p className="mt-4 text-xs text-textSecondary">
                  Best: <b className="text-accentGreen">{courses.summary.highest_score}</b> · Weakest: <b className="text-accentOrange">{courses.summary.lowest_score}</b>
                </p>
              )}
            </Card>
          </div>

          <Card className="overflow-x-auto p-0">
            <div className="flex items-center justify-between p-4">
              <h2 className="font-semibold">Course details</h2>
              <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}
                      className="rounded-lg border border-border bg-surfaceElevated px-2 py-1 text-sm">
                <option value="engagement">Sort: engagement</option>
                <option value="avg_score">Sort: avg score</option>
                <option value="learners">Sort: learners</option>
              </select>
            </div>
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-y border-border text-xs uppercase text-textSecondary">
                <tr>
                  {["Course", "Subject", "Lessons", "Videos", "Views", "Attempts", "Learners", "Avg score", "Level"].map((h) => (
                    <th key={h} className="px-4 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.course_id} className="border-b border-border/60 last:border-0">
                    <td className="max-w-[220px] truncate px-4 py-2" title={c.title}>{c.title}</td>
                    <td className="px-4 py-2 text-textSecondary">{c.subject}</td>
                    <td className="px-4 py-2">{c.lessons}</td>
                    <td className="px-4 py-2">{c.videos}</td>
                    <td className="px-4 py-2">{c.lesson_views}</td>
                    <td className="px-4 py-2">{c.quiz_attempts}</td>
                    <td className="px-4 py-2">{c.learners}</td>
                    <td className="px-4 py-2">{c.avg_score === null ? "—" : `${c.avg_score}%`}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${LEVEL_STYLE[c.level]}`}>{c.level}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
