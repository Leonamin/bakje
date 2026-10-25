---
type: Log
title: "Wiki Setup"
description: "프로젝트 위키 구조를 만들고 지금까지의 계획·구현을 문서화"
timestamp: 2026-10-25
okf_version: "0.1"
---

# Wiki Setup

기획 논의와 구현 내용이 대화에만 남아 있어, 프로젝트에 위키를 만들고 문서로 옮겼다.

## 결정

- 경로: `./wiki` (프로젝트 루트 기준)
- 형식: OKF v0.1 스타일 Markdown + YAML frontmatter
- 분류: `concepts`(개념·시스템) / `decisions`(ADR) / `references`(외부 자료) / `logs`(변경 이력)
- 인덱스: 모든 디렉토리에 `index.md`, 바로 아래 문서와 하위 인덱스만 안내
- 로그: `YYYY-MM-DD-kebab-case.md`, `logs/index.md`에 최신순 등록

## 만든 문서

- concepts: product-scope, collection-rules, platform-adapters, data-model, korean-search, media-pipeline, translation, ui-system, operations
- decisions: 001~009
- references: platform-sources, design-references
- logs: 이 문서 포함 3건

## 원칙

- 코드와 어긋난 서술은 코드를 기준으로 고친다.
- 검증하지 않은 동작은 "미검증"으로 표시한다. 특히 Threads 다단 타래, 실제 LLM 번역 품질.
- 대화에 없던 사실·출처·결정을 만들지 않는다.

## 변경 파일

- 추가: `.agents/wiki-path`, `.agents/wiki-structure.md`, `wiki/**`
