"""Assemble the offline handoff and a machine-readable asset inventory."""
from pathlib import Path
import json, html, hashlib

ROOT = Path(__file__).resolve().parents[2]
DOC = Path(__file__).resolve().parent
IMG = ROOT / 'src/img'
photos = json.loads((DOC/'photo-metadata.json').read_text(encoding='utf-8'))
vectors = json.loads((DOC/'vector-metadata.json').read_text(encoding='utf-8'))
photo_usage = {
 'landing-hero-family-reading': dict(pages=['/'], placement='히어로 오른쪽. 모바일에서는 제목·설명·CTA 다음. 3:2 원본 비율 유지', alt='햇살이 드는 거실에서 함께 책을 읽는 가족', objectFit='contain', source='src/app/page.tsx: ShelfIllustration 교체'),
 'auth-reading-nook': dict(pages=['/login','/onboarding'], placement='데스크톱 로그인 좌측 4:5 패널. 온보딩 보조 이미지. 모바일에서는 숨기거나 작은 보조 컷으로 배치', alt='초록 안락의자와 나무 책장이 있는 햇살 드는 독서 공간', objectFit='cover', source='src/app/login/page.tsx; src/app/onboarding/page.tsx'),
 'neighborhood-book-sharing': dict(pages=['/#neighbors','/neighborhood'], placement='랜딩 가족·이웃 설명 옆 3:2 사진. 동네 미가입 안내 보조. 공유 장서 목록에는 반복하지 않음', alt='동네 이웃끼리 책 두 권을 건네는 모습', objectFit='contain', source='src/app/page.tsx #neighbors; src/app/(app)/neighborhood/page.tsx')
}
records = []
for p in photos:
    records.append(dict(id=Path(p['file']).stem,type='webp',**p,**photo_usage[p['key']],origin='AI-generated via built-in image_gen.imagegen',focalPoint='50% 50%',motion=None))
records += vectors
for r in records:
    r['sha256'] = hashlib.sha256((IMG/r['file']).read_bytes()).hexdigest()
manifest = dict(schemaVersion=1,created='2026-10-04',service='우리집 서재',assetRoot='src/img',runtimeAssets=len(records),naming='{page-or-feature}-{purpose}-{subject}[-{width}].{ext}',integration='Next.js static imports; src/img is not a public URL',assets=records)
(IMG/'asset-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')

def esc(x): return html.escape(str(x))
gallery = ''
for r in records:
    if r['type']=='webp' and r['width'] < 1000: continue
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
