import clsx from "clsx";

type Variant = "new" | "analyzed" | "in_progress" | "active" | "paused" | "completed";

const styles: Record<Variant, string> = {
  new:         "bg-amber-50 text-amber-700 border border-amber-200",
  analyzed:    "bg-emerald-50 text-emerald-700 border border-emerald-200",
  in_progress: "bg-blue-50 text-blue-700 border border-blue-200",
  active:      "bg-emerald-50 text-emerald-700 border border-emerald-200",
  paused:      "bg-slate-100 text-slate-500 border border-slate-200",
  completed:   "bg-indigo-50 text-indigo-600 border border-indigo-200",
};

const labels: Record<Variant, string> = {
  new:         "Новая",
  analyzed:    "Проанализировано",
  in_progress: "В работе",
  active:      "Активный",
  paused:      "Пауза",
  completed:   "Завершён",
};

export function Badge({ variant }: { variant: Variant }) {
  return (
    <span className={clsx("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", styles[variant])}>
      {labels[variant]}
    </span>
  );
}
