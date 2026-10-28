---
type: Log
title: "연결 자료 상세에서 검색 목록 복귀 수정"
description: "고정 라이브러리 링크를 공용 BackLink로 통합해 검색어·필터·페이지 보존"
timestamp: 2026-10-28
okf_version: "0.1"
---

# 연결 자료 상세의 검색 조건 보존

사용자가 목록에서 검색한 뒤 상세를 열고 돌아오면 검색어가 사라진다고 보고했다. 운영에서 검색어·출처·저장소·목록 보기·2페이지 조건으로 연결 자료를 열고 상세의 “라이브러리”를 누르면 `/`로 이동하는 문제를 재현했다.

연결 자료 상세를 SNS 상세와 같은 공용 BackLink로 통합했다. 기존 목록 URL과 브라우저 기록으로 복귀하며 검색 상태를 별도로 복제하지 않는다. 공용 BackLink는 지원 브라우저에서 Navigation API의 같은 출처 이전 기록을 확인한다. 직접 진입한 빈/외부 이전 페이지로 이동하는 경우를 줄이고, 수정 키 클릭은 기본 링크 동작으로 유지한다. API 미지원 브라우저는 기존 방문 기록 길이 판단을 유지한다.

타입 검사·UI 검사·프로덕션 빌드를 통과했다. 로컬 브라우저에서 다음을 검증했다.

- `/?q=logo&origin=opennana&storage=2&view=list&page=2`의 URL 전체와 입력값 복원.
- 상세 새로고침 후 화면 내 뒤로가기.
- 브라우저 뒤로가기와 전용 검색 화면 `/search?q=logo` 복귀.
- 새 방문 기록에서 상세 직접 진입 후 기본 목록 이동.

- 코드: `src/app/items/[id]/page.tsx`, `src/components/back-link.tsx`
- 위키: `concepts/ui-system.md`, `logs/index.md`
- 로컬 캡처: `/tmp/bakje-backlink/restored-list.png`


운영 릴리스 `20261028T074249Z`로 web만 교체했다. 실제 tailnet 서비스에서 연결 자료의 검색어·출처·저장소·보기 방식·페이지 복원과 기존 SNS 상세의 검색어 복귀를 확인했다. web·embedder 정상 상태, 기존 SNS 46건·연결 자료 18,142건 보존을 확인했고 임베딩 서버는 재시작하지 않았다. 운영 캡처는 `/tmp/bakje-backlink/production-restored.png`다.
