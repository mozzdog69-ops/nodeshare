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
    "bg-accent text-white shadow-[var(--shadow-red)] hover:bg-accent-hover hover:shadow-[0_6px_28px_var(--accent-glow)] hover:-translate-y-px active:translate-y-0 disabled:opacity-45 disabled:shadow-none disabled:hover:translate-y-0",
  secondary:
    "bg-white text-text-primary border-2 border-border-strong hover:border-accent hover:text-accent hover:bg-surface-accent disabled:opacity-45",
  ghost:
    "text-text-secondary hover:text-accent hover:bg-surface-accent disabled:opacity-45",
  danger:
    "bg-accent-hover text-white hover:bg-red-800 disabled:opacity-45",
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
      "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] px-4 py-2.5 text-sm font-semibold tracking-tight transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none",
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
      <button ref={ref} type={type} className={classes} {...props}>
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
