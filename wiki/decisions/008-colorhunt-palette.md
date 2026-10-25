---
type: Decision
title: "008. ColorHunt Popular #23 팔레트"
description: "테크노 톤과 장문 가독성 사이의 선택"
tags: [design, color, palette]
timestamp: 2026-10-25
---

# 008. ColorHunt Popular #23 팔레트

## Context

"테크노 디자인"에 어울리면서 긴 글을 읽기에도 무리가 없는 색이 필요했다. ColorHunt Popular 목록에서 후보를 추렸다.

- #23 `#E0F8C7 · #B7D894 · #36415A · #202734` — 슬레이트 + 형광 초록
- #25 `#E3EF4F · #5882E8 · #0F42C0 · #1F06AC` — 일렉트릭 블루 + 애시드 옐로
- #11 `#2A1A0E · #D4621A · #F4AE52 · #FEF3E2` — 번트 오렌지 + 크림

## Decision

**#23**을 기본으로 채택했다. 배경은 `#202734`를 한 단계 더 눌러 `#141922`로 쓰고, 강조는 `#B7D894` 하나만 쓴다.

#25는 테크노 인상이 더 강하지만 채도 높은 남색 배경이 장문 읽기에서 피로를 만든다. #11은 터미널 앰버 느낌이 좋으나 이미지 색과 충돌하기 쉽다.

## Consequences

- 형광 초록은 화면당 한두 곳(활성 탭, 주요 액션, 강조 텍스트)에만 쓴다. 남용하면 테크노가 아니라 형광등이 된다.
- 플랫폼 표기는 채도를 낮춘 별도 색(X `#9FB3C8`, Threads `#C6ADA4`, Reddit `#D99A86`)으로 분리해 강조색과 경쟁하지 않게 한다.
- 라이트 테마는 지원하지 않는다. `color-scheme: dark` 고정.

## Status

Accepted
