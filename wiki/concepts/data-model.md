---
type: Concept
title: "데이터 모델"
description: "SQLite 스키마, 파일 레이아웃, 스냅샷과 파서 버전"
tags: [sqlite, schema, storage]
timestamp: 2026-10-26
---

# 데이터 모델

## 저장 위치

```
data/  (운영: /var/lib/bakje)
  archive.db                  SQLite (WAL)
  media/<sha256>.<ext>        미디어 원본
  media/<sha256>.poster.jpg   영상·gif 포스터
  raw/<platform>/<id>-<ts>.html   파싱 직전 원본
  raw/<platform>/<id>-<ts>.json   Reddit DOM 추출 결과
  browser/state.json          Playwright 세션 쿠키
```

## 테이블

| 테이블 | 역할 |
|---|---|
| `source` | 게시글 1건. 플랫폼·원문 id 유니크, 상태, 지표, 언어, content_hash, parser_version, `hidden_at`(숨김 시각, `NULL`이면 보임. → [결정 016](../decisions/016-hide-posts.md)) |
| `part` | 본문/이어쓰기/맥락/인용 조각. `ordinal` 순서, `text_original`, `text_ko` |
| `media` | 조각에 붙은 미디어. `status`(ok·too_large·failed)와 원격 URL 보존 |
| `media_blob` | sha256 단위 중복 제거 인덱스 |
| `translation` | 게시글 단위 요약·번역 제목(`title_ko`)·모델·프롬프트 버전 |
| `setting` | 키-값 설정. LLM 제공자·Base URL·API 형식·모델·키 |
| `tag`, `source_tag` | 사용자 분류 |
| `snapshot` | 원본 스냅샷 이력(경로·시각·파서 버전) |
| `job` | 수집 작업 큐 상태(`pending`·`running`·`done`·`failed`·`duplicate`). 재시작 후 복구, 재시도 횟수(`attempts`)·다음 시도 시각(`next_attempt_at`). → [수집 작업 큐](./capture-queue.md) |
| `search_doc`, `search_fts` | 검색 원문과 trigram 인덱스 |

## 설계상 중요한 선택

1. **게시글과 파트를 분리**했다. 타래는 순서가 있는 여러 조각이고, 번역은 조각 단위로 붙는다.
2. **번역을 필드가 아니라 레코드로** 두었다. 모델과 프롬프트 버전을 남겨야 나중에 일괄 재번역이 가능하다.
3. **미디어 행은 다운로드 실패도 남긴다.** `too_large`·`failed`도 원격 URL과 함께 저장해 UI에서 원본으로 안내한다.
4. **`content_hash`는 파트 텍스트 기준**이다. 재수집 시 편집 여부를 판별할 수 있다.
5. **`parser_version`**은 스냅샷과 소스에 기록한다. 파서를 고치면 이 값으로 재파싱 범위를 정한다.

## 상태 값

- `ok`: 정상 수집
- `partial`: 일부만 수집(X syndication 폴백 등)
- `deleted`: 원문 404/410 확인
- `error`: 파싱·네트워크 실패. **삭제로 단정하지 않는다.**

`error`와 `deleted`를 분리한 이유는 파서가 깨졌을 때 아카이브 전체가 "삭제됨"으로 물드는 사고를 막기 위해서다.

## 재수집 시 동작

`source`는 upsert하고 `part`·`media` 행은 지우고 다시 만든다. 파일은 sha256으로 중복 제거되므로 같은 미디어를 다시 받아도 디스크가 늘지 않는다. 기존 번역은 원문 텍스트가 같으면 보존한다.

## 통합 라이브러리 확장 (2026-10-28)

기존 SNS 테이블과 상세 ID는 유지하고 `library_storage`, `library_item`, `library_component`, `library_asset`, `library_collection`, `library_collection_item`을 추가한다. 기존 `source.id`는 공통 자료의 `source_id`로 매핑한다. `library_run`·`library_run_entry`는 등록/내보내기, `analysis_job`은 배경 분석, `library_vector`·`embedding_cache`·`library_fts`는 검색 파생 데이터를 보유한다. 기존 임베딩 테이블에도 `model_key`를 추가해 모델/전처리가 다른 벡터의 혼합을 막는다. 세부 책임과 등록 규격은 [통합 라이브러리](./unified-library.md)를 참고한다.


`library_change`·`library_change_item`은 구성요소 편집·분리·합치기의 전후 스냅샷과 되돌림 시각을 기록한다. `library_organization`·`library_organization_item`·`library_organization_op`은 원본 정리 계획, 자료 버전, 파일별 해시·원래/목적 경로·체크포인트를 보존한다. 실행 중 `library_storage_lock`이 같은 저장소의 스캔·편집과 신규 배경 분석을 대기시킨다. 구성요소 ID와 `input_hash`가 같은 역할/순서·소속 변경은 임베딩을 재사용한다. → [묶음 편집과 원본 정리](./library-organization.md)

### better-sqlite3 순회 중에는 양보하지 않는다 (2026-10-28)

`iterate()`가 열려 있는 동안 `await`로 이벤트 루프를 내주면, 그 사이 같은 연결의 **쓰기와 트랜잭션이** `This database connection is busy executing a query`로 실패한다(읽기는 성공). better-sqlite3로 직접 재현해 확인했다. 의미 검색이 1,000행마다 양보하던 코드가 이 문제였고, 분석 결과 저장·휴지통 워커·원본 정리 단계·`POST /api/library`가 검색과 겹치면 간헐적으로 실패할 수 있었다. 순회 안에서는 `await`하지 않는다(`embed.ts`의 `semanticHits`처럼 동기로 끝낸다). 오래 걸릴 일이면 `.all()`로 읽은 뒤 청크로 나눠 양보한다. 검색은 후보 id를 `IN (?,?,…)` 대신 `json_each(?)` 하나로 넘겨 매개변수 한도를 피한다.
