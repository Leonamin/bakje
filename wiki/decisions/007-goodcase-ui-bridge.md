---
type: Decision
title: "007. Goodcase UI 이식과 토큰 브리지"
description: "직접 만든 버튼·시트를 참조 컴포넌트로 교체한 이유와 비용"
tags: [ui, components, accessibility]
timestamp: 2026-10-25
---

# 007. Goodcase UI 이식과 토큰 브리지

## Context

초기 UI는 Tailwind로 직접 만든 버튼·모달이었다. 모바일 시트가 필요해지면서 포커스 트랩, Escape 닫기, 바깥 클릭 처리, 스크롤 잠금을 직접 구현해야 했고, 접근성 계약을 매번 다시 검증하는 비용이 컸다.

Goodcase UI 배포본에는 이 계약이 이미 구현된 Button, Drawer, Tabs, Toast, ImageViewer가 있었다.

## Decision

필요한 컴포넌트만 `src/components/goodcase/`로 복사하고, `src/styles/bridge.css`에서 `--gc-*` 토큰을 앱 팔레트에 매핑한다. 레이아웃은 Tailwind를 그대로 쓰고, 상호작용 요소만 Goodcase를 쓴다.

가져온 것: Button, Badge, Card, TextField, Drawer, Toast, ImageViewer, Spinner, Skeleton.

## Consequences

- 포커스 트랩·Escape·중복 제출 차단·이미지 뷰어 제스처를 다시 만들지 않는다.
- CSS 약 2,500줄이 추가된다. 토큰 브리지가 없으면 라이트 테마 기본값이 새어 나오므로 매핑을 유지해야 한다.
- 라이브러리 기본값과 앱 토큰이 충돌하는 지점(포커스 링, 드로어 높이, 토스트 위치)은 `bridge.css`에서 명시적으로 덮는다.
- 아이콘 전용 버튼의 접근 가능한 이름은 여전히 호출부 책임이다. 실제로 `aria-label` 누락을 자동화가 잡아냈다.
- 레이어 함정: `globals.css`의 Tailwind 유틸리티는 `@layer utilities`에 있어, 레이어 밖 규칙(`bridge.css`, Goodcase CSS)이 항상 이긴다. `a { color: inherit }`가 `text-[var(--gc-on-accent)]`를 덮어 네온 배경에 밝은 글자가 나왔다. 요소 기본값은 `@layer base`에 두고, `.gc-button`·`.gc-icon-button`과 겹치는 속성(높이·패딩·색)을 유틸리티로 바꿔야 하면 `!` 접두사를 쓴다.
- 앱 코드는 `<button>`을 직접 만들지 않는다. 버튼은 `Button`/`IconButton`, 링크형 CTA는 `className="gc-button gc-button-primary"`, 예외는 `chip`·`press`·`media-tile` 클래스로만 허용하며 `pnpm lint:ui`가 검사한다.
- `Button`의 `.gc-button-content` 래퍼에는 가로 배치가 없어 `bridge.css`에서 `inline-flex`로 보강했다.

## Status

Accepted
