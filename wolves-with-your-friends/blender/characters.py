"""Hero characters: Rookie Broker and The Chairman. Run: python3 characters.py"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from lib import *  # noqa

OUT = os.path.join(os.path.dirname(__file__), "renders")
os.makedirs(OUT, exist_ok=True)
R = math.radians

reset()

SKIN = mat("Skin", (0.95, 0.52, 0.28), 0.55)
WHITE = mat("White", (0.95, 0.95, 0.92), 0.4)
BLACK = mat("Black", (0.02, 0.02, 0.02), 0.3)
SHINY_BLACK = mat("ShinyBlack", (0.01, 0.01, 0.01), 0.15)
PUPIL = mat("Pupil", (0.01, 0.01, 0.02), 0.1)
SPARK = mat("Spark", (1, 1, 1), 0.1, emit=3)
MOUTH = mat("Mouth", (0.35, 0.05, 0.05), 0.5)
TONGUE = mat("Tongue", (0.9, 0.35, 0.4), 0.5)
STEEL = mat("Steel", (0.8, 0.8, 0.83), 0.2, metal=1)
GLASS = mat("DialGlass", (0.9, 0.95, 1.0), 0.02)
GLASS.node_tree.nodes["Principled BSDF"].inputs["Transmission Weight"].default_value = 1.0
DIAMOND = mat("Diamond", (0.9, 0.97, 1.0), 0.02, emit=1.2)


def eye(prefix, x, y, z, r, par, look=(0, 0), pupil_scale=0.38):
    sphere(prefix + "White", r, (x, y, z), (1, 0.55, 1.1), WHITE, par, width=0.008)
    px, pz = look
    sphere(prefix + "Pupil", r * pupil_scale, (x + px, y - r * 0.52, z + pz), (1, 0.5, 1), PUPIL, par, outline=False)
    sphere(prefix + "Spark", r * 0.1, (x + px + r * 0.12, y - r * 0.62, z + pz + r * 0.15), (1, 0.5, 1), SPARK, par,
           outline=False)


def analog_watch(name, h, k, case_m, dial_m, band_m, hand_m, diamonds=False):
    """Realistic analog watch on a hand frame: link bracelet, lugs, case, bezel, dial, markers, hands, crown.
    Worn a little above the wrist (local +Z), face on the local -Y side."""
    zc = 0.045 * k ** 0.3
    rx, ry = 0.034, 0.047
    R0 = 0.024 * k  # case radius
    y0 = -ry - 0.004
    y1 = y0 - 0.014 * k
    # bracelet: 26 chunky links around the wrist, skipping behind the case
    for i in range(26):
        a = 2 * math.pi * i / 26
        px, py = rx * 1.12 * math.cos(a), ry * 1.12 * math.sin(a)
        if py < -ry * 0.75 and abs(px) < R0 * 0.8:
            continue
        cube(f"{name}Link", 1, (px, py, zc), (0.011, 0.007, 0.016 * min(k, 1.6)), band_m, h,
             rot=(0, 0, a + math.pi / 2), bevel=0.002, outline=False)
    for s in (-1, 1):  # lugs join case to bracelet
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
                                                zc + (R0 * 0.93) * math.cos(a + 0.26)), (1, 0.6, 1), DIAMOND, h,
                   outline=False)
    c = (0, y1 - 0.0025, zc)
    strip(f"{name}HourHand", c, (R0 * 0.3, y1 - 0.0025, zc + R0 * 0.3), 0.004 * k, 0.001, hand_m, h, outline=False)
    strip(f"{name}MinHand", c, (-R0 * 0.12, y1 - 0.003, zc + R0 * 0.62), 0.003 * k, 0.001, hand_m, h,
          outline=False)
    strip(f"{name}SecHand", c, (-R0 * 0.55, y1 - 0.0035, zc - R0 * 0.3), 0.0012 * k, 0.0008,
          mat("SecRed", (0.9, 0.1, 0.05), 0.4), h, outline=False)
    sphere(f"{name}Pin", 0.003 * k, (0, y1 - 0.004, zc), (1, 0.6, 1), hand_m, h, outline=False)
    tube(f"{name}Glass", R0 * 0.86, (0, y1 - 0.004, zc), (0, y1 - 0.0045, zc), GLASS, h, outline=False)
    tube(f"{name}Crown", 0.004 * k, (R0 * 0.98, (y0 + y1) / 2, zc), (R0 * 1.15, (y0 + y1) / 2, zc), case_m, h,
         outline=False)


def digital_watch(name, h, zc=0.045):
    """Cheap plastic digital watch: rubber strap, square case, green LCD time."""
    rubber = mat("Rubber", (0.06, 0.06, 0.07), 0.8)
    torus(f"{name}Strap", 0.042, 0.011, (0, 0, zc), rubber, h, scale=(0.85, 1.15, 1.4), width=0.004)
    cube(f"{name}Case", 1, (0, -0.056, zc), (0.05, 0.02, 0.046), rubber, h, bevel=0.006, width=0.004)
    screen = mat("LCD", (0.25, 0.45, 0.25), 0.3, emit=0.3)
    cube(f"{name}Screen", 1, (0, -0.066, zc), (0.036, 0.002, 0.026), screen, h, bevel=0, outline=False)
    text(f"{name}Time", "9:02", (0, -0.068, zc - 0.002), 0.017, mat("LCDText", (0.05, 0.1, 0.05), 0.5), h,
         extrude=0.0005)
    for s in (-1, 1):
        tube(f"{name}Button", 0.004, (s * 0.025, -0.056, zc + 0.012), (s * 0.03, -0.056, zc + 0.012), rubber, h,
             outline=False)


# ================================================================ Rookie Broker
rk = empty("RookieBroker", (-1.25, 0, 0))
SUIT_R = mat("RookieSuit", (0.33, 0.4, 0.52), 0.8)
SUIT_R2 = mat("RookieLapel", (0.24, 0.3, 0.4), 0.8)
PANTS_R = mat("RookiePants", (0.2, 0.24, 0.33), 0.85)
TIE_R = mat("RookieTie", (0.85, 0.12, 0.12), 0.5)
SHOE_R = mat("RookieShoe", (0.35, 0.18, 0.08), 0.35)
HAIR_R = mat("RookieHair", (0.2, 0.11, 0.05), 0.7)
SWEAT = mat("Sweat", (0.45, 0.75, 1.0), 0.05)

# pants: one mesh from the pelvis down to baggy cuffs pooling on the shoes
skin("RookiePants",
     [(0, 0, 0.66), (-0.16, 0, 0.58), (-0.18, -0.01, 0.35), (-0.18, 0, 0.13),
      (0.16, 0, 0.58), (0.18, -0.01, 0.35), (0.18, 0, 0.13)],
     [(0, 1), (1, 2), (2, 3), (0, 4), (4, 5), (5, 6)],
     [(0.3, 0.24), 0.15, 0.135, (0.16, 0.17), 0.15, 0.135, (0.16, 0.17)], PANTS_R, rk)
for s in (-1, 1):
    sphere("Shoe", 0.15, (0.18 * s, -0.08, 0.07), (0.9, 1.7, 0.55), SHOE_R, rk)

# jacket + sleeves: ONE mesh, so belly, chest, shoulders and arms flow together; far too big for him
skin("RookieJacket",
     [(0, 0, 0.6), (0, -0.03, 0.88), (0, 0, 1.15), (0, 0, 1.36),
      (-0.34, 0, 1.25), (-0.52, -0.04, 1.0), (-0.62, -0.1, 0.74),
      (0.34, 0, 1.25), (0.52, -0.04, 1.0), (0.62, -0.1, 0.74)],
     [(0, 1), (1, 2), (2, 3), (2, 4), (4, 5), (5, 6), (2, 7), (7, 8), (8, 9)],
     [(0.42, 0.36), (0.47, 0.4), (0.43, 0.34), (0.15, 0.13),
      0.19, 0.14, (0.15, 0.15), 0.19, 0.14, (0.15, 0.15)], SUIT_R, rk)
for s in (-1, 1):
    tube("SleeveCuff", 0.13, (0.605 * s, -0.093, 0.79), (0.622 * s, -0.103, 0.735), SUIT_R2, rk, smooth=True)
    strip("Lapel", (0.035 * s, -0.3, 1.33), (0.16 * s, -0.37, 1.0), 0.075, 0.018, SUIT_R2, rk)
    sphere("Button", 0.024, (0.045 * s, -0.43, 0.8 + 0.07 * (s + 1)), (1, 0.5, 1), BLACK, rk, outline=False)
sphere("ShirtV", 0.2, (0, -0.28, 1.2), (0.5, 0.3, 0.85), WHITE, rk, width=0.006)
cone("PocketSquare", 0.035, 0, 0.06, (-0.22, -0.335, 1.16), WHITE, rk, scale=(1, 0.35, 1), width=0.005)
strip("PocketSlit", (-0.28, -0.33, 1.13), (-0.16, -0.335, 1.13), 0.012, 0.012, SUIT_R2, rk, outline=False)
cube("NameTag", 1, (0.23, -0.37, 1.1), (0.15, 0.01, 0.065), WHITE, rk, bevel=0.005, outline=False,
     rot=(R(-8), 0, 0))
text("NameTagText", "ROOKIE", (0.23, -0.38, 1.1), 0.042, TIE_R, rk, rot=(R(82), 0, 0))

# hands peek out of the too-long sleeves; left wrist wears a cheap digital watch
hr = hand("RookieHandR", rk, (0.625, -0.105, 0.75), (0.05, -0.05, -1), SKIN, side=1, scale=1.35, xhint=(1, -1, 0))
hl = hand("RookieHandL", rk, (-0.625, -0.105, 0.75), (-0.05, -0.05, -1), SKIN, side=-1, scale=1.35, xhint=(1, 1, 0))
digital_watch("RookieWatch", hl, zc=0.0)

# tie: knot, down the belly, off the edge, along the floor
torus("Collar", 0.1, 0.035, (0, -0.02, 1.38), WHITE, rk)
sphere("TieKnot", 0.05, (0, -0.33, 1.32), (1, 0.7, 1), TIE_R, rk)
tie_path = [(0, -0.35, 1.29), (0, -0.44, 1.05), (0, -0.45, 0.85), (0, -0.41, 0.62), (0, -0.33, 0.35),
            (0, -0.3, 0.012), (0.04, -0.7, 0.012), (0.12, -1.05, 0.012)]
for i in range(len(tie_path) - 1):
    strip("Tie", tie_path[i], tie_path[i + 1], 0.13 if i else 0.09, 0.02, TIE_R, rk)
cone("TieTip", 0.075, 0, 0.12, (0.15, -1.16, 0.012), TIE_R, rk, rot=(R(90), 0, R(12)), scale=(1, 0.15, 1))

# neck grows up into the giant bobble head
skin("RookieNeck", [(0, 0, 1.3), (0, -0.01, 1.48), (0, -0.05, 1.62)], [(0, 1), (1, 2)],
     [0.07, 0.065, 0.11], SKIN, rk)
sphere("Head", 0.56, (0, 0, 2.02), (1, 0.88, 0.95), SKIN, rk)
sphere("TinyChin", 0.1, (0, -0.28, 1.52), (1.1, 1, 0.8), SKIN, rk)
eye("EyeL", -0.2, -0.36, 2.08, 0.22, rk, look=(0.03, -0.02))
eye("EyeR", 0.21, -0.36, 2.1, 0.24, rk, look=(-0.02, 0.03))
for s, tilt in ((-1, -18), (1, 18)):
    cube("Brow", 1, (0.21 * s, -0.43, 2.4), (0.18, 0.04, 0.045), HAIR_R, rk, rot=(0, R(tilt), 0), bevel=0.015)
    sphere("Ear", 0.11, (0.55 * s, 0, 2.0), (0.5, 0.8, 1), SKIN, rk)
sphere("Nose", 0.07, (0, -0.52, 1.92), (1, 0.9, 0.9), SKIN, rk)
sphere("Mouth", 0.1, (0, -0.44, 1.74), (1, 0.45, 0.35), MOUTH, rk, rot=(0, R(8), 0))
cube("Teeth", 1, (0, -0.475, 1.765), (0.12, 0.01, 0.025), WHITE, rk, bevel=0.005, outline=False)
sphere("HairCap", 0.52, (0, 0.05, 2.25), (1.02, 0.9, 0.55), HAIR_R, rk)
for x, y, rx, ry in [(-0.25, -0.2, -25, -20), (0, -0.25, -35, 0), (0.25, -0.15, -20, 25),
                     (0.1, 0.15, 25, 10), (-0.15, 0.2, 30, -15)]:
    cone("HairSpike", 0.1, 0, 0.3, (x, y, 2.5), HAIR_R, rk, rot=(R(rx), R(ry), 0))
sphere("Sweat", 0.06, (0.48, -0.3, 2.3), (1, 0.6, 1.2), SWEAT, rk)
cone("SweatTip", 0.058, 0, 0.1, (0.48, -0.3, 2.39), SWEAT, rk, scale=(1, 0.6, 1))

# ================================================================ The Chairman
ch = empty("TheChairman", (1.25, 0, 0))
GOLD = mat("GoldSuit", (1.0, 0.7, 0.2), 0.35, metal=0.45)
GOLD_D = mat("GoldLapel", (0.75, 0.45, 0.08), 0.3, metal=0.9)
BLING = mat("Bling", (1.0, 0.8, 0.3), 0.12, metal=1.0)
SK_CH = mat("SkinChairman", (0.93, 0.58, 0.36), 0.5)
SILVER = mat("SilverHair", (0.78, 0.78, 0.82), 0.3)
SILVER_D = mat("SilverHairDark", (0.55, 0.55, 0.6), 0.3)
SHIRT_B = mat("ShirtBlack", (0.05, 0.05, 0.06), 0.6)
TIE_C = mat("ChairTie", (0.7, 0.05, 0.08), 0.4)
BLACK_DIAL = mat("BlackDial", (0.02, 0.02, 0.03), 0.15)

skin("ChairmanPants",
     [(0, 0, 0.58), (-0.14, 0, 0.5), (-0.14, -0.01, 0.3), (-0.13, 0, 0.1),
      (0.14, 0, 0.5), (0.14, -0.01, 0.3), (0.13, 0, 0.1)],
     [(0, 1), (1, 2), (2, 3), (0, 4), (4, 5), (5, 6)],
     [(0.28, 0.22), 0.12, 0.1, 0.1, 0.12, 0.1, 0.1], GOLD, ch)
for s in (-1, 1):
    sphere("Shoe", 0.13, (0.13 * s, -0.06, 0.06), (0.85, 1.6, 0.5), SHINY_BLACK, ch)

# massive chest, belly and arms as ONE gold mesh; right arm raised with the mic, left forearm forward to flex the watch
skin("ChairmanJacket",
     [(0, 0, 0.55), (0, -0.06, 0.85), (0, -0.02, 1.2), (0, 0, 1.5),
      (0.46, 0, 1.36), (0.76, -0.1, 1.42), (0.86, -0.2, 1.72),
      (-0.46, 0, 1.36), (-0.74, -0.24, 1.1), (-0.54, -0.45, 1.115)],
     [(0, 1), (1, 2), (2, 3), (2, 4), (4, 5), (5, 6), (2, 7), (7, 8), (8, 9)],
     [(0.34, 0.28), (0.62, 0.52), (0.64, 0.5), (0.2, 0.18),
      0.22, 0.16, 0.14, 0.22, 0.16, 0.14], GOLD, ch)
tube("CuffR", 0.125, (0.858, -0.196, 1.69), (0.864, -0.206, 1.73), WHITE, ch, smooth=True)
tube("CuffL", 0.112, (-0.555, -0.435, 1.115), (-0.53, -0.462, 1.115), WHITE, ch, smooth=True)
tube("ForearmL", 0.058, (-0.55, -0.44, 1.115), (-0.37, -0.63, 1.12), SK_CH, ch, r2=0.05, smooth=True)
sphere("ShirtV", 0.22, (0, -0.42, 1.3), (0.55, 0.3, 0.85), SHIRT_B, ch, width=0.006)
for s in (-1, 1):
    strip("Lapel", (0.045 * s, -0.46, 1.48), (0.25 * s, -0.52, 1.02), 0.13, 0.03, GOLD_D, ch)
    sphere("Button", 0.03, (0.06 * s, -0.6, 0.78 + 0.08 * (s + 1)), (1, 0.5, 1), BLING, ch, outline=False)
sphere("TieKnot", 0.05, (0, -0.49, 1.45), (1, 0.7, 1), TIE_C, ch)
strip("Tie", (0, -0.5, 1.42), (0, -0.56, 1.08), 0.11, 0.02, TIE_C, ch)
cone("TieTip", 0.06, 0, 0.09, (0, -0.565, 1.04), TIE_C, ch, rot=(R(180), 0, 0), scale=(1, 0.3, 1))
torus("GoldChain", 0.24, 0.022, (0, -0.25, 1.42), BLING, ch, rot=(R(60), 0, 0), scale=(1, 1.1, 1))
sphere("ChainMedal", 0.07, (0, -0.53, 1.25), (1, 0.35, 1), BLING, ch)
text("MedalW", "W", (0, -0.565, 1.25), 0.07, SHIRT_B, ch)

# big hands: a fist around the mic, and an open hand under the enormous watch
fist = hand("ChairmanFist", ch, (0.87, -0.22, 1.76), (0.1, -0.2, 1), SK_CH, side=1, scale=1.45, pose="fist",
            xhint=(-1, 0, 0))
tube("MicHandle", 0.022, (0.045, 0.06, -0.12), (0.045, -0.12, -0.12), SHINY_BLACK, fist, r2=0.03)
tube("MicRing", 0.036, (0.045, -0.12, -0.12), (0.045, -0.14, -0.12), STEEL, fist, width=0.004)
sphere("MicHead", 0.065, (0.045, -0.19, -0.12), (1, 1.1, 1), STEEL, fist)
for i in range(5):  # grille lines
    torus("MicGrille", 0.064 * math.sin(math.radians(30 + 30 * i)), 0.003,
          (0.045, -0.19 - 0.064 * math.cos(math.radians(30 + 30 * i)), -0.12), BLACK, fist, rot=(R(90), 0, 0),
          outline=False)
lh = hand("ChairmanHandL", ch, (-0.37, -0.63, 1.12), (0.37, -0.37, 0.02), SK_CH, side=1, scale=1.4, xhint=(0, 0, 1))
analog_watch("GoldWatch", lh, 2.4, BLING, BLACK_DIAL, BLING, BLING, diamonds=True)

# human head: tan, schemer grin, gold tooth
skin("ChairmanNeck", [(0, 0, 1.42), (0, -0.02, 1.6), (0, -0.05, 1.7)], [(0, 1), (1, 2)],
     [0.13, 0.13, 0.15], SK_CH, ch)
sphere("Head", 0.46, (0, -0.02, 1.98), (1.0, 0.9, 1.02), SK_CH, ch)
sphere("Jowls", 0.3, (0, -0.14, 1.76), (1.25, 0.95, 0.6), SK_CH, ch)
eye("EyeL", -0.16, -0.36, 2.04, 0.12, ch, look=(0.02, 0), pupil_scale=0.42)
eye("EyeR", 0.16, -0.36, 2.04, 0.12, ch, look=(-0.02, 0), pupil_scale=0.42)
for s in (-1, 1):
    sphere("SchemeLid", 0.125, (0.16 * s, -0.355, 2.085), (1.03, 0.6, 0.5), SK_CH, ch, width=0.006)
    sphere("BushyBrow", 0.09, (0.17 * s, -0.41, 2.2), (1.7, 0.6, 0.55), SILVER, ch, rot=(0, R(22 * s), 0))
    sphere("Ear", 0.1, (0.44 * s, 0, 1.98), (0.5, 0.8, 1), SK_CH, ch)
    sphere("Sideburn", 0.08, (0.38 * s, -0.08, 1.9), (0.6, 0.8, 1.6), SILVER, ch)
sphere("Nose", 0.09, (0, -0.5, 1.94), (0.95, 1, 1.1), SK_CH, ch)
sphere("Grin", 0.2, (0, -0.4, 1.75), (1.25, 0.6, 0.45), MOUTH, ch)
cube("TeethTop", 1, (0, -0.505, 1.8), (0.32, 0.02, 0.045), WHITE, ch, bevel=0.01, outline=False)
cube("TeethBottom", 1, (0, -0.49, 1.7), (0.26, 0.02, 0.035), WHITE, ch, bevel=0.01, outline=False)
cube("GoldTooth", 1, (0.07, -0.515, 1.8), (0.05, 0.022, 0.046), BLING, ch, bevel=0.008, outline=False)
sphere("ToothGleam", 0.02, (-0.1, -0.53, 1.82), (1.4, 0.4, 1.4), SPARK, ch, outline=False)
# slicked-back silver hair: every strand under control
sphere("HairBack", 0.46, (0, 0.05, 2.12), (1.03, 1.0, 0.62), SILVER, ch)
sphere("HairFront", 0.26, (0, -0.25, 2.3), (1.45, 0.9, 0.55), SILVER, ch, rot=(R(-15), 0, 0))
for i in range(5):
    strip("CombLine", (-0.2 + 0.1 * i, -0.36, 2.34), (-0.22 + 0.11 * i, 0.15, 2.46), 0.008, 0.006, SILVER_D, ch,
          outline=False)
sphere("Shine", 0.05, (0.1, -0.38, 2.4), (2.2, 0.6, 0.4), SPARK, ch, outline=False)

studio(cam_loc=(0.3, -7.2, 2.1), target=(0, 0, 1.35), lens=50)
text("Title", "WOLVES WITH YOUR FRIENDS", (0, 3.95, 3.3), 0.32, mat("Logo", (1, 0.75, 0.25), 0.3, emit=1.5))
render(os.path.join(OUT, "heroes_front.png"), x=1000, y=750, samples=32)

# close-ups of the hands and watches
cam = bpy.context.scene.camera
for nm, loc, tgt in [("watch_chairman", (0.9, -2.0, 1.3), (0.88, -0.62, 1.12)),
                     ("hands_rookie", (-1.9, -1.8, 0.9), (-1.85, -0.1, 0.72))]:
    cam.location = loc
    cam.rotation_quaternion = (Vector(tgt) - Vector(loc)).to_track_quat("-Z", "Y")
    render(os.path.join(OUT, nm + ".png"), x=800, y=600, samples=32)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(os.path.dirname(__file__), "heroes.blend"))
print("DONE")
