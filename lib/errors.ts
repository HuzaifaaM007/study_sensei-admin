import axios from "axios";

/** Turns any thrown error into a readable sentence, using FastAPI's `detail` when present. */
export function errorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      const base = error.config?.baseURL ?? "the backend";
      return `Cannot reach ${base}. Is the backend running, and does CORS_ORIGINS include this site's address?`;
    }
    const detail = error.response.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item: { loc?: (string | number)[]; msg?: string }) =>
          `${(item.loc ?? []).filter((part) => part !== "body").join(".")}: ${item.msg ?? "invalid"}`
        )
        .join("; ");
    }
    return `${fallback} (HTTP ${error.response.status})`;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
