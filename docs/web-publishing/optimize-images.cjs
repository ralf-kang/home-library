// Run from the project: node docs/web-publishing/optimize-images.cjs
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '../..');
const prompts = require('./image-prompts.json');
(async () => {
  const records = [];
  for (const p of prompts) {
    const master = path.join(root, 'src/img/_masters', `${p.key}-original.png`);
    fs.mkdirSync(path.dirname(master), { recursive: true });
    fs.mkdirSync(path.join(root, 'src/img/photos'), { recursive: true });
    if (!fs.existsSync(master)) fs.copyFileSync(p.sourceFile, master, fs.constants.COPYFILE_EXCL);
    for (const width of p.key === 'auth-reading-nook' ? [640, 1120] : [768, 1536]) {
      const file = `photos/${p.key}-${width}.webp`;
      const dest = path.join(root, 'src/img', file);
      const result = await sharp(master).rotate().resize({width, withoutEnlargement:true}).webp({quality:82, effort:6}).toFile(dest);
      records.push({key:p.key, file, width:result.width, height:result.height, bytes:result.size});
    }
  }
  fs.writeFileSync(path.join(__dirname, 'photo-metadata.json'), JSON.stringify(records, null, 2));
  console.log(JSON.stringify(records, null, 2));
})().catch(e=>{ console.error(e); process.exitCode=1; });
