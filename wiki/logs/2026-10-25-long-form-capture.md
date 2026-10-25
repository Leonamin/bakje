---
type: Log
title: "Threads 장문·X Article 본문 수집"
description: "Threads 장문 첨부와 X Article(장문 뷰어) 본문이 저장되지 않던 문제를 어댑터에서 해결"
timestamp: 2026-10-25
okf_version: "0.1"
---

# Threads 장문·X Article 본문 수집

- **Threads**: 장문 글은 `caption`에 앞부분만 있고 전문은 `text_post_app_info.snippet_attachment_info.text_fragments`에 있었다. 별도 뷰어 요청 없이 이미 받은 HTML에서 읽어 캡션 뒤에 붙인다. 실제 글(1470자)로 확인했다.
- **X Article**: TweetDetail에는 제목·미리보기뿐이다. 본문은 Article 트윗 자신의 페이지 SSR(`articleDocument.contentKey` 블록 목록, 코드는 `highlights`)에 있어 마크다운으로 변환한다. 인용된 Article이면 그 트윗 페이지를 한 번 더 가져온다. 로그인은 필요 없고 약 2.4만 자 본문을 확인했다.
- 새 SSR 형식에서 인용 글이 `tweet_result_by_rest_id`에만 실려 있어 인용 글이 빠지던 문제도 함께 고쳤다.
- 한계: Article 인라인 이미지·표지는 저장하지 않는다. 코드 블록 언어는 알려진 목록만 인식한다. `npm run reparse`는 스냅샷에 원글 페이지만 있어 인용된 Article 본문을 채우지 못하므로 재수집해야 한다. 서버 배포·재수집은 미검증.

- 추가: logs/2026-10-25-long-form-capture.md
- 갱신: concepts/platform-adapters.md, logs/index.md
