import sys, json, numpy as np, cv2, mediapipe as mp
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision
from PIL import Image
def analyze(path, out):
    im = np.asarray(Image.open(path).convert('RGB')); H, W = im.shape[:2]
    mimg = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(im))
    fl = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(base_options=mpt.BaseOptions(model_asset_path='/tmp/mp/face_landmarker.task'), num_faces=1))
    r = fl.detect(mimg); lm = [(p.x * W, p.y * H) for p in r.face_landmarks[0]] if r.face_landmarks else None
    seg = vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(base_options=mpt.BaseOptions(model_asset_path='/tmp/mp/multiclass.tflite'), output_category_mask=True))
    cm = seg.segment(mimg).category_mask.numpy_view().copy().squeeze()
    np.save(out + '_cat.npy', cm); json.dump({'W': W, 'H': H, 'lm': lm}, open(out + '_lm.json', 'w'))
    vis = im.copy(); pal = np.array([[255,255,255],[60,30,20],[230,180,140],[250,200,160],[80,120,200],[0,200,0]])
    vis = (0.5 * vis + 0.5 * pal[cm]).astype(np.uint8)
    if lm:
        for x, y in lm: cv2.circle(vis, (int(x), int(y)), 1, (255, 0, 0), -1)
    Image.fromarray(vis).save(out + '_vis.png'); print(path, W, H, 'face' if lm else 'NO FACE', np.bincount(cm.ravel(), minlength=6))
for s in sys.argv[1:]:
    # use the raw (un-cut) crop so segmentation sees full context
    analyze(f'/tmp/paint/ref/{s}_st.png', f'/tmp/mp/{s}')
