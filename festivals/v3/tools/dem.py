#!/usr/bin/env python3
"""Elevation for the relief map: AWS Terrain Tiles (Terrarium PNG, public, no key; SRTM/GMTED-derived) at zoom 8 over
Nepal, decoded and resampled to a regular lon/lat grid -> build/dem.npy (metres, row 0 = north) + build/dem.json (bounds)."""
import io, json, math, os, urllib.request
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); Z = 8
LON0, LON1, LAT0, LAT1 = 79.9, 88.4, 26.2, 30.6


def tile_xy(lon, lat):
    n = 2 ** Z; x = (lon + 180) / 360 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def main():
    x0, y0 = tile_xy(LON0, LAT1); x1, y1 = tile_xy(LON1, LAT0)
    tx = range(int(x0), int(x1) + 1); ty = range(int(y0), int(y1) + 1)
    big = np.zeros((len(ty) * 256, len(tx) * 256), np.float32)
    for j, y in enumerate(ty):
        for i, x in enumerate(tx):
            url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{x}/{y}.png"
            im = np.asarray(Image.open(io.BytesIO(urllib.request.urlopen(url, timeout=60).read())).convert("RGB")).astype(np.float32)
            big[j * 256:(j + 1) * 256, i * 256:(i + 1) * 256] = im[..., 0] * 256 + im[..., 1] + im[..., 2] / 256 - 32768
    W, H = 2400, 1300
    lons = np.linspace(LON0, LON1, W); lats = np.linspace(LAT1, LAT0, H)
    X = np.array([tile_xy(lo, 0)[0] for lo in lons]); Y = np.array([tile_xy(0, la)[1] for la in lats])
    ci = np.clip(((X - tx[0]) * 256).astype(int), 0, big.shape[1] - 1); ri = np.clip(((Y - ty[0]) * 256).astype(int), 0, big.shape[0] - 1)
    dem = big[ri][:, ci]
    os.makedirs(f"{HERE}/build", exist_ok=True)
    np.save(f"{HERE}/build/dem.npy", dem)
    json.dump({"bounds": [LON0, LON1, LAT0, LAT1], "max": float(dem.max()), "source": "AWS Terrain Tiles (terrarium), z8"}, open(f"{HERE}/build/dem.json", "w"))
    print("dem", dem.shape, dem.min(), dem.max())


main()
