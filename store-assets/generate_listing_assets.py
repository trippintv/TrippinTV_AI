#!/usr/bin/env python3
"""Generate Google Play Store listing assets for Trippin' TV.

Outputs (into store-assets/):
  feature-graphic-1024x500.png  — required 1024x500 feature graphic
  screenshot-1-feed.png         — 1080x1920 phone mock: video feed
  screenshot-2-ai-generator.png — 1080x1920 phone mock: AI video generator
  screenshot-3-leaderboard.png  — 1080x1920 phone mock: leaderboard
  screenshot-4-profile.png      — 1080x1920 phone mock: profile

Run:  python3 store-assets/generate_listing_assets.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)))
FONT_BUNGEE = os.path.join(OUT, "fonts", "Bungee-Regular.ttf")
FONT_DEJAVU = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

PURPLE = (168, 85, 247)
PINK = (236, 72, 153)
INDIGO = (99, 102, 241)
WHITE = (255, 255, 255)
ZINC = (39, 39, 42)      # zinc-800
ZINC_D = (24, 24, 27)    # zinc-900
BLACK = (10, 10, 12)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(size, c1, c2, vertical=True):
    w, h = size
    img = Image.new("RGB", size)
    d = ImageDraw.Draw(img)
    n = h if vertical else w
    for i in range(n):
        d.line([(0, i), (w, i)] if vertical else [(i, 0), (i, h)],
               fill=lerp(c1, c2, i / max(1, n - 1)))
    return img


def radial_glow(size, center, radius, color, strength):
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    steps = 70
    for i in range(steps, 0, -1):
        r = radius * i / steps
        a = int(strength * (1 - i / steps))
        d.ellipse([center[0] - r, center[1] - r, center[0] + r, center[1] + r],
                  fill=(color[0], color[1], color[2], a))
    return img


def round_corners(img, radius):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.size[0] - 1, img.size[1] - 1], radius, fill=255)
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def app_icon(size):
    icon = Image.open(os.path.join(os.path.dirname(OUT), "public", "icon-512.png")).convert("RGBA")
    icon = icon.resize((size, size), Image.LANCZOS)
    return round_corners(icon, int(size * 0.2))


def avatar(size, seed, initials):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c1 = lerp(PURPLE, PINK, seed)
    c2 = lerp(PINK, INDIGO, (seed + 0.4) % 1)
    r = size / 2
    for i in range(int(r)):
        t = i / max(1, r - 1)
        d.ellipse([r - i, r - i, r + i, r + i], fill=lerp(c1, c2, t))
    d.ellipse([0, 0, size, size], fill=(0, 0, 0, 0), outline=None)
    f = ImageFont.truetype(FONT_DEJAVU, int(size * 0.42))
    d.text((size / 2, size / 2), initials, font=f, fill=WHITE, anchor="mm")
    return round_corners(img, size // 2)


def text(d, xy, s, font, fill=WHITE, anchor="mm", shadow=True, so=4, sc=(0, 0, 0, 170)):
    if shadow:
        d.text((xy[0] + so, xy[1] + so), s, font=font, fill=sc, anchor=anchor)
    d.text(xy, s, font=font, fill=fill, anchor=anchor)


def font_bungee(size):
    return ImageFont.truetype(FONT_BUNGEE, size)


def font_body(size):
    return ImageFont.truetype(FONT_DEJAVU, size)


# ---------------------------------------------------------------------------
# 1. Feature graphic 1024x500
# ---------------------------------------------------------------------------
def make_feature_graphic():
    W, H = 1024, 500
    base = gradient((W, H), (124, 58, 237), (236, 72, 153), vertical=False)
    img = base.convert("RGBA")
    img.alpha_composite(radial_glow((W, H), (850, 80), 420, (236, 72, 153), 60))
    img.alpha_composite(radial_glow((W, H), (120, 430), 380, (168, 85, 247), 60))
    d = ImageDraw.Draw(img)

    # App icon on the left
    icon = app_icon(230)
    img.alpha_composite(icon, (120, 135))

    # Title
    f_t = font_bungee(74)
    text(d, (600, 195), "TRIPPIN' TV", f_t, WHITE, shadow=True, so=5)

    # Tagline
    f_s = font_body(34)
    text(d, (600, 285), "CRAZY VIDEOS  •  REAL PRIZES", f_s,
         (255, 235, 250), shadow=True, so=3)

    # Small chips
    chips = ["AI VIDEO GENERATOR", "WEEKLY PRIZES", "VOTE + EARN"]
    f_c = font_body(20)
    total = len(chips) * 250 + (len(chips) - 1) * 18
    x0 = 600 - total / 2
    for i, c in enumerate(chips):
        w = 250
        x = x0 + i * (w + 18)
        d.rounded_rectangle([x, 330, x + w, 378], 24, fill=(0, 0, 0, 90),
                            outline=(255, 255, 255, 90), width=2)
        d.text((x + w / 2, 354), c, font=f_c, fill=WHITE, anchor="mm")

    img.convert("RGB").save(os.path.join(OUT, "feature-graphic-1024x500.png"))
    print("feature-graphic-1024x500.png")


# ---------------------------------------------------------------------------
# Phone screenshots
# ---------------------------------------------------------------------------
PHONE = (1080, 1920)


def phone_base():
    img = Image.new("RGBA", PHONE, BLACK)
    img.alpha_composite(radial_glow(PHONE, (540, 260), 620, (168, 85, 247), 26))
    img.alpha_composite(radial_glow(PHONE, (900, 1750), 560, (236, 72, 153), 18))
    return img


def status_bar(img, title="TRIPPIN' TV"):
    d = ImageDraw.Draw(img)
    d.text((48, 54), "9:41", font=font_body(30), fill=WHITE, anchor="lm")
    f = font_bungee(34)
    d.text((540, 58), title, font=f, fill=WHITE, anchor="mm")
    # bell dot
    d.rounded_rectangle([988, 40, 1032, 74], 17, fill=ZINC)
    d.ellipse([1006, 44, 1020, 58], fill=(255, 255, 255))
    d.ellipse([1014, 62, 1022, 70], fill=(236, 72, 153))


def make_screenshot_feed():
    img = phone_base()
    d = ImageDraw.Draw(img)
    status_bar(img)

    # Video card (9:16-ish) centered
    cx, cw, cy, ch = 540, 860, 1010, 1600
    x0, x1, y0, y1 = cx - cw // 2, cx + cw // 2, cy - ch // 2, cy + ch // 2
    video = gradient((cw, ch), (16, 185, 129), (59, 130, 246), vertical=False)
    video = video.convert("RGBA")
    video.alpha_composite(radial_glow((cw, ch), (cw - 80, 140), 420, (236, 72, 153), 70))
    video.alpha_composite(radial_glow((cw, ch), (120, ch - 120), 380, (168, 85, 247), 70))
    card = round_corners(video, 48)
    img.alpha_composite(card, (x0, y0))

    # AI watermark chip
    d.rounded_rectangle([x0 + 24, y0 + 24, x0 + 210, y0 + 62], 20, fill=(0, 0, 0, 160))
    d.text((x0 + 46, y0 + 43), "@funny_cat_lover  AI", font=font_body(22), fill=WHITE, anchor="lm")

    # Bottom info gradient
    ov = Image.new("RGBA", (cw, 460), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    for i in range(460):
        od.line([(0, i), (cw, i)], fill=(0, 0, 0, int(200 * i / 459)))
    img.alpha_composite(ov, (x0, y1 - 460))

    d = ImageDraw.Draw(img)
    # User row
    av = avatar(64, 0.2, "J")
    img.alpha_composite(av, (x0 + 28, y1 - 330))
    d.text((x0 + 112, y1 - 300), "@trippin_jenny", font=font_body(28), fill=WHITE, anchor="lm")
    # Title + caption
    d.text((x0 + 28, y1 - 240), "Sneaky cat vs. laser pointer", font=font_bungee(40), fill=WHITE, anchor="lm")
    d.text((x0 + 28, y1 - 170), "It waited 3 years for this moment.  #pets  #wild", font=font_body(26), fill=(224, 224, 228), anchor="lm")

    # Right action rail
    rx = x1 - 58
    items = [("62K", None), ("4.1K", None), ("2.3K", None), ("SAVE", None)]
    labels = ["62K", "4.1K", "2.3K", "SAVE"]
    y = y1 - 420
    for lab in labels:
        d.ellipse([rx - 40, y - 40, rx + 40, y + 40], fill=(24, 24, 27, 210))
        # icon
        if lab == "62K":
            d.polygon([(rx, y - 18), (rx, y + 18), (rx + 30, y)], fill=WHITE)
        elif lab == "4.1K":
            d.rounded_rectangle([rx - 22, y - 16, rx + 22, y + 16], 10, outline=WHITE, width=4)
        elif lab == "2.3K":
            d.ellipse([rx - 18, y - 18, rx + 18, y + 18], fill=(251, 146, 60))
            d.text((rx, y), "😂", font=font_body(26), anchor="mm")
        else:
            d.rounded_rectangle([rx - 18, y - 16, rx + 18, y + 16], 6, outline=WHITE, width=4)
        d.text((rx, y + 62), lab, font=font_body(24), fill=WHITE, anchor="mm")
        y += 150

    # Comment bar
    d.rounded_rectangle([x0 + 28, y1 - 78, x1 - 28, y1 - 24], 30, fill=(39, 39, 42))
    d.text((x0 + 56, y1 - 51), "Say something trippy...", font=font_body(26), fill=(140, 140, 150), anchor="lm")
    d.ellipse([x1 - 92, y1 - 66, x1 - 36, y1 - 10], fill=(168, 85, 247))
    d.polygon([(x1 - 78, y1 - 48), (x1 - 78, y1 - 28), (x1 - 50, y1 - 38)], fill=WHITE)

    img.convert("RGB").save(os.path.join(OUT, "screenshot-1-feed.png"))
    print("screenshot-1-feed.png")


def make_screenshot_ai():
    img = phone_base()
    d = ImageDraw.Draw(img)
    status_bar(img)

    # Header
    d.text((540, 200), "AI VIDEO GENERATOR", font=font_bungee(46), fill=WHITE, anchor="mm")
    d.text((540, 264), "Describe a trip. Watch it come alive.", font=font_body(26),
           fill=(200, 200, 210), anchor="mm")

    # Prompt card
    py0 = 340
    d.rounded_rectangle([100, py0, 980, py0 + 330], 36, fill=ZINC_D, outline=(63, 63, 70), width=3)
    d.text((140, py0 + 60), "Describe your wildest trip...", font=font_body(34), fill=(120, 120, 130), anchor="lm")
    for i in range(3):
        y = py0 + 130 + i * 58
        d.rounded_rectangle([140, y, 940, y + 40], 14, fill=(39, 39, 42))
        d.text((168, y + 20), ["A shark surfing a wave", "Neon roller coaster through space", "A cat DJ'ing a rooftop party"][i],
               font=font_body(26), fill=(190, 190, 200), anchor="lm")

    # Generate button
    btn = gradient((880, 120), PURPLE, PINK, vertical=False)
    btn = round_corners(btn, 60)
    img.alpha_composite(btn, (100, py0 + 380))
    d = ImageDraw.Draw(img)
    d.text((540, py0 + 440), "GENERATE VIDEO", font=font_bungee(40), fill=WHITE, anchor="mm", shadow=True)
    d.text((540, py0 + 505), "5 credits per video", font=font_body(24), fill=(200, 200, 210), anchor="mm")

    # Credits pill
    d.rounded_rectangle([820, 168, 1010, 216], 24, fill=(168, 85, 247, 120))
    d.text((915, 192), "12 credits", font=font_body(24), fill=WHITE, anchor="mm")

    # Recent renders
    d.text((540, 1190), "RECENT RENDERS", font=font_bungee(30), fill=(255, 255, 255), anchor="mm")
    y = 1260
    for i in range(3):
        d.rounded_rectangle([140, y, 940, y + 170], 28, fill=ZINC_D, outline=(39, 39, 42), width=2)
        thumb = gradient((140, 140), lerp(PINK, PURPLE, i * 0.3), lerp(INDIGO, PINK, i * 0.3), vertical=False)
        thumb = round_corners(thumb, 22)
        img.alpha_composite(thumb, (160, y + 15))
        d = ImageDraw.Draw(img)
        d.text((340, y + 48), ["Flying taco delivery drone", "Rainbow avalanche in the Alps", "Hoverboard race downtown"][i],
               font=font_body(28), fill=WHITE, anchor="lm")
        d.text((340, y + 100), "QUEUED" if i == 0 else "READY", font=font_body(20),
               fill=(250, 204, 21) if i == 0 else (74, 222, 128), anchor="lm")
        y += 210

    img.convert("RGB").save(os.path.join(OUT, "screenshot-2-ai-generator.png"))
    print("screenshot-2-ai-generator.png")


def make_screenshot_leaderboard():
    img = phone_base()
    d = ImageDraw.Draw(img)
    status_bar(img, title="WEEKLY LEGENDS")

    d.text((540, 190), "TOP TRIPPERS", font=font_bungee(44), fill=WHITE, anchor="mm")
    d.text((540, 244), "Ends Sunday 11:59 PM", font=font_body(24), fill=(180, 180, 190), anchor="mm")

    # Podium
    podium = [(540, 400, 0.35, "2ND", (165, 165, 170)), (240, 470, 0.15, "1ST", (250, 204, 21)),
              (840, 470, 0.55, "3RD", (205, 127, 50))]
    names = ["@prizefighter", "@lil_goomba", "@airborne_ami"]
    for cx, cy, seed, place, color in podium:
        av = avatar(150, seed, place[0])
        img.alpha_composite(av, (int(cx - 75), int(cy - 75)))
        d = ImageDraw.Draw(img)
        d.ellipse([cx - 38, cy + 88, cx + 38, cy + 140], fill=(0, 0, 0, 120))
        d.text((cx, cy + 114), place, font=font_bungee(30), fill=color, anchor="mm")
        d.text((cx, cy + 178), names[podium.index((cx, cy, seed, place, color))],
               font=font_body(24), fill=WHITE, anchor="mm")

    # Rows
    rows = [
        ("@shadowcaster", 4820, 0.6),
        ("@neon_nomad", 4710, 0.4),
        ("@ghost_reaper", 4635, 0.25),
        ("@wavy_dave", 4580, 0.7),
        ("@frostbite_fred", 4495, 0.1),
    ]
    y = 780
    for i, (name, pts, seed) in enumerate(rows, start=4):
        d.rounded_rectangle([120, y, 960, y + 150], 30, fill=ZINC_D, outline=(39, 39, 42), width=2)
        av = avatar(84, seed, str(i))
        img.alpha_composite(av, (150, y + 33))
        d = ImageDraw.Draw(img)
        d.text((270, y + 75), name, font=font_body(30), fill=WHITE, anchor="lm")
        d.text((900, y + 75), f"{pts:,}", font=font_bungee(30), fill=(250, 204, 21), anchor="rm")
        d.text((900, y + 118), "PTS", font=font_body(16), fill=(140, 140, 150), anchor="rm")
        y += 190

    img.convert("RGB").save(os.path.join(OUT, "screenshot-3-leaderboard.png"))
    print("screenshot-3-leaderboard.png")


def make_screenshot_profile():
    img = phone_base()
    d = ImageDraw.Draw(img)
    status_bar(img)

    # Profile card
    d.rounded_rectangle([100, 170, 980, 820], 48, fill=ZINC_D, outline=(39, 39, 42), width=2)
    av = avatar(190, 0.3, "A")
    img.alpha_composite(av, (445, 230))
    d = ImageDraw.Draw(img)
    d.text((540, 470), "@adam", font=font_bungee(56), fill=WHITE, anchor="mm")
    d.text((540, 540), "Finding the wildest trips on the internet.", font=font_body(26),
           fill=(200, 200, 210), anchor="mm")

    stats = [("12", "UPLOADS"), ("38K", "TRIPS"), ("2.4K", "POINTS")]
    x = 240
    for val, lab in stats:
        d.text((x, 640), val, font=font_bungee(44), fill=WHITE, anchor="mm")
        d.text((x, 700), lab, font=font_body(20), fill=(140, 140, 150), anchor="mm")
        x += 300

    # Streak
    d.text((540, 780), "🔥 4-day streak", font=font_body(26), fill=(251, 146, 60), anchor="mm")

    # Referral card
    d.rounded_rectangle([100, 880, 980, 1330], 48, fill=(30, 20, 48), outline=(139, 92, 246, 90), width=3)
    d.text((540, 960), "INVITE FRIENDS", font=font_bungee(38), fill=WHITE, anchor="mm")
    d.text((540, 1020), "You both earn free credits", font=font_body(26), fill=(200, 200, 210), anchor="mm")
    d.rounded_rectangle([220, 1100, 640, 1180], 30, fill=BLACK, outline=(63, 63, 70), width=2)
    d.text((430, 1140), "TRIPX7K2", font=font_bungee(40), fill=(250, 204, 21), anchor="mm")
    btn = gradient((260, 80), PURPLE, PINK, vertical=False)
    btn = round_corners(btn, 40)
    img.alpha_composite(btn, (680, 1100))
    d = ImageDraw.Draw(img)
    d.text((810, 1140), "COPY", font=font_bungee(28), fill=WHITE, anchor="mm")
    d.text((540, 1240), "12 friends joined  •  +120 credits earned", font=font_body(22),
           fill=(190, 190, 200), anchor="mm")

    # Recent trips
    d.text((540, 1410), "RECENT TRIPS", font=font_bungee(32), fill=WHITE, anchor="mm")
    x = 150
    for seed, col in [(0.1, "T"), (0.5, "X"), (0.8, "Z")]:
        thumb = gradient((230, 410), lerp(PURPLE, INDIGO, seed), lerp(PINK, PURPLE, seed), vertical=False)
        thumb = round_corners(thumb, 26)
        img.alpha_composite(thumb, (x, 1480))
        d = ImageDraw.Draw(img)
        d.ellipse([x + 24, 1495, x + 64, 1535], fill=(255, 255, 255, 220))
        d.text((x + 116, 1560), "TRIPS", font=font_body(18), fill=(0, 0, 0, 200), anchor="mm")
        x += 260

    img.convert("RGB").save(os.path.join(OUT, "screenshot-4-profile.png"))
    print("screenshot-4-profile.png")


if __name__ == "__main__":
    make_feature_graphic()
    make_screenshot_feed()
    make_screenshot_ai()
    make_screenshot_leaderboard()
    make_screenshot_profile()
