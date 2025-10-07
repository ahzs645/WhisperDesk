#!/usr/bin/env python3
"""
Generate all required Tauri app icons from SVG source
Generates PNG files at multiple resolutions, then converts to .icns and .ico
"""

import os
import sys
from pathlib import Path

try:
    from PIL import Image
    import cairosvg
except ImportError:
    print("❌ Required packages not found. Install with:")
    print("   pip install Pillow cairosvg")
    sys.exit(1)

# Icon sizes needed for Tauri
ICON_SIZES = [
    32, 128, 256, 512,  # Standard sizes
    44, 71, 89, 107, 142, 150, 284, 310,  # Windows Store sizes
]

def generate_png_from_svg(svg_path, output_path, size):
    """Generate PNG from SVG at specified size"""
    print(f"  Generating {size}x{size}px PNG...")
    cairosvg.svg2png(
        url=svg_path,
        write_to=output_path,
        output_width=size,
        output_height=size
    )

def generate_icns(png_1024_path, output_path):
    """Generate macOS .icns file from 1024x1024 PNG"""
    print("  Generating .icns for macOS...")

    # Create iconset directory
    iconset_dir = Path(output_path).parent / "icon.iconset"
    iconset_dir.mkdir(exist_ok=True)

    # Generate all required sizes for .icns
    sizes_for_icns = {
        16: ['icon_16x16.png'],
        32: ['icon_16x16@2x.png', 'icon_32x32.png'],
        64: ['icon_32x32@2x.png'],
        128: ['icon_128x128.png'],
        256: ['icon_128x128@2x.png', 'icon_256x256.png'],
        512: ['icon_256x256@2x.png', 'icon_512x512.png'],
        1024: ['icon_512x512@2x.png']
    }

    source_img = Image.open(png_1024_path)

    for size, filenames in sizes_for_icns.items():
        resized = source_img.resize((size, size), Image.Resampling.LANCZOS)
        for filename in filenames:
            resized.save(iconset_dir / filename, 'PNG')

    # Use iconutil to create .icns
    os.system(f'iconutil -c icns "{iconset_dir}" -o "{output_path}"')

    # Clean up iconset directory
    os.system(f'rm -rf "{iconset_dir}"')

    print(f"  ✅ Created {output_path}")

def generate_ico(png_path, output_path):
    """Generate Windows .ico file"""
    print("  Generating .ico for Windows...")

    # ICO needs multiple sizes embedded
    ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]

    source_img = Image.open(png_path)
    images = []

    for size in ico_sizes:
        resized = source_img.resize(size, Image.Resampling.LANCZOS)
        images.append(resized)

    # Save as ICO with all sizes
    images[0].save(
        output_path,
        format='ICO',
        sizes=ico_sizes,
        append_images=images[1:]
    )

    print(f"  ✅ Created {output_path}")

def main():
    # Paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    svg_source = project_root / "assets" / "icon-template.svg"
    output_dir = project_root / "apps" / "native" / "src-tauri" / "icons"

    if not svg_source.exists():
        # Try WhisperDesk-1 path
        svg_source = Path("/Users/ahmadjalil/Github/WhisperDesk-1/assets/icon-template.svg")
        if not svg_source.exists():
            print(f"❌ SVG source not found: {svg_source}")
            sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"🎨 Generating icons from: {svg_source}")
    print(f"   Output directory: {output_dir}")
    print()

    # Generate 1024x1024 base PNG for processing
    temp_1024 = output_dir / "temp_1024.png"
    generate_png_from_svg(str(svg_source), str(temp_1024), 1024)

    # Generate all required PNG sizes
    print("\n📐 Generating PNG files...")
    for size in ICON_SIZES:
        output_path = output_dir / f"{size}x{size}.png"
        img = Image.open(temp_1024)
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(output_path, 'PNG')
        print(f"  ✅ {size}x{size}.png")

    # Generate Tauri-specific sizes
    tauri_sizes = {
        '32x32.png': 32,
        '128x128.png': 128,
        '128x128@2x.png': 256,
        'icon.png': 512,
    }

    for filename, size in tauri_sizes.items():
        output_path = output_dir / filename
        img = Image.open(temp_1024)
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(output_path, 'PNG')
        print(f"  ✅ {filename}")

    # Generate Windows Store sizes
    store_sizes = {
        'Square30x30Logo.png': 30,
        'Square44x44Logo.png': 44,
        'Square71x71Logo.png': 71,
        'Square89x89Logo.png': 89,
        'Square107x107Logo.png': 107,
        'Square142x142Logo.png': 142,
        'Square150x150Logo.png': 150,
        'Square284x284Logo.png': 284,
        'Square310x310Logo.png': 310,
        'StoreLogo.png': 50,
    }

    print("\n🏪 Generating Windows Store logos...")
    for filename, size in store_sizes.items():
        output_path = output_dir / filename
        img = Image.open(temp_1024)
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(output_path, 'PNG')
        print(f"  ✅ {filename}")

    # Generate platform-specific formats
    print("\n🖥️  Generating platform-specific formats...")
    generate_icns(str(temp_1024), str(output_dir / "icon.icns"))
    generate_ico(str(temp_1024), str(output_dir / "icon.ico"))

    # Clean up temp file
    temp_1024.unlink()

    print("\n✨ Icon generation complete!")
    print(f"   Generated {len(ICON_SIZES) + len(tauri_sizes) + len(store_sizes) + 2} icon files")
    print(f"   Location: {output_dir}")

if __name__ == "__main__":
    main()
