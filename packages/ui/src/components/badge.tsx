import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

export type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "purple";

const badgeToneClasses: Record<BadgeTone, string> = {
  neutral:
    "border-border bg-muted text-muted-foreground [&_.badge-dot]:bg-muted-foreground/72",
  // Steel blue-gray: informational and quiet, distinct from the saturated
  // brand-blue "purple" tone below.
  info: "border-slate-600/40 bg-slate-500/12 text-slate-700 dark:border-slate-300/40 dark:bg-slate-300/14 dark:text-slate-200 [&_.badge-dot]:bg-slate-600 dark:[&_.badge-dot]:bg-slate-300",
  success:
    "border-success/55 bg-success/16 text-success [&_.badge-dot]:bg-success",
  warning:
    "border-warning/60 bg-warning/22 text-warning-foreground dark:bg-warning/16 dark:text-warning [&_.badge-dot]:bg-warning",
  danger:
    "border-destructive/55 bg-destructive/14 text-destructive [&_.badge-dot]:bg-destructive",
  // Legacy key name from the purple era; renders the brand-blue tone.
  purple:
    "border-primary-strong/45 bg-primary/24 text-primary-strong [&_.badge-dot]:bg-primary-strong",
};

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border font-semibold leading-none whitespace-nowrap",
  {
    variants: {
      variant: {
        default: badgeToneClasses.purple,
        secondary: badgeToneClasses.neutral,
        outline: "border-border bg-transparent text-foreground",
        destructive: badgeToneClasses.danger,
        success: badgeToneClasses.success,
        warning: badgeToneClasses.warning,
      },
      tone: badgeToneClasses,
      size: {
        sm: "min-h-6 gap-1.5 px-2 text-xs",
        md: "min-h-[1.625rem] gap-1.5 px-2.5 text-xs",
      },
    },
    defaultVariants: {
      size: "sm",
    },
  },
);

const legacyVariantTone: Record<
  NonNullable<VariantProps<typeof badgeVariants>["variant"]>,
  BadgeTone
> = {
  default: "purple",
  secondary: "neutral",
  outline: "neutral",
  destructive: "danger",
  success: "success",
  warning: "warning",
};

export interface BadgeProps
  extends
    Omit<React.HTMLAttributes<HTMLDivElement>, "color">,
    VariantProps<typeof badgeVariants> {
  icon?: React.ReactNode;
  tone?: BadgeTone;
}

export interface VersionBadgeProps
  extends Omit<
    BadgeProps,
    "children" | "icon" | "size" | "tone" | "variant"
  > {
  version: string;
}

function Badge({
  children,
  className,
  icon,
  size = "sm",
  tone,
  variant,
  ...props
}: BadgeProps) {
  const resolvedTone =
    tone ?? (variant ? legacyVariantTone[variant] : "neutral");

  return (
    <div
      className={cn(
        badgeVariants({ tone: resolvedTone, size, variant: undefined }),
        className,
      )}
      {...props}
    >
      {icon ? <span className="inline-flex shrink-0">{icon}</span> : null}
      {children}
    </div>
  );
}

function VersionBadge({
  version,
  className,
  ...props
}: VersionBadgeProps) {
  const normalizedVersion = version.startsWith("v")
    ? version.slice(1)
    : version;

  return (
    <Badge
      aria-label={`Version ${normalizedVersion}`}
      tone="purple"
      className={cn(
        "min-h-[18px] px-1.5 py-0 font-mono text-[9.5px] tracking-[0.02em]",
        className,
      )}
      {...props}
    >
      v{normalizedVersion}
    </Badge>
  );
}

export { Badge, VersionBadge, badgeVariants };
