"""Build editable, project-native vector assets. No external packages required."""
from pathlib import Path
import json
import html

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'src/img'
records = []

def svg(file, title, body, pages, placement, size=(480, 320), motion=None, fallback=None):
    w, h = size
    title_id = Path(file).stem + '-title'
    text = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-labelledby="{title_id}"><title id="{title_id}">{html.escape(title)}</title>{body}</svg>'''
    p = OUT / file
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding='utf-8')
    records.append(dict(id=p.stem, file=file, type='animated-svg' if motion else 'svg', width=w, height=h, bytes=p.stat().st_size, pages=pages, placement=placement, alt=title, objectFit='contain', motion=motion, fallback=fallback, origin='original editable SVG, adapted to existing icon.svg palette'))

bg = '<rect width="480" height="320" rx="28" fill="#faf8f3"/><circle cx="240" cy="153" r="109" fill="#e3eee9"/><ellipse cx="240" cy="269" rx="140" ry="12" fill="#e5e1d8"/>'
books = '<rect x="143" y="143" width="28" height="98" rx="4" fill="#2f5d50"/><rect x="176" y="122" width="33" height="119" rx="4" fill="#91b3a2"/><rect x="215" y="155" width="25" height="86" rx="4" fill="#b5651d"/><path d="M149 162h16M184 140h17M184 146h17M220 171h15" stroke="#faf8f3" stroke-width="3" stroke-linecap="round"/>'
shelf = '<path d="M114 100h252v160H114z" fill="#fff" stroke="#a98a65" stroke-width="10" stroke-linejoin="round"/><path d="M120 244h240" stroke="#a98a65" stroke-width="10"/>'
svg('illustrations/shelves-empty-first-book.svg', '책장에 첫 책을 등록하는 그림', bg+shelf+books+'<rect x="271" y="152" width="54" height="72" rx="8" fill="#e3eee9" stroke="#2f5d50" stroke-width="2" stroke-dasharray="5 5"/><path d="M287 188h22m-11-11v22" stroke="#2f5d50" stroke-width="3" stroke-linecap="round"/>', ['/shelves','/dashboard'], '장서가 0권일 때만. 첫 책 등록 CTA 위 240×160px')

svg('illustrations/search-empty-discovery.svg', '책 위의 돋보기 그림', bg+'<path d="M108 150q62-28 124 0v94q-62-28-124 0zm124 0q62-28 124 0v94q-62-28-124 0z" fill="#fff" stroke="#2f5d50" stroke-width="4" stroke-linejoin="round"/><path d="M130 169q38-12 77 0m-77 18q38-12 77 0m-77 18q38-12 77 0" fill="none" stroke="#91b3a2" stroke-width="4" stroke-linecap="round"/><circle cx="285" cy="143" r="42" fill="#e3eee9" fill-opacity=".8" stroke="#2f5d50" stroke-width="7"/><path d="m315 175 44 46" stroke="#b5651d" stroke-width="13" stroke-linecap="round"/>', ['/search','/neighborhood'], '검색 조건에 맞는 결과가 없을 때. 오류/로딩과 구분')

svg('illustrations/onboarding-create-library.svg', '집 안에 작은 책장을 만드는 그림', bg+'<path d="m104 140 136-95 136 95" fill="none" stroke="#2f5d50" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M127 133v124h226V133" fill="#fff" stroke="#2f5d50" stroke-width="6" stroke-linejoin="round"/>'+books+'<rect x="268" y="172" width="54" height="69" rx="3" fill="#e3eee9"/><path d="M294 186v35m-17-18h34" stroke="#2f5d50" stroke-width="3" stroke-linecap="round"/><path d="M139 244h198" stroke="#a98a65" stroke-width="7"/>', ['/onboarding','/#how','/pricing'], '서재 생성 폼 위 180×120px / 사용 방법 1단계')

svg('illustrations/invite-family-circle.svg', '책을 중심으로 연결된 가족 구성원을 나타내는 그림', bg+'<path d="M165 149q75-88 150 0m-150 0q-30 97 75 97t75-97" fill="none" stroke="#91b3a2" stroke-width="3" stroke-dasharray="6 7"/><g fill="#2f5d50"><circle cx="160" cy="118" r="21"/><path d="M124 175v-14a36 36 0 0 1 72 0v14z"/></g><g fill="#b5651d"><circle cx="320" cy="118" r="21"/><path d="M284 175v-14a36 36 0 0 1 72 0v14z"/></g><path d="M198 196q21-14 42 0 21-14 42 0v57q-21-14-42 0-21-14-42 0z" fill="#fff" stroke="#2f5d50" stroke-width="3" stroke-linejoin="round"/><path d="M240 196v57" stroke="#2f5d50" stroke-width="3"/>', ['/invite/[token]','/settings','/#how'], '유효한 초대 화면/가족 초대 안내. 만료·권한 오류에는 사용하지 않음')

svg('illustrations/reading-empty-journal.svg', '독서 기록을 기다리는 노트와 연필 그림', bg+'<rect x="146" y="82" width="181" height="174" rx="12" fill="#2f5d50"/><rect x="162" y="82" width="154" height="166" rx="9" fill="#fff"/><path d="M189 119h94m-94 25h94m-94 25h62m-62 25h77" stroke="#91b3a2" stroke-width="4" stroke-linecap="round"/><path d="m274 229 57-110 16 8-57 110-18 12z" fill="#b5651d"/><path d="m273 248 4-20 14 8z" fill="#e5d2ad"/><path d="m275 244 2-9 6 4z" fill="#1f2933"/><path d="M180 82v35l14-9 14 9V82" fill="#b5651d"/>', ['/me','/recommend','/books/[id]'], '기록이 없거나 추천 근거가 부족할 때. 사실과 다른 추천 결과를 표현하지 않음')

svg('illustrations/book-cover-unavailable.svg', '표지가 없는 책', '<rect x="2" y="2" width="236" height="356" rx="12" fill="#e3eee9" stroke="#d3e0d9" stroke-width="4"/><path d="M24 3v354" stroke="#91b3a2" stroke-width="4"/><path d="M65 140q27-18 55 0 28-18 55 0v78q-28-18-55 0-28-18-55 0z" fill="#faf8f3" stroke="#2f5d50" stroke-width="3" stroke-linejoin="round"/><path d="M120 140v78" stroke="#2f5d50" stroke-width="3"/>', ['/shelves','/search','/books/[id]','/recommend','/neighborhood'], '실제 표지 URL이 없거나 로드 실패 시. 제목·저자는 옆의 HTML로 제공', (240,360))

scan_bg = '<rect width="480" height="320" rx="28" fill="#faf8f3"/><rect x="70" y="58" width="340" height="201" rx="16" fill="#e3eee9"/>'
scan_books = ''.join(f'<rect x="{105+i*39}" y="{y}" width="29" height="{229-y}" rx="3" fill="{c}"/><path d="M{111+i*39} {y+19}h17" stroke="#faf8f3" stroke-width="3"/>' for i,(y,c) in enumerate([(102,'#2f5d50'),(89,'#91b3a2'),(113,'#b5651d'),(93,'#2f5d50'),(110,'#91b3a2'),(86,'#2f5d50'),(99,'#b5651d')]))
scan_body = scan_bg+scan_books+'<path d="M91 232h298" stroke="#a98a65" stroke-width="8" stroke-linecap="round"/><path d="M84 98V77h22m268 0h22v21M84 219v23h22m268 0h22v-23" fill="none" stroke="#2f5d50" stroke-width="4" stroke-linecap="round"/>'
svg('motion/add-photo-scan-poster.svg', '책장 한 칸의 책등을 정면에서 촬영하는 안내 그림', scan_body, ['/add/photo','/#how'], '사진 판독 안내의 기본 정지 이미지')
scan_css = '<style>@keyframes scan{0%,15%{transform:translateY(0);opacity:0}22%{opacity:1}78%{opacity:1}90%,100%{transform:translateY(142px);opacity:0}}.scan{animation:scan 3.6s ease-in-out 1 both}@media(prefers-reduced-motion:reduce){.scan{animation:none;opacity:0}}</style>'
svg('motion/add-photo-scan-once.svg', '책장 한 칸을 위에서 아래로 살펴보는 촬영 안내', scan_css+scan_body+'<g class="scan" opacity="0"><rect x="93" y="80" width="294" height="20" rx="5" fill="#2f5d50" opacity=".13"/><path d="M93 88h294" stroke="#2f5d50" stroke-width="3"/></g>', ['/add/photo','/#how'], '사용자가 촬영 안내 보기를 누를 때 1회 재생. 실제 업로드 진행률로 사용 금지', motion={'durationMs':3600,'iterations':1,'trigger':'user request','reducedMotion':'static poster'}, fallback='motion/add-photo-scan-poster.svg')

success = '<rect width="160" height="160" rx="40" fill="#e3eee9"/><circle cx="80" cy="80" r="48" fill="#2f5d50"/><path class="tick" d="m55 80 17 18 34-37" fill="none" stroke="#faf8f3" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'
svg('motion/book-save-success-poster.svg', '책 등록 완료', success, ['/add','/add/photo'], '서버 저장 성공 확인 후, 텍스트와 함께', (160,160))
svg('motion/book-save-success-once.svg', '책 등록 완료', '<style>@keyframes tick{from{stroke-dashoffset:90}to{stroke-dashoffset:0}}.tick{stroke-dasharray:90;animation:tick .9s ease-out 1 both}@media(prefers-reduced-motion:reduce){.tick{animation:none;stroke-dashoffset:0}}</style>'+success, ['/add','/add/photo'], '실제 저장 성공 응답 이후 0.9초 1회. 저장 전에는 표시 금지', (160,160), motion={'durationMs':900,'iterations':1,'trigger':'confirmed server success','reducedMotion':'static poster'}, fallback='motion/book-save-success-poster.svg')

icon_paths = {
 'dashboard':'<path d="M4 20V4m0 16h17M9 16v-5m5 5V6m5 10v-8"/>',
 'shelves':'<path d="M3 20h18M5 17V6h4v11m3 0V3h4v14m3 0-2-11 3-.6 2 11"/>',
 'search':'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
 'reading':'<path d="M3 5q4.5-2 9 1 4.5-3 9-1v14q-4.5-2-9 1-4.5-3-9-1zm9 1v14"/>',
 'recommend':'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>',
 'neighborhood':'<path d="m2 11 5-4 5 4m0-4 5-4 5 4M4 10v10h6V10m4-4v14h6V6M7 16v4m10-4v4"/>'
}
for name, body in icon_paths.items():
    svg(f'icons/feature-{name}.svg', {'dashboard':'취향 대시보드','shelves':'표지로 보는 서가','search':'내용 검색','reading':'독서 기록','recommend':'도서 추천','neighborhood':'동네 공유 서가'}[name], '<g fill="none" stroke="#2f5d50" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+body+'</g>', ['/#features'], '기능 카드 아이콘 24~32px, 인접 제목이 있으면 alt=""', (24,24))

(ROOT / 'docs/web-publishing/vector-metadata.json').write_text(json.dumps(records,ensure_ascii=False,indent=2), encoding='utf-8')
print(f'Created {len(records)} SVG assets')
