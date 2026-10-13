const toneBadge: Record<string, string> = {
  primary: "bg-primary-100 text-primary-700",
  accent: "bg-accent-100 text-accent-700",
  secondary: "bg-secondary-100 text-secondary-700",
};

export interface ActivityItem {
  icon: string;
  text: string;
  when: string;
  tone: string;
}

export default function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <div className="p-5 rounded-lg bg-background-100 border border-background-200">
      <h2 className="font-heading font-semibold text-base text-foreground-950 mb-4">Activité récente</h2>
      {items.length === 0 ? (
        <p className="text-sm text-foreground-500">Aucune activité pour le moment.</p>
      ) : (
        <ul className="flex flex-col gap-3.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-sm ${toneBadge[item.tone] ?? toneBadge.primary}`}>
                <i className={item.icon}></i>
              </span>
              <div>
                <p className="text-sm text-foreground-800 leading-snug">{item.text}</p>
                <p className="text-[11px] text-foreground-400 mt-0.5">{item.when}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}