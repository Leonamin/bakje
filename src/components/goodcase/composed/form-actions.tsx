import { Button } from "../basic/button";

export function FormActions({
  isSubmitting,
  onCancel,
  error,
  submitLabel = "저장",
}: {
  isSubmitting: boolean;
  onCancel: () => void;
  error?: string;
  submitLabel?: string;
}) {
  return (
    <div className="gc-form-actions">
      {error && (
        <p role="alert" className="gc-error">
          {error}
        </p>
      )}
      <div className="gc-actions">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          취소
        </Button>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? "저장 중…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}
