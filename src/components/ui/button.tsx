import {
  cloneElement,
  forwardRef,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactElement,
} from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white shadow-sm hover:bg-accent-hover hover:shadow-[0_0_0_1px_rgba(225,29,72,0.2),0_8px_24px_var(--accent-glow)] hover:-translate-y-px active:translate-y-0 disabled:opacity-45 disabled:shadow-none disabled:hover:translate-y-0",
  secondary:
    "bg-surface-elevated text-text-primary border border-border-strong hover:border-accent/30 hover:bg-white hover:shadow-card disabled:opacity-45",
  ghost:
    "text-text-secondary hover:text-text-primary hover:bg-black/[0.04] disabled:opacity-45",
  danger:
    "bg-red-600 text-white hover:bg-red-700 disabled:opacity-45",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  asChild?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", type = "button", asChild, children, ...props },
    ref,
  ) => {
    const classes = cn(
      "inline-flex items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-medium tracking-tight transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none",
      variants[variant],
      className,
    );

    if (asChild && isValidElement(children)) {
      const child = children as ReactElement<{ className?: string; ref?: unknown }>;
      return cloneElement(child, {
        ...child.props,
        ...props,
        ref: ref as never,
        className: cn(classes, child.props.className),
      } as never);
    }

    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        {...props}
      >
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
