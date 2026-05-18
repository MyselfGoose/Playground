"use client";

import { forwardRef, useId } from "react";

const inputBase =
  "w-full px-4 py-3 rounded-[var(--radius-lg)] bg-[var(--input-bg)] border-2 border-[var(--input-border)] text-foreground placeholder-[var(--input-placeholder)] outline-none transition-[border-color,box-shadow] duration-[var(--motion-fast)] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 disabled:opacity-60 disabled:cursor-not-allowed";

const inputError =
  "border-error focus-visible:border-error focus-visible:ring-error/25 aria-invalid:border-error";

export const Input = forwardRef(function Input(
  { label, error, id: idProp, className = "", ...props },
  ref,
) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const hasError = Boolean(error);
  const describedBy = hasError ? `${id}-error` : undefined;

  return (
    <div className="space-y-2">
      {label ? (
        <label htmlFor={id} className="block text-sm font-bold text-foreground">
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={id}
        aria-invalid={hasError || undefined}
        aria-describedby={describedBy}
        className={`${inputBase} ${hasError ? inputError : ""} ${className}`}
        {...props}
      />
      {hasError ? (
        <p id={describedBy} role="alert" className="text-sm font-medium text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
});

Input.displayName = "Input";
