"""Decode every frame and inspect delivered video files, not the source frames."""
from pathlib import Path
import os, sys, json, hashlib, struct, re, subprocess
sys.path.insert(0, str(Path('C:/hyper-v/.tools/video-python')))
import imageio_ffmpeg

DOC=Path(__file__).resolve().parent
ROOT=DOC.parents[1]
IMG=ROOT/'src/img'
FFMPEG=os.environ.get('FFMPEG_BINARY',imageio_ffmpeg.get_ffmpeg_exe())
os.environ['IMAGEIO_FFMPEG_EXE']=FFMPEG
assets=json.loads((DOC/'video-metadata.json').read_text(encoding='utf-8'))
checks=[]
def add(name,ok,detail): checks.append(dict(name=name,ok=bool(ok),detail=detail))
def atoms(path):
    result=[]
    with path.open('rb') as f:
        while True:
            pos=f.tell(); header=f.read(8)
            if len(header)<8: break
            size,kind=struct.unpack('>I4s',header)
            if size==1: size=struct.unpack('>Q',f.read(8))[0]
            result.append((kind.decode('ascii','replace'),pos))
            if size==0: break
            f.seek(pos+size)
    return dict(result)

for a in assets:
    if a['type'] not in ['mp4','webm']: continue
    path=IMG/a['file']
    reader=imageio_ffmpeg.read_frames(str(path),pix_fmt='rgb24')
    meta=next(reader); count=0; hashes=set()
    for frame in reader:
        count+=1
        hashes.add(hashlib.sha256(frame).digest())
    add('decode all frames: '+a['file'],count==288,dict(frames=count,distinctFrames=len(hashes),metadata=meta))
    add('video dimensions: '+a['file'],list(meta['size'])==[1280,720],meta['size'])
    add('frame rate and duration: '+a['file'],abs(meta['fps']-24)<.01 and abs(meta['duration']-12)<.1,dict(fps=meta['fps'],duration=meta['duration']))
    add('visible motion: '+a['file'],len(hashes)>60,{'distinctDecodedFrames':len(hashes)})
    info=subprocess.run([FFMPEG,'-hide_banner','-i',str(path)],capture_output=True,text=True).stderr
    add('codec and pixel format: '+a['file'],a['codec'] in info and 'yuv420p' in info,{'expectedCodec':a['codec'],'pixelFormat':'yuv420p'})
    add('silent track: '+a['file'],'Audio:' not in info,'No audio stream')
    add('video file budget: '+a['file'],path.stat().st_size<4*1024*1024,{'bytes':path.stat().st_size,'budgetBytes':4*1024*1024})
    if a['type']=='mp4':
        offsets=atoms(path)
        add('MP4 fast start: '+a['file'],'moov' in offsets and 'mdat' in offsets and offsets['moov']<offsets['mdat'],offsets)
        for sec in [1,5,9]:
            dest=DOC/f'{path.stem}-decoded-{sec}s.png'
            subprocess.run([FFMPEG,'-y','-hide_banner','-loglevel','error','-ss',str(sec),'-i',str(path),'-frames:v','1','-vf','scale=640:-1',str(dest)],check=True)
    for field in ['poster','captions','transcript']:
        add(field+': '+a['file'],(IMG/a[field]).is_file(),a[field])
    vtt=(IMG/a['captions']).read_text(encoding='utf-8')
    add('timed captions: '+a['file'],vtt.startswith('WEBVTT\n') and vtt.count('-->')==3 and '00:00:12.000' in vtt,'3 cues cover 0–12 seconds')

report=dict(date='2026-10-04',ffmpegVersion=imageio_ffmpeg.get_ffmpeg_version(),checks=checks,allPassed=all(c['ok'] for c in checks),limitations=['Decoded with FFmpeg, including samples from delivered MP4 files; no connected browser was available for native playback and cross-browser UI verification.','Silent editorial montage and procedural vector animation, not live-action generated video or a screen recording.'])
(DOC/'video-validation-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'checks':len(checks),'allPassed':report['allPassed'],'failures':[c for c in checks if not c['ok']]},ensure_ascii=False))
if not report['allPassed']:raise SystemExit(1)
