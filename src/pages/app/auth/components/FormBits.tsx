import type { ReactNode } from "react";

export const inputClass =
  "h-11 w-full rounded-md border border-background-200 bg-background-50 px-3 text-sm text-foreground-950 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400";

export const inputIconClass =
  "h-11 w-full rounded-md border border-background-200 bg-background-50 pl-9 pr-3 text-sm text-foreground-950 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400";

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-semibold text-foreground-700">
        {label}
      </label>
      {children}
    </div>
  );
}

export function Feedback({ kind, text }: { kind: "error" | "success"; text: string }) {
  const isError = kind === "error";
  return (
    <div
      className={`flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm ${
        isError
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      <i className={`${isError ? "ri-error-warning-line" : "ri-checkbox-circle-line"} mt-0.5`}></i>
      <span>{text}</span>
    </div>
  );
}