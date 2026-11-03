#!/usr/bin/env python3
"""Copy a legacy personal UX library and generate Bakje v1 manifests; never modify the source."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    args = parser.parse_args()
    source, destination = args.source.resolve(), args.destination.resolve()
    if source == destination or source in destination.parents or destination in source.parents:
        parser.error('source and destination must be separate trees')
    library = json.loads((source / 'library.json').read_text())
    if library.get('purpose') != 'personal':
        parser.error('only personal libraries can be migrated')
    records = {}
    for group in ['cases', 'rules', 'assets', 'sources']:
        records[group] = {}
        for file in sorted((source / group).glob('*.json')):
            if file.name.startswith('._'):
                continue  # AppleDouble metadata is not a JSON record.
            record = json.loads(file.read_text(encoding='utf-8-sig'))
            if file.stem != record['id'] or record['id'] in records[group]:
                raise ValueError(f'invalid/duplicate ID: {file}')
            records[group][record['id']] = record
    # Validate references and hashes before creating any output.
    for group, field in [('assets', 'path'), ('sources', 'snapshot_path')]:
        for record in records[group].values():
            if field not in record:
                continue
            file = (source / record[field]).resolve()
            if source not in file.parents or not file.is_file():
                raise ValueError(f'invalid file: {file}')
            if hashlib.sha256(file.read_bytes()).hexdigest() != record['sha256']:
                raise ValueError(f'hash mismatch: {file}')
    for case in records['cases'].values():
        for source_id in case.get('source_ids', []):
            assert source_id in records['sources'], source_id
        for asset in case.get('assets', []):
            assert asset['asset_id'] in records['assets'], asset
        for rule in case.get('rules', []):
            assert rule['rule_id'] in records['rules'], rule
    # Preserve all original records and evidence, including unreferenced history.
    legacy = destination / 'legacy'
    for file in source.rglob('*'):
        relative = file.relative_to(source)
        if not file.is_file() or any(p.startswith('._') or p in {'.DS_Store', '.index'} for p in relative.parts):
            continue
        if source not in file.resolve().parents:
            raise ValueError(f'escaping symlink: {file}')
        target = legacy / relative
        if target.exists() and target.read_bytes() != file.read_bytes():
            raise ValueError(f'destination differs; refusing overwrite: {target}')
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(file, target)
    items = []
    labels = {'context': '상황', 'problem': '문제', 'user_impact': '영향과 한계', 'improvement': '개선 내용',
              'verification_note': '검증 범위', 'status': '상태', 'product': '제품', 'surface': '화면',
              'resolutions': '해결 이력', 'assets': '근거와 확인할 위치', 'rules': '연결된 초안 규칙',
              'source_ids': '출처 ID', 'principle': '원칙', 'applies_when': '적용 조건', 'exceptions': '예외',
              'audit_question': '점검 질문', 'implementation_guidance': '구현 지침', 'verification_method': '확인 방법',
              'scope': '범위', 'scope_ref': '범위 대상', 'publication_note': '원본 공개 제한'}
    for group in ['cases', 'rules']:
        for rid, record in records[group].items():
            external_id = f"ux:{library['id']}:{'case' if group == 'cases' else 'rule'}:{rid}"
            folder = destination / group / rid
            folder.mkdir(parents=True, exist_ok=True)
            lines = [f"# {record['title']}", '', f"원본 ID: {rid}", '',
                     '기존 UX 저장소에서 이전한 기록. 아래 상태·검증 수준은 원본 기록이며 이번 이전에서 UI·배포·사용자 효과를 재검증하지 않았다.', '']
            if group == 'rules':
                lines += ['초안 규칙이다. 확정 원칙으로 취급하지 않는다.' if record.get('status') == 'draft' else f"원본 규칙 상태: {record.get('status', 'unknown')}", '']
            for key, label in labels.items():
                if key not in record:
                    continue
                value = record[key]
                lines += [f'## {label}', '', value if isinstance(value, str) else '```json\n' + json.dumps(value, ensure_ascii=False, indent=2) + '\n```', '']
            doc = folder / 'README.md'
            doc.write_text('\n'.join(lines), encoding='utf-8')
            components = [
                {'key': 'doc', 'kind': 'text', 'role': 'doc', 'path': doc.relative_to(destination).as_posix()},
                {'key': f'legacy:{rid}', 'kind': 'file', 'role': 'attachment', 'path': f'legacy/{group}/{rid}.json'},
            ]
            for ref in record.get('assets', []):
                asset = records['assets'][ref['asset_id']]
                kind = asset['kind'] if asset['kind'] in ['text', 'image', 'video'] else 'file'
                c = {'key': f"asset:{asset['id']}", 'kind': kind,
                     'role': 'result' if ref['role'] == 'improvement' else 'screenshot' if kind == 'image' else ref['role'],
                     'metadata': {**asset, **ref}}
                if kind == 'text':
                    c['text'] = asset['text']
                else:
                    c['path'] = 'legacy/' + asset['path']
                components.append(c)
            for sid in record.get('source_ids', []):
                src = records['sources'][sid]
                components.append({'key': f'source:{sid}', 'kind': 'text', 'role': 'reference',
                                   'path': 'legacy/' + src['snapshot_path'], 'metadata': {**src, 'embed': False}})
            item = {'schema_version': 1, 'path_base': 'storage', 'external_id': external_id, 'title': record['title'],
                    'kind': 'ux' if group == 'cases' else 'document', 'origin': 'local',
                    'folder_path': f'{group}/{rid}', 'collections': ['UX 사례' if group == 'cases' else 'UX 원칙 초안'],
                    'tags': list(dict.fromkeys(['UX', record.get('category', ''), record.get('product', ''), record.get('status', '')])),
                    'metadata': {'legacy_library_id': library['id'], 'legacy_record_id': rid, 'legacy_record_type': group,
                                 'legacy_record': record, 'migration_version': 1}, 'components': components}
            item['tags'] = [t for t in item['tags'] if t]
            (folder / 'item.json').write_text(json.dumps(item, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            items.append(item)
    (destination / 'items.jsonl').write_text(''.join(json.dumps(i, ensure_ascii=False) + '\n' for i in items), encoding='utf-8')
    print(json.dumps({'library_id': library['id'], 'counts': {k: len(v) for k, v in records.items()},
                      'items': len(items), 'manifest': str(destination / 'items.jsonl')}, ensure_ascii=False))


if __name__ == '__main__':
    main()
