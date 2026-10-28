---
type: Reference
title: "디자인 레퍼런스"
description: "정보 정리 UI 사례와 색상 팔레트 출처"
tags: [design, reference, pinterest, colorhunt, immich]
timestamp: 2026-10-28
---

# 디자인 레퍼런스

## 정보 정리 UI

| 사례 | 출처 | 가져온 패턴 |
|---|---|---|
| Pinterest iOS 저장 화면 | Mobbin `explore/screens/181bb372-…`, Spectr 디자인 블루프린트 | 2열 미디어 그리드, 칩 필터, 하단 내비게이션, 모바일에서 시트 |
| Reeder 5 읽기 목록 | Mobbin `explore/screens/cad24956-…` | 리스트 + 필터 + 하단 탭, 행 밀도 |
| Raindrop.io 39개 플로우 | Screenrove `screenrove.com/raindrop/flows` | 56px 썸네일 + 15px 제목 + `도메인 · 시간` 보조행, List/Cards 전환, 태그를 행 아래에 |
| Readwise Reader | Readwise 문서·Lazer Technologies 케이스 스터디 | 태그·메모를 하단 시트에서, 필터의 초안/적용 분리 |
| Immich 썸네일 선택 | GitHub `immich-app/immich`의 `web/src/lib/components/assets/thumbnail/Thumbnail.svelte` (2026-10-28 확인) | 선택 모드에서 썸네일 왼쪽 위에 `role="checkbox"` 체크 원, 선택되면 타일이 줄고 모서리가 둥글어지며 아이콘이 강조색으로 채워짐, 타일 어디를 눌러도 토글 |

## 적용 판단

- **그리드 기본 + 리스트 토글**: 아카이브는 미디어 비중이 높아 그리드가 탐색에 유리하지만, 텍스트 위주 글은 리스트가 읽기 좋다. 둘 다 제공하고 URL 파라미터로 유지한다.
- **하단 시트**: 필터가 많은 화면을 모바일에서 다루는 가장 안정적인 패턴. 적용 버튼을 누르기 전까지 결과를 바꾸지 않는다.
- **행 보조 정보**: Raindrop의 `도메인 · 시간` 한 줄이 밀도를 크게 올려서 `플랫폼 @핸들 · 날짜`로 채용.
- **선택 모드**: 원 버튼만 눌러야 하면 불편하고 "선택 버튼처럼 안 보인다"는 피드백이 있어서, 사진 앱이 이미 검증한 방식(Immich·Google Photos)을 따랐다. 박제에서는 타일 축소 대신 링과 약한 축소(`scale 0.96`)로 줄였다. 카드가 링크라서 타일 전체 클릭은 캡처 단계에서 가로채 토글한다.
- **빈 상태**: 미디어 없는 글에 빈 썸네일을 두지 않는다. 초기에는 타이포 타일을 썼고, 2026-10-25 개편 후에는 썸네일 자리까지 본문을 7줄 보여준다.

## 색상

- ColorHunt Popular `colorhunt.co/palettes/popular`
- 채택: **#23** `#E0F8C7 #B7D894 #36415A #202734`
- 탈락: #25(일렉트릭 블루, 장문 피로), #11(번트 오렌지, 이미지 색 충돌)

## 타이포

- 2026-10-25 개편 후: Pretendard Variable, 11 · 12 · 14 · 16 · 20 · 24px 스케일. 게시글 본문 16px / 1.7, UI 14px, 라벨 12px. 자세한 표는 [UI 시스템](../concepts/ui-system.md).
- 개편 전(폐기): 본문 15px / 1.78, 모노 라벨 10.5px 대문자 — 글자가 작고 장식이 많다는 피드백으로 걷어냈다. → [결정 010](../decisions/010-capture-first-ui.md)
- 숫자는 tabular-nums
