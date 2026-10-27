"""Assemble the offline handoff and a machine-readable asset inventory."""
from pathlib import Path
import json, html, hashlib

ROOT = Path(__file__).resolve().parents[2]
DOC = Path(__file__).resolve().parent
IMG = ROOT / 'src/img'
photos = json.loads((DOC/'photo-metadata.json').read_text(encoding='utf-8'))
vectors = json.loads((DOC/'vector-metadata.json').read_text(encoding='utf-8'))
videos = json.loads((DOC/'video-metadata.json').read_text(encoding='utf-8'))
photo_usage = {
 'landing-hero-family-reading': dict(pages=['/'], placement='히어로 오른쪽. 모바일에서는 제목·설명·CTA 다음. 3:2 원본 비율 유지', alt='햇살이 드는 거실에서 함께 책을 읽는 가족', objectFit='contain', source='src/app/page.tsx: ShelfIllustration 교체'),
 'auth-reading-nook': dict(pages=['/login','/onboarding'], placement='데스크톱 로그인 좌측 4:5 패널. 온보딩 보조 이미지. 모바일에서는 숨기거나 작은 보조 컷으로 배치', alt='초록 안락의자와 나무 책장이 있는 햇살 드는 독서 공간', objectFit='cover', source='src/app/login/page.tsx; src/app/onboarding/page.tsx'),
 'neighborhood-book-sharing': dict(pages=['/#neighbors','/neighborhood'], placement='랜딩 가족·이웃 설명 옆 3:2 사진. 동네 미가입 안내 보조. 공유 장서 목록에는 반복하지 않음', alt='동네 이웃끼리 책 두 권을 건네는 모습', objectFit='contain', source='src/app/page.tsx #neighbors; src/app/(app)/neighborhood/page.tsx'),
 'me-reading-journal-desk': dict(pages=['/me','/books/[id]'], placement='독서 기록 첫 사용 안내의 16:9 사진. 기록 목록이 있으면 작은 보조 컷으로 축소', alt='나무 책상 위 독서 노트와 펜, 책과 찻잔', objectFit='contain', source='src/app/(app)/me/page.tsx; src/app/(app)/books/[id]/page.tsx'),
 'recommend-unread-books-selection': dict(pages=['/recommend'], placement='사기 전에 이 책부터 섹션 소개용 16:9 사진. 실제 추천 도서 표지를 대체하지 않음', alt='다시 읽을 책을 고르듯 가지런히 놓인 초록색과 갈색 책', objectFit='contain', source='src/app/(app)/recommend/page.tsx'),
 'add-photo-shelf-framing': dict(pages=['/add/photo','/#how'], placement='사진 업로드 전 촬영 안내. 16:9 전체 프레임 유지, 최대 표시 폭 480px', alt='책장 한 칸의 책등을 정면으로 담는 휴대폰 촬영 구도', objectFit='contain', source='src/app/(app)/add/photo/page.tsx')
}
records = []
for p in photos:
    records.append(dict(id=Path(p['file']).stem,type='webp',**p,**photo_usage[p['key']],origin='AI-generated via built-in image_gen.imagegen',focalPoint='50% 50%',motion=None))
records += vectors
records += videos
for r in records:
    r['sha256'] = hashlib.sha256((IMG/r['file']).read_bytes()).hexdigest()
support=[]
for p in sorted((IMG/'video').glob('*')):
    if p.suffix in ['.vtt','.txt']:
        support.append(dict(file=p.relative_to(IMG).as_posix(),type='captions' if p.suffix=='.vtt' else 'transcript',bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
manifest = dict(schemaVersion=2,created='2026-10-04',revision='additional-media-02',service='우리집 서재',assetRoot='src/img',runtimeAssets=len(records),naming='{page-or-feature}-{purpose}-{subject}[-{width-or-resolution}].{ext}',integration='Images: Next.js static imports. Video: copy src/img/video to public/img/video when integrating; no public URL exists yet.',assets=records,supportFiles=support)
(IMG/'asset-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')

def esc(x): return html.escape(str(x))
gallery = ''
for r in records:
    if r['type']=='webp' and r['width'] < 1000: continue
    if r['type'] in ['mp4','webm']: continue
    preview = r.get('fallback') or r['file']
    gallery += f'''<article class="asset" data-search="{esc(r['file']+' '+' '.join(r['pages']))}"><div class="asset-image"><img src="../../src/img/{preview}" alt="{esc(r['alt'])}" loading="lazy" width="{r['width']}" height="{r['height']}"></div><div class="asset-body"><a href="../../src/img/{r['file']}"><code>{esc(r['file'])}</code></a><p class="meta">{r['width']} × {r['height']} · {r['bytes']/1024:.1f} KiB</p><p><b>{esc(' · '.join(r['pages']))}</b></p><p>{esc(r['placement'])}</p></div></article>'''
rows = ''.join(f'<tr><td><code>{esc(r["file"])}</code></td><td>{esc(" · ".join(r["pages"]))}</td><td>{r["width"]}×{r["height"]}</td><td>{r["bytes"]/1024:.1f}</td></tr>' for r in records)
template = (DOC/'design-guide.template.html').read_text(encoding='utf-8')
template = template.replace('{{GALLERY}}',gallery).replace('{{ROWS}}',rows)
template = template.replace('{{SCAN}}',(IMG/'motion/add-photo-scan-once.svg').read_text(encoding='utf-8'))
template = template.replace('{{SUCCESS}}',(IMG/'motion/book-save-success-once.svg').read_text(encoding='utf-8'))
template = template.replace('{{TOTAL_KIB}}',f'{sum(r["bytes"] for r in records)/1024:.1f}')
(DOC/'design-guide.html').write_text(template,encoding='utf-8')
print(f'Guide and manifest ready: {len(records)} runtime assets, {sum(r["bytes"] for r in records):,} bytes')
