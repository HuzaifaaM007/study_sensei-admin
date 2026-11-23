"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getAccessToken, saveSession } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { isAdminRole } from "@/lib/types";
import { Alert, Button, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Already signed in? Go straight to the dashboard (the dashboard re-checks the token).
  useEffect(() => {
    if (getAccessToken()) router.replace("/dashboard");
  }, [router]);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email: email.trim(), password });
      if (!isAdminRole(data.user.role)) {
        setError("This account does not have admin access.");
        return;
      }
      saveSession(data.tokens.access_token, data.tokens.refresh_token);
      router.replace("/dashboard");
    } catch (err) {
      setError(errorMessage(err, "Login failed. Check your email and password."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Study Sensei</h1>
          <p className="mt-1 text-sm text-textSecondary">Admin panel</p>
        </div>
        <Field label="Email">
          <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="Password"
          />
        </Field>
        {error && <Alert>{error}</Alert>}
        <Button onClick={handleLogin} loading={loading} disabled={!email || !password} className="w-full">
          Log in
        </Button>
      </div>
    </div>
  );
}
