---
type: Log
title: "라이브러리 선택 UI를 공용 Select로 통합"
description: "네이티브 드롭다운 7곳 교체, 전체 선택 값 호환, 어두운 메뉴 테마와 재발 방지 검사"
timestamp: 2026-10-28
okf_version: "0.1"
---

# 라이브러리 선택 UI 통합

사용자 지적에 따라 라이브러리에 직접 작성한 네이티브 select를 기존 Goodcase 공용 Select로 교체했다. 대상은 라이브러리 필터 6곳과 자동 새로고침 1곳이다. 명령 메뉴인 Menu 대신 선택 값을 관리하는 Radix Select를 사용한다.

공용 Select에 내부 값 인코딩을 추가해 외부의 빈 문자열 전체 선택을 지원한다. 전체 항목이 없는 경우의 placeholder와 기존 선택 값 계약은 유지했다. 어두운 화면에서 밝은 기본 색상이 나타나지 않도록 trigger와 포털 메뉴에 앱 팔레트를 연결했다. UI 검사에 앱 코드의 네이티브 select 금지 규칙을 추가했다.

타입 검사·UI 검사·프로덕션 빌드 통과. 실제 로컬 브라우저에서 키보드 선택·전체 초기화·Space/Enter·Escape·포커스 복귀와 390px 모바일 배치를 확인했다. 자동 새로고침은 모의 요청으로 60분 숫자 전달과 요청 중 disabled를 검증했다. 실제 운영 스캔 주기를 변경하지 않았다.

- 갱신: `src/components/library-toolbar.tsx`, `src/components/library-manager.tsx`, `src/components/goodcase/overlays/select.tsx`, `src/styles/bridge.css`, `scripts/lint-ui.ts`
- 위키 갱신: `concepts/ui-system.md`, `logs/index.md`
- 화면: `/tmp/bakje-select/desktop-open.png`, `/tmp/bakje-select/mobile-open.png`


운영에 릴리스 `20261028T072553Z`로 반영했다. web만 교체하고 embedder 컨테이너, 기존 데이터 볼륨과 OpenNana 읽기 전용 마운트를 유지했다. 배포 전 온라인 DB 백업과 무결성 검사를 수행했다. 운영 `/library`에서 공용 메뉴의 항목 3개와 어두운 배경, 브라우저 오류 없음을 확인했으며 자동 새로고침 값은 변경하지 않았다. 운영 화면 캡처는 `/tmp/bakje-select/production-open.png`다.

배포 후 기존 SNS 46건, 연결 자료 18,142건과 성공한 등록 작업을 확인했다. 분석 작업은 유지되고 계속 처리된다. 키보드 Tab 순서와 트리거 높이 44px, pointer 커서도 로컬 브라우저에서 확인했다.
