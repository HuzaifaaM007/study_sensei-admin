"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, clearSession, getAccessToken } from "@/lib/api";
import { isAdminRole, type SessionUser } from "@/lib/types";

/**
 * Keeps non-admins out of the dashboard. This runs in the browser, so it is a convenience:
 * the real protection is that every admin endpoint on the backend requires an admin token.
 */
export default function AuthGuard({ children }: { children: (user: SessionUser) => React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    api
      .get<SessionUser>("/auth/me")
      .then(({ data }) => {
        if (!isAdminRole(data.role)) {
          clearSession();
          router.replace("/login");
        } else {
          setUser(data);
        }
      })
      .catch(() => {
        clearSession();
        router.replace("/login");
      });
  }, [router]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-textSecondary">Checking access...</div>
    );
  }
  return <>{children(user)}</>;
}
