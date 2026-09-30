"""The rest of the cast: Intern, Crypto Bro, CEO, Security Guard, Receptionist (all human).
Run: python3 cast.py"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from parts import *  # noqa

OUT = os.path.join(os.path.dirname(__file__), "renders")
os.makedirs(OUT, exist_ok=True)
R = math.radians

reset()
m = M()
WHITE, BLACK, SHINY, MOUTH, TONGUE, STEEL, BLING, SWEAT = (m[k] for k in (
    "white", "black", "shiny", "mouth", "tongue", "steel", "bling", "sweat"))
XS = [-3.2, -1.6, 0.0, 1.6, 3.2]

# =================================================================== INTERN
it = empty("Intern", (XS[0], 0, 0))
SK = mat("SkinIntern", (0.98, 0.68, 0.45), 0.55)
SHIRT = mat("InternShirt", (0.82, 0.88, 1.0), 0.7)
KHAKI = mat("Khaki", (0.76, 0.62, 0.4), 0.85)
TIE_G = mat("InternTie", (0.2, 0.6, 0.25), 0.5)
HAIR_I = mat("InternHair", (0.08, 0.06, 0.05), 0.6)
BAG = mat("Backpack", (0.95, 0.45, 0.1), 0.7)
BAG2 = mat("BackpackDark", (0.55, 0.22, 0.05), 0.7)
SOCK = mat("Sock", (0.85, 0.15, 0.2), 0.9)
CARD = mat("Cardboard", (0.72, 0.55, 0.33), 0.9)
COFFEE = mat("Coffee", (0.3, 0.16, 0.06), 0.2)
FRECKLE = mat("Freckle", (0.75, 0.4, 0.2), 0.7)

legs("InternLegs", it, KHAKI, (0, 0, 0.62), (0.2, 0.16),
     [[(-0.1, 0, 0.56), (-0.11, -0.01, 0.33), (-0.11, 0, 0.1)],
      [(0.1, 0, 0.56), (0.11, -0.01, 0.33), (0.11, 0, 0.1)]], [0.085, 0.075, 0.07])
sphere("Sneaker", 0.12, (0.11, -0.06, 0.06), (0.85, 1.6, 0.6), WHITE, it)
cube("Sole", 1, (0.11, -0.06, 0.018), (0.2, 0.37, 0.035), mat("Sole", (0.3, 0.3, 0.32), 0.8), it, bevel=0.015)
for i in range(3):
    strip("Lace", (0.08, -0.12 - 0.035 * i, 0.12 - 0.01 * i), (0.14, -0.12 - 0.035 * i, 0.12 - 0.01 * i), 0.012,
          0.008, BLACK, it, outline=False)
# missing shoe: striped sock with a toe poking out of a hole
sphere("SockFoot", 0.1, (-0.11, -0.05, 0.055), (0.78, 1.5, 0.55), SOCK, it)
for z in (0.12, 0.16):
    torus("SockStripe", 0.072, 0.012, (-0.11, 0, z), WHITE, it, outline=False)
sphere("Toe", 0.032, (-0.11, -0.2, 0.06), (1, 1, 0.9), SK, it)

torso("InternShirt", it, SHIRT, [(0, 0, 0.6), (0, -0.01, 0.8), (0, 0, 1.02), (0, 0, 1.2)],
      [(0.2, 0.16), (0.22, 0.17), (0.24, 0.17), (0.08, 0.07)],
      [[(-0.22, 0, 1.08), (-0.3, -0.02, 0.97)], [(0.22, 0, 1.08), (0.3, -0.02, 0.97)]], [0.09, 0.085])
for s in (-1, 1):
    el, wr = (0.33 * s, -0.1, 0.82), (0.2 * s, -0.34, 0.9)
    limb("InternArm", it, SK, [(0.29 * s, -0.02, 0.99), el, wr], [0.055, 0.05, 0.042])
    hand("InternHand", it, wr, fdir(el, wr), SK, side=s, scale=1.1, xhint=(0, 0, -s))
torus("Collar", 0.085, 0.025, (0, -0.01, 1.17), WHITE, it)
sphere("TieKnot", 0.035, (0.03, -0.17, 1.13), (1, 0.7, 1), TIE_G, it)
strip("Tie", (0.03, -0.18, 1.11), (0.12, -0.2, 0.84), 0.06, 0.015, TIE_G, it)  # crooked
cone("TieTip", 0.034, 0, 0.05, (0.13, -0.2, 0.81), TIE_G, it, rot=(0, R(160), 0), scale=(1, 0.3, 1))
for s in (-1, 1):
    strip("Lanyard", (0.07 * s, -0.08, 1.18), (-0.08 + 0.02 * s, -0.19, 0.95), 0.018, 0.004,
          mat("Lanyard", (0.1, 0.3, 0.8), 0.6), it, outline=False)
cube("Badge", 1, (-0.08, -0.2, 0.89), (0.09, 0.006, 0.11), WHITE, it, bevel=0.005, width=0.004)
cube("BadgePhoto", 1, (-0.08, -0.205, 0.91), (0.04, 0.002, 0.045), mat("Photo", (0.5, 0.7, 0.9), 0.5), it,
     bevel=0, outline=False)
text("BadgeText", "INTERN", (-0.08, -0.206, 0.86), 0.022, mat("RedText", (0.8, 0.1, 0.1), 0.5), it,
     extrude=0.001)
# coffee run: cardboard tray, four cups, one lid flying off
cube("Tray", 1, (0, -0.47, 0.95), (0.34, 0.24, 0.025), CARD, it, bevel=0.008)
for i, (cx, cy) in enumerate([(-0.08, -0.41), (0.08, -0.41), (-0.08, -0.53), (0.08, -0.53)]):
    tilt = i == 3
    base = (cx, cy, 0.965)
    top = (cx + (0.05 if tilt else 0), cy - (0.03 if tilt else 0), 1.09)
    tube("Cup", 0.034, base, top, WHITE, it, r2=0.044, width=0.005)
    tube("CupSleeve", 0.041, (base[0], base[1], 1.0), (top[0] * 0.3 + base[0] * 0.7, top[1] * 0.3 + base[1] * 0.7,
                                                        1.05), CARD, it, width=0.004)
    if not tilt:
        tube("Lid", 0.047, (cx, cy, 1.09), (cx, cy, 1.105), WHITE, it, width=0.004)
torus("FlyingLid", 0.04, 0.01, (0.2, -0.64, 1.28), WHITE, it, rot=(R(40), R(30), 0))
for j, (dx, dz, r) in enumerate([(0.15, 1.13, 0.03), (0.19, 1.18, 0.022), (0.23, 1.2, 0.016), (0.12, 1.19, 0.018)]):
    sphere("Splash", r, (dx, -0.58 - 0.02 * j, dz), (1, 1, 1.2), COFFEE, it, width=0.004)
# backpack bigger than he is
cube("Backpack", 1, (0, 0.45, 1.0), (0.78, 0.46, 1.2), BAG, it, bevel=0.16)
torus("BagHandle", 0.08, 0.02, (0, 0.45, 1.62), BAG2, it, rot=(R(90), 0, 0))
tube("Bottle", 0.05, (0.43, 0.4, 0.9), (0.43, 0.4, 1.28), mat("Bottle", (0.2, 0.5, 0.95), 0.2), it)
tube("BottleCap", 0.04, (0.43, 0.4, 1.28), (0.43, 0.4, 1.33), BLACK, it)
sphere("Keychain", 0.05, (-0.42, 0.32, 0.6), (1, 1, 1), mat("Plush", (0.6, 0.6, 0.65), 0.9), it)
tube("KeyRing", 0.005, (-0.41, 0.33, 0.66), (-0.4, 0.35, 0.78), STEEL, it, outline=False)
for s in (-1, 1):
    strip("Strap", (0.12 * s, 0.02, 1.2), (0.17 * s, -0.19, 0.92), 0.06, 0.02, BAG2, it)
    strip("Strap2", (0.17 * s, -0.19, 0.92), (0.2 * s, -0.14, 0.64), 0.06, 0.02, BAG2, it)
strip("ChestStrap", (-0.16, -0.21, 0.98), (0.16, -0.21, 0.98), 0.025, 0.012, BAG2, it)
# head: bowl cut, huge glasses, braces, freckles
limb("InternNeck", it, SK, [(0, 0, 1.12), (0, -0.01, 1.3)], [0.055, 0.06])
hd = empty("InternHead", (0, -0.02, 1.68))
hd.parent = it
sphere("Head", 0.48, (0, 0, 0), (1, 0.9, 0.95), SK, hd)
for s in (-1, 1):
    eye("Eye", 0.17 * s, -0.34, 0.05, 0.15, hd, look=(0, 0.02))
    torus("GlassRim", 0.165, 0.016, (0.17 * s, -0.43, 0.05), BLACK, hd, rot=(R(90), 0, 0))
    tube("GlassLens", 0.155, (0.17 * s, -0.425, 0.05), (0.17 * s, -0.43, 0.05), glass_mat(), hd, outline=False)
    strip("GlassArm", (0.33 * s, -0.42, 0.07), (0.45 * s, -0.05, 0.06), 0.015, 0.012, BLACK, hd, outline=False)
    sphere("Ear", 0.1, (0.47 * s, 0, 0), (0.5, 0.8, 1), SK, hd)
    cube("Brow", 1, (0.17 * s, -0.42, 0.26), (0.13, 0.03, 0.035), HAIR_I, hd, rot=(0, R(-12 * s), 0), bevel=0.01)
    for fx, fz in ((0.24, -0.08), (0.3, -0.12), (0.2, -0.14)):
        sphere("Freckle", 0.014, (fx * s, -0.4, fz), (1, 0.4, 1), FRECKLE, hd, outline=False)
strip("GlassBridge", (-0.01, -0.44, 0.08), (0.01, -0.44, 0.08), 0.02, 0.015, BLACK, hd, outline=False)
sphere("Nose", 0.055, (0, -0.46, -0.06), (1, 0.9, 0.9), SK, hd)
sphere("Mouth", 0.1, (0, -0.38, -0.21), (1.45, 0.45, 0.6), MOUTH, hd)
sphere("Tongue", 0.06, (0, -0.41, -0.25), (1.3, 0.6, 0.5), TONGUE, hd, outline=False)
cube("Teeth", 1, (0, -0.435, -0.175), (0.2, 0.012, 0.035), WHITE, hd, bevel=0.006, outline=False)
strip("Braces", (-0.09, -0.445, -0.175), (0.09, -0.445, -0.175), 0.008, 0.004, STEEL, hd, outline=False)
sphere("HairBowl", 0.5, (0, 0.03, 0.12), (1.03, 0.95, 0.75), HAIR_I, hd)
cube("Bangs", 1, (0, -0.33, 0.27), (0.64, 0.12, 0.14), HAIR_I, hd, bevel=0.05)
cone("Cowlick", 0.05, 0, 0.18, (0.05, 0.25, 0.48), HAIR_I, hd, rot=(R(35), 0, 0))

# =================================================================== CRYPTO BRO (shark)
cb = empty("CryptoBro", (XS[1], 0, 0))
BLAZER = mat("Blazer", (0.07, 0.07, 0.09), 0.6)
LAPEL_B = mat("BlazerLapel", (0.16, 0.16, 0.2), 0.5)
HOOD = mat("Hoodie", (0.55, 0.2, 0.9), 0.85)
JOG = mat("Joggers", (0.45, 0.45, 0.5), 0.9)
SK_CB = mat("SkinCrypto", (0.85, 0.55, 0.35), 0.55)
FROST = mat("FrostedTips", (1.0, 0.9, 0.55), 0.5)
FROST_D = mat("CryptoHair", (0.35, 0.22, 0.1), 0.5)

legs("CryptoLegs", cb, JOG, (0, 0, 0.64), (0.2, 0.16),
     [[(-0.13, 0, 0.55), (-0.14, -0.01, 0.33), (-0.13, 0, 0.13)],
      [(0.13, 0, 0.55), (0.14, -0.01, 0.33), (0.13, 0, 0.13)]], [0.1, 0.095, 0.085])
for s in (-1, 1):
    torus("AnkleCuff", 0.075, 0.02, (0.13 * s, 0, 0.14), JOG, cb, outline=False)
    sphere("ChunkySneaker", 0.15, (0.13 * s, -0.07, 0.085), (0.9, 1.6, 0.7), WHITE, cb)
    cube("SneakerSole", 1, (0.13 * s, -0.07, 0.025), (0.22, 0.42, 0.05), mat("SoleWhite", (0.85, 0.85, 0.8), 0.7), cb,
         bevel=0.02)
    strip("SneakerSwoosh", (0.13 * s + 0.13 * s, 0.02, 0.07), (0.13 * s + 0.12 * s, -0.2, 0.11), 0.03, 0.01, HOOD,
          cb, outline=False)
ARM_R = [(0.3, 0, 1.18), (0.38, -0.12, 0.92), (0.18, -0.38, 1.0)]
ARM_L = [(-0.3, 0, 1.18), (-0.5, -0.1, 1.3), (-0.42, -0.12, 1.58)]
torso("CryptoBlazer", cb, BLAZER, [(0, 0, 0.62), (0, -0.02, 0.85), (0, 0, 1.1), (0, 0, 1.3)],
      [(0.26, 0.2), (0.3, 0.24), (0.34, 0.24), (0.12, 0.11)], [ARM_R, ARM_L], [0.11, 0.09, 0.08])
for arm in (ARM_R, ARM_L):
    tube("HoodieCuff", 0.085, arm[2], tuple(arm[2][i] + 0.25 * (arm[2][i] - arm[1][i]) for i in range(3)), HOOD, cb)
sphere("HoodieFront", 0.16, (0, -0.19, 1.1), (0.7, 0.35, 1.1), HOOD, cb)
sphere("Hood", 0.17, (0, 0.13, 1.3), (1.4, 0.8, 0.6), HOOD, cb)
for s in (-1, 1):
    strip("Drawstring", (0.04 * s, -0.22, 1.24), (0.05 * s, -0.27, 0.98), 0.012, 0.012, WHITE, cb, outline=False)
    tube("Aglet", 0.01, (0.05 * s, -0.27, 0.98), (0.05 * s, -0.27, 0.95), STEEL, cb, outline=False)
    strip("Lapel", (0.05 * s, -0.22, 1.28), (0.14 * s, -0.28, 0.98), 0.07, 0.02, LAPEL_B, cb)
torus("GoldChain", 0.2, 0.025, (0, -0.12, 1.25), BLING, cb, rot=(R(60), 0, 0))
sphere("Medallion", 0.07, (0, -0.33, 1.07), (1, 0.35, 1), BLING, cb)
text("MedallionSign", "$", (0, -0.36, 1.07), 0.08, mat("DarkGold", (0.4, 0.25, 0.02), 0.4), cb)
# three phones: staring at one, one on the ear, one in the pocket
phone("PhoneHand", cb, (0.15, -0.48, 1.1), (R(-120), 0, R(15)))
phone("PhoneEar", cb, (-0.44, -0.18, 1.72), (0, 0, R(90)), arrow=False)
phone("PhonePocket", cb, (0.17, -0.25, 1.14), (R(-8), 0, R(-10)), scale=0.75)
hand("CryptoHandR", cb, ARM_R[2], fdir(ARM_R[1], ARM_R[2]), SK_CB, side=1, scale=1.1, pose="fist",
     xhint=(0, 0, -1))
hand("CryptoHandL", cb, ARM_L[2], fdir(ARM_L[1], ARM_L[2]), SK_CB, side=-1, scale=1.1, xhint=(1, 0, 0))
limb("CryptoNeck", cb, SK_CB, [(0, 0, 1.25), (0, -0.03, 1.45)], [0.07, 0.08])
sh = empty("CryptoHead", (0, -0.05, 1.74))
sh.parent = cb
sh.rotation_euler = (R(18), 0, 0)  # staring down at the phone
sphere("Head", 0.43, (0, 0, 0), (0.95, 0.92, 1.0), SK_CB, sh)
for s in (-1, 1):
    eye("Eye", 0.15 * s, -0.33, 0.02, 0.11, sh, look=(0, -0.04), pupil_scale=0.42)
    sphere("CoolLid", 0.115, (0.15 * s, -0.325, 0.06), (1.03, 0.58, 0.5), SK_CB, sh, width=0.006)
    cube("Brow", 1, (0.15 * s, -0.39, 0.17), (0.12, 0.03, 0.03), FROST_D, sh, rot=(0, R(-10 * s), 0), bevel=0.01)
    sphere("Ear", 0.085, (0.41 * s, 0, 0), (0.5, 0.8, 1), SK_CB, sh)
    sphere("ShadeLens", 0.085, (0.13 * s, -0.27, 0.34), (1.05, 0.4, 0.7), SHINY, sh, rot=(R(-40), 0, 0))
sphere("Earbud", 0.028, (0.41, -0.05, -0.02), (1, 1, 1.4), WHITE, sh, outline=False)
strip("ShadeBridge", (-0.05, -0.3, 0.37), (0.05, -0.3, 0.37), 0.02, 0.012, BLING, sh, outline=False)
sphere("Nose", 0.055, (0, -0.44, -0.06), (0.9, 1, 1.05), SK_CB, sh)
sphere("Grin", 0.1, (0.02, -0.36, -0.2), (1.5, 0.5, 0.45), MOUTH, sh, rot=(0, R(-8), 0))
cube("GrinTeeth", 1, (0.02, -0.405, -0.185), (0.2, 0.01, 0.03), WHITE, sh, bevel=0.006, outline=False)
cone("Goatee", 0.06, 0, 0.1, (0, -0.33, -0.36), FROST_D, sh, rot=(R(180), 0, 0), scale=(1, 0.6, 1))
sphere("HairBase", 0.43, (0, 0.03, 0.12), (1.0, 0.95, 0.6), FROST_D, sh)
for i, (x, y, rx, ry) in enumerate([(-0.2, -0.15, -20, -25), (-0.07, -0.22, -30, -8), (0.07, -0.22, -30, 8),
                                    (0.2, -0.15, -20, 25), (-0.12, 0.05, 5, -20), (0.12, 0.05, 5, 20),
                                    (0, 0.15, 25, 0)]):
    cone("SpikeRoot", 0.08, 0.04, 0.16, (x, y, 0.4), FROST_D, sh, rot=(R(rx), R(ry), 0))
    cone("FrostedTip", 0.04, 0, 0.12, (x * 1.25, y * 1.25 - 0.03, 0.54), FROST, sh, rot=(R(rx), R(ry), 0))

# =================================================================== CEO
ce = empty("CEO", (XS[2], 0, 0))
SK3 = mat("SkinCEO", (0.9, 0.6, 0.42), 0.55)
NAVY = mat("NavySuit", (0.08, 0.1, 0.22), 0.55)
NAVY_L = mat("NavyLapel", (0.05, 0.06, 0.14), 0.45)
POWER_TIE = mat("PowerTie", (0.75, 0.05, 0.05), 0.35)
HAIR_C = mat("CEOHair", (0.12, 0.08, 0.05), 0.2)
BLUE_DIAL = mat("BlueDial", (0.05, 0.15, 0.45), 0.2)

legs("CEOLegs", ce, NAVY, (0, 0, 0.55), (0.26, 0.2),
     [[(-0.13, 0, 0.5), (-0.13, -0.01, 0.3), (-0.12, 0, 0.1)],
      [(0.13, 0, 0.5), (0.13, -0.01, 0.3), (0.12, 0, 0.1)]], [0.1, 0.09, 0.085])
for s in (-1, 1):
    sphere("Oxford", 0.12, (0.12 * s, -0.06, 0.06), (0.85, 1.7, 0.5), SHINY, ce)
CEO_R = [(0.52, 0, 1.3), (0.8, 0.02, 0.98), (0.42, -0.14, 0.76)]
CEO_L = [(-0.52, 0, 1.3), (-0.8, 0.02, 0.98), (-0.42, -0.14, 0.76)]
torso("CEOSuit", ce, NAVY, [(0, 0, 0.55), (0, -0.03, 0.8), (0, -0.03, 1.15), (0, 0, 1.45)],
      [(0.3, 0.24), (0.5, 0.4), (0.62, 0.48), (0.16, 0.14)], [CEO_R, CEO_L], [0.2, 0.15, 0.12])
sphere("ShirtV", 0.2, (0, -0.42, 1.3), (0.55, 0.3, 0.85), WHITE, ce, width=0.006)
for s in (-1, 1):
    strip("Lapel", (0.045 * s, -0.46, 1.44), (0.24 * s, -0.5, 1.0), 0.12, 0.03, NAVY_L, ce)
    sphere("Button", 0.028, (0.06 * s, -0.53, 0.78 + 0.07 * (s + 1)), (1, 0.5, 1), NAVY_L, ce, outline=False)
for i in range(7):  # pinstripes on the belly
    x = -0.3 + 0.1 * i
    strip("Pinstripe", (x, -0.36 - 0.09 * math.cos(x * 2), 1.02), (x * 1.03, -0.37 - 0.08 * math.cos(x * 2), 0.78),
          0.006, 0.004, mat("Pin", (0.55, 0.58, 0.7), 0.5), ce, outline=False)
sphere("TieKnot", 0.05, (0, -0.47, 1.41), (1, 0.7, 1), POWER_TIE, ce)
strip("Tie", (0, -0.48, 1.38), (0, -0.55, 1.0), 0.12, 0.02, POWER_TIE, ce)
cone("TieTip", 0.065, 0, 0.09, (0, -0.555, 0.96), POWER_TIE, ce, rot=(R(180), 0, 0), scale=(1, 0.3, 1))
cone("PocketSquare", 0.05, 0, 0.08, (-0.3, -0.45, 1.22), POWER_TIE, ce, scale=(1, 0.35, 1), width=0.005)
for arm, s in ((CEO_R, 1), (CEO_L, -1)):
    tube("ShirtCuff", 0.105, tuple(arm[1][i] * 0.12 + arm[2][i] * 0.88 for i in range(3)), arm[2], WHITE, ce)
    h = hand("CEOHand", ce, arm[2], fdir(arm[1], arm[2]), SK3, side=s, scale=1.25, xhint=(1, 0, 0))
    if s == -1:
        analog_watch("CEOWatch", h, 2.0, STEEL, BLUE_DIAL, STEEL, WHITE)
limb("CEONeck", ce, SK3, [(0, 0, 1.4), (0, -0.02, 1.62)], [0.13, 0.13])
torus("Collar", 0.14, 0.03, (0, -0.02, 1.45), WHITE, ce)
ch = empty("CEOHead", (0, -0.03, 1.98))
ch.parent = ce
sphere("Head", 0.42, (0, 0, 0), (0.95, 0.9, 1.05), SK3, ch)
sphere("LanternJaw", 0.3, (0, -0.1, -0.25), (1.05, 0.95, 0.62), SK3, ch)
strip("ChinCleft", (0, -0.38, -0.33), (0, -0.385, -0.39), 0.008, 0.005, mat("Cleft", (0.6, 0.35, 0.22), 0.6), ch,
      outline=False)
for s in (-1, 1):
    sphere("EyeWhite", 0.09, (0.15 * s, -0.33, 0.06), (1, 0.55, 0.7), WHITE, ch, width=0.006)
    sphere("EyePupil", 0.04, (0.14 * s, -0.38, 0.05), (1, 0.5, 1), m["pupil"], ch, outline=False)
    sphere("SmugLid", 0.095, (0.15 * s, -0.32, 0.1), (1.05, 0.6, 0.45), SK3, ch, width=0.006)
    cube("VillainBrow", 1, (0.16 * s, -0.37, 0.19), (0.17, 0.05, 0.05), HAIR_C, ch, rot=(0, R(22 * s), R(-6 * s)),
         bevel=0.015)
    torus("TinyGlasses", 0.045, 0.008, (0.08 * s, -0.47, -0.06), BLING, ch, rot=(R(90), 0, 0), outline=False)
    tube("TinyLens", 0.042, (0.08 * s, -0.468, -0.06), (0.08 * s, -0.472, -0.06), glass_mat(), ch, outline=False)
    sphere("Ear", 0.09, (0.4 * s, 0, 0), (0.5, 0.8, 1), SK3, ch)
strip("GlassBridge", (-0.035, -0.48, -0.055), (0.035, -0.48, -0.055), 0.01, 0.006, BLING, ch, outline=False)
sphere("Nose", 0.07, (0, -0.43, -0.07), (0.9, 1, 1.1), SK3, ch)
strip("Smirk", (-0.12, -0.43, -0.22), (0.12, -0.43, -0.18), 0.02, 0.02, MOUTH, ch)
sphere("SmirkCorner", 0.02, (0.13, -0.43, -0.17), (1, 0.6, 1), MOUTH, ch, outline=False)
sphere("HairTop", 0.44, (0, 0.03, 0.14), (1.0, 0.95, 0.6), HAIR_C, ch)
sphere("HairWave", 0.24, (-0.12, -0.26, 0.32), (1.5, 0.8, 0.6), HAIR_C, ch, rot=(0, R(-12), 0))
strip("SidePart", (0.16, -0.28, 0.38), (0.2, 0.2, 0.44), 0.012, 0.01, SK3, ch, outline=False)
sphere("HairShine", 0.04, (-0.18, -0.36, 0.42), (2.2, 0.6, 0.4), m["spark"], ch, outline=False)

# =================================================================== SECURITY GUARD (bull, instantly scared)
sg = empty("SecurityGuard", (XS[3], 0, 0))
UNI = mat("Uniform", (0.12, 0.16, 0.32), 0.7)
UNI_D = mat("UniformDark", (0.07, 0.09, 0.2), 0.6)
SK_G = mat("SkinGuard", (0.6, 0.38, 0.25), 0.55)
MUSTACHE = mat("GuardHair", (0.1, 0.07, 0.05), 0.7)

legs("GuardLegs", sg, UNI, (0, 0, 0.66), (0.32, 0.25),
     [[(-0.18, 0, 0.6), (-0.07, -0.02, 0.36), (-0.2, 0, 0.12)],
      [(0.18, 0, 0.6), (0.07, -0.02, 0.36), (0.2, 0, 0.12)]], [0.14, 0.12, 0.11])  # knees knocking
for s in (-1, 1):
    sphere("Boot", 0.16, (0.2 * s, -0.07, 0.08), (0.9, 1.5, 0.6), SHINY, sg)
    for i in range(3):  # cartoon tremble lines by the knees
        strip("Tremble", (0.2 * s + 0.03 * i * s, -0.1, 0.44 - 0.06 * i), (0.24 * s + 0.03 * i * s, -0.1, 0.4 - 0.06 * i),
              0.012, 0.008, WHITE, sg, outline=False)
GR = [(0.5, 0, 1.3), (0.62, -0.2, 1.05), (0.4, -0.5, 1.05)]
GL = [(-0.5, 0, 1.3), (-0.6, -0.15, 1.0), (-0.25, -0.45, 1.2)]
torso("GuardShirt", sg, UNI, [(0, 0, 0.66), (0, -0.02, 0.9), (0, 0, 1.2), (0, 0, 1.45)],
      [(0.34, 0.26), (0.42, 0.32), (0.55, 0.36), (0.18, 0.16)], [GR, GL], [0.19, 0.15, 0.13])
torus("Belt", 0.37, 0.045, (0, -0.01, 0.74), BLACK, sg, scale=(1.05, 0.82, 1))
cube("Buckle", 1, (0, -0.33, 0.74), (0.1, 0.02, 0.07), BLING, sg, bevel=0.01)
cube("Holster", 1, (0.36, -0.12, 0.66), (0.08, 0.1, 0.16), BLACK, sg, bevel=0.02)
for s in (-1, 1):
    cube("Epaulette", 1, (0.42 * s, -0.02, 1.36), (0.2, 0.14, 0.03), UNI_D, sg, rot=(0, R(-14 * s), 0), bevel=0.01)
    cube("PocketFlap", 1, (0.2 * s, -0.36, 1.14), (0.14, 0.02, 0.05), UNI_D, sg, bevel=0.01)
cone("StarBadge", 0.07, 0.07, 0.02, (-0.2, -0.37, 1.25), BLING, sg, rot=(R(90), 0, 0))
text("BadgeText", "SEC", (-0.2, -0.385, 1.25), 0.035, UNI_D, sg, extrude=0.002)
# flashlight in a shaking fist, walkie-talkie clutched to the chest
hand("GuardHandR", sg, GR[2], fdir(GR[1], GR[2]), SK_G, side=1, scale=1.35, pose="fist", xhint=(0, 0, 1))
tube("Flashlight", 0.04, (0.41, -0.52, 1.02), (0.45, -0.88, 1.1), BLACK, sg, r2=0.056)
tube("FlashLens", 0.05, (0.45, -0.88, 1.1), (0.452, -0.9, 1.102), mat("Beam", (1, 0.95, 0.6), 0.1, emit=6), sg,
     outline=False)
hand("GuardHandL", sg, GL[2], fdir(GL[1], GL[2]), SK_G, side=-1, scale=1.35, pose="fist", xhint=(0, 0, 1))
cube("Walkie", 1, (-0.22, -0.55, 1.28), (0.08, 0.05, 0.17), BLACK, sg, bevel=0.012)
tube("Antenna", 0.008, (-0.24, -0.55, 1.36), (-0.25, -0.55, 1.52), BLACK, sg, outline=False)
for i in range(4):
    strip("Grille", (-0.25, -0.577, 1.3 - 0.02 * i), (-0.19, -0.577, 1.3 - 0.02 * i), 0.006, 0.002, UNI, sg,
          outline=False)
limb("GuardNeck", sg, SK_G, [(0, 0, 1.4), (0, -0.02, 1.62)], [0.16, 0.16])
bh = empty("GuardHead", (0, -0.02, 1.95))
bh.parent = sg
sphere("Head", 0.42, (0, 0, 0), (1.05, 0.92, 1.0), SK_G, bh)
sphere("SquareJaw", 0.34, (0, -0.06, -0.22), (1.1, 0.9, 0.62), SK_G, bh)
for s in (-1, 1):
    eye("Eye", 0.16 * s, -0.33, 0.1, 0.15, bh, look=(0, 0.02), pupil_scale=0.16)  # tiny terrified pupils
    cube("Brow", 1, (0.17 * s, -0.4, 0.33), (0.15, 0.05, 0.045), MUSTACHE, bh, rot=(0, R(-25 * s), 0), bevel=0.014)
    sphere("Ear", 0.1, (0.43 * s, 0, 0), (0.5, 0.8, 1), SK_G, bh)
    sphere("MustacheHalf", 0.11, (0.1 * s, -0.43, -0.13), (1.3, 0.55, 0.45), MUSTACHE, bh, rot=(0, R(-12 * s), 0))
sphere("Nose", 0.08, (0, -0.47, -0.02), (1, 1, 1.1), SK_G, bh)
sphere("ScaredMouth", 0.065, (0, -0.46, -0.3), (1.1, 0.5, 1.3), MOUTH, bh)
cube("ChatterTeeth", 1, (0, -0.495, -0.25), (0.1, 0.01, 0.022), WHITE, bh, bevel=0.005, outline=False)
for x, z in ((0.4, 0.28), (-0.43, 0.18), (0.33, 0.42)):
    sphere("Sweat", 0.045, (x, -0.25, z), (1, 0.6, 1.2), SWEAT, bh)
sphere("BuzzCut", 0.42, (0, 0.03, 0.1), (1.06, 0.95, 0.72), MUSTACHE, bh)
sphere("CapCrown", 0.36, (0, 0.03, 0.33), (1.05, 1.0, 0.45), UNI, bh)
cube("CapBrim", 1, (0, -0.33, 0.28), (0.5, 0.26, 0.03), UNI_D, bh, rot=(R(-8), 0, 0), bevel=0.02)
cone("CapBadge", 0.045, 0.045, 0.01, (0, -0.33, 0.41), BLING, bh, rot=(R(80), 0, 0))

# =================================================================== RECEPTIONIST (gossip)
rc = empty("Receptionist", (XS[4], 0, 0))
SK4 = mat("SkinReception", (0.72, 0.45, 0.3), 0.55)
CARDI = mat("Cardigan", (0.1, 0.55, 0.55), 0.85)
BLOUSE = mat("Blouse", (0.98, 0.93, 0.82), 0.6)
SKIRT = mat("Skirt", (0.4, 0.12, 0.3), 0.7)
HAIR_R = mat("AuburnHair", (0.55, 0.15, 0.08), 0.5)
LIPS = mat("Lips", (0.85, 0.08, 0.15), 0.3)
PEARL = mat("Pearl", (0.97, 0.95, 0.92), 0.15)
RED = mat("RedShoe", (0.85, 0.06, 0.1), 0.25)

cone("PencilSkirt", 0.27, 0.21, 0.36, (0, 0, 0.62), SKIRT, rc)
for s in (-1, 1):
    limb("Leg", rc, SK4, [(0.09 * s, 0, 0.5), (0.09 * s, -0.01, 0.3), (0.09 * s, 0, 0.1)], [0.065, 0.058, 0.05])
    sphere("Heel", 0.08, (0.09 * s, -0.06, 0.06), (0.8, 1.6, 0.55), RED, rc)
    cone("Stiletto", 0.02, 0.008, 0.08, (0.09 * s, 0.05, 0.04), RED, rc)
RR = [(0.26, 0, 1.17), (0.4, -0.2, 1.0), (0.22, -0.42, 1.4)]
RL = [(-0.26, 0, 1.17), (-0.36, -0.08, 0.92), (-0.22, -0.32, 0.9)]
torso("Cardigan", rc, CARDI, [(0, 0, 0.72), (0, -0.01, 0.9), (0, 0, 1.1), (0, 0, 1.28)],
      [(0.24, 0.18), (0.25, 0.19), (0.28, 0.19), (0.08, 0.07)], [RR, RL], [0.085, 0.075, 0.065])
sphere("BlouseV", 0.14, (0, -0.15, 1.12), (0.6, 0.35, 1.1), BLOUSE, rc)
for i in range(4):
    sphere("CardiButton", 0.018, (0.07, -0.2, 1.0 - 0.08 * i), (1, 0.5, 1), PEARL, rc, outline=False)
for i in range(17):  # pearl necklace
    a = R(-80 + 10 * i)
    sphere("Pearl", 0.022, (0.12 * math.sin(a), -0.08 - 0.1 * math.cos(a), 1.23 - 0.07 * math.cos(a)), (1, 1, 1),
           PEARL, rc, outline=False)
hand("ReceptionHandR", rc, RR[2], (-0.05, -0.1, 1), SK4, side=1, scale=1.05, xhint=(1, 0, 0))
h_mug = hand("ReceptionHandL", rc, RL[2], fdir(RL[1], RL[2]), SK4, side=-1, scale=1.05, pose="fist",
             xhint=(0, 0, 1))
tube("Mug", 0.055, (-0.2, -0.43, 0.84), (-0.2, -0.43, 0.98), WHITE, rc)
tube("MugCoffee", 0.05, (-0.2, -0.43, 0.975), (-0.2, -0.43, 0.982), COFFEE, rc, outline=False)
torus("MugHandle", 0.035, 0.01, (-0.14, -0.43, 0.91), WHITE, rc, rot=(R(90), 0, 0))
text("MugText", "#1 GOSSIP", (-0.2, -0.49, 0.91), 0.018, mat("MugRed", (0.85, 0.1, 0.2), 0.4), rc, extrude=0.001)
for i in range(3):
    sphere("Steam", 0.018 + 0.006 * i, (-0.2 + 0.02 * (i % 2), -0.43, 1.02 + 0.05 * i), (1, 1, 1.3), WHITE, rc,
           outline=False)
text("Psst", "psst...", (0.42, -0.5, 1.72), 0.07, mat("Whisper", (1, 1, 1), 0.3, emit=0.6), rc)
limb("ReceptionNeck", rc, SK4, [(0, 0, 1.2), (0, -0.01, 1.36)], [0.055, 0.06])
rh = empty("ReceptionHead", (0, -0.02, 1.72))
rh.parent = rc
rh.rotation_euler = (0, R(8), 0)  # leaning in to whisper
sphere("Head", 0.42, (0, 0, 0), (1, 0.9, 0.97), SK4, rh)
for s in (-1, 1):
    eye("Eye", 0.15 * s, -0.31, 0.04, 0.12, rh, look=(0.05, 0), lashes=BLACK)  # side-eye
    sphere("SlyLid", 0.126, (0.15 * s, -0.305, 0.08), (1.02, 0.58, 0.55), SK4, rh, width=0.006)
    torus("CatEyeRim", 0.14, 0.014, (0.15 * s, -0.4, 0.04), mat("CatEyeFrame", (0.7, 0.05, 0.25), 0.3), rh,
          rot=(R(90), 0, 0))
    cone("CatEyeWing", 0.03, 0, 0.09, (0.27 * s, -0.4, 0.13), mat("CatEyeFrame", (0.7, 0.05, 0.25), 0.3), rh,
         rot=(0, R(-60 * s), 0), outline=False)
    torus("HoopEarring", 0.05, 0.008, (0.41 * s, -0.02, -0.16), BLING, rh, rot=(0, R(90), 0), outline=False)
    sphere("Ear", 0.08, (0.4 * s, 0, -0.02), (0.5, 0.8, 1), SK4, rh)
    cube("Brow", 1, (0.15 * s, -0.37, 0.2), (0.12, 0.025, 0.025), HAIR_R, rh, rot=(0, R(8 * s), 0), bevel=0.008)
sphere("Nose", 0.05, (0, -0.42, -0.06), (0.9, 1, 1.1), SK4, rh)
sphere("Lips", 0.075, (0.02, -0.38, -0.2), (1.3, 0.5, 0.5), LIPS, rh, rot=(0, R(-10), 0))
sphere("BeautyMark", 0.012, (0.12, -0.38, -0.14), (1, 0.5, 1), BLACK, rh, outline=False)
sphere("HairCap", 0.44, (0, 0.03, 0.1), (1.03, 0.97, 0.75), HAIR_R, rh)
sphere("SideSwoop", 0.2, (-0.18, -0.25, 0.28), (1.4, 0.8, 0.6), HAIR_R, rh, rot=(0, R(20), 0))
sphere("BigBun", 0.24, (0, 0.12, 0.45), (1, 1, 0.9), HAIR_R, rh)
tube("Pencil", 0.016, (-0.3, 0.1, 0.48), (0.3, 0.14, 0.5), mat("PencilYellow", (1, 0.8, 0.1), 0.5), rh)
tube("Eraser", 0.016, (-0.3, 0.1, 0.48), (-0.34, 0.1, 0.48), mat("Eraser", (0.95, 0.5, 0.6), 0.7), rh)
cone("PencilTip", 0.016, 0.003, 0.04, (0.32, 0.14, 0.5), mat("Wood", (0.9, 0.75, 0.5), 0.8), rh,
     rot=(0, R(90), 0))
torus("HeadsetBand", 0.43, 0.018, (0, 0.03, 0.08), BLACK, rh, rot=(0, R(90), 0), scale=(1, 1, 1.05))
sphere("EarCup", 0.08, (0.43, 0, 0), (0.5, 1, 1), BLACK, rh)
strip("MicBoom", (0.42, -0.05, -0.05), (0.18, -0.4, -0.24), 0.012, 0.012, BLACK, rh, outline=False)
sphere("MicTip", 0.022, (0.17, -0.41, -0.25), (1, 1, 1), BLACK, rh, outline=False)

# =================================================================== render
studio(cam_loc=(0, -9.5, 2.2), target=(0, 0, 1.2), lens=35)
text("Title", "WOLVES WITH YOUR FRIENDS", (0, 3.95, 3.6), 0.34, mat("Logo", (1, 0.75, 0.25), 0.3, emit=1.5))
render(os.path.join(OUT, "cast_lineup.png"), x=1400, y=800, samples=32)
cam = bpy.context.scene.camera
cam.data.lens = 50
for nm, x in zip(["intern", "crypto_bro", "ceo", "security_guard", "receptionist"], XS):
    loc, tgt = (x + 0.5, -4.2, 1.8), (x, 0, 1.2)
    cam.location = loc
    cam.rotation_quaternion = (Vector(tgt) - Vector(loc)).to_track_quat("-Z", "Y")
    render(os.path.join(OUT, f"cast_{nm}.png"), x=640, y=800, samples=28)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(os.path.dirname(__file__), "cast.blend"))
print("DONE")
