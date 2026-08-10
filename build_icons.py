"""
Tasker brand mark generator.

Renders the icon at 8x and downsamples, so edges stay clean at every size.
Supersedes create_icons.js, which emitted flat squares with no antialiasing.

    python build_icons.py

Outputs into assets/:
    icon16.png / icon48.png   full-bleed (toolbar + extensions page)
    icon128.png               96x96 art centred in 128 (Chrome Web Store guidance)
    logo.svg                  vector master for the GitHub Pages site
    promo-440x280.png         small promo tile for the store listing
"""
from PIL import Image, ImageDraw, ImageFont
import os

SS = 1024                      # supersample canvas
INK  = (42, 15, 20, 255)       # --brand-ink     #2A0F14
GOLD = (250, 226, 97, 255)     # --accent-yellow #FAE261

# The mark: an ascending pulse. Normalized to the 0..1 icon square.
STROKE = 0.125
PULSE  = [(0.25, 0.60), (0.41, 0.675), (0.545, 0.325), (0.755, 0.505)]

ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")


def render(size_px, art_fraction=1.0):
    """Draw the mark at `size_px`. art_fraction < 1 leaves transparent padding."""
    img = Image.new("RGBA", (SS, SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    inset = SS * (1 - art_fraction) / 2
    span = SS - inset * 2
    d.rounded_rectangle([inset, inset, SS - inset, SS - inset],
                        radius=span * 0.235, fill=INK)

    xy = [(inset + x * span, inset + y * span) for x, y in PULSE]
    w = STROKE * span
    d.line(xy, fill=GOLD, width=int(w), joint="curve")
    for (x, y) in xy:                                   # round caps
        d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=GOLD)

    return img.resize((size_px, size_px), Image.LANCZOS)


def svg():
    """Vector master. Coordinates are the same 0..1 mark scaled to 128."""
    pts = " ".join(f"{x * 128:.1f},{y * 128:.1f}" for x, y in PULSE)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" role="img" aria-label="Tasker">
  <rect width="128" height="128" rx="30.1" fill="#2A0F14"/>
  <polyline points="{pts}" fill="none" stroke="#FAE261"
            stroke-width="{STROKE * 128:.1f}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
'''


def load_font(size, bold=True):
    """Prefer a real UI face; fall back to Pillow's bitmap font if absent."""
    faces = ("segoeuib.ttf", "arialbd.ttf") if bold else ("segoeui.ttf", "arial.ttf")
    for name in faces:
        path = os.path.join(r"C:\Windows\Fonts", name)
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def promo_tile():
    """440x280 small promo tile: mark on the app's cream background."""
    W, H = 440, 280
    tile = Image.new("RGBA", (W, H), (248, 250, 247, 255))   # page bg #F8FAF7
    mark = render(120)
    tile.paste(mark, ((W - 120) // 2, 42), mark)

    d = ImageDraw.Draw(tile)
    title = load_font(40)
    sub = load_font(19, bold=False)

    # anchor="mt" centres horizontally on the given x and hangs from the top.
    d.text((W // 2, 178), "Tasker", font=title, fill=(42, 15, 20), anchor="mt")
    d.text((W // 2, 226), "Activity tracking & monthly recaps",
           font=sub, fill=(118, 110, 112), anchor="mt")
    return tile


if __name__ == "__main__":
    os.makedirs(ASSETS, exist_ok=True)

    for s in (16, 48):
        render(s).save(os.path.join(ASSETS, f"icon{s}.png"))

    # Store guidance: art occupies 96 of the 128 canvas, 16px padding each side.
    render(128, art_fraction=96 / 128).save(os.path.join(ASSETS, "icon128.png"))

    with open(os.path.join(ASSETS, "logo.svg"), "w", encoding="utf-8") as f:
        f.write(svg())

    promo_tile().save(os.path.join(ASSETS, "promo-440x280.png"))

    print("Wrote icon16, icon48, icon128, logo.svg, promo-440x280 to assets/")
