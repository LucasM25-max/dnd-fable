#!/usr/bin/env python3
"""Dev tool: perspective splat render of the whole hub scene from the real
camera pose (eye 0,172,470 looking at 0,108,0).

  python3 scripts/scene-preview.py /tmp/scene.json /tmp/scene.png
"""
import json, math, sys
from PIL import Image, ImageDraw

def main():
    data = json.load(open(sys.argv[1]))
    out = sys.argv[2]
    eye = (0.0, 172.0, 470.0)
    tgt = (0.0, 108.0, 0.0)
    fov = 38.0
    W, H = 1280, 800

    fw = [tgt[i] - eye[i] for i in range(3)]
    fn = math.sqrt(sum(c * c for c in fw))
    fw = [c / fn for c in fw]
    up = (0.0, 1.0, 0.0)
    rt = [fw[1] * up[2] - fw[2] * up[1], fw[2] * up[0] - fw[0] * up[2], fw[0] * up[1] - fw[1] * up[0]]
    rn = math.sqrt(sum(c * c for c in rt))
    rt = [c / rn for c in rt]
    u2 = [rt[1] * fw[2] - rt[2] * fw[1], rt[2] * fw[0] - rt[0] * fw[2], rt[0] * fw[1] - rt[1] * fw[0]]

    focal = (H / 2) / math.tan(math.radians(fov) / 2)

    pts = []
    for x, y, z, r, g, b, s in data['voxels']:
        cx, cy, cz = x + s / 2, y + s / 2, z + s / 2
        px, py, pz = cx - eye[0], cy - eye[1], cz - eye[2]
        d = px * fw[0] + py * fw[1] + pz * fw[2]
        if d < 5:
            continue
        hx = px * rt[0] + py * rt[1] + pz * rt[2]
        hy = px * u2[0] + py * u2[1] + pz * u2[2]
        sx = W / 2 + hx * focal / d
        sy = H / 2 - hy * focal / d
        rad = max(0.6, s * focal / d * 0.55)
        pts.append((d, sx, sy, rad, r, g, b))
    pts.sort(key=lambda p: -p[0])  # far first

    img = Image.new('RGB', (W, H), (13, 10, 8))
    dr = ImageDraw.Draw(img)
    far = pts[0][0] if pts else 1
    for d, sx, sy, rad, r, g, b in pts:
        if sx < -40 or sx > W + 40 or sy < -40 or sy > H + 40:
            continue
        fog = max(0.0, min(1.0, (d - 500) / 1100))
        f = 1 - fog * 0.85
        dr.rectangle([sx - rad, sy - rad, sx + rad, sy + rad],
                     fill=(int(r * f + 13 * fog * 0.85), int(g * f + 10 * fog * 0.85), int(b * f + 8 * fog * 0.85)))
    img.save(out)
    print('wrote', out, len(pts), 'splats')

main()
