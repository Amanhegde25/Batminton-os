"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "./kit";
import { X } from "@/components/icons";

export function Tabs({
  tabs,
  active,
  onChange
}: {
  tabs: { key: string; label: React.ReactNode }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
            active === t.key ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  children
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border bg-card p-5 sm:p-6 shadow-2xl">
        <div className="mb-4 flex shrink-0 items-center justify-between border-b pb-3">
          <h2 className="text-lg font-semibold leading-tight break-words pr-2">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 pr-1">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function Table({ head, children }: { head: React.ReactNode[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left">
            {head.map((h, i) => (
              <th key={i} className="px-4 py-2.5 font-medium text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ className = "", ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-4 py-3 align-middle ${className}`} {...props} />;
}

export function useToast() {
  const [message, setMessage] = useState<{ text: string; tone: "error" | "success" } | null>(null);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);
  const node = message ? (
    <div
      className={`fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-full px-4 py-2 text-sm shadow-lg ${
        message.tone === "error" ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
      }`}
    >
      {message.text}
    </div>
  ) : null;
  return {
    toast: (text: string, tone: "error" | "success" = "success") => setMessage({ text, tone }),
    node
  };
}
