---
type: Log
title: "Article Media And Storage"
description: "X Article 안의 영상·이미지 박제, twimg 403 수정, 세로 영상 잘림 수정, 저장 공간 표시"
timestamp: 2026-10-26
okf_version: "0.1"
---

# Article Media And Storage

X Article 글(`chungmuromafia`)의 영상이 박제되지 않던 문제를 조사해 고치고, 설정에 저장 공간 표시를 더했다.

- 질문: X는 영상 다운로드가 되는가. 코드상 일반 트윗(`video_info.variants`)·Threads(`video_versions`)·Reddit(HLS)은 지원한다. 로컬 DB에는 Reddit 영상만 있어 X·Threads 실저장은 확인하지 못했다.
- 원인 1: 그 글은 영상 트윗이 아니라 Article이었다. 트윗의 `media_entities2`는 비어 있고, 본문 속 영상 7개·이미지 6개는 같은 HTML의 `ArticleByTweetId` 응답에만 있었다. `extractArticle`은 텍스트만 읽었다.
- 원인 2: `video.twimg.com`이 구글 referer에 403을 줘서 영상 7개가 `failed`였다(`x.com` referer면 200). 임시 DB로 박제해 확인했다. 수정 후 이미지 6, 영상 7(약 10MB) 모두 `ok`.
- 부수: Article 변형은 `bit_rate`(밑줄) 키, 최고 화질 10Mbps는 30MB를 넘기 쉬워 2.5Mbps 이하 중 최고를 고르게 했다.
- 저장 공간: 설정에 폴더별 용량과 디스크 여유를 추가. `thumbs`가 없으면 계산이 죽는 문제를 같이 고쳤다.
- 세로 영상 잘림: 저장된 파일은 720x1280(9:16)으로 정상이었다. `.media-tile video`의 `object-fit: cover`가 상세 화면에서 위아래를 잘랐고, 영상만 `contain`으로 바꿨다.
- 이미 박제된 글은 자동으로 채워지지 않는다. 상세 화면의 "원문 재확인"으로 미디어를 다시 받는다.
- 배포 직후 화면이 잠깐 멈췄다는 보고가 있었으나 서버는 정상(응답 10ms 이내)이었고 곧 풀렸다. 원인은 **미확정**이다(재시작 중 일시 지연으로 추정).
- 커밋: `6b1c416`, `f4440bf`, `fefbb95`. 릴리스 `20261026T152518Z`.
- 미검증: 일반 X 영상 트윗의 403 재현, 모바일에서 영상 11개 글의 로딩 부담, 저장 공간 계산의 대용량 응답 시간.

- 추가: logs/2026-10-26-article-media-and-storage.md
- 갱신: concepts/media-pipeline.md, concepts/platform-adapters.md, concepts/ui-system.md, index.md, logs/index.md
