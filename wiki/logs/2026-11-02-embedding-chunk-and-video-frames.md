---
type: Log
title: "임베딩 점검: 제목 접두, 영상 포스터·키프레임, 연결 폴더 검색 쏠림"
description: "청킹 점검, 영상 포스터 누락 복구, 영상 키프레임 임베딩, OpenNana 남자 검색 쏠림 원인 기록"
timestamp: 2026-11-02
okf_version: "0.1"
---

# 임베딩 점검

임베딩 원리를 점검하고 세 가지와 네 번째는 원인을 확인하고 수정해 배포했다.

1. **2번째 이후 청크에 제목 접두** ([#18](https://github.com/Leonamin/bakje/pull/18)). 박제 글 75건 중 21건이 다중 청크다. 영향받는 글의 `embed_state`를 지워 재임베딩했다. 배포 전 DB 백업: `~/bakje-backup/db/chunk-title-predeploy-20261102T034719Z.db.gz`.
2. **웹 컨테이너 ffmpeg 설치** ([#19](https://github.com/Leonamin/bakje/pull/19)). 컨테이너에 `ffmpeg`가 없어 영상 31건의 포스터가 없었고 이미지 벡터가 빈 값(14건)이거나 실패(17건)였다. 설치 후 포스터 31건을 만들고 임베딩 작업을 초기화해 복구했다.
3. **영상 키프레임 임베딩** ([#20](https://github.com/Leonamin/bakje/pull/20)). `max(3초, 길이÷8)` 간격, 영상당 최대 8장, 프레임 이미지는 저장하지 않는다. 벡터 119개를 `media_frame_embedding`에 저장했다. 배포는 web만 교체했고 embedder, 사용자 `1000:1000`, 재시작 정책, 볼륨을 보존했다.
4. **연결 폴더 검색 쏠림** ([#21](https://github.com/Leonamin/bakje/pull/21)). 이미지와 프롬프트 텍스트를 한 점수로 줄 세워 텍스트가 이미지를 덮었다. 둘을 따로 순위화해 RRF로 합치도록 고쳤고, 릴리스 `20261102T054118Z`로 web만 교체해 배포했다(DB 쓰기 없음). 이미지 전용 필터는 추가하지 않고 보류했다.

측정 결과와 보류한 개선, 다시 검토할 조건은 [임베딩 파이프라인](../concepts/embedding-pipeline.md)에 있다.

- 추가: concepts/embedding-pipeline.md
- 갱신: concepts/index.md, concepts/media-pipeline.md, concepts/operations.md, index.md, logs/index.md
