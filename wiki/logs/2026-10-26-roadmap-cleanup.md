---
type: Log
title: "Roadmap Cleanup"
description: "다음 단계 목록을 사용자 확인 결과로 정리하고 의미 검색 검토를 기록"
timestamp: 2026-10-26
okf_version: "0.1"
---

# Roadmap Cleanup

사용자가 알려 준 진행 상황으로 `index.md`의 다음 단계를 정리했다.

- 완료: 번역 실사용, 실기기 검증, 단축어 iCloud 링크 생성.
- 보류: "다시 번역" 버튼, 북마크 폴링 수집.
- 유지: Threads 다단 타래·Reddit 차단 검증.
- 검토 시작: 의미 검색. CPU 전용 PC에서 `google/embeddinggemma-2`(모델 페이지 확인: 텍스트 백본 270M, 768차원, 8192토큰, Apache 2.0)로 가능해 보인다. 한국어 명시 지원은 페이지에 없어 미검증, ONNX 지원도 미확인이다.
- 실험(2026-10-26): `sentence-transformers` 6.2.0, `google/embeddinggemma-2`, CPU fp32, 256차원. 운영 DB 20건에 한국어 질의 10개(교차 언어 포함)를 던져 top1 10/10, top3 10/10. 문서당 약 1.6초. 표본이 작고 정답을 직접 정해서 한계가 있다. 스크립트는 저장소 밖 scratchpad에만 두었다.
- 구현: `embedder/` 사이드카, `src/lib/embed.ts`(청킹·스윕·질의 임베딩), `searchHybrid`, 테이블 `embedding`·`embed_state`, `scripts/test-embed.ts`. 운영 DB 복사본으로 end-to-end 확인(20건·42청크 백필 12초, 키워드 0건 질의가 의미 검색으로 적중). 운영 배포는 하지 않았다.
- 이미지 임베딩: 사이드카 `/embed-image`, `media_embedding`, 오디오 인코더 제외로 램 약 2.9GB. 운영 이미지 29장 백필 포함 78초, 이미지로 찾는 한국어 질의 적중(수영복·할로윈·스타킹). 고양이 같은 없는 대상의 오탐 관찰.
- 사용 피드백 반영: 검색 카드 의미 검색 배지와 `?debug=1` 점수, 상세 화면 뒤로가기가 검색어를 유지하도록 `BackLink` 추가.
- 후속: `/help/shortcut` 페이지에 iCloud 링크 반영(코드 미반영).

- 추가: decisions/014-semantic-search-embedder-sidecar.md
- 갱신: concepts/ui-system.md, decisions/014-semantic-search-embedder-sidecar.md, decisions/index.md, concepts/korean-search.md, index.md, concepts/ios-shortcut.md, concepts/ui-system.md, logs/index.md
- 추가: logs/2026-10-26-roadmap-cleanup.md
