import { useState } from "react";
import { seedDemoData } from "@/lib/seedDemoData";
import { useAuth } from "@/hooks/useAuth";

export default function SampleDataButton({ onSeeded }: { onSeeded: () => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    const result = await seedDemoData(user.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Le chargement des exemples a échoué. Réessayez.");
      return;
    }
    onSeeded();
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-database-2-line"></i>}
        Charger des données d'exemple
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}