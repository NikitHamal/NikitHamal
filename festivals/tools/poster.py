"""Poster frame + a 4x4 contact sheet from the rendered frames: python3 tools/poster.py dashain"""
import sys, os, glob
from PIL import Image
film = sys.argv[1]; root = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); fr = sorted(glob.glob(f'{root}/frames_{film}/*.jpg'))
Image.open(fr[int(len(fr) * 0.93)]).save(f'{root}/out/{film}_poster.jpg', quality=92)
pick = [fr[int(i * (len(fr) - 1) / 15)] for i in range(16)]; tw, th = 270, 480; sheet = Image.new('RGB', (tw * 8 + 90, th * 2 + 30), (16, 16, 16))
for i, p in enumerate(pick): sheet.paste(Image.open(p).resize((tw, th)), (10 + (i % 8) * (tw + 10), 10 + (i // 8) * (th + 10)))
sheet.save(f'{root}/out/{film}_contact_sheet.jpg', quality=88)
