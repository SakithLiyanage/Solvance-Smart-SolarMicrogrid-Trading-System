import os
from PIL import Image

src_path = r"C:\Users\user\.gemini\antigravity-ide\brain\b33492c6-2187-41c0-bc21-df152304c5e1\.user_uploaded\media_1789237163795.jpg"
img = Image.open(src_path)
width, height = img.size

# Target output directories
web_public = r"c:\Users\user\Downloads\EAD\web-client\public"
android_drawable = r"c:\Users\user\Downloads\EAD\mobile-client\app\src\main\res\drawable"
docs_branding = r"c:\Users\user\Downloads\EAD\docs\branding"

for d in [web_public, android_drawable, docs_branding]:
    os.makedirs(d, exist_ok=True)

# 1. Dark logo: bottom center tile - strictly inner navy box without white border
# The dark tile is roughly x: [0.342 * w, 0.655 * w], y: [0.552 * h, 0.995 * h]
dark_box = (int(width * 0.343), int(height * 0.552), int(width * 0.655), int(height * 0.995))
dark_crop = img.crop(dark_box)

# 2. Horizontal light logo: top-left (Sun/S + Text)
light_horiz_box = (int(width * 0.04), int(height * 0.05), int(width * 0.62), int(height * 0.48))
light_horiz_crop = img.crop(light_horiz_box)

# 3. Square Icon Mark: top-right
icon_box = (int(width * 0.70), int(height * 0.03), int(width * 0.96), int(height * 0.48))
icon_crop = img.crop(icon_box)

# 4. Vertical light logo: bottom-right
vert_box = (int(width * 0.70), int(height * 0.55), int(width * 0.96), int(height * 0.96))
vert_crop = img.crop(vert_box)

# Save to docs branding
dark_crop.save(os.path.join(docs_branding, "solvance_dark_logo.png"))
light_horiz_crop.save(os.path.join(docs_branding, "solvance_light_horizontal.png"))
icon_crop.save(os.path.join(docs_branding, "solvance_icon.png"))
vert_crop.save(os.path.join(docs_branding, "solvance_vertical.png"))

# Save to web-client public assets
dark_crop.save(os.path.join(web_public, "solvance_logo_dark.png"))
light_horiz_crop.save(os.path.join(web_public, "solvance_logo_light.png"))
icon_crop.save(os.path.join(web_public, "solvance_icon.png"))
icon_crop.save(os.path.join(web_public, "favicon.png"))

# Save to mobile-client Android assets
dark_crop.save(os.path.join(android_drawable, "logo_dark.png"))
light_horiz_crop.save(os.path.join(android_drawable, "logo_light.png"))
icon_crop.save(os.path.join(android_drawable, "logo_icon.png"))
icon_crop.save(os.path.join(android_drawable, "ic_solvance_logo.png"))

print("Logos re-cropped with pixel-perfect bounds and distributed!")
