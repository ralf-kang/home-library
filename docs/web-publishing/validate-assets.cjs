const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const root = path.resolve(__dirname, '../..');
const imgRoot = path.join(root, 'src/img');
const manifest = JSON.parse(fs.readFileSync(path.join(imgRoot, 'asset-manifest.json')));
const report = { date:'2026-10-04', checks:[], limitations:[
  'Browser UI unavailable: no browser screenshots or cross-browser layout/motion verification.',
  'Authenticated pages reviewed in local source, not through an authenticated browser session.',
  'No deployment or live app changes; production performance metrics not measured.'
] };
const add = (name,ok,detail) => {report.checks.push({name,ok,detail}); if(!ok)process.exitCode=1;};
(async()=>{
  for (const item of manifest.assets) {
    const file=path.join(imgRoot,item.file), data=fs.readFileSync(file);
    if (!['mp4','webm'].includes(item.type)) {
      const meta=await sharp(data).metadata();
      await sharp(data).raw().toBuffer();
      add('decode: '+item.file, meta.width===item.width && meta.height===item.height, `${meta.width}x${meta.height}, ${data.length} bytes`);
    }
    add('sha256: '+item.file, crypto.createHash('sha256').update(data).digest('hex')===item.sha256, 'matches manifest');
    if (item.type==='animated-svg') {
      add('reduced motion: '+item.file, data.includes(Buffer.from('prefers-reduced-motion:reduce')) && !data.includes(Buffer.from('infinite')), 'finite CSS animation with reduced-motion rule');
      add('poster: '+item.file, fs.existsSync(path.join(imgRoot,item.fallback)),item.fallback);
    }
  }
  const files=manifest.assets.filter(x=>x.file.startsWith('photos/'));
  add('photo size budget', files.every(x=>x.bytes<200*1024),`All ${files.length} photo WebP files below 200 KiB`);
  const mediaCount=fs.readdirSync(path.join(imgRoot,'photos')).length+fs.readdirSync(path.join(imgRoot,'illustrations')).length+fs.readdirSync(path.join(imgRoot,'icons')).length+fs.readdirSync(path.join(imgRoot,'motion')).length+fs.readdirSync(path.join(imgRoot,'video')).filter(x=>/\.(mp4|webm|webp)$/.test(x)).length;
  add('runtime inventory', manifest.assets.length===mediaCount,`${mediaCount} runtime media files; PNG masters and text tracks excluded`);
  for(const item of manifest.supportFiles || []){const data=fs.readFileSync(path.join(imgRoot,item.file));add('support hash: '+item.file,crypto.createHash('sha256').update(data).digest('hex')===item.sha256,'matches manifest')}
  // Render a contact sheet for model/user visual inspection, never a production asset.
  const selected=manifest.assets.filter(x=>(x.type==='webp' && x.width>1000) || x.file.startsWith('illustrations/') || x.file.endsWith('-poster.svg'));
  const cells=[]; const cw=360,ch=270,cols=3;
  for(let i=0;i<selected.length;i++){
    const a=selected[i];
    const thumb=await sharp(path.join(imgRoot,a.file)).resize(332,218,{fit:'contain',background:'#faf8f3'}).png().toBuffer();
    cells.push({input:thumb,left:(i%cols)*cw+14,top:Math.floor(i/cols)*ch+12});
    const label=`<svg width="350" height="32"><rect width="350" height="32" fill="#ffffff"/><text x="8" y="20" font-family="sans-serif" font-size="11" fill="#1f2933">${a.id}</text></svg>`;
    cells.push({input:Buffer.from(label),left:(i%cols)*cw+5,top:Math.floor(i/cols)*ch+235});
  }
  await sharp({create:{width:cw*cols,height:Math.ceil(selected.length/cols)*ch,channels:3,background:'#ffffff'}}).composite(cells).png().toFile(path.join(__dirname,'asset-contact-sheet.png'));
  fs.writeFileSync(path.join(__dirname,'validation-report.json'),JSON.stringify(report,null,2));
  console.log(`Validated ${manifest.assets.length} assets; ${report.checks.length} checks, ${report.checks.filter(x=>!x.ok).length} failures.`);
})().catch(e=>{console.error(e);process.exitCode=1});
