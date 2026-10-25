export function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function relative(iso: string | null): string {
  if (!iso) return "-";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "-";
  const diff = Date.now() - t;
  const min = Math.round(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hour = Math.round(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.round(hour / 24);
  if (day < 30) return `${day}일 전`;
  const month = Math.round(day / 30);
  if (month < 12) return `${month}개월 전`;
  return `${Math.round(month / 12)}년 전`;
}

export function platformName(p: string): string {
  return p === "x" ? "X" : p === "threads" ? "Threads" : p === "reddit" ? "Reddit" : p;
}

export function statusLabel(s: string): { text: string; tone: "ok" | "warn" | "bad" } {
  switch (s) {
    case "ok":
      return { text: "보존됨", tone: "ok" };
    case "partial":
      return { text: "부분 수집", tone: "warn" };
    case "deleted":
      return { text: "원문 삭제됨", tone: "bad" };
    case "error":
      return { text: "확인 필요", tone: "warn" };
    default:
      return { text: s, tone: "warn" };
  }
}

export function compactNumber(n: number | null): string {
  if (n == null) return "-";
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}천`;
  return `${(n / 10000).toFixed(1).replace(/\.0$/, "")}만`;
}

export function mediaUrl(p: string | null): string | null {
  if (!p) return null;
  return `/api/media/${p}`;
}
