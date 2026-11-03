---
type: Log
title: "박제 수집 스킬 통합 계획"
description: "범용 박제 수집 스킬과 UX 수집 단순화 계획 기록"
timestamp: 2026-11-03
okf_version: "0.1"
---

# 박제 수집 스킬 통합 계획

`bakje-code`를 `bakje-collect`로 확장하는 제안, 코드·UX별 지침, 기존 UX 스킬과 자료의 전환 검토 및 완료 기준을 계획으로 기록했다. 구현이나 자료 이전은 수행하지 않았다.

- 추가: `concepts/bakje-collect-plan.md`
- 갱신: `concepts/index.md`, `logs/index.md`


## 구현과 검증

사용자와 파일 구조 유지, 안전한 부분 수정, 변경 내용의 검색 갱신, 수집 스킬 통합을 논의한 뒤 구현을 진행했다.

- 추가: patch_library_item MCP와 부분 수정 schema·함수, 구성요소별 분석 상태 출력, `scripts/test-library-patch.ts` 및 `pnpm test:library-patch`.
- 변경: 기존 재등록의 벡터 무효화, 코드 profile 안내의 bakje-collect 연결.
- 스킬: bakje-collect 공통 진입점과 코드·UX 참조 작성, bakje-code·ux-collect 호환 안내, 박제 기반 ux-solve. 사용자 설치 경로의 bakje-collect 연결과 기존 UX SKILL.md도 반영했으며 기존 스크립트·자료는 유지했다.
- 문서: 통합 계획의 구현 결과와 미실행 범위, 통합 라이브러리의 부분 수정 계약 및 인덱스 설명 갱신.
- 검증: 부분 수정과 실제 MCP transport 요청, 선택적 모의 임베딩, 기존 library/library-management/embed-flag 회귀 검사, 타입 검사, UI lint, 프로덕션 빌드 통과. 수정 도중 충돌·오래된 분석 결과 차단·첨부 보존을 확인했다. 실제 모델과 운영 배포는 검증하지 않았다.
- 기존 UX 자료 이전·삭제, 운영 서버 배포, 웹 내용 편집 UI는 수행하지 않았다.
