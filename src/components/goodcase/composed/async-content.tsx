import { type ReactNode } from "react";
import { Button } from "../basic/button";
import { Skeleton } from "../basic/skeleton";

export function AsyncContent({
  isLoading,
  isRefreshing = false,
  error,
  isEmpty,
  onRetry,
  children,
}: {
  isLoading: boolean;
  isRefreshing?: boolean;
  error?: string;
  isEmpty: boolean;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (isLoading)
    return (
      <div className="gc-async" role="status" aria-label="처음 불러오는 중">
        <Skeleton height={20} />
        <Skeleton height={20} />
        <p>불러오는 중…</p>
      </div>
    );
  if (error && isEmpty)
    return (
      <div className="gc-async" role="alert">
        <p className="gc-error">{error}</p>
        <Button variant="secondary" onClick={onRetry}>
          다시 시도
        </Button>
      </div>
    );
  if (isEmpty)
    return (
      <div className="gc-async">
        <strong>표시할 항목이 없습니다</strong>
        <p className="gc-muted">조건을 바꾸거나 항목을 추가해보세요.</p>
      </div>
    );
  return (
    <div aria-busy={isRefreshing}>
      {isRefreshing && <p role="status">최신 내용을 불러오는 중…</p>}
      {error && (
        <div role="alert">
          <p className="gc-error">{error} 기존 내용을 유지합니다.</p>
          <Button variant="secondary" onClick={onRetry}>
            다시 시도
          </Button>
        </div>
      )}
      {children}
    </div>
  );
}
