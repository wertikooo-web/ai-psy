import clsx from "clsx";
import { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  onClick?: () => void;
  className?: string;
}

const variants = {
  primary:   "bg-brand-500 hover:bg-brand-600 text-white shadow-sm",
  secondary: "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm",
  ghost:     "hover:bg-slate-100 text-slate-600",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

export function Button({ children, variant = "primary", size = "md", onClick, className }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-lg font-medium transition-all",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </button>
  );
}
