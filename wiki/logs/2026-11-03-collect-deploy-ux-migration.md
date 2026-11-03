---
type: Log
title: "수집 통합 운영 배포와 UX 자료 이전"
description: "부분 수정 운영 검증, 기존 UX 사례·규칙 이전, leonamin-skills 반영"
timestamp: 2026-11-03
okf_version: "0.1"
---

# 수집 통합 운영 배포와 UX 자료 이전

사용자가 운영 배포, 기존 UX 자료 이전, 이후 leonamin-skills 갱신을 요청해 수행했다.

- 배포: `20261103T044207Z`. 웹만 교체하고 embedder·기존 마운트·UID/GID·재시작 정책·네트워크 유지. DB 백업 `/home/leonamin/bakje-backup/db/collect-predeploy-20261103T044155Z.db`와 이전 이미지 태그 `bakje-web:pre-collect-20261103T044207Z` 보관.
- 이전: 원본 UX 저장소에서 사례 4·규칙 4·근거 7·출처 1을 확인했다. `._*` AppleDouble 파일로 기존 검증이 실패해 해당 보조 파일을 제외한 복제본을 검증했다. 원본 파일 31개 내용과 출처·초안 상태·검증 한계·해결 이력을 보존했다.
- 저장소: `~/Library/ux-notes` → `/library/ux-notes` 읽기 전용, storage_id=6. import job=7, 박제본 ID=19917~19924. 새로 생성한 파일과 원자료는 Git에 넣지 않았다.
- 검증: 등록 8/8, 실패 0. 실제 분석 20 done·벡터 22, 첨부 참조 22개 해시·한국어 검색·부분 수정의 구성요소 보존, HTTP 200·healthy·DB quick_check=ok. 기존 19,916건과 SNS 78건 보존.
- 스킬: leonamin-skills에 4개 스킬과 README 추가. ux-solve의 독립 설치용 references/bakje.md를 두고 로컬 설치본도 갱신했다. quick_validate, skills add . --list, 임시 프로젝트의 4개 스킬 Codex 설치·참조 링크 검사 통과. Git 커밋·push는 하지 않았다.
- 추가: scripts/migrate-ux-library.py. 원본 JSON·참조·파일 해시를 확인하고 사본·매니페스트를 생성하며 원본을 수정하지 않는다.
- 갱신: concepts/bakje-collect-plan.md, concepts/operations.md, index.md, logs/index.md.

이전은 과거 사례의 현재 UI·배포·사용자 효과에 대한 새 검증을 의미하지 않는다. 기존 CLI·UX 저장소는 삭제하지 않았다.


## 스킬 소유 저장소 정리

사용자의 후속 요청에 따라 bakje-code·ux-collect 호환 진입점을 제거했다. bakje-collect는 박제 저장소에만 남기고 leonamin-skills에서 삭제했다. ux-solve는 leonamin-skills에만 남기고 박제 저장소의 중복본을 제거했다. 사용자 설치 경로도 각 정본을 참조하도록 정리했다.

기존 UX CLI·참조 자원은 ~/.local/share/bakje/legacy-ux-tools에 보존하고 폐기한 SKILL.md는 남기지 않았다. 실제 UX 자료와 운영 서버는 변경하지 않았다. 두 README·통합 계획을 갱신하고 목록 탐색·박제 저장소의 임시 프로젝트 설치·참조·설치 경로를 검증했다.
