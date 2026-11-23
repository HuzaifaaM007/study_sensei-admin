"use client";
import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, useEffect } from "react";

const fieldBase =
  "w-full rounded-lg border border-border bg-surfaceElevated px-3 py-2 text-sm text-textPrimary outline-none placeholder:text-textSecondary focus:border-accentBlue disabled:opacity-50";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-white text-black hover:bg-gray-200",
  secondary: "bg-surfaceElevated text-textPrimary hover:bg-border",
  danger: "bg-accentPink text-white hover:opacity-90",
  ghost: "text-textSecondary hover:text-textPrimary",
};

export function Button({
  variant = "primary",
  loading = false,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${buttonStyles[variant]} ${className}`}
    >
      {loading && <Spinner small />}
      {children}
    </button>
  );
}

export function Spinner({ small = false }: { small?: boolean }) {
  const size = small ? "h-4 w-4" : "h-6 w-6";
  return <span className={`inline-block ${size} animate-spin rounded-full border-2 border-current border-t-transparent`} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium uppercase tracking-wide text-textSecondary">{label}</span>
      {children}
      {hint && <span className="block text-xs text-textSecondary">{hint}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldBase} ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${fieldBase} ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${fieldBase} ${props.className ?? ""}`} />;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-surface p-5 ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-textSecondary">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const badgeColors: Record<string, string> = {
  beginner: "bg-accentGreen/15 text-accentGreen",
  intermediate: "bg-accentBlue/15 text-accentBlue",
  advanced: "bg-accentPink/15 text-accentPink",
  purple: "bg-accentPurple/15 text-accentPurple",
  blue: "bg-accentBlue/15 text-accentBlue",
  orange: "bg-accentOrange/15 text-accentOrange",
};

export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  const color = (tone && badgeColors[tone.toLowerCase()]) || "bg-surfaceElevated text-textSecondary";
  return <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${color}`}>{children}</span>;
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <Card className="py-10 text-center">
      <p className="font-semibold">{title}</p>
      {hint && <p className="mt-1 text-sm text-textSecondary">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}

export function LoadingBlock({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-textSecondary">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function Alert({ kind = "error", children }: { kind?: "error" | "info" | "warning"; children: ReactNode }) {
  const style =
    kind === "error"
      ? "border-accentPink/40 text-accentPink"
      : kind === "warning"
        ? "border-accentOrange/40 text-accentOrange"
        : "border-accentBlue/40 text-accentBlue";
  return <div className={`rounded-lg border bg-surface px-4 py-3 text-sm ${style}`}>{children}</div>;
}

export function Modal({
  title,
  onClose,
  children,
  wide = false,
  extraWide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  extraWide?: boolean;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-12" onClick={onClose}>
      <div
        className={`w-full ${extraWide ? "max-w-6xl" : wide ? "max-w-3xl" : "max-w-lg"} rounded-xl border border-border bg-surface p-6`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="text-textSecondary hover:text-textPrimary" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  loading = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="space-y-5">
        <div className="text-sm text-textSecondary">{message}</div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
