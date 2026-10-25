---
type: Decision
title: "002. TypeScript + Next.js 단일 스택"
description: "수집·파싱·API·UI를 한 언어로 묶은 이유"
tags: [stack, typescript, nextjs]
timestamp: 2026-10-25
---

# 002. TypeScript + Next.js 단일 스택

## Context

이 제품의 난이도는 대부분 파싱에 있다. 파서는 Playwright로 DOM을 읽고, 결과는 SQLite에 저장하고, UI는 그 데이터를 읽는다. 언어가 둘로 갈리면 타입과 직렬화 경계가 늘어난다.

## Decision

TypeScript 하나로 간다.

- Next.js 15 App Router: 화면과 API route를 한 프로젝트에
- better-sqlite3: 동기 API라 파이프라인 코드가 단순해진다
- Playwright: TS 네이티브
- Tailwind CSS v4: 레이아웃 유틸리티

Python(FastAPI + BeautifulSoup)도 검토했지만, 어차피 브라우저 자동화가 필요하고 UI까지 한 저장소에서 관리하는 이점이 컸다.

## Consequences

- 파서의 추출 결과 타입을 그대로 DB 저장까지 끌고 갈 수 있다.
- Next 서버 프로세스가 장시간 파싱·다운로드를 수행한다. 인프로세스 큐로 처리하고, 재시작 시 `job` 테이블에서 복구한다.
- Playwright를 서버 런타임에서 쓰기 위해 `serverExternalPackages` 설정이 필요하다.
- 빌드 산출물과 네이티브 모듈(better-sqlite3)을 같은 이미지에서 컴파일해야 한다.

## Status

Accepted
