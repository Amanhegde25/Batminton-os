import { forwardRef } from "react";
import { Card } from "./card";

const variants = {
  default: "bg-primary text-primary-foreground shadow hover:opacity-90",
  secondary: "bg-secondary text-secondary-foreground shadow-sm hover:opacity-90",
  outline: "border border-input bg-background shadow-sm hover:bg-muted",
  ghost: "hover:bg-muted",
  destructive: "bg-destructive text-destructive-foreground shadow-sm hover:opacity-90",
  link: "text-primary underline-offset-4 hover:underline"
};

const sizes = {
  sm: "h-8 rounded-lg px-3 text-xs",
  md: "h-10 rounded-lg px-4 text-sm",
  lg: "h-11 rounded-xl px-6 text-base",
  icon: "h-9 w-9 rounded-lg"
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className = "", variant = "default", size = "md", type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
});

export function Badge({
  className = "",
  tone = "muted",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "muted" | "primary" | "success" | "warning" | "danger" | "accent" }) {
  const tones = {
    muted: "bg-muted text-muted-foreground",
    primary: "bg-primary/10 text-primary dark:bg-primary/20",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    danger: "bg-red-500/10 text-red-600 dark:text-red-400",
    accent: "bg-accent/15 text-teal-700 dark:text-teal-300"
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
      {...props}
    />
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function Avatar({ name, src, size = 36 }: { name: string; src?: string | null; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className="inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} width={size} height={size} className="h-full w-full object-cover" />
      ) : (
        initials || "?"
      )}
    </span>
  );
}

export function EmptyState({
  title,
  body,
  icon
}: {
  title: React.ReactNode;
  body?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center">
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <div className="font-medium">{title}</div>
      {body && <p className="max-w-sm text-sm text-muted-foreground">{body}</p>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

export function Sparkline({
  data,
  height = 40,
  className = ""
}: {
  data: number[];
  height?: number;
  className?: string;
}) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = Math.max(data.length * 8, 60);
  const points = data.map((v, i) => `${(i / (data.length - 1 || 1)) * w},${height - ((v - min) / range) * (height - 6) - 3}`);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className={className} style={{ width: "100%", height }} preserveAspectRatio="none">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BarChart({ data, labels, format }: { data: number[]; labels: string[]; format?: (n: number) => string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="space-y-2">
      {data.map((v, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-xs text-muted-foreground">{labels[i]}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.max((v / max) * 100, v > 0 ? 2 : 0)}%` }}
            />
          </div>
          <span className="w-16 shrink-0 text-right text-xs tabular-nums">{format ? format(v) : v}</span>
        </div>
      ))}
    </div>
  );
}
