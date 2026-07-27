import * as React from "react";
import { cn } from "../lib/utils";

export type SegmentedControlOption<T extends string> = {
  value: T;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
};

export interface SegmentedControlProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: SegmentedControlOption<T>[];
  className?: string;
  disabled?: boolean;
  /** "sm" matches the 32px height of Button size="sm" */
  size?: "default" | "sm";
  "aria-label"?: string;
}

function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  className,
  disabled,
  size = "default",
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex w-full gap-1 rounded-lg border border-border bg-muted",
        size === "sm" ? "h-8 p-[3px]" : "p-1",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled || option.disabled}
            data-state={selected ? "on" : "off"}
            onClick={() => {
              if (!selected) {
                onValueChange(option.value);
              }
            }}
            className={cn(
              "flex flex-1 flex-col rounded-md font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
              size === "sm"
                ? "items-center justify-center px-2.5 text-xs"
                : "items-start gap-0.5 px-3 py-2 text-left text-sm",
              selected
                ? "bg-background text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="leading-tight">{option.label}</span>
            {option.description ? (
              <span className="text-xs font-normal leading-tight text-muted-foreground">
                {option.description}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export { SegmentedControl };
