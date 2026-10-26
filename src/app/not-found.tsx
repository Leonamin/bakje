import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <p className="label mb-2">404</p>
      <h1 className="text-[20px] font-semibold">게시글을 찾을 수 없습니다</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-[var(--muted)]">
        삭제되었거나 주소가 잘못되었습니다.
      </p>
      <Link
        href="/"
        className="gc-button gc-button-secondary mt-5"
      >
        라이브러리로
      </Link>
    </div>
  );
}
