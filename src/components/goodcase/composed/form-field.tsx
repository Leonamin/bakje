import { useId, type ReactNode } from "react";

export function FormField({
  label,
  description,
  error,
  isRequired,
  children,
}: {
  label: string;
  description?: string;
  error?: string;
  isRequired?: boolean;
  children: (props: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid": boolean;
    required: boolean;
  }) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="gc-form-field">
      <label htmlFor={id}>
        {label}
        {isRequired && <span aria-hidden="true"> *</span>}
      </label>
      {children({
        id,
        "aria-describedby": description || error ? `${id}-help` : undefined,
        "aria-invalid": !!error,
        required: !!isRequired,
      })}
      {(description || error) && (
        <p id={`${id}-help`} className={error ? "gc-error" : "gc-muted"}>
          {error || description}
        </p>
      )}
    </div>
  );
}
