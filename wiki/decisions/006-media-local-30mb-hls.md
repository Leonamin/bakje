---
type: Decision
title: "006. 미디어 로컬 복제와 30MB 상한"
description: "핫링크를 버리고 용량 상한과 HLS 처리 규칙을 정한 이유"
tags: [media, storage, video]
timestamp: 2026-10-25
---

# 006. 미디어 로컬 복제와 30MB 상한

## Context

이 제품의 존재 이유가 "원문이 사라져도 남는 것"인데, 미디어를 핫링크하면 원문 삭제 시 이미지도 같이 죽는다. 반대로 모든 영상을 무제한으로 받으면 디스크가 통제 불능이 된다.

Reddit 영상은 `v.redd.it`의 HLS 매니페스트로 오고, 이 환경의 정적 ffmpeg는 네트워크 입력에서 세그폴트가 난다.

## Decision

- 모든 미디어를 로컬에 복제하고 sha256으로 중복 제거한다.
- **30MB를 넘으면 저장하지 않고** `too_large`로 기록한다(원격 URL은 보존).
- HLS는 Node로 내려받고 ffmpeg은 로컬 mux·포스터 생성에만 쓴다.
- 영상·gif는 0.5초 지점 포스터를 만든다.

## Consequences

- 원문 삭제 후에도 미디어를 볼 수 있다.
- 저장 공간이 글당 수 MB~수십 MB 늘어난다.
- 30MB는 길이가 아니라 파일 크기 기준이라, 고화질 짧은 영상은 저장되고 긴 저화질 영상은 제외될 수 있다.
- Reddit 오디오 트랙 mux가 실패하면 무음 영상이 남는다.
- `npm run gc`가 참조 없는 파일을 지우고 사라진 포스터를 복구한다.

## Status

Accepted
