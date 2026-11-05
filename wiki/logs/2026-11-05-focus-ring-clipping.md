---
type: Log
title: "포커스 링 잘림 수정과 lint:ui 검사"
description: "드롭다운 항목 포커스 링 잘림 원인 정리, .gc-option 수정, overflow 규칙 검사 추가"
timestamp: 2026-11-05
---

# 포커스 링 잘림 수정과 lint:ui 검사

- 원인과 규칙: [UI 시스템](../concepts/ui-system.md)의 "포커스 링 잘림과 outline: none 무효".
- `src/styles/overlays.css`: `.gc-option` 포커스 링 제거(특이도 0,2,0).
- `scripts/lint-ui.ts`: `overflow: auto/scroll` CSS 규칙에 `--gc-focus-clearance` 또는 `focus-ok` 주석 요구. 기존 7곳에 주석 표시.
- 미검증: 브라우저에서 키보드로 링이 사라졌는지 직접 확인하지 않았다. Goodcase 쪽 점검은 별도 요청.
