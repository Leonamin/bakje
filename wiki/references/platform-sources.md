---
type: Reference
title: "플랫폼 수집 경로"
description: "각 플랫폼에서 데이터를 얻는 실제 엔드포인트와 제약"
tags: [x, threads, reddit, scraping]
timestamp: 2026-10-25
---

# 플랫폼 수집 경로

## X

| 경로 | 얻는 것 | 비고 |
|---|---|---|
| `x.com/i/status/<id>` (브라우저 UA) | TweetDetail 전체: 본문·타래·부모·인용·지표·미디어 | SSR HTML 내 `GraphQLRequestStream.Completed`의 `value` 문자열 |
| `cdn.syndication.twimg.com/tweet-result?id=<id>&lang=en&token=a` | 단일 글 본문·미디어 | 토큰 없이 동작. 타래 없음 |
| `publish.twitter.com/oembed` | 없음 | 현재 빈 응답 |

- GraphQL 응답 구조: `data.threaded_conversation_with_injections_v2.instructions[].entries[]`
- 작성자: `result.core.user_results.result.core.screen_name`
- 본문: `note_tweet.note_tweet_results.result.text` 우선, 없으면 `details.full_text`
- 부모: `reply_to_results.rest_id`
- 타래 표시: `content.display_type === "SelfThread"`
- 미디어: `media_entities2[]` (photo는 `media_url_https`, 영상은 variants)

## Threads

- 게시글: `threads.com/@user/post/<code>`, `threads.com/t/<code>`
- 공유 링크: `threads.com/share/<token>` → 브라우저로 열어야 최종 URL이 나온다(HTTP 리다이렉트 아님)
- 데이터: `<script type="application/json">` 블록의 Relay 프리로더. `code` + `caption` + `user` + `image_versions2`/`video_versions`
- oEmbed(`graph.threads.com/oembed`)는 단일 글 HTML만 준다. 타래는 없다.

## Reddit

- 페이지: `reddit.com/r/<sub>/comments/<id>/<slug>/`
- `.json` 엔드포인트: 현재 403. 브라우저 쿠키로도 차단.
- DOM: `<shreddit-post>` 속성(`post-title`, `author`, `score`, `comment-count`, `created-timestamp`, `permalink`, `content-href`, `post-type`)
- 본문: `[slot="text-body"]` 내 `p, li, h1..h4, blockquote, pre`
- 댓글: `<shreddit-comment author depth thingid>`, 본문은 `[slot="comment"]`
- 영상: `shreddit-player[src]`가 HLS 매니페스트 → `CMAF_<height>.mp4` 파일 하나가 모든 바이트 범위를 포함

## 환경 제약

- 이 호스트의 정적 ffmpeg 7.0.2는 HTTPS 입력에서 세그폴트(exit 139). 네트워크 다운로드는 Node가 담당.
- Reddit은 동일 IP에서 반복 요청 시 챌린지 페이지를 반환한다. 쿠키를 받은 뒤 재시도해도 실패할 수 있다.
