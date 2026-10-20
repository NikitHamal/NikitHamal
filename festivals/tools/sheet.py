"""Contact sheet: python3 tools/sheet.py out.png img1 img2 ... (fits each into a 540px-tall cell, one row)"""
import sys
from PIL import Image
out, files = sys.argv[1], sys.argv[2:]; H = 540
ims = [Image.open(f).convert('RGB') for f in files]; ims = [i.resize((round(i.width * H / i.height), H), Image.LANCZOS) for i in ims]
sheet = Image.new('RGB', (sum(i.width for i in ims) + 10 * (len(ims) + 1), H + 20), (30, 30, 30)); x = 10
for i in ims: sheet.paste(i, (x, 10)); x += i.width + 10
sheet.save(out)
