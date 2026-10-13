import type { ReactNode } from "react";

export default function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
  footer,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-foreground-950/40"
      onClick={onClose}
    >
      <div
        className={`w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"} max-h-[90vh] overflow-y-auto rounded-t-lg sm:rounded-lg bg-background-50 border border-background-200 p-6`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading font-bold text-lg text-foreground-950">{title}</h2>
            {subtitle && <p className="text-xs text-foreground-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md hover:bg-background-200 cursor-pointer"
          >
            <i className="ri-close-line text-foreground-500"></i>
          </button>
        </div>
        <div className="mt-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 mt-6">{footer}</div>}
      </div>
    </div>
  );
}