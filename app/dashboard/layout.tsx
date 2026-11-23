"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import ProfileMenu from "@/components/ProfileMenu";
import { UserProvider } from "@/components/UserContext";
import { api, clearSession, getRefreshToken } from "@/lib/api";
import { ROLE_ADMIN } from "@/lib/types";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/subjects", label: "Subjects" },
  { href: "/dashboard/courses", label: "Courses" },
  { href: "/dashboard/lessons", label: "Lessons" },
  { href: "/dashboard/books", label: "Upload book" },
  { href: "/dashboard/users", label: "Users" },
  { href: "/dashboard/discussions", label: "Discussions" },
];

// Only the main admin can manage other admins (the backend enforces this too).
const adminLink = { href: "/dashboard/admins", label: "Child admins" };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [nameOverride, setNameOverride] = useState<string | null | undefined>(undefined);

  const logout = async () => {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) await api.post("/auth/logout", { refresh_token: refreshToken });
    } catch {
      // Logging out locally is enough if the server call fails.
    }
    clearSession();
    router.replace("/login");
  };

  return (
    <AuthGuard>
      {(authUser) => {
        const user = nameOverride === undefined ? authUser : { ...authUser, full_name: nameOverride };
        return (
        <UserProvider value={user}>
        <div className="min-h-screen bg-background text-textPrimary">
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border px-6 py-4">
            <span className="font-bold">Study Sensei Admin</span>
            {(user.role === ROLE_ADMIN ? [...links, adminLink] : links).map((link) => {
              const active = link.href === "/dashboard" ? pathname === link.href : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={active ? "font-semibold text-textPrimary" : "text-textSecondary hover:text-textPrimary"}
                >
                  {link.label}
                </Link>
              );
            })}
            <ProfileMenu user={user} onLogout={logout} onNameSaved={setNameOverride} />
          </nav>
          <main className="mx-auto max-w-6xl p-6">{children}</main>
        </div>
        </UserProvider>
        );
      }}
    </AuthGuard>
  );
}
