---
type: Log
title: "카드 호버 썸네일 미리보기"
description: "목록·검색·연관 자료 카드에 0.5초 호버 시 원본 비율 썸네일 표시"
timestamp: 2026-10-28
okf_version: "0.1"
---

# 카드 호버 썸네일 미리보기

## 변경

- 카드에 마우스를 0.5초 올리면 썸네일을 원본 비율로 띄운다. 최대 360×360px이며 자르지 않는다. 화면 가장자리에서는 위치가 자동으로 바뀐다.
- 이름은 팝오버(클릭으로 여는 패널)가 아니라 호버 카드다. Radix `HoverCard`를 공용 `overlays/hover-card.tsx`로 감쌌고, 카드용 `thumb-preview.tsx`가 썸네일을 채운다.
- 터치 기기는 호버가 없어 영향이 없다. 이미지는 목록의 640px 썸네일을 재사용하므로 원본을 새로 받지 않는다.
- 적용 위치: SNS 카드(그리드·목록·피드), 연결 자료 카드, 연관 자료 카드.
- 같은 날 릴리스 번호를 위키 `index.md`에 맞췄다.

- 코드: `src/components/goodcase/overlays/hover-card.tsx`, `src/components/thumb-preview.tsx`, `src/components/library-card.tsx`, `src/components/source-card.tsx`, `src/components/related-items.tsx`
