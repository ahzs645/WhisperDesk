#!/bin/bash

echo "🔧 Creating WhisperDesk resources manually..."

# Create directories
mkdir -p resources/icons

# Create a simple DMG background using macOS built-in tools
echo "🎨 Creating simple DMG background..."

# Method 1: Use QuickLook to create a simple background
cat > /tmp/create_bg.swift << 'EOF'
import Cocoa
import CoreGraphics

let width = 658
let height = 498

// Create a bitmap context
let colorSpace = CGColorSpaceCreateDeviceRGB()
let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 4 * width, space: colorSpace, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!

// Create gradient
let gradient = CGGradient(colorsSpace: colorSpace, colors: [
    CGColor(red: 0.9, green: 0.95, blue: 1.0, alpha: 1.0),
    CGColor(red: 0.8, green: 0.9, blue: 0.98, alpha: 1.0)
] as CFArray, locations: [0.0, 1.0])!

context.drawLinearGradient(gradient, start: CGPoint(x: 0, y: 0), end: CGPoint(x: 0, y: height), options: [])

// Add text
context.setFillColor(CGColor(red: 0.2, green: 0.2, blue: 0.2, alpha: 1.0))
let font = CTFontCreateWithName("Arial" as CFString, 24, nil)
let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: NSColor.darkGray]
let text = NSAttributedString(string: "WhisperDesk Enhanced", attributes: attributes)

context.saveGState()
context.translateBy(x: width/2 - 120, y: height - 80)
let line = CTLineCreateWithAttributedString(text)
CTLineDraw(line, context)
context.restoreGState()

// Save image
let image = context.makeImage()!
let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: "resources/dmg-background.png") as CFURL, "public.png" as CFString, 1, nil)!
CGImageDestinationAddImage(dest, image, nil)
CGImageDestinationFinalize(dest)

print("✅ Created DMG background")
EOF

# Try to compile and run Swift script
if command -v swift &> /dev/null; then
    echo "Using Swift to create background..."
    swift /tmp/create_bg.swift 2>/dev/null && echo "✅ DMG background created with Swift" || {
        echo "⚠️  Swift compilation failed, using alternative method..."
        # Fallback: Create a simple solid color image
        python3 -c "
import sys
try:
    from PIL import Image, ImageDraw
    img = Image.new('RGB', (658, 498), color='#f0f8ff')
    draw = ImageDraw.Draw(img)
    draw.text((200, 200), 'WhisperDesk Enhanced', fill='#333333')
    img.save('resources/dmg-background.png')
    print('✅ Created simple background with Python')
except ImportError:
    print('❌ Neither Swift nor Python/PIL available')
    sys.exit(1)
" || {
            echo "❌ Could not create background image"
            echo "📝 Creating placeholder file..."
            # Create a minimal PNG file as placeholder
            echo "This would normally be a PNG image" > resources/dmg-background.png
        }
    }
else
    echo "⚠️  Swift not available"
fi

# Create app icon using built-in macOS resources
echo "📱 Creating app icon..."

# Copy a system icon as base
if [ -f "/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/GenericApplicationIcon.icns" ]; then
    cp "/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/GenericApplicationIcon.icns" resources/icons/icon.icns
    echo "✅ Copied system icon as placeholder"
elif [ -f "/System/Library/CoreServices/Finder.app/Contents/Resources/Finder.icns" ]; then
    cp "/System/Library/CoreServices/Finder.app/Contents/Resources/Finder.icns" resources/icons/icon.icns
    echo "✅ Copied Finder icon as placeholder"
else
    echo "⚠️  Could not find system icon to copy"
    # Create a simple text file as placeholder
    echo "ICNS placeholder" > resources/icons/icon.icns
fi

# Clean up
rm -f /tmp/create_bg.swift

echo ""
echo "📋 Resources status:"
echo "   DMG Background: $([ -f resources/dmg-background.png ] && echo '✅' || echo '❌') resources/dmg-background.png"
echo "   App Icon: $([ -f resources/icons/icon.icns ] && echo '✅' || echo '❌') resources/icons/icon.icns"
echo ""

# Check file sizes to make sure they're real files
if [ -f resources/dmg-background.png ]; then
    size=$(wc -c < resources/dmg-background.png)
    if [ $size -lt 1000 ]; then
        echo "⚠️  DMG background seems too small (${size} bytes) - might be placeholder"
    else
        echo "✅ DMG background looks good (${size} bytes)"
    fi
fi

if [ -f resources/icons/icon.icns ]; then
    size=$(wc -c < resources/icons/icon.icns)
    if [ $size -lt 1000 ]; then
        echo "⚠️  Icon seems too small (${size} bytes) - might be placeholder"
    else
        echo "✅ Icon looks good (${size} bytes)"
    fi
fi

echo ""
echo "🎉 Resource creation complete!"
echo "💡 You can now run 'make build' to test the build process."