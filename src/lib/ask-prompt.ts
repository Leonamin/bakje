/** The prompt copied by "AI에게 질문". All wording lives here so it can move to settings later. */

/** Body text beyond this is cut so the prompt still fits a chat box. */
export const ASK_MAX_BODY = 12000;

const ASK_INTRO = "아래 게시글을 읽고, 맨 끝의 질문에 답해 주세요. 게시글에 없는 내용은 추측하지 말고 모른다고 말해 주세요.";
const ASK_QUESTION_LABEL = "질문:";

export type AskInput = {
  url: string;
  title: string | null;
  author: string | null;
  summary: string | null;
  /** Visible text of each part, in reading order. */
  parts: { label: string; text: string }[];
};

export function buildAskPrompt({ url, title, author, summary, parts }: AskInput): string {
  let body = parts
    .filter((p) => p.text.trim())
    .map((p) => `[${p.label}]\n${p.text.trim()}`)
    .join("\n\n");
  if (body.length > ASK_MAX_BODY) body = `${body.slice(0, ASK_MAX_BODY)}\n(이하 생략)`;

  const meta = [title && `제목: ${title}`, author && `작성자: ${author}`, `출처: ${url}`].filter(Boolean).join("\n");

  return [ASK_INTRO, meta, summary && `요약:\n${summary}`, `본문:\n${body}`, `${ASK_QUESTION_LABEL} `]
    .filter(Boolean)
    .join("\n\n");
}
