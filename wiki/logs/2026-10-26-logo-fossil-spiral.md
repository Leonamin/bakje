---
type: Log
title: "Logo Fossil Spiral"
description: "로고 시안 탐색, F(화석 나선) 확정, 아이콘 3종 교체"
timestamp: 2026-10-26
okf_version: "0.1"
---

# Logo Fossil Spiral

로고 컨셉을 탐색해 F(화석 나선)로 확정하고 아이콘을 교체했다. 시안 미리보기는 임시 서버로 tailnet에서 확인했고 확정 뒤 종료했다. OpenGraph는 개인용이라 보류했다.

- 추가: decisions/015-logo-fossil-spiral.md, references/logo-sketches.md
- 갱신: decisions/index.md, references/index.md, logs/index.md, index.md
- 코드: src/app/icon.svg, src/app/apple-icon.png, public/icon-512.png

## 배포와 위키 정정

- 로고 커밋을 처음 배포할 때 의미 검색이 아직 운영에 없다는 위키 문구를 믿고 의미 검색 커밋 이전 상태에서 배포해 임베딩 사이드카가 잠시 내려갔다. 실제로는 릴리스 `20261026T024037Z`부터 운영 중이었다. 현재 커밋으로 다시 배포해 복구했다.
- 위키의 "운영 배포 전" 문구와 최신 릴리스(`20261026T031110Z`)를 정정했다.
- 헤더 락업과 나선 스피너(`7c000c7`)를 함께 배포했다.
- 갱신: index.md, decisions/014-semantic-search-embedder-sidecar.md, decisions/015-logo-fossil-spiral.md
