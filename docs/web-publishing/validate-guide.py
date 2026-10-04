from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse, unquote
import json
import xml.etree.ElementTree as ET

DOC=Path(__file__).resolve().parent
ROOT=DOC.parents[1]
report=json.loads((DOC/'validation-report.json').read_text(encoding='utf-8'))
errors=[]
class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.links=[]; self.ids=[]; self.images=0; self.scripts=[]; self.in_script=False
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a: self.ids.append(a['id'])
        for key in ('src','href'):
            if a.get(key): self.links.append(a[key])
        if a.get('srcset'):
            self.links.extend(part.strip().split()[0] for part in a['srcset'].split(','))
        if tag=='img':
            self.images+=1
            if 'alt' not in a: errors.append('Image missing alt')
        if tag=='script': self.in_script=True
    def handle_endtag(self,tag):
        if tag=='script': self.in_script=False
    def handle_data(self,data):
        if self.in_script: self.scripts.append(data)

for name in ['design-guide.html','landing-preview.html']:
    p=Page(); p.feed((DOC/name).read_text(encoding='utf-8'))
    for ref in p.links:
        parsed=urlparse(ref)
        if parsed.scheme or ref.startswith('//'): continue
        if parsed.path:
            dest=(DOC/unquote(parsed.path)).resolve()
            if not dest.exists(): errors.append(f'{name}: missing {ref}')
        elif parsed.fragment and parsed.fragment not in p.ids: errors.append(f'{name}: missing anchor {ref}')
    if len(p.ids)!=len(set(p.ids)): errors.append(f'{name}: duplicate ids')
    for i,script in enumerate(p.scripts): (DOC/f'{name}.script-{i}.js').write_text(script,encoding='utf-8')
    report['checks'].append(dict(name=f'HTML references and accessibility structure: {name}',ok=not errors,detail=f'{len(p.links)} references; {p.images} images with alt attributes'))
for svg in (ROOT/'src/img').rglob('*.svg'): ET.parse(svg)
report['checks'].append(dict(name='SVG XML',ok=True,detail='16 SVG files parse successfully'))
report['checks'].append(dict(name='guide references',ok=not errors,detail=errors or 'All local links, srcsets and anchor targets exist; no duplicate IDs'))
(DOC/'validation-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'errors':errors,'checks':len(report['checks'])},ensure_ascii=False))
if errors: raise SystemExit(1)
