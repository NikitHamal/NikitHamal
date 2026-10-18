import sys, glob, os
from PIL import Image, ImageDraw
d = sys.argv[1]; fs = sorted(glob.glob(d + '/*.jpg')); cols = 5; tw = 384; th = 216
rows = (len(fs) + cols - 1) // cols; sh = Image.new('RGB', (cols * tw, rows * (th + 18)), (20, 20, 20)); dr = ImageDraw.Draw(sh)
for i, f in enumerate(fs):
    im = Image.open(f).resize((tw, th)); x, y = (i % cols) * tw, (i // cols) * (th + 18); sh.paste(im, (x, y)); n = int(os.path.basename(f)[:4]); dr.text((x + 4, y + th + 3), f'f{n}  {n/60:.2f}s', fill=(230, 230, 230))
sh.save(sys.argv[2])
