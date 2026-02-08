"""
Brand Assets Generator for Totem App
Converts PDF logos to PNG and creates app icons and splash screen.
"""

import os
import sys
from PIL import Image, ImageDraw, ImageFilter
import fitz  # PyMuPDF

# Paths
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOWNLOADS = os.path.expanduser("~/Downloads")
ASSETS_DIR = os.path.join(PROJECT_ROOT, "src", "assets")
LOGO_DIR = os.path.join(ASSETS_DIR, "logo")

# Source PDFs
FULL_LOGO_PDF = os.path.join(DOWNLOADS, "לוגו טוטם מלא.pdf")
ICON_LOGO_PDF = os.path.join(DOWNLOADS, "טוטם- רק לוגו.pdf")

# Brand colors
BRAND_DARK = (11, 11, 15)  # #0B0B0F
BRAND_DARK_2 = (17, 24, 39)  # #111827
BRAND_CHARCOAL = (35, 31, 32)  # #231F20 (from logo)


def pdf_to_png(pdf_path, output_path, dpi=300):
    """Convert PDF to PNG using PyMuPDF"""
    print(f"  Converting {os.path.basename(pdf_path)}...")
    doc = fitz.open(pdf_path)
    page = doc.load_page(0)
    
    # High resolution matrix for sharp output
    zoom = dpi / 72
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=True)
    
    # Save as PNG
    pix.save(output_path)
    doc.close()
    print(f"  ✓ Saved to {output_path}")
    return output_path


def make_monochrome(input_path, output_path, color):
    """Convert image to monochrome (single color)"""
    img = Image.open(input_path).convert("RGBA")
    
    # Split into channels
    r, g, b, a = img.split()
    
    # Create new image with target color
    mono = Image.new("RGBA", img.size, (0, 0, 0, 0))
    for x in range(img.size[0]):
        for y in range(img.size[1]):
            alpha = a.getpixel((x, y))
            if alpha > 0:
                # Get original darkness (inverted for logo)
                orig_r, orig_g, orig_b = r.getpixel((x, y)), g.getpixel((x, y)), b.getpixel((x, y))
                # If dark in original, use target color
                darkness = 255 - int((orig_r + orig_g + orig_b) / 3)
                if darkness > 30:  # Threshold for what counts as "ink"
                    mono.putpixel((x, y), (*color, alpha))
    
    mono.save(output_path, optimize=True)
    print(f"  ✓ Monochrome saved to {os.path.basename(output_path)}")


def make_monochrome_fast(input_path, output_path, target_color):
    """Fast monochrome conversion using PIL operations"""
    img = Image.open(input_path).convert("RGBA")
    
    # Get alpha channel
    r, g, b, a = img.split()
    
    # Create grayscale from RGB
    gray = Image.merge("RGB", (r, g, b)).convert("L")
    
    # Invert (dark pixels become white mask)
    # For a logo with dark content on transparent, we want the dark parts
    inverted = Image.eval(gray, lambda x: 255 - x)
    
    # Threshold to binary
    threshold = 128
    mask = inverted.point(lambda x: 255 if x > threshold else 0)
    
    # Combine with alpha
    final_alpha = Image.composite(mask, Image.new("L", img.size, 0), a)
    
    # Create colored image
    result = Image.new("RGBA", img.size, (*target_color, 0))
    colored = Image.new("RGBA", img.size, (*target_color, 255))
    result = Image.composite(colored, result, final_alpha)
    
    result.save(output_path, optimize=True)
    print(f"  ✓ Monochrome saved to {os.path.basename(output_path)}")


def create_app_icon(logo_path, output_path, size=1024, padding_ratio=0.62):
    """Create iOS app icon with dark background"""
    print(f"  Creating app icon...")
    
    # Load logo
    logo = Image.open(logo_path).convert("RGBA")
    
    # Create dark background
    canvas = Image.new("RGBA", (size, size), BRAND_DARK + (255,))
    
    # Resize logo to fit with padding
    target_w = int(size * padding_ratio)
    w, h = logo.size
    new_h = int(h * target_w / w)
    logo_resized = logo.resize((target_w, new_h), Image.Resampling.LANCZOS)
    
    # Center on canvas
    x = (size - logo_resized.size[0]) // 2
    y = (size - logo_resized.size[1]) // 2
    canvas.alpha_composite(logo_resized, (x, y))
    
    # Save as RGB (iOS requires no alpha for app icon)
    canvas.convert("RGB").save(output_path, optimize=True)
    print(f"  ✓ App icon saved to {os.path.basename(output_path)}")


def create_adaptive_icon(logo_path, output_path, size=1024, padding_ratio=0.72):
    """Create Android adaptive icon foreground (transparent)"""
    print(f"  Creating adaptive icon...")
    
    # Load logo
    logo = Image.open(logo_path).convert("RGBA")
    
    # Create transparent canvas
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    
    # Resize logo with safe zone padding
    target_w = int(size * padding_ratio)
    w, h = logo.size
    new_h = int(h * target_w / w)
    logo_resized = logo.resize((target_w, new_h), Image.Resampling.LANCZOS)
    
    # Center on canvas
    x = (size - logo_resized.size[0]) // 2
    y = (size - logo_resized.size[1]) // 2
    canvas.alpha_composite(logo_resized, (x, y))
    
    canvas.save(output_path, optimize=True)
    print(f"  ✓ Adaptive icon saved to {os.path.basename(output_path)}")


def create_splash_screen(logo_path, output_path, width=1284, height=2778):
    """Create splash screen with gradient background"""
    print(f"  Creating splash screen...")
    
    # Create gradient background
    top_color = BRAND_DARK
    bottom_color = BRAND_DARK_2
    
    gradient = Image.new("RGB", (width, height), top_color)
    draw = ImageDraw.Draw(gradient)
    
    for y in range(height):
        t = y / (height - 1)
        r = int(top_color[0] * (1 - t) + bottom_color[0] * t)
        g = int(top_color[1] * (1 - t) + bottom_color[1] * t)
        b = int(top_color[2] * (1 - t) + bottom_color[2] * t)
        draw.line([(0, y), (width, y)], fill=(r, g, b))
    
    splash = gradient.convert("RGBA")
    
    # Load and resize logo
    logo = Image.open(logo_path).convert("RGBA")
    target_w = int(width * 0.58)
    w, h = logo.size
    new_h = int(h * target_w / w)
    logo_resized = logo.resize((target_w, new_h), Image.Resampling.LANCZOS)
    
    # Position slightly above center
    x = (width - logo_resized.size[0]) // 2
    y = int(height * 0.36 - logo_resized.size[1] // 2)
    
    splash.alpha_composite(logo_resized, (x, y))
    splash.convert("RGB").save(output_path, optimize=True)
    print(f"  ✓ Splash screen saved to {os.path.basename(output_path)}")


def main():
    print("\n🎨 Totem Brand Assets Generator\n")
    print("=" * 50)
    
    # Check source files exist
    if not os.path.exists(FULL_LOGO_PDF):
        print(f"❌ Error: Full logo PDF not found at {FULL_LOGO_PDF}")
        sys.exit(1)
    if not os.path.exists(ICON_LOGO_PDF):
        print(f"❌ Error: Icon logo PDF not found at {ICON_LOGO_PDF}")
        sys.exit(1)
    
    # Create directories
    os.makedirs(LOGO_DIR, exist_ok=True)
    os.makedirs(ASSETS_DIR, exist_ok=True)
    
    # Step 1: Convert PDFs to high-res PNGs
    print("\n📄 Step 1: Converting PDFs to PNG...")
    full_png = os.path.join(LOGO_DIR, "logo-full-original.png")
    icon_png = os.path.join(LOGO_DIR, "logo-icon-original.png")
    
    pdf_to_png(FULL_LOGO_PDF, full_png, dpi=300)
    pdf_to_png(ICON_LOGO_PDF, icon_png, dpi=300)
    
    # Step 2: Create monochrome versions
    print("\n🎨 Step 2: Creating monochrome versions...")
    
    # White versions (for dark backgrounds)
    white = (255, 255, 255)
    make_monochrome_fast(full_png, os.path.join(LOGO_DIR, "logo-full-white.png"), white)
    make_monochrome_fast(icon_png, os.path.join(LOGO_DIR, "logo-icon-white.png"), white)
    
    # Dark versions (for light backgrounds)
    dark = (17, 24, 39)  # #111827
    make_monochrome_fast(full_png, os.path.join(LOGO_DIR, "logo-full-dark.png"), dark)
    make_monochrome_fast(icon_png, os.path.join(LOGO_DIR, "logo-icon-dark.png"), dark)
    
    # Step 3: Create sized versions
    print("\n📐 Step 3: Creating sized versions...")
    
    # Full logo versions
    full_orig = Image.open(full_png)
    for suffix, width in [("", 900), ("@2x", 600), ("@3x", 300)]:
        out_path = os.path.join(LOGO_DIR, f"logo-full{suffix}.png")
        w, h = full_orig.size
        new_h = int(h * width / w)
        resized = full_orig.resize((width, new_h), Image.Resampling.LANCZOS)
        resized.save(out_path, optimize=True)
        print(f"  ✓ logo-full{suffix}.png ({width}px)")
    
    # Icon versions
    icon_orig = Image.open(icon_png)
    for suffix, width in [("", 384), ("@2x", 256), ("@3x", 128)]:
        out_path = os.path.join(LOGO_DIR, f"logo-icon{suffix}.png")
        w, h = icon_orig.size
        new_h = int(h * width / w)
        resized = icon_orig.resize((width, new_h), Image.Resampling.LANCZOS)
        resized.save(out_path, optimize=True)
        print(f"  ✓ logo-icon{suffix}.png ({width}px)")
    
    # Step 4: Create app assets
    print("\n📱 Step 4: Creating app assets...")
    
    white_icon = os.path.join(LOGO_DIR, "logo-icon-white.png")
    white_full = os.path.join(LOGO_DIR, "logo-full-white.png")
    
    # iOS App Icon (1024x1024, dark bg, white logo)
    create_app_icon(white_icon, os.path.join(ASSETS_DIR, "icon.png"))
    
    # Android Adaptive Icon foreground
    create_adaptive_icon(white_icon, os.path.join(ASSETS_DIR, "adaptive-icon.png"))
    
    # Splash screen
    create_splash_screen(white_full, os.path.join(ASSETS_DIR, "splash.png"))
    
    # Step 5: Summary
    print("\n" + "=" * 50)
    print("✅ All assets generated successfully!\n")
    print("📁 Generated files:")
    print(f"   {LOGO_DIR}/")
    for f in sorted(os.listdir(LOGO_DIR)):
        size = os.path.getsize(os.path.join(LOGO_DIR, f))
        print(f"      {f} ({size // 1024}KB)")
    print(f"\n   {ASSETS_DIR}/")
    for f in ["icon.png", "adaptive-icon.png", "splash.png"]:
        path = os.path.join(ASSETS_DIR, f)
        if os.path.exists(path):
            size = os.path.getsize(path)
            print(f"      {f} ({size // 1024}KB)")
    
    print("\n🎯 Next steps:")
    print("   1. Update app.json with new splash backgroundColor: '#0B0B0F'")
    print("   2. Update ThemeContext.tsx with brand colors")
    print("   3. Test on device/simulator")


if __name__ == "__main__":
    main()
