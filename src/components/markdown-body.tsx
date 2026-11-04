import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Fold } from "@/components/fold";

// Raw HTML is not enabled (react-markdown default), links open in a new tab, images are not fetched.
const components: Components = {
  h1: ({ children }) => <h2 className="mb-3 mt-9 text-[20px] font-bold leading-snug">{children}</h2>,
  h2: ({ children }) => <h2 className="mb-3 mt-9 text-[20px] font-bold leading-snug">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 mt-6 text-[16px] font-semibold">{children}</h3>,
  h4: ({ children }) => <h4 className="mb-2 mt-5 text-[15px] font-semibold">{children}</h4>,
  p: ({ children }) => <p className="my-3">{children}</p>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1.5 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1.5 pl-5">{children}</ol>,
  a: ({ href, children }) => <a className="press underline" href={href} target="_blank" rel="noreferrer">{children}</a>,
  img: ({ alt }) => <span className="text-[var(--muted)]">[이미지{alt ? `: ${alt}` : ""}]</span>,
  blockquote: ({ children }) => <blockquote className="my-4 border-l-2 border-[var(--line-strong)] pl-4 text-[var(--muted)]">{children}</blockquote>,
  hr: () => <hr className="my-6 border-[var(--line)]" />,
  code: ({ className, children }) => className
    ? <code className={className}>{children}</code>
    : <code className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-[0.9em]">{children}</code>,
  pre: ({ children }) => <pre className="my-4 overflow-x-auto rounded-2xl bg-[var(--surface)] p-4 text-[14px] leading-relaxed">{children}</pre>,
  table: ({ children }) => <div className="my-4 overflow-x-auto"><table className="w-full border-collapse text-[14px]">{children}</table></div>,
  th: ({ children }) => <th className="border-b border-[var(--line-strong)] px-3 py-2 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-[var(--line)] px-3 py-2 align-top">{children}</td>,
};

/** The page already shows the title as h1; drop a leading `# title` that repeats it. */
function withoutTitle(text: string, title: string) {
  const m = text.match(/^\s*#\s+(.+?)\s*\n/);
  return m && m[1].trim() === title.trim() ? text.slice(m[0].length) : text;
}

export function Markdown({ text }: { text: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{text}</ReactMarkdown>;
}

/** Main document of an item: no card, with the raw text one tap away for copying. */
export function MarkdownBody({ text, title }: { text: string; title: string }) {
  return <>
    <div className="break-words text-[16px] leading-[1.7] [&>*:first-child]:mt-0">
      <Markdown text={withoutTitle(text, title)} />
    </div>
    <Fold title="원문 보기" className="mt-8 border-t border-[var(--line)] pt-3" summaryClassName="label min-h-11">
      <div className="whitespace-pre-wrap break-words rounded-2xl bg-[var(--surface)] p-4 text-[14px] leading-relaxed">{text}</div>
    </Fold>
  </>;
}
