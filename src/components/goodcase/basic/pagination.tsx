import { Button } from "./button";

export function Pagination({
  page,
  totalPages,
  onPageChange,
  isLoading = false,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}) {
  const safeTotal = Math.max(1, totalPages);
  return (
    <nav className="gc-pagination" aria-label="페이지 탐색">
      <Button
        variant="secondary"
        disabled={page <= 1 || isLoading}
        onClick={() => onPageChange(1)}
      >
        처음
      </Button>
      <Button
        variant="secondary"
        disabled={page <= 1 || isLoading}
        onClick={() => onPageChange(page - 1)}
      >
        이전
      </Button>
      <span aria-live="polite">
        {page} / {safeTotal}
      </span>
      <Button
        variant="secondary"
        disabled={page >= safeTotal || isLoading}
        onClick={() => onPageChange(page + 1)}
      >
        다음
      </Button>
      <Button
        variant="secondary"
        disabled={page >= safeTotal || isLoading}
        onClick={() => onPageChange(safeTotal)}
      >
        마지막
      </Button>
    </nav>
  );
}
