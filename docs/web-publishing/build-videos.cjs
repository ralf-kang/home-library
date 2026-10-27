// Deterministic 720p / 24 fps editorial montage + vector motion guide.
// Requires project sharp and ffmpeg (FFMPEG_BINARY may override the local tool).
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {Readable} = require('node:stream');
const {pipeline} = require('node:stream/promises');
const sharp = require('sharp');
const root=path.resolve(__dirname,'../..'), imgRoot=path.join(root,'src/img');
const out=path.join(imgRoot,'video');fs.mkdirSync(out,{recursive:true});
const ffmpeg=process.env.FFMPEG_BINARY || 'C:/hyper-v/.tools/video-python/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';
const W=1280,H=720,FPS=24,DURATION=12,FRAMES=FPS*DURATION;
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x)};
const text=(x,y,t,size=24,color='#1f2933',weight=400)=>`<text x="${x}" y="${y}" font-family="Malgun Gothic, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${esc(t)}</text>`;
const logo=`<rect x="64" y="50" width="38" height="38" rx="10" fill="#2f5d50"/><path d="M75 77V62m7 15V59m8 18-3-16M71 79h25" stroke="#faf8f3" stroke-width="4" stroke-linecap="round"/>${text(115,78,'우리집 서재',24,'#2f5d50',700)}`;
function shell(content,step,progress,kind){return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#faf8f3"/>${logo}${text(1005,76,kind,18,'#59626b')}${content}<path d="M64 637h1152" stroke="#e5e1d8"/>${text(64,679,'함께 읽고, 함께 기억해요.',18,'#59626b')}<rect x="953" y="665" width="192" height="4" rx="2" fill="#e5e1d8"/><rect x="953" y="665" width="${Math.max(1,192*progress)}" height="4" rx="2" fill="#2f5d50"/>${text(1170,676,`${step+1}/3`,17,'#59626b')}</svg>`}
const montageScenes=[
 {photo:'landing-hero-family-reading-1536.webp',tag:'OUR FAMILY LIBRARY',title:['책이 모이는 집,','우리집 서재'],sub:['집 안의 책을 한곳에 모아','우리 가족의 서재를 만들어요.']},
 {photo:'me-reading-journal-desk-1536.webp',tag:'READ & REMEMBER',title:['읽은 순간을','가족의 기록으로'],sub:['완독과 별점, 마음에 남은 문장.','가족의 독서 이야기를 기록해요.']},
 {photo:'neighborhood-book-sharing-1536.webp',tag:'SHARE A STORY',title:['책 한 권으로','이웃과 가까이'],sub:['나누고 싶은 책을 공개하고','동네 이웃과 함께 읽어요.']}
];
const photoCache=[];
async function montageFrame(scene,p,globalP){
  const s=montageScenes[scene];
  const svg=shell(`${text(64,192,s.tag,17,'#b5651d',700)}${text(64,290,s.title[0],48,'#2f5d50',700)}${text(64,357,s.title[1],48,'#2f5d50',700)}${text(64,438,s.sub[0],24,'#59626b')}${text(64,478,s.sub[1],24,'#59626b')}`,scene,globalP,'가족 독서 플랫폼');
  // Small lateral camera move across a still photograph, not synthesized action.
  const photo=await sharp(photoCache[scene]).extract({left:Math.round(24*ease(p)),top:8,width:660,height:440}).png().toBuffer();
  return sharp(Buffer.from(svg)).composite([{input:photo,left:556,top:155}]).removeAlpha().raw().toBuffer();
}
const guideScenes=[
 {title:['책장 한 칸을','정면에서 촬영'],sub:['책등 전체가 선명하게 보이도록','밝은 곳에서 한 칸씩 찍어 주세요.']},
 {title:['판독한 목록을','확인하고 수정'],sub:['제목·ISBN·중복 여부를 살펴보고','책을 꽂을 위치도 확인해 주세요.']},
 {title:['확인한 책만','서재에 등록'],sub:['목록 검토가 끝나면 등록하세요.','저장 완료 표시를 확인해 주세요.']}
];
function guideGraphic(scene,p){
  let body='<rect width="636" height="398" rx="28" fill="#e3eee9"/>';
  if(scene===0){
    body+='<rect x="67" y="70" width="502" height="262" rx="14" fill="#faf8f3"/>';
    [190,216,174,205,185,224,199].forEach((h,i)=>{const c=['#2f5d50','#91b3a2','#b5651d'][i%3];body+=`<rect x="${94+i*65}" y="${305-h}" width="48" height="${h}" rx="5" fill="${c}"/><path d="M${104+i*65} ${327-h}h28" stroke="#faf8f3" stroke-width="4"/>`});
    body+='<path d="M83 309h470" stroke="#a98a65" stroke-width="9" stroke-linecap="round"/><path d="M53 94V53h42m446 0h42v41M53 307v39h42m446 0h42v-39" fill="none" stroke="#2f5d50" stroke-width="4" stroke-linecap="round"/>';
    const y=72+228*ease(Math.min(1,p*1.4));const opacity=p<.82?.5:Math.max(0,(1-p)/.18*.5);
    body+=`<rect x="66" y="${y}" width="502" height="14" fill="#2f5d50" opacity="${opacity}"/>`;
  }else if(scene===1){
    ['제목 확인','ISBN 확인','중복·위치 확인'].forEach((label,i)=>{
      const done=p>(i+1)*.18, y=54+i*101;
      body+=`<rect x="58" y="${y}" width="520" height="82" rx="14" fill="#fff"/>${text(88,y+50,label,27,'#2f5d50',600)}<circle cx="533" cy="${y+41}" r="18" fill="${done?'#2f5d50':'#e3eee9'}"/>`;
      if(done)body+=`<path d="m524 ${y+41} 6 7 13-16" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    });
  }else{
    const q=ease(p*2.5);
    body+=`<circle cx="318" cy="164" r="${74+7*q}" fill="#2f5d50"/><path d="m277 162 28 29 61-65" fill="none" stroke="#faf8f3" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="145" stroke-dashoffset="${145*(1-q)}"/>${text(233,298,'등록 완료',36,'#2f5d50',700)}`;
  }
  return `<g transform="translate(580 168)">${body}</g>`;
}
async function guideFrame(scene,p,globalP){const s=guideScenes[scene];return sharp(Buffer.from(shell(`${text(64,185,`STEP 0${scene+1}`,18,'#b5651d',700)}${text(64,275,s.title[0],46,'#2f5d50',700)}${text(64,340,s.title[1],46,'#2f5d50',700)}${text(64,422,s.sub[0],23,'#59626b')}${text(64,461,s.sub[1],23,'#59626b')}${text(64,567,'사용 순서 안내 · 실제 판독 결과가 아닌 예시',16,'#59626b')}${guideGraphic(scene,p)}`,scene,globalP,'사진 등록 가이드'))).removeAlpha().raw().toBuffer()}
async function blend(a,b,alpha){const layer=await sharp(b,{raw:{width:W,height:H,channels:3}}).joinChannel(Buffer.alloc(W*H,Math.round(alpha*255)),{raw:{width:W,height:H,channels:1}}).png().toBuffer();return sharp(a,{raw:{width:W,height:H,channels:3}}).composite([{input:layer}]).removeAlpha().raw().toBuffer()}
function run(args){return new Promise((resolve,reject)=>{const proc=spawn(ffmpeg,args,{windowsHide:true});let err='';proc.stderr.on('data',b=>err+=b.toString());proc.on('error',reject);proc.on('close',c=>c===0?resolve(err):reject(new Error(err.slice(-6000))))})}
async function encode(key,frameFn){
  const file=path.join(out,key+'-720p.mp4');
  const proc=spawn(ffmpeg,['-y','-hide_banner','-loglevel','error','-f','rawvideo','-pixel_format','rgb24','-video_size',`${W}x${H}`,'-framerate',String(FPS),'-i','pipe:0','-an','-c:v','libx264','-threads','2','-preset','medium','-crf','22','-pix_fmt','yuv420p','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-movflags','+faststart',file],{windowsHide:true});
  let err='';proc.stderr.on('data',b=>err+=b.toString());
  const done=new Promise((resolve,reject)=>{proc.on('error',reject);proc.on('close',c=>c===0?resolve():reject(new Error(err.slice(-6000))))});
  const snapshots=[];
  async function* frames(){
    for(let i=0;i<FRAMES;i++){
      const t=i/FPS,scene=Math.min(2,Math.floor(t/4)),p=(t%4)/4;
      let raw=await frameFn(scene,p,i/(FRAMES-1));
      if(p>.9 && scene<2){const next=await frameFn(scene+1,0,i/(FRAMES-1));raw=await blend(raw,next,ease((p-.9)/.1))}
      if(i===0)await sharp(raw,{raw:{width:W,height:H,channels:3}}).webp({quality:86}).toFile(path.join(out,key+'-poster.webp'));
      if([24,120,216].includes(i)) snapshots.push({second:t,raw});
      if(i%96===0)console.log(`${key}: scene ${scene+1}/3`);
      yield raw;
    }
  }
  await Promise.all([pipeline(Readable.from(frames()),proc.stdin),done]);
  await run(['-y','-hide_banner','-loglevel','error','-i',file,'-an','-c:v','libvpx-vp9','-threads','2','-b:v','0','-crf','33','-deadline','good','-cpu-used','3','-pix_fmt','yuv420p',path.join(out,key+'-720p.webm')]);
  for (const shot of snapshots) await sharp(shot.raw,{raw:{width:W,height:H,channels:3}}).resize(640).png().toFile(path.join(__dirname,`${key}-frame-${shot.second}s.png`));
  console.log(`${key}: MP4 + WebM complete`);
}
function support(key,cues){
  fs.writeFileSync(path.join(out,key+'-ko.vtt'),'WEBVTT\n\n'+cues.map((x,i)=>`00:00:${String(i*4).padStart(2,'0')}.000 --> 00:00:${String((i+1)*4).padStart(2,'0')}.000\n${x}\n`).join('\n'),'utf8');
  fs.writeFileSync(path.join(out,key+'-transcript.txt'),cues.map((x,i)=>`${i*4}–${(i+1)*4}초: ${x}`).join('\n')+'\n\n무음 영상. 화면의 핵심 문구와 순서를 위에 기록했습니다.\n','utf8');
}
(async()=>{
  for(const scene of montageScenes) photoCache.push(await sharp(path.join(imgRoot,'photos',scene.photo)).resize(684,456,{fit:'cover'}).png().toBuffer());
  await encode('landing-family-library-story',montageFrame);
  await encode('add-photo-three-step-guide',guideFrame);
  support('landing-family-library-story',['우리집 서재: 집 안의 책을 한곳에 모아 가족의 서재를 만듭니다.','완독과 별점, 마음에 남은 문장을 가족의 독서 기록으로 남깁니다.','나누고 싶은 책을 공개하고 동네 이웃과 함께 읽습니다.']);
  support('add-photo-three-step-guide',['1. 책장 한 칸을 정면에서 촬영합니다. 책등 전체가 선명하게 보이도록 밝은 곳에서 찍습니다.','2. 판독한 목록의 제목·ISBN·중복 여부를 확인하고 수정합니다. 책을 꽂을 위치도 확인합니다.','3. 확인한 책만 서재에 등록합니다. 서버 저장 완료 표시를 확인합니다.']);
  const metadata=[];
  for(const key of ['landing-family-library-story','add-photo-three-step-guide']){
    const isStory=key.startsWith('landing');
    const common={pages:isStory?['/','/#how']:['/add/photo','/#how'],placement:isStory?'랜딩 사용 방법 근처의 사용자 재생형 소개 영상':'사진 업로드 전 촬영·검토·등록 안내, 사용자 재생',alt:isStory?'가족 독서, 독서 기록, 이웃 책 나눔을 소개하는 12초 사진 편집 영상':'책장 촬영, 판독 목록 확인, 등록의 세 단계를 설명하는 12초 모션그래픽',objectFit:'contain',origin:isStory?'AI-generated still photos edited into a video; original typography and camera pans':'Original vector motion graphics; procedural SVG frames',durationSeconds:DURATION,fps:FPS,audio:false,poster:`video/${key}-poster.webp`,captions:`video/${key}-ko.vtt`,transcript:`video/${key}-transcript.txt`,motion:{durationMs:DURATION*1000,iterations:1,trigger:'user controls',reducedMotion:'poster until explicit play'}};
    for(const ext of ['mp4','webm']){const file=`video/${key}-720p.${ext}`;metadata.push({id:`${key}-720p-${ext}`,file,type:ext,width:W,height:H,bytes:fs.statSync(path.join(imgRoot,file)).size,...common,codec:ext==='mp4'?'h264':'vp9'})}
    const file=`video/${key}-poster.webp`;metadata.push({id:`${key}-poster`,file,type:'webp',width:W,height:H,bytes:fs.statSync(path.join(imgRoot,file)).size,pages:common.pages,placement:'영상 재생 전 포스터 및 동작 줄이기 대체 이미지',alt:common.alt,objectFit:'contain',origin:common.origin,motion:null});
  }
  fs.writeFileSync(path.join(__dirname,'video-metadata.json'),JSON.stringify(metadata,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
