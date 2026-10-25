# Wiki Structure

- Wiki path: ./wiki
- Format: OKF v0.1 style Markdown with YAML frontmatter
- Index policy: Every wiki directory contains index.md
- Change log: ./wiki/logs/

## Directory map

- concepts/: 제품 범위, 수집 규칙, 데이터 모델, 검색, 미디어, 번역, UI, 운영
- decisions/: 번호가 있는 ADR
- references/: 외부 플랫폼·디자인 자료
- logs/: 날짜·주제별 변경 이력

## Rules

- 문서 하나에 한 주제를 다룬다.
- 새 문서·디렉토리는 해당 index.md에 등록한다.
- 인덱스는 바로 아래 문서와 하위 인덱스만 안내한다.
- 로그는 YYYY-MM-DD-kebab-case.md로 만들고 logs/index.md에 등록한다.
- 구현과 어긋난 서술을 발견하면 코드를 기준으로 문서를 고친다.
- 확인되지 않은 동작은 "미검증" 또는 "가정"으로 표시한다.
