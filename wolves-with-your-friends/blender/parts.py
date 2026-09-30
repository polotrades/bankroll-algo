"""Reusable character parts: eyes, bodies, legs, watches, phones."""
import math

from lib import *  # noqa

R = math.radians


def M():
    """Common materials (created once per scene)."""
    return dict(
        white=mat("White", (0.95, 0.95, 0.92), 0.4),
        black=mat("Black", (0.02, 0.02, 0.02), 0.3),
        shiny=mat("ShinyBlack", (0.01, 0.01, 0.01), 0.15),
        pupil=mat("Pupil", (0.01, 0.01, 0.02), 0.1),
        spark=mat("Spark", (1, 1, 1), 0.1, emit=3),
        mouth=mat("Mouth", (0.35, 0.05, 0.05), 0.5),
        tongue=mat("Tongue", (0.9, 0.35, 0.4), 0.5),
        steel=mat("Steel", (0.8, 0.8, 0.83), 0.2, metal=1),
        bling=mat("Bling", (1.0, 0.8, 0.3), 0.12, metal=1.0),
        sweat=mat("Sweat", (0.45, 0.75, 1.0), 0.05),
        diamond=mat("Diamond", (0.9, 0.97, 1.0), 0.02, emit=1.2),
    )


def glass_mat():
    g = bpy.data.materials.get("DialGlass")
    if not g:
        g = mat("DialGlass", (0.9, 0.95, 1.0), 0.02)
        g.node_tree.nodes["Principled BSDF"].inputs["Transmission Weight"].default_value = 1.0
    return g


def eye(prefix, x, y, z, r, par, look=(0, 0), pupil_scale=0.38, lashes=None, iris=None):
    m = M()
    sphere(prefix + "White", r, (x, y, z), (1, 0.55, 1.1), m["white"], par, width=0.008)
    px, pz = look
    if iris:
        sphere(prefix + "Iris", r * pupil_scale * 1.5, (x + px, y - r * 0.5, z + pz), (1, 0.45, 1), iris, par,
               outline=False)
    sphere(prefix + "Pupil", r * pupil_scale, (x + px, y - r * 0.54, z + pz), (1, 0.5, 1), m["pupil"], par,
           outline=False)
    sphere(prefix + "Spark", r * 0.1, (x + px + r * 0.12, y - r * 0.64, z + pz + r * 0.15), (1, 0.5, 1), m["spark"],
           par, outline=False)
    if lashes:
        side = 1 if x > 0 else -1
        for i in range(3):
            cone(prefix + "Lash", 0.012, 0, 0.07, (x + side * (r * 0.4 + i * 0.03), y - r * 0.3, z + r * 1.0 - i * 0.02),
                 lashes, par, rot=(R(-20), R(side * (25 + 20 * i)), 0), outline=False)


def torso(name, par, m, core, core_r, arms, arm_r):
    """Core chain (hip, belly, chest, neck) + arm chains branching from the chest: one continuous mesh."""
    verts, radii = list(core), list(core_r)
    edges = [(i, i + 1) for i in range(len(core) - 1)]
    for arm in arms:
        base = len(verts)
        for j, p in enumerate(arm):
            verts.append(p)
            radii.append(arm_r[j] if not isinstance(arm_r[0], list) else arm_r[arms.index(arm)][j])
            edges.append((2 if j == 0 else base + j - 1, base + j))
    return skin(name, verts, edges, radii, m, par)


def legs(name, par, m, pelvis, pelvis_r, chains, leg_r):
    """Hips as a smooth rounded piece, each leg its own limb growing out of it (no crotch flaps)."""
    rx, ry = pelvis_r if isinstance(pelvis_r, tuple) else (pelvis_r, pelvis_r)
    sphere(name + "Hips", 1, (pelvis[0], pelvis[1], pelvis[2] - 0.03), (rx * 1.05, ry * 1.1, rx * 0.55), m, par)
    for ch in chains:
        top = (ch[0][0] * 0.9, ch[0][1], pelvis[2] - 0.02)
        limb(name + "Leg", par, m, [top] + ch, [leg_r[0] * 1.1] + list(leg_r))


def limb(name, par, m, pts, radii):
    return skin(name, pts, [(i, i + 1) for i in range(len(pts) - 1)], radii, m, par)


def fdir(a, b):
    return tuple(b[i] - a[i] for i in range(3))


def analog_watch(name, h, k, case_m, dial_m, band_m, hand_m, diamonds=False):
    """Analog watch on a hand frame: link bracelet, lugs, case, bezel, dial, markers, hands, crown, glass."""
    m = M()
    zc = 0.045 * k ** 0.3
    rx, ry = 0.034, 0.047
    R0 = 0.024 * k
    y0 = -ry - 0.004
    y1 = y0 - 0.014 * k
    for i in range(26):
        a = 2 * math.pi * i / 26
        px, py = rx * 1.12 * math.cos(a), ry * 1.12 * math.sin(a)
        if py < -ry * 0.75 and abs(px) < R0 * 0.8:
            continue
        cube(f"{name}Link", 1, (px, py, zc), (0.011, 0.007, 0.016 * min(k, 1.6)), band_m, h,
             rot=(0, 0, a + math.pi / 2), bevel=0.002, outline=False)
    for s in (-1, 1):
        for t in (-1, 1):
            cube(f"{name}Lug", 1, (s * R0 * 0.55, y0 + 0.004, zc + t * R0 * 0.95), (0.008, 0.012, 0.012 * k ** 0.5),
                 case_m, h, bevel=0.002, outline=False)
    tube(f"{name}Case", R0, (0, y0 + 0.006, zc), (0, y1, zc), case_m, h, width=0.004)
    torus(f"{name}Bezel", R0 * 0.93, R0 * 0.1, (0, y1, zc), case_m, h, rot=(R(90), 0, 0), outline=False)
    tube(f"{name}Dial", R0 * 0.84, (0, y1 + 0.002, zc), (0, y1 - 0.001, zc), dial_m, h, outline=False, smooth=False)
    for i in range(12):
        a = 2 * math.pi * i / 12
        big = i % 3 == 0
        rr = R0 * 0.68
        cube(f"{name}Marker", 1, (rr * math.sin(a), y1 - 0.0015, zc + rr * math.cos(a)),
             (0.0022 * k if big else 0.0014 * k, 0.001, (0.0075 if big else 0.005) * k), hand_m, h,
             rot=(0, -a, 0), bevel=0, outline=False)
        if diamonds:
            sphere(f"{name}Stone", 0.0026 * k, ((R0 * 0.93) * math.sin(a + 0.26), y1 - 0.003,
                                                zc + (R0 * 0.93) * math.cos(a + 0.26)), (1, 0.6, 1), m["diamond"], h,
                   outline=False)
    c = (0, y1 - 0.0025, zc)
    strip(f"{name}HourHand", c, (R0 * 0.3, y1 - 0.0025, zc + R0 * 0.3), 0.004 * k, 0.001, hand_m, h, outline=False)
    strip(f"{name}MinHand", c, (-R0 * 0.12, y1 - 0.003, zc + R0 * 0.62), 0.003 * k, 0.001, hand_m, h,
          outline=False)
    strip(f"{name}SecHand", c, (-R0 * 0.55, y1 - 0.0035, zc - R0 * 0.3), 0.0012 * k, 0.0008,
          mat("SecRed", (0.9, 0.1, 0.05), 0.4), h, outline=False)
    sphere(f"{name}Pin", 0.003 * k, (0, y1 - 0.004, zc), (1, 0.6, 1), hand_m, h, outline=False)
    tube(f"{name}Glass", R0 * 0.86, (0, y1 - 0.004, zc), (0, y1 - 0.0045, zc), glass_mat(), h, outline=False)
    tube(f"{name}Crown", 0.004 * k, (R0 * 0.98, (y0 + y1) / 2, zc), (R0 * 1.15, (y0 + y1) / 2, zc), case_m, h,
         outline=False)


def phone(name, par, loc, rot, screen_color=(0.1, 0.9, 0.4), case_color=(0.08, 0.08, 0.1), scale=1.0, arrow=True):
    """Smartphone with a glowing screen and a stonks arrow; local screen faces -Y before rotation."""
    e = empty(name, loc)
    e.parent = par
    e.rotation_euler = rot
    e.scale = (scale, scale, scale)
    cube(name + "Body", 1, (0, 0, 0), (0.075, 0.012, 0.15), mat(name + "Case", case_color, 0.3), e, bevel=0.01,
         width=0.004)
    cube(name + "Screen", 1, (0, -0.0065, 0), (0.066, 0.001, 0.138), mat("PhoneScreen", (0.03, 0.06, 0.08), 0.2,
                                                                           emit=0.4), e, bevel=0, outline=False)
    if arrow:
        g = mat("Stonks", screen_color, 0.3, emit=2.5)
        pts = [(-0.025, -0.008, -0.04), (-0.008, -0.008, -0.01), (0.004, -0.008, -0.025), (0.022, -0.008, 0.03)]
        for i in range(3):
            strip(name + "Line", pts[i], pts[i + 1], 0.006, 0.001, g, e, outline=False)
        cone(name + "Arrow", 0.012, 0, 0.022, (0.025, -0.008, 0.04), g, e, rot=(0, R(-20), 0), scale=(1, 0.2, 1),
             outline=False)
    tube(name + "Cam", 0.006, (0.022, 0.006, 0.06), (0.022, 0.009, 0.06), mat("Black", (0.02, 0.02, 0.02), 0.3), e,
         outline=False)
    return e
