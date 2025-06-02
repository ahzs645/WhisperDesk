#!/bin/bash

# Icon Generator Script for Whisper Desk
# Generates all required icon sizes for macOS, Windows, and Linux

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if SVG file exists
SVG_FILE="icon.svg"
if [ ! -f "$SVG_FILE" ]; then
    echo -e "${RED}Error: $SVG_FILE not found!${NC}"
    echo "Please save your SVG as 'icon.svg' in the current directory."
    exit 1
fi

echo -e "${GREEN}🎨 Whisper Desk Icon Generator${NC}"
echo "================================================"

# Check for ImageMagick
if ! command -v magick &> /dev/null && ! command -v convert &> /dev/null; then
    echo -e "${RED}Error: ImageMagick not found!${NC}"
    echo "Please install ImageMagick:"
    echo "  macOS: brew install imagemagick"
    echo "  Ubuntu: sudo apt install imagemagick"
    echo "  Windows: Download from https://imagemagick.org/script/download.php"
    exit 1
fi

# Use 'magick' if available (newer ImageMagick), otherwise 'convert'
if command -v magick &> /dev/null; then
    CONVERT_CMD="magick"
else
    CONVERT_CMD="convert"
fi

# Create directory structure
echo -e "${YELLOW}📁 Creating directory structure...${NC}"
mkdir -p resources/icons
mkdir -p resources/macos
mkdir -p resources/windows
mkdir -p resources/linux

# Define all required sizes
SIZES="16 24 32 48 64 128 256 512 1024"

# Generate PNG files
echo -e "${YELLOW}🖼️  Generating PNG files...${NC}"
for size in $SIZES; do
    output_file="resources/icons/${size}x${size}.png"
    echo "  Creating ${size}x${size}.png..."
    $CONVERT_CMD "$SVG_FILE" -resize ${size}x${size} "$output_file"
done

# Copy files for each platform
echo -e "${YELLOW}📋 Organizing files by platform...${NC}"

# macOS files
echo "  📱 macOS icons..."
cp resources/icons/16x16.png resources/macos/
cp resources/icons/32x32.png resources/macos/
cp resources/icons/128x128.png resources/macos/
cp resources/icons/256x256.png resources/macos/
cp resources/icons/512x512.png resources/macos/
cp resources/icons/1024x1024.png resources/macos/

# Windows files  
echo "  🪟 Windows icons..."
cp resources/icons/16x16.png resources/windows/
cp resources/icons/24x24.png resources/windows/
cp resources/icons/32x32.png resources/windows/
cp resources/icons/48x48.png resources/windows/
cp resources/icons/64x64.png resources/windows/
cp resources/icons/128x128.png resources/windows/
cp resources/icons/256x256.png resources/windows/

# Linux files
echo "  🐧 Linux icons..."
cp resources/icons/*.png resources/linux/
cp resources/icons/512x512.png resources/linux/icon.png  # Main icon

# Try to create ICO file for Windows
echo -e "${YELLOW}🪟 Creating Windows ICO file...${NC}"
if $CONVERT_CMD \
    resources/icons/16x16.png \
    resources/icons/24x24.png \
    resources/icons/32x32.png \
    resources/icons/48x48.png \
    resources/icons/64x64.png \
    resources/icons/128x128.png \
    resources/icons/256x256.png \
    resources/icons/icon.ico 2>/dev/null; then
    echo "  ✅ Created icon.ico"
    # Also copy to windows folder
    cp resources/icons/icon.ico resources/windows/icon.ico
else
    echo "  ⚠️  Could not create ICO file automatically"
    echo "     You can create it manually with GIMP or online converters"
fi

# Try to create ICNS file for macOS (macOS only)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "${YELLOW}🍎 Creating macOS ICNS file...${NC}"
    
    # Create iconset directory
    mkdir -p resources/macos/AppIcon.iconset
    
    # Copy files with required naming
    cp resources/icons/16x16.png resources/macos/AppIcon.iconset/icon_16x16.png
    cp resources/icons/32x32.png resources/macos/AppIcon.iconset/icon_16x16@2x.png
    cp resources/icons/32x32.png resources/macos/AppIcon.iconset/icon_32x32.png
    cp resources/icons/64x64.png resources/macos/AppIcon.iconset/icon_32x32@2x.png
    cp resources/icons/128x128.png resources/macos/AppIcon.iconset/icon_128x128.png
    cp resources/icons/256x256.png resources/macos/AppIcon.iconset/icon_128x128@2x.png
    cp resources/icons/256x256.png resources/macos/AppIcon.iconset/icon_256x256.png
    cp resources/icons/512x512.png resources/macos/AppIcon.iconset/icon_256x256@2x.png
    cp resources/icons/512x512.png resources/macos/AppIcon.iconset/icon_512x512.png
    cp resources/icons/1024x1024.png resources/macos/AppIcon.iconset/icon_512x512@2x.png
    
    # Create ICNS file
    if iconutil -c icns resources/macos/AppIcon.iconset -o resources/icons/icon.icns 2>/dev/null; then
        echo "  ✅ Created icon.icns"
        # Also copy to macos folder
        cp resources/icons/icon.icns resources/macos/icon.icns
        rm -rf resources/macos/AppIcon.iconset  # Clean up
    else
        echo "  ⚠️  Could not create ICNS file"
        echo "     iconutil might not be available"
    fi
else
    echo -e "${YELLOW}🍎 ICNS file creation skipped (requires macOS)${NC}"
fi

# Generate summary
echo ""
echo -e "${GREEN}✨ Icon generation complete!${NC}"
echo "================================================"
echo ""
echo "📁 Generated files:"
echo "  resources/icons/        - All PNG sizes + main ICO/ICNS files"
echo "  resources/macos/        - macOS specific files"
echo "  resources/windows/      - Windows specific files"  
echo "  resources/linux/        - Linux specific files"
echo ""
echo "🎯 Key files for electron-builder:"
echo "  resources/icons/icon.icns    - macOS app icon"
echo "  resources/icons/icon.ico     - Windows app icon"
echo "  resources/icons/512x512.png - Linux app icon"
echo ""
echo "🎯 Next steps:"
echo "  1. Copy the appropriate files to your app project"
echo "  2. Reference them in your build configuration"
echo "  3. Test the icons at different sizes"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"