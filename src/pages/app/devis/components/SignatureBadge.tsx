/**
 * Badge de statut de signature d'un devis, pensé pour la liste :
 * « Signé » (vert/accent) quand le client a signé, « En attente » (secondaire)
 * sinon. Il permet de repérer d'un coup d'œil les devis qui ne sont pas encore signés.
 */
export default function SignatureBadge({ signed }: { signed: boolean }) {
  if (signed) {
    return (
      <span
        className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-accent-100 text-accent-800 text-[10px] font-bold whitespace-nowrap"
        title="Devis signé par le client"
      >
        <i className="ri-checkbox-circle-fill text-[11px]"></i>
        Signé
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-secondary-100 text-secondary-800 text-[10px] font-bold whitespace-nowrap"
      title="En attente de la signature du client"
    >
      <i className="ri-time-line text-[11px]"></i>
      En attente
    </span>
  );
}