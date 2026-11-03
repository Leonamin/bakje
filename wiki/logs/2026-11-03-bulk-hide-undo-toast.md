---
type: Log
title: "Bulk Hide Undo Toast"
description: "선택 모드 일괄 숨김의 확인창 제거와 되돌리기 토스트"
timestamp: 2026-11-03
okf_version: "0.1"
---

# Bulk Hide Undo Toast

숨김은 되돌릴 수 있는데 선택 모드의 일괄 숨김만 확인창을 띄워 동작을 방해했다. 확인창을 없애고 바로 숨긴 뒤 토스트에 "되돌리기"를 표시한다.

- 동작: "N개 자료를 숨겼습니다" 토스트의 되돌리기는 방금 숨긴 id 목록으로 서버에 숨김 해제를 요청한다. 토스트가 닫힌 뒤에는 숨긴 자료 필터에서 해제한다.
- 유지: 삭제(휴지통 이동)는 확인창을 유지한다. 스와이프·상세 숨김은 원래 토스트 방식이었다.
- 배포: PR #31, web 컨테이너만 재생성(`ARCHIVE_DEPLOY_WEB_ONLY=1`), 릴리스 `20261103T021831Z`. 사용자가 화면에서 확인했다.

- 추가: logs/2026-11-03-bulk-hide-undo-toast.md
- 갱신: concepts/ui-system.md, concepts/unified-library.md, logs/index.md
