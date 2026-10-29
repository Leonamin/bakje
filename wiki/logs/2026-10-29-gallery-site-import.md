---
type: Log
title: "갤러리 사이트 박제와 연결"
description: "ai-costume·ai-pose 갤러리를 일회성 스크립트로 받아 연결 폴더로 등록한 기록"
timestamp: 2026-10-29
okf_version: "0.1"
---

# 갤러리 사이트 박제와 연결

`ai-costume-gallery`(1,407건)와 `ai-pose-gallery`(288포즈·1,439장)를 박제 저장소 밖 스크립트(`~/dev/prompt/ai-costume`, `~/dev/prompt/ai-pose`)로 수집했다. 데이터는 `~/Library/ai-costume`, `~/Library/ai-pose`에 두고 `/etc/bakje/compose.override.yml`에 마운트를 추가해 `web`만 재생성한 뒤 연결·등록했다(저장소 3·4, 작업 4·5, 실패 0). 포즈는 PNG를 webp로 변환했고 일부에 `성인` 태그를 붙였다. 박제 앱 코드는 바꾸지 않았다.

- 추가: `concepts/gallery-site-import.md`, `logs/2026-10-29-gallery-site-import.md`
- 갱신: `concepts/index.md`, `logs/index.md`, `index.md`
