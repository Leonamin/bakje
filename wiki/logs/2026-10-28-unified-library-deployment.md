---
type: Log
title: "통합 라이브러리 운영 배포와 연결 폴더 준비"
description: "web만 교체하고 기존 SNS·임베딩 서버를 유지하면서 OpenNana 읽기 전용 마운트 추가"
timestamp: 2026-10-28
okf_version: "0.1"
---

# 통합 라이브러리 운영 배포

사용자 요청에 따라 릴리스 `20261028T064802Z`를 배포했다. 배포 전 온라인 DB 백업과 무결성 확인을 수행했다. 백업은 `/home/leonamin/bakje-backup/db/library-predeploy-20261028T064802Z.db.gz`에 보관하고 이전 웹 이미지는 `bakje-web:pre-library-20261028T064802Z` 태그로 보존했다.

`ARCHIVE_DEPLOY_WEB_ONLY=1`로 web만 교체했다. 기존 embedder 컨테이너 ID와 상태를 유지했다. 사용자 1000:1000, 기존 데이터·모델 볼륨, 네트워크, 포트, 재시작 정책과 읽기 전용 루트 파일 시스템을 확인하고 보존했다.

호스트 `/home/leonamin/dev/prompt/opennana/data`를 컨테이너 `/library/opennana`로 읽기 전용 마운트했다. 호스트별 설정은 `/etc/bakje/compose.override.yml`에 두고 배포 스크립트가 다음 릴리스에도 적용하도록 변경했다. 공유 호스트의 전역 이미지 정리는 명시적으로 선택할 때만 실행하도록 바꿨다.

검증 결과:

- web·embedder 정상 상태, `/api/health` 정상.
- DB 무결성 정상. 기존 source 46건, part 63건, media 89건, snapshot 58건, job 52건 유지.
- SNS의 공통 자료 매핑 46건. 폴더 등록 작업 0건으로 전체 등록·임베딩은 시작하지 않음.
- 컨테이너에서 프롬프트와 두 미디어 매니페스트 읽기 가능, 연결 루트 쓰기 불가.
- MCP 도구 18개와 검색 API 정상, 실제 모델 질의 256차원 응답 확인.
- tailnet `https://hamsbox.badger-viper.ts.net:8888/library`에서 폴더 등록 화면과 경로 입력 확인, 브라우저 실행 오류 없음. 등록 버튼은 누르지 않음.
- 화면 캡처: `/tmp/bakje-production-library/connect-folder.png`.

등록 절차는 `/library` → **폴더 연결** → 이름 `OpenNana`, 경로 `/library/opennana` → **폴더 연결** → **OpenNana 등록·새로고침** 순서다. 원본은 현재 구조로 유지한다.

- 코드 갱신: `scripts/deploy.sh`
- 운영 설정 추가: `/etc/bakje/compose.override.yml`
- 위키 갱신: `concepts/operations.md`, `concepts/unified-library.md`, `index.md`, `logs/index.md`
