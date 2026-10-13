import type { ReactNode } from "react";

export function LoadingBlock() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="flex flex-col items-center gap-3">
        <i className="ri-loader-4-line animate-spin text-2xl text-primary-600"></i>
        <p className="text-sm text-foreground-500">Chargement de vos données…</p>
      </div>
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-16 rounded-lg bg-background-100 border border-background-200">
      <span className="w-14 h-14 flex items-center justify-center rounded-full bg-primary-100 text-primary-700 text-2xl">
        <i className="ri-error-warning-line"></i>
      </span>
      <p className="mt-4 text-sm text-foreground-600 max-w-md">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
      >
        <i className="ri-refresh-line"></i> Réessayer
      </button>
    </div>
  );
}

export default function DataState({
  loading,
  error,
  onRetry,
  children,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={onRetry} />;
  return <>{children}</>;
}