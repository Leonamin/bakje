---
type: Log
title: "중복 링크 재수집 승인과 pnpm 전환"
description: "이미 저장된 링크는 duplicate 상태로 두고 수집 화면에서 다시 가져오기를 승인·거부, 패키지 매니저를 pnpm으로 전환"
timestamp: 2026-10-25
okf_version: "0.1"
---

# 중복 링크 재수집 승인과 pnpm 전환

1. **pnpm 전환**: `package-lock.json`을 `pnpm-lock.yaml`로 옮기고(`pnpm import`) 원본을 지웠다. pnpm 12는 빌드 스크립트를 기본 차단해 `pnpm-workspace.yaml`에 `allowBuilds`(`better-sqlite3`, `esbuild`)를 뒀다. `packageManager`를 `pnpm@12.9.1`로 고정하고, Dockerfile(`corepack enable`, `--frozen-lockfile`, `node_modules/.bin/next`), README, 스크립트 주석을 맞췄다. npm 캐시는 비웠다.
2. **중복 링크**: 이미 저장된 글이면 `duplicate` 상태로 두고, 수집 화면에서 `다시 가져오기`·`그대로 두기`를 고르게 했다. `POST /api/jobs/[id]`와 `resolveDuplicate`가 처리한다. 상세는 [수집 작업 큐](../concepts/capture-queue.md).
3. **검증**: 중복 진입·거부·재요청 409·모바일 폭 화면은 확인했고 승인(재수집) 경로는 미검증이다.

- 갱신: concepts/capture-queue.md, concepts/data-model.md, concepts/index.md, index.md, logs/index.md
- 추가: logs/2026-10-25-duplicate-refetch-and-pnpm.md
