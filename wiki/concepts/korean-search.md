---
type: Concept
title: "한국어 키워드 검색"
description: "trigram FTS5를 쓰는 이유와 2글자 이하 폴백"
tags: [search, fts5, korean]
timestamp: 2026-10-25
---

# 한국어 키워드 검색

## 문제

SQLite FTS5 기본 `unicode61` 토크나이저는 공백·구두점 기준으로 토큰을 나눈다. 한국어는 조사가 붙어 `북마크`와 `북마크를`이 서로 다른 토큰이 되므로, "북마크"로 "북마크를"을 찾지 못한다.

## 선택

`tokenize = 'trigram'`을 쓴다. 3글자 이상 질의를 부분 문자열로 매칭하므로 조사·어미 변화에 강하다. 별도 형태소 분석기 의존성이 없다.

- 3글자 이상: `search_fts MATCH "질의"` (bm25 정렬)
- 2글자 이하: trigram 최소 길이 제약 때문에 `search_doc`에 `LIKE '%질의%'` 스캔
- 여러 토큰: 각각 따옴표로 감싸 `AND` 결합

## 색인 대상

`search_doc`에 다음을 모아 색인한다.

- 제목(Reddit)과 원문 본문
- 번역문(`text_ko`) — 한국어로 검색해도 해외 글이 잡히게 하려면 필수
- 요약, 작성자 이름·핸들, 태그

`parent_context`(부모 글)는 본문 색인에서 제외한다. 맥락이 검색 결과를 오염시키지 않게 하려는 선택이다.

## 구현 위치

- `src/lib/search.ts` — 질의 분기, bm25, 스니펫 생성
- `src/lib/pipeline.ts`의 `rebuildSearch` — 저장·번역 후 색인 재생성
- 태그 변경 시 `search_fts` 해당 row만 갱신

## 한계

- trigram 인덱스는 원문 대비 2~3배 커진다. 개인 아카이브 규모에서는 문제되지 않는다.
- 형태소 분석이 아니므로 "먹었다"와 "먹다"를 같은 어근으로 묶지 못한다. 의미 검색(→ [결정 014](../decisions/014-semantic-search-embedder-sidecar.md))이 이 빈틈을 일부 메운다.
- 1글자 질의는 `LIKE` 스캔이라 데이터가 커지면 느려진다.
