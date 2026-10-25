---
type: Log
title: "MVP 구현"
description: "수집·저장·검색·미디어·번역 파이프라인을 실제 동작하는 코드로 구현"
timestamp: 2026-10-25
okf_version: "0.1"
---

# MVP 구현

## 계획에서 확정된 것

기획 초안을 구체화하면서 세 가지를 먼저 고쳤다.

1. "댓글의 답글은 파싱하지 않는다"를 깊이 제한으로 구현하면 X 타래가 두 번째에서 잘린다. → **작성자 연속 사슬** 규칙으로 재정의
2. 원문 보존의 의미를 "텍스트 저장"이 아니라 **재처리 가능한 원본**으로 정의
3. 한국어 키워드 검색은 기본 FTS로 동작하지 않는다 → trigram

## 구현 범위

- 스키마: source / part / media / media_blob / translation / tag / snapshot / job / search_doc / search_fts
- 어댑터: X(SSR GraphQL), Threads(Relay JSON), Reddit(DOM 추출)
- 파이프라인: fetch → 스냅샷 → 파싱 → 저장 → 미디어 → 번역 → 색인
- 큐: 인프로세스 2 concurrent, 재시작 시 `job` 테이블에서 복구
- 미디어: 스트리밍 30MB 상한, sha256 중복 제거, HLS→CMAF 파일 다운로드 후 mux, 포스터
- 검색: trigram FTS + 3글자 미만 LIKE 폴백 + 필터
- UI: 라이브러리·수집·상세 (이후 재설계)
- 운영 스크립트: `check`, `reparse`, `gc`, 목 LLM

## 검증

- X: 본문 + 작성자 이어쓰기 1건(note_tweet 전문) + 이미지 4장
- Threads: 공유 링크 해소 → 본문 파싱
- Reddit: 본문 + 미디어 4건(HLS 영상 포함)
- 한국어 검색: `음성`으로 `음성까지` 매칭 확인
- 번역: 목 서버로 저장·토글 확인 (실제 모델 미검증)

## 구현 중 드러난 사실

- X는 로그인 없이 SSR HTML에 전체 대화 페이로드가 들어 있다. 계획했던 Playwright 로그인 경로가 불필요해졌다.
- Reddit `.json`은 403이다. 브라우저 DOM 추출로 전환.
- Reddit 영상은 HLS이고, 이 환경의 정적 ffmpeg는 네트워크 입력에서 죽는다. Node 다운로드 + 로컬 mux로 우회.
- `page.evaluate(fn)`에 TS로 작성한 함수를 넘기면 번들러의 `__name` 헬퍼가 직렬화되어 깨진다. 추출기는 문자열로 넘긴다.

## 변경 파일

- 추가: `src/lib/**`, `src/app/**`, `scripts/{check,reparse,gc,mock-llm}`
- 갱신: `README.md`
