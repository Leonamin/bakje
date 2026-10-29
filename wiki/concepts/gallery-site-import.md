---
type: Concept
title: "갤러리 사이트 일회성 수집"
description: "ai-costume·ai-pose 갤러리를 박제 밖 스크립트로 받아 manifest로 등록한 절차와 분류 규칙"
tags: [library, import, manifest, gallery]
timestamp: 2026-10-29
---

# 갤러리 사이트 일회성 수집

HTML 안에 데이터 배열(`const D=[...]`)을 심은 정적 갤러리 사이트(Cloudflare Pages)를 박제 라이브러리에 넣은 절차다. 박제 앱에는 이 사이트용 코드가 없다. 수집 스크립트는 박제 저장소 밖 `~/dev/prompt/<이름>/scrape.py`에 둔 일회성 도구이고, 결과 폴더만 `~/Library/<이름>/`에 두어 연결 폴더로 등록했다. → [통합 라이브러리](./unified-library.md), [결정 019](../decisions/019-no-manual-upload-free-folder.md)

## 흐름

1. `scrape.py`가 HTML의 `const D=[...]`를 읽고 이미지를 `~/Library/<이름>/img/`에 저장한 뒤 같은 폴더에 `manifest.jsonl`을 쓴다. 재실행하면 받은 이미지는 건너뛴다(`.part` 임시 파일 후 이름 변경).
2. `/etc/bakje/compose.override.yml`에 `~/Library/<이름>` → `/library/<이름>` 바인드 마운트를 추가하고 `web`만 다시 만든다. 기존 마운트·`/data`·재시작 정책(`unless-stopped`)은 그대로 유지한다. 수정 전 `.bak-날짜시각` 백업을 만든다. → [운영과 배포](./operations.md)
3. MCP `connect_library_folder`로 `/library/<이름>`을 연결하고 `import_library_manifest`로 `manifest.jsonl`을 등록한다. 임베딩 분석은 등록과 별개로 큐에서 진행된다.

## ai-costume

- 출처 `ai-costume-gallery.pages.dev`. 1,407건, 카테고리 8종(春·夏·秋·冬·ランジェリー·セクシー·水着·パーティ).
- 사이트가 `img/*.webp`(1366×2048)와 원본 `png/`를 모두 제공한다. 같은 해상도라 webp만 받았다(약 118MB).
- 항목 1개 = 이미지 1장 + 영어 키워드 글(`prompt:en`). 사이트에 완성된 프롬프트는 없고 의상 키워드뿐이다. 제목은 사이트 ID(`SPR-0001`).
- 폴더 `의상/<봄|여름|가을|겨울|란제리|섹시|수영복|파티>`, 태그 `의상` + 카테고리.
- 저장소 id 3 `ai-costume`, 등록 작업 4: 1,407건 성공.

## ai-pose

- 출처 `ai-pose-gallery.pages.dev`. 이미지 1,439장 = 포즈 288개 × 앵글 4~5장(정면·위·아래·옆·비스듬, 한 포즈만 4장).
- 사이트는 PNG(900×1200, 약 520KB)만 제공한다. Pillow(스크립트 폴더의 `.venv`에만 설치)로 webp 품질 90 변환해 750MB 예상이 75MB가 됐다.
- 항목 1개 = 포즈 1개. 일본어 포즈 이름(`text:name`)과 앵글별 이미지(`image:<앵글>`)를 묶고, 앵글은 구성요소 metadata에 둔다. 제목 `P001 포즈이름`, `external_id`는 `ai-pose:<계통코드>_<번호>`.
- 폴더 `포즈/<계통>`(전신1인·섹시계 / 전신1인·표준계 / 상반신1인 / 2人絡み). 태그 `포즈` + 계통 + 분류(26종, 일본어 원문 유지).
- 성인 태그: `2人絡み` 계통 전체와 `セクシー・露骨寄り系` 분류에 `성인`을 붙였다(288건 중 85건). 기준은 스크립트의 `ADULT_LINE`·`ADULT_CAT`.
- 저장소 id 4 `ai-pose`, 등록 작업 5: 288건 성공.

## 주의와 미검증

- 개인 보관용이다. 두 사이트 모두 `robots.txt`는 확인하지 못했거나 없었고, 제작자 공개 갤러리라는 점만 근거다.
- 새 마운트는 opennana와 같은 형식이라 마운트 자체에 `read_only`를 걸지 않았다. 박제 쪽 연결은 `allow_delete=0`이다.
- 사이트가 항목을 추가했을 때 같은 manifest를 다시 등록해 갱신되는지는 미검증이다. 성인 태그 기준을 바꿔 재등록하는 경우도 같다.
- 첫 컨테이너 재생성은 zsh에서 명령을 변수에 담아 실행해 실패했다(컨테이너는 이전 상태 유지). 셸 함수로 바꿔 다시 실행했다.
