"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { ROLE_ADMIN, type Course, type Subject } from "@/lib/types";
import { useUser } from "@/components/UserContext";
import AnalyticsPanel from "@/components/AnalyticsPanel";
import { Alert, Card, LoadingBlock, PageHeader } from "@/components/ui";

export default function DashboardHome() {
  const user = useUser();
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.get<Subject[]>("/catalog/subjects"), api.get<Course[]>("/catalog/courses")])
      .then(([s, c]) => {
        setSubjects(s.data);
        setCourses(c.data);
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!subjects || !courses) return <LoadingBlock />;

  const cards = [
    { href: "/dashboard/subjects", title: "Subjects", value: subjects.length, desc: "Create, rename and delete subjects", accent: "text-accentPurple" },
    { href: "/dashboard/courses", title: "Courses", value: courses.length, desc: "Manage courses, see their chapters and pages, open their lessons", accent: "text-accentBlue" },
    { href: "/dashboard/books", title: "Upload book", value: null, desc: "Turn a PDF into a course with lessons", accent: "text-accentGreen" },
    ...(user.role === ROLE_ADMIN
      ? [{ href: "/dashboard/admins", title: "Child admins", value: null, desc: "Add, edit and remove admin accounts", accent: "text-accentOrange" }]
      : []),
  ];

  return (
    <>
      <PageHeader title="Overview" subtitle="Everything students see in the app is managed here." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.href} href={card.href}>
            <Card className="h-full transition hover:bg-surfaceElevated">
              <p className={`text-lg font-semibold ${card.accent}`}>{card.title}</p>
              {card.value !== null && <p className="mt-2 text-3xl font-bold">{card.value}</p>}
              <p className="mt-2 text-sm text-textSecondary">{card.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
      <h2 className="mb-3 mt-8 text-lg font-semibold">Analytics</h2>
      <AnalyticsPanel />
    </>
  );
}
