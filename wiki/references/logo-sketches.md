---
type: Reference
title: "로고 시안 모음"
description: "박제 로고 탐색 과정에서 만든 시안과 SVG 원본, 채택·폐기 이유"
tags: [logo, branding, design]
timestamp: 2026-10-26
---

# 로고 시안 모음

로고는 F(화석 나선)로 확정했다. → [결정 015](../decisions/015-logo-fossil-spiral.md)
아래는 탐색 중 만든 시안이다. SVG는 모두 `viewBox="0 0 512 512"`이고 배경은 `#141922`다. 겹침 여부(Threads `@` 로고 등)는 이미지 검색이나 상표 DB로 확인하지 않았다(미검증).

## 0. 스큐어모피즘 시안 (호박 + 나비 + 페이지)

앰버 수지 블록 안에 페이지 날개 나비를 핀으로 고정. 그라데이션·하이라이트가 있어 스큐어모피즘에 가깝다. 미니멀 취향과 맞지 않아 폐기.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="amber" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFD27A"/>
      <stop offset="1" stop-color="#E08A1E"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="#141922"/>
  <!-- amber block -->
  <rect x="76" y="76" width="360" height="360" rx="72" fill="url(#amber)"/>
  <path d="M110 150q0-44 44-44h70" fill="none" stroke="#FFF1CF" stroke-width="14" stroke-linecap="round" opacity=".7"/>
  <!-- butterfly wings as pages -->
  <path d="M256 256 L150 168 Q132 160 128 182 L132 292 Q134 316 156 308 Z" fill="#FFF8E7"/>
  <path d="M256 256 L362 168 Q380 160 384 182 L380 292 Q378 316 356 308 Z" fill="#FFF8E7"/>
  <path d="M256 276 L172 322 Q150 336 168 356 Q186 372 214 346 Z" fill="#F3E3BC"/>
  <path d="M256 276 L340 322 Q362 336 344 356 Q326 372 298 346 Z" fill="#F3E3BC"/>
  <!-- text lines on wings -->
  <path d="M150 208l64 28M150 238l64 14M150 268l40 10" stroke="#B9791A" stroke-width="12" stroke-linecap="round"/>
  <path d="M362 208l-64 28M362 238l-64 14M362 268l-40 10" stroke="#B9791A" stroke-width="12" stroke-linecap="round"/>
  <!-- pin -->
  <rect x="248" y="170" width="16" height="200" rx="8" fill="#141922"/>
  <circle cx="256" cy="162" r="26" fill="#141922"/>
  <circle cx="248" cy="154" r="8" fill="#5A6785"/>
</svg>
```

## A. 핀 + 날개

기하학적 나비를 핀 하나로 고정. 앰버 단색. 의미가 분명하고 16px에서도 읽힌다. **보류(킵)**: 다른 로고가 필요할 때 후보.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#141922"/>
<g fill="#F5A524"><g id="w"><path d="M246 238L120 156V292Z"/><path d="M246 262L156 352V296Z"/></g><use href="#w" transform="translate(512 0) scale(-1 1)"/></g>
<rect x="251" y="150" width="10" height="214" rx="5" fill="#F4EBD9"/><circle cx="256" cy="150" r="20" fill="#F4EBD9"/></svg>
```

## B. 핀 꽂힌 페이지

앰버 카드에 줄 3개와 핀. 가장 단순하지만 일반 문서 아이콘처럼 보인다.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#141922"/>
<rect x="136" y="116" width="240" height="290" rx="28" fill="#F5A524"/>
<path d="M184 262h144M184 316h144M184 370h84" stroke="#141922" stroke-width="18" stroke-linecap="round"/>
<circle cx="256" cy="176" r="24" fill="#F4EBD9"/></svg>
```

## C. 앰버 블록 + 음각 나비

앰버 타일에 나비를 음각. 작은 크기에서 얼굴처럼 뭉친다.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#141922"/>
<rect x="96" y="96" width="320" height="320" rx="64" fill="#F5A524"/>
<g fill="#141922" transform="translate(256 256) scale(.78) translate(-256 -256)"><g id="w"><path d="M246 238L120 156V292Z"/><path d="M246 262L156 352V296Z"/></g><use href="#w" transform="translate(512 0) scale(-1 1)"/></g>
<rect x="252" y="170" width="8" height="170" rx="4" fill="#F4EBD9"/><circle cx="256" cy="170" r="16" fill="#F4EBD9"/></svg>
```

## D. 캡처 프레임 + 핀 점

스크린샷 모서리 괄호와 가운데 점. 박제=캡처 의미는 직접적이나 카메라 포커스 아이콘과 헷갈린다.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#141922"/><g fill="none" stroke="#B7D894" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"><path d="M130 200V130H200M312 130H382V200M382 312V382H312M200 382H130V312"/></g><circle cx="256" cy="256" r="44" fill="#B7D894"/></svg>
```

## E. 유리 돔 표본 카드

돔 아래 핀 꽂힌 카드. 표본 느낌이 나지만 작은 크기에서 안쪽이 뭉친다.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#141922"/><g fill="none" stroke="#F4EBD9" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"><path d="M140 360V270a116 116 0 0 1 232 0V360M108 360H404"/></g><rect x="206" y="270" width="100" height="90" rx="10" fill="#F4EBD9"/><circle cx="256" cy="296" r="14" fill="#F2684A"/></svg>
```

## F. 화석 나선 (확정)

호박·나비 없이 암모나이트 나선 하나. 크림 단색 + 네이비. 가장 미니멀하고 작은 크기에서도 선명하다. **채택**.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#141922"/><path transform="translate(-30 -30)" d="M256 256a20 20 0 0 1 20-20a40 40 0 0 1 40 40a60 60 0 0 1-60 60a80 80 0 0 1-80-80a100 100 0 0 1 100-100a120 120 0 0 1 120 120a140 140 0 0 1-140 140" fill="none" stroke="#F4EBD9" stroke-width="24" stroke-linecap="round"/></svg>
```

## F2. 시작점이 핀 머리

나선 중심에 연두 점.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#141922"/><path transform="translate(-30 -30)" d="M256 256a20 20 0 0 1 20-20a40 40 0 0 1 40 40a60 60 0 0 1-60 60a80 80 0 0 1-80-80a100 100 0 0 1 100-100a120 120 0 0 1 120 120a140 140 0 0 1-140 140" fill="none" stroke="#F4EBD9" stroke-width="24" stroke-linecap="round"/><circle cx="226" cy="226" r="26" fill="#B7D894"/></svg>
```

## F3. 각진 나선

사각 나선. 16px에서 미로·QR처럼 뭉친다.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#141922"/><path d="M240 256H272V224H208V288H304V192H176V320H336V160H144V352H368" fill="none" stroke="#F4EBD9" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/></svg>
```

## F4. 캡처 프레임 + 나선

D와 F의 결합. 요소가 늘어 나선이 작아진다.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#141922"/><g fill="none" stroke="#B7D894" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"><path d="M112 190V112H190M322 112H400V190M400 322V400H322M190 400H112V322"/></g><path transform="translate(256 256) scale(.55) translate(-286 -286)" d="M256 256a20 20 0 0 1 20-20a40 40 0 0 1 40 40a60 60 0 0 1-60 60a80 80 0 0 1-80-80a100 100 0 0 1 100-100a120 120 0 0 1 120 120a140 140 0 0 1-140 140" fill="none" stroke="#F4EBD9" stroke-width="40" stroke-linecap="round"/></svg>
```

## F5. 나선을 관통하는 핀

대각선 핀이 나선을 꿰뚫는다. 박제 의미가 가장 선명하나 작은 크기에서 핀이 가늘다.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#141922"/><path transform="translate(-30 -30)" d="M256 256a20 20 0 0 1 20-20a40 40 0 0 1 40 40a60 60 0 0 1-60 60a80 80 0 0 1-80-80a100 100 0 0 1 100-100a120 120 0 0 1 120 120a140 140 0 0 1-140 140" fill="none" stroke="#F4EBD9" stroke-width="24" stroke-linecap="round"/><path d="M360 92L180 272" stroke="#B7D894" stroke-width="14" stroke-linecap="round"/><circle cx="360" cy="92" r="26" fill="#B7D894"/></svg>
```

## G. 한글 ㅂ + 핀

ㅂ 안에 핀 점. 한국어 정체성은 강하나 컵·H처럼 보인다.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#141922"/><g fill="none" stroke="#B7D894" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"><path d="M160 130V382M352 130V382M160 270H352M160 382H352"/></g><circle cx="256" cy="200" r="26" fill="#F2684A"/></svg>
```
