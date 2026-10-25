import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <p className="mono mb-2">404</p>
      <h1 className="text-[20px] font-semibold">게시글을 찾을 수 없습니다</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted)]">
        삭제되었거나 주소가 잘못되었습니다.
      </p>
      <Link
        href="/"
        className="mt-5 inline-flex h-9 items-center rounded-md border border-[var(--line-strong)] px-3 text-[12.5px]"
      >
        라이브러리로
      </Link>
    </div>
  );
}
