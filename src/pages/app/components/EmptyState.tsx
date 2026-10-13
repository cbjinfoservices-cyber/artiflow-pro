import type { ReactNode } from "react";

export default function EmptyState({
  icon,
  title,
  text,
  children,
}: {
  icon: string;
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-14 md:py-20 rounded-lg bg-background-100 border border-background-200">
      <span className="w-16 h-16 flex items-center justify-center rounded-full bg-primary-100 text-primary-700 text-3xl">
        <i className={icon}></i>
      </span>
      <h2 className="mt-5 font-heading font-bold text-xl text-foreground-950">{title}</h2>
      <p className="mt-2 text-sm text-foreground-500 leading-relaxed max-w-md">{text}</p>
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}