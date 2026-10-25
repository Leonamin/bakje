---
type: Concept
title: "iOS 단축어 수집"
description: "공유 시트의 단축어가 /api/ingest로 링크를 보내는 방식, 응답 형식, 도움말 페이지"
tags: [ios, shortcut, capture, help]
timestamp: 2026-10-25
---

# iOS 단축어 수집

X·Threads·Reddit 앱의 공유 시트에서 단축어를 실행하면 링크가 곧바로 박제 서버로 간다. 앱을 열고 수집 탭에서 붙여넣기를 승인하는 단계가 없어진다. 접근은 지금처럼 tailnet으로 제한하고 인증은 붙이지 않았다. → [결정 001](../decisions/001-single-user-local.md)

## 서버 입력 (`/api/ingest`)

- 본문으로 JSON `{urls}`·`{url}`·`{text}`와 일반 텍스트를 모두 받는다. 공유된 글에 섞인 링크만 골라내고(`src/lib/canonical.ts`) 중복은 제거한다.
- 응답 JSON에 한국어 `message`를 붙인다: 박제를 시작했습니다 / 이미 저장된 게시글입니다 / 지원하지 않는 링크 N개 제외.
- `?format=text`면 메시지 한 줄을 일반 텍스트로, **항상 200**으로 돌려준다. 단축어가 4xx 응답 본문을 보여주는지 확인하지 못해서, 결과를 "알림 보기"에 그대로 띄우기 위해 이렇게 했다.
- 앱이 쓰는 JSON 응답(`jobs`, `rejected`, `error`, 상태 코드)은 바뀌지 않았다.
- 본문 해석 자체 검사: `npx tsx scripts/test-extract.ts`

## 도움말 페이지 (`/help/shortcut`)

- 수집 화면 제목 옆 "공유 시트로 저장" 링크에서 들어간다.
- 단축어 만드는 7단계와 "잘 안 될 때" 6항목. 수집 주소는 복사 칸(`src/components/copy-field.tsx`)으로 제공한다.
- 각 단계 그림은 단축어 화면을 단순화한 인라인 SVG다. 단계마다 `capture` 필드가 있어 실제 캡처를 `public/help/`에 넣고 지정하면 그림 대신 표시된다.

## 미검증

- 단축어 동작의 한국어 이름(URL의 콘텐츠 가져오기, 알림 보기, 공유 시트에서 보기), 첫 실행 허용 창 문구, 권한 재설정 경로. Apple 공식 문서로 확인하지 못하고 커뮤니티 자료로만 맞췄다.
- 각 앱의 공유 메뉴 이름("더 보기", "다음으로 공유…").
- iCloud 단축어 공유 링크는 실제 iPhone에서 만들어야 해서 페이지에는 아직 없다는 안내만 있다.
- 실기기 동작 전체.
