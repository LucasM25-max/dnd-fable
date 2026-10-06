#!/usr/bin/env python3
"""Dev tool: painter's-algorithm splat renderer for voxel JSON dumps,
so the fighter model can be eyeballed without a browser.

  python3 scripts/preview.py /tmp/fighter.json /tmp/fighter
"""
import json, math, sys
from PIL import Image, ImageDraw

def render(voxels, view, out, scale=2.6, pad=24):
    vx, vy, vz = view
    n = math.sqrt(vx*vx + vy*vy + vz*vz)
    vx, vy, vz = vx/n, vy/n, vz/n
    # up bias = +y
    ux, uy, uz = 0, 1, 0
    # right = up x view
    rx, ry, rz = uy*vz - uz*vy, uz*vx - ux*vz, ux*vy - uy*vx
    rn = math.sqrt(rx*rx + ry*ry + rz*rz) or 1
    rx, ry, rz = rx/rn, ry/rn, rz/rn
    # true up = view x right
    tx, ty, tz = vy*rz - vz*ry, vz*rx - vx*rz, vx*ry - vy*rx

    pts = []
    for x, y, z, r, g, b in voxels:
        px = x*rx + y*ry + z*rz
        py = x*tx + y*ty + z*tz
        pd = x*vx + y*vy + z*vz
        pts.append((pd, px, py, r, g, b))
    pts.sort(key=lambda p: p[0])  # far -> near

    minx = min(p[1] for p in pts); maxx = max(p[1] for p in pts)
    miny = min(p[2] for p in pts); maxy = max(p[2] for p in pts)
    W = int((maxx - minx) * scale) + pad * 2
    H = int((maxy - miny) * scale) + pad * 2
    img = Image.new('RGB', (W, H), (20, 16, 13))
    dr = ImageDraw.Draw(img)
    c = scale * 0.62
    for pd, px, py, r, g, b in pts:
        sx = (px - minx) * scale + pad
        sy = (maxy - py) * scale + pad
        # cheap depth shade
        f = 0.75 + 0.25 * max(0.0, min(1.0, (pd - pts[0][0]) / 40.0))
        dr.rectangle([sx - c, sy - c, sx + c, sy + c],
                     fill=(int(r*f), int(g*f), int(b*f)))
    img.save(out)
    print('wrote', out, f'{W}x{H}')

data = json.load(open(sys.argv[1]))
base = sys.argv[2]
v = data['voxels']
render(v, (0.0, -0.05, 1.0), base + '_front.png')       # front
render(v, (1.0, -0.05, 0.0), base + '_side.png')        # his right side
render(v, (0.45, -0.12, 1.0), base + '_tq.png')         # three-quarter
head = [p for p in v if p[1] > 148]
render(head, (0.0, -0.05, 1.0), base + '_face.png', scale=10.0)  # closeup
