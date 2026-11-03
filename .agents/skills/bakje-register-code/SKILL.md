---
name: bakje-register-code
description: 재활용할 코드·스킬·아이디어를 정리 문서와 함께 박제(bakje) 연결 폴더에 만들고 MCP로 등록할 때 사용한다. 박제에서 기존 사례를 먼저 찾아 구현에 쓰는 요청에도 사용한다.
---

# 박제에 코드 등록하기 (PROFILE v2)

**목표: 등록한 자료만 본 사람이 구현할 수 있어야 한다.**

## 먼저 찾기

구현 전에 `search_library`를 `kind=code`로 호출한다. 결과가 있으면 인터넷보다 먼저 쓴다.
각 결과의 `freshness`를 읽는다.

- `timeless`: 그대로 쓴다.
- `versioned`: `depends_on`과 프로젝트 lockfile 버전을 비교한다. 다르거나 `stale`이면 공식 문서를 먼저 확인하고, 이 코드는 구조 참고용으로만 쓴다.
- `unknown`: `versioned`처럼 다룬다.
- `fidelity=pseudo`는 복사하지 않는다. `partial`은 빠진 연결 부분을 직접 채운다.

검색은 한 번만 한다. 제목과 요약이 작업과 맞지 않으면 없는 것으로 보고 바로 진행한다. 의미 검색은 관련 없는 결과도 돌려주므로(`kind=code`가 이를 줄인다) 재검색하지 않는다.

### 프로젝트 AGENTS.md 예시

에이전트는 시키지 않으면 박제를 먼저 찾지 않는다. 박제를 쓸 프로젝트의 AGENTS.md에 아래를 넣는다.

```markdown
- 구현 전에 박제(bakje MCP)에서 `search_library`를 `kind=code`로 한 번만 검색한다. 제목과 요약이 작업과 맞지 않으면 없는 것으로 보고 바로 진행한다. 재검색하지 않는다.
- 맞는 항목이 있으면 인터넷보다 먼저 쓴다. `freshness.stale`이 true이거나 `fidelity`가 runnable이 아니면 그대로 복사하지 말고 현재 문서와 차이를 확인해 알린다.
- 쓴 박제 항목의 id를 마지막에 보고한다.
```

## 등록 순서

1. **폴더를 정한다.** 코드 항목은 박제 기본저장소(managed)에 등록할 수 없다. 연결 폴더가 필요하다.
   - 먼저 `list_library_storages`로 코드용 연결 폴더가 있는지 본다. 있으면 그 폴더에 쓴다.
   - 없으면 폴더는 서버 컨테이너에 마운트되어 있어야 한다 (`/library/…` 읽기 전용, 또는 허용된 위치). 새 마운트는 컨테이너 재생성이 필요한 운영 변경이다. 사용자에게 알리고 승인받은 뒤에 한다.
   - 박제는 연결 폴더에 파일을 쓰지 않는다. 파일은 호스트에서 직접 쓴다.
   - `connect_library_folder`는 사용자가 요청했을 때만 호출한다.
2. **파일을 쓴다.** 항목마다 폴더 하나. 원래 폴더 구조를 유지한다. 파일 하나가 구성요소 하나다.
3. **`register_library_items`로 등록한다.** `kind: "code"`. 같은 `external_id`로 다시 올리면 갱신된다.
4. **`warnings`를 확인한다.** 있으면 고쳐서 다시 등록한다.
5. **`search_library`로 찾아본다.** "언제 쓰나"에 쓴 문장으로 검색해서 이 항목이 나오는지 확인한다.

## 구성요소 역할

| 종류 | role | 임베딩 |
|---|---|---|
| 요약 카드 (필수) | `profile` | 한다 |
| 구현 문서 | `doc` (또는 `guide`, `note`, `readme`) | 한다 |
| 슈도코드 | `pseudo` | 한다 |
| 코드 | `entry`, `helper`, `config`, `test` 등 | 하지 않는다 (키워드 검색만) |
| 이미지 | `diagram`, `result`, `screenshot` (`kind: image`) | 한다. 끄려면 `embed=false` |
| 그 밖의 파일 (html, pdf, zip, 데이터) | `attachment` (`kind: file`) | 하지 않는다 |

기본 규칙을 바꾸려면 구성요소 `metadata.embed`를 `true`/`false`로 명시하거나 `edit_library_components`의 `embed`를 쓴다.

## profile 작성법

`{key:"profile", kind:"text", role:"profile"}`. 한국어, 짧은 문장. 아래 제목을 그대로 쓴다.

- **무엇**: 하는 일 한 문장. 서비스나 라이브러리 이름을 쓴다.
- **언제 쓰나**: 이 자료를 찾게 될 작업. 사용자가 물어볼 법한 표현 2~3개.
- **적용 방법**: 진입 파일, 파일별 역할, 프로젝트에 연결하는 방법. 코드를 붙이지 않는다.
- **주의**: 한계, 필요한 키, 깨지는 부분.
- **결과물**: 정상 실행 결과(출력, 스크린샷, 로그)와 첨부 파일 목록. 없으면 생략.

칭찬하지 않는다. 확인하지 않은 것은 추측하지 말고 "미확인"이라고 쓴다.

## doc 작성법

`role: "doc"`, 마크다운. 다른 자료 없이 읽을 수 있게 쓴다. 순서는 이렇다.

1. 목표
2. 전제 (버전, 키, 환경)
3. 구현 단계 (번호)
4. 코드 또는 슈도코드
5. 함정 (무엇이 깨졌고 왜)
6. 확인 방법

코드 블록마다 `실행 가능`, `일부`, `슈도` 중 하나를 표시한다. 슈도코드를 동작하는 코드처럼 쓰지 않는다.

## metadata (kind=code 필수)

- `fidelity`: `runnable`(그대로 실행) / `partial`(핵심만, 연결 필요) / `pseudo`(아이디어 수준). 항목 전체에서 가장 낮은 수준을 쓴다.
- `durability`: `timeless`(알고리즘·패턴, 외부 API 없음) / `versioned`(서비스·라이브러리·API에 의존). 애매하면 `versioned`.
- `depends_on`: versioned이면 `["openai-sdk@4.x","api:2026-03"]` 형식. 아니면 `[]`.
- `verified_at`: 마지막으로 동작을 본 날 `YYYY-MM-DD`. 실행해 본 적이 없으면 생략한다.
- `profile_version`: `2`

`versioned`이면서 `verified_at`이 없거나 180일이 지나면 `stale`로 표시된다.
