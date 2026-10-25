---
type: Concept
title: "UI 시스템"
description: "모바일 우선 정보 구조, Goodcase 컴포넌트 이식, 색상 토큰"
tags: [ui, mobile, design-system, goodcase]
timestamp: 2026-10-25
---

# UI 시스템

## 방향

개인용 읽기 도구다. 탐색을 유도하는 피드가 아니라 **보관한 것을 다시 찾고 읽는 화면**이 우선이다. 그림자·그라데이션 대신 1px 괘선, 모노 라벨, 평평한 판을 쓴다.

## 정보 구조

- 하단 탭 3개: 라이브러리 / 검색 / 수집 (모바일 56px + 안전 영역)
- 데스크톱은 상단 내비게이션으로 전환
- 라이브러리: 2열 미디어 그리드 기본, 리스트 보기 토글
- 필터와 정리는 **하단 시트**. 초안과 적용을 분리하고 `적용`에서만 URL을 바꾼다.
- 상세: 읽기 폭 우선, 데스크톱에서만 우측 248px 보조 열

## 화면

| 경로 | 역할 |
|---|---|
| `/` | 라이브러리(검색·필터·보기 전환 포함) |
| `/search` | 전용 검색 화면, 태그 제안 |
| `/add` | 링크 수집, 작업 기록, 클립보드 붙여넣기 |
| `/sources/[id]` | 읽기, 미디어 뷰어, 태그·메모 시트, 원문 재확인 |

## Goodcase 이식

`src/components/goodcase/`에 Button, Badge, Card, TextField, Drawer, Toast, ImageViewer, Spinner, Skeleton 등을 두고, `src/styles/bridge.css`에서 `--gc-*` 토큰을 앱 팔레트에 연결했다.

동작 계약은 유지한다: 포커스 트랩, Escape 닫기, 중복 실행 차단, 실패 시 입력 유지, 이미지 뷰어의 확대·스와이프.

이식 중 아이콘 전용 버튼에 접근 가능한 이름이 없어 자동화가 버튼을 찾지 못하는 문제가 실제로 발생해 `aria-label`을 추가했다.

## 색상

ColorHunt Popular **#23** — `#E0F8C7 · #B7D894 · #36415A · #202734`. 슬레이트 베이스에 형광 초록 하나만 강조로 쓴다. 강조색은 화면당 한두 곳만 쓰고, 플랫폼 표기는 채도를 낮춘 별도 색으로 분리해 경쟁하지 않게 한다.

→ [결정 007](../decisions/007-goodcase-ui-bridge.md), [결정 008](../decisions/008-colorhunt-palette.md), [디자인 레퍼런스](../references/design-references.md)

## 검증

- 390×844 터치 뷰포트와 1280에서 라이브러리·검색·수집·상세·필터 시트·정리 시트·이미지 뷰어 확인
- 시트 Escape 닫힘, 검색 제출 후 결과 반영, 뷰어 열기/닫기 확인
- 데스크톱·모바일 모두 콘솔 오류와 4xx/5xx 없음
