---
type: Decision
title: "005. trigram FTS5로 한국어 검색"
description: "형태소 분석기 없이 조사 변화를 견디는 선택"
tags: [search, fts5, korean]
timestamp: 2026-10-25
---

# 005. trigram FTS5로 한국어 검색

## Context

FTS5 기본 토크나이저(`unicode61`)는 공백 기준이라 `북마크`로 `북마크를`을 찾지 못한다. 후보는 세 가지였다.

1. 형태소 분석(kiwi/mecab-ko) 후 색인 — 정확도는 높지만 파이프라인과 사전 관리가 붙는다
2. Postgres + pg_trgm — 배포가 무거워진다
3. FTS5 `trigram` — 부분 문자열 매칭, 추가 의존성 없음

## Decision

`tokenize='trigram'`을 쓰고, 3글자 미만 질의는 `search_doc`에 `LIKE` 스캔으로 폴백한다. 원문과 번역문을 함께 색인한다.

## Consequences

- 조사·어미가 붙어도 매칭된다. 형태소 사전 없이 한국어에서 가장 실용적인 절충이다.
- 인덱스가 원문 대비 2~3배 커진다.
- trigram 최소 길이 때문에 2글자 이하 질의는 스캔이다. 데이터가 커지면 느려진다.
- 어근 정규화는 하지 못한다. 의미 검색이 붙기 전까지의 한계로 남긴다.

## Status

Accepted
