"""Rebuild audio/wav/ from the download URLs listed in audio/SOURCES.md (the licensed files themselves are not committed:
Mixkit's licence forbids redistributing its sounds on their own). Converts every file to 48 kHz stereo WAV.
  python3 tools/fetch_audio.py          (skips files already present)"""
import os, re, subprocess, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); A = os.path.join(ROOT, 'audio'); W = os.path.join(A, 'wav'); os.makedirs(W, exist_ok=True)
EXCERPT = {'music_nepali_bansuri_dhun_solo': (60, 30)}   # the bansuri solo is used as a 30 s excerpt from 1:00
for line in open(os.path.join(A, 'SOURCES.md'), encoding='utf-8'):
    m = re.match(r'\|\s*`wav/([^`]+)\.wav`\s*\|', line)
    if not m: continue
    name = m.group(1); dst = os.path.join(W, name + '.wav')
    if os.path.exists(dst): continue
    url = next((u for u in re.findall(r'https://[^\s|)]+', line) if re.search(r'\.(mp3|wav|ogg|flac)$', u, re.I)), None)
    if not url: print('no direct URL for', name); continue
    tmp = os.path.join(W, name + '.src'); req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    open(tmp, 'wb').write(urllib.request.urlopen(req, timeout=120).read())
    cut = ['-ss', str(EXCERPT[name][0]), '-t', str(EXCERPT[name][1])] if name in EXCERPT else []
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *cut, '-i', tmp, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', dst], check=True); os.remove(tmp); print('fetched', name)
