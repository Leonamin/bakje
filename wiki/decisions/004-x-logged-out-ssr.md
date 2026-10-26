---
type: Decision
title: "004. X를 로그인 없이 SSR 페이로드로 수집"
description: "API 비용과 로그인 자동화를 피한 대신 구조 변경에 취약해진 선택"
tags: [x, parsing, no-auth]
timestamp: 2026-10-25
---

# 004. X를 로그인 없이 SSR 페이로드로 수집

## Context

X는 비로그인 접근을 계속 조여 왔다. 공식 API v2는 개인용으로 쓰기엔 비싸고(Basic $200/월), 브라우저 로그인 자동화는 계정 제재 위험이 있다.

실제로 확인해보니 `x.com/i/status/<id>`를 일반 브라우저 UA로 요청하면 응답 HTML의 스트리밍 스크립트에 **TweetDetail GraphQL 응답이 JSON 문자열로 포함**되어 있었다. 본문, 작성자, 타래, 부모, 인용, 지표, 미디어 variants가 모두 들어 있었다.

## Decision

SSR HTML에서 `GraphQLRequestStream.Completed`의 `value` 문자열을 꺼내 파싱한다. 브라우저도, 로그인도, API 키도 쓰지 않는다.

페이로드가 없으면 `cdn.syndication.twimg.com/tweet-result`로 단일 글만 저장하고 `partial`로 표시한다.

## Consequences

- 수집이 빠르고(2초 내외) 자격 증명이 필요 없다. 계정 제재 위험도 없다.
- X가 SSR 구조나 스크립트 포맷을 바꾸면 즉시 깨진다. 어댑터 한 파일만 고치면 되도록 격리했다.
- 폴백(syndication)은 단일 글만 주므로 타래·맥락이 빠진다. 상태를 `partial`로 남겨 사용자가 알 수 있게 한다.
- 연령 제한 게시글은 이 경로로 가져올 수 없다. 그 경우만 전용 계정 쿠키로 보완했다. → [결정 017](./017-x-age-restricted-cookie.md)

## Status

Accepted
