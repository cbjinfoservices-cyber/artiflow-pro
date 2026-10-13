import { TONE_BADGE } from "@/lib/statuts";

export default function StatutBadge({ label, tone, icon }: { label: string; tone: string; icon?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${TONE_BADGE[tone] ?? TONE_BADGE.secondary}`}>
      {icon && <i className={icon}></i>}
      {label}
    </span>
  );
}