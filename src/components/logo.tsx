/** The fossil-spiral mark as a bare stroke so it follows the surrounding text color. Centered on its viewBox, so it can spin in place. */
export function Logo({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="106 106 300 300" fill="none" aria-hidden="true" className={className}>
      <path
        transform="translate(-30 -30)"
        d="M256 256a20 20 0 0 1 20-20a40 40 0 0 1 40 40a60 60 0 0 1-60 60a80 80 0 0 1-80-80a100 100 0 0 1 100-100a120 120 0 0 1 120 120a140 140 0 0 1-140 140"
        stroke="currentColor"
        strokeWidth="24"
        strokeLinecap="round"
      />
    </svg>
  );
}
