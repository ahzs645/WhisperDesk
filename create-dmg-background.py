#!/usr/bin/env python3
"""
Create a simple DMG background image for WhisperDesk Enhanced
Standard DMG background size: 658x498 pixels
"""

try:
    from PIL import Image, ImageDraw, ImageFont
    import os
except ImportError:
    print("❌ PIL (Pillow) not found. Install with: pip install Pillow")
    exit(1)

def create_dmg_background():
    # Standard DMG size
    width, height = 658, 498
    
    # Create image with gradient background
    img = Image.new('RGB', (width, height), color='#f5f5f5')
    draw = ImageDraw.Draw(img)
    
    # Create a subtle gradient
    for y in range(height):
        # Blue gradient from light to slightly darker
        alpha = y / height
        r = int(240 + (220 - 240) * alpha)
        g = int(248 + (235 - 248) * alpha) 
        b = int(255 + (250 - 255) * alpha)
        color = (r, g, b)
        draw.line([(0, y), (width, y)], fill=color)
    
    # Add app title
    try:
        # Try to use a nice font
        font_large = ImageFont.truetype("Arial.ttf", 36)
        font_small = ImageFont.truetype("Arial.ttf", 18)
    except (OSError, IOError):
        try:
            # Fallback to system fonts on macOS
            font_large = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", 36)
            font_small = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", 18)
        except (OSError, IOError):
            # Final fallback to default font
            font_large = ImageFont.load_default()
            font_small = ImageFont.load_default()
    
    # Main title
    title = "WhisperDesk Enhanced"
    bbox = draw.textbbox((0, 0), title, font=font_large)
    text_width = bbox[2] - bbox[0]
    x = (width - text_width) // 2
    y = 50
    
    # Add shadow effect
    draw.text((x + 2, y + 2), title, fill=(0, 0, 0, 30), font=font_large)
    draw.text((x, y), title, fill=(51, 51, 51), font=font_large)
    
    # Subtitle
    subtitle = "Advanced AI-Powered Transcription"
    bbox = draw.textbbox((0, 0), subtitle, font=font_small)
    text_width = bbox[2] - bbox[0]
    x = (width - text_width) // 2
    y = 100
    draw.text((x, y), subtitle, fill=(102, 102, 102), font=font_small)
    
    # Add some decorative elements
    # Microphone icon area (simple circle for now)
    center_x, center_y = width // 2, 200
    circle_radius = 30
    
    # Outer circle (light)
    draw.ellipse([
        center_x - circle_radius, center_y - circle_radius,
        center_x + circle_radius, center_y + circle_radius
    ], fill=(100, 150, 255, 50), outline=(100, 150, 255))
    
    # Inner circle (darker)
    inner_radius = 20
    draw.ellipse([
        center_x - inner_radius, center_y - inner_radius,
        center_x + inner_radius, center_y + inner_radius
    ], fill=(70, 130, 255), outline=(50, 110, 235))
    
    # Simple microphone shape
    mic_width, mic_height = 8, 16
    draw.rectangle([
        center_x - mic_width//2, center_y - mic_height//2,
        center_x + mic_width//2, center_y + mic_height//2
    ], fill=(255, 255, 255))
    
    # Instructions at the bottom
    instruction = "Drag the app to Applications folder to install"
    bbox = draw.textbbox((0, 0), instruction, font=font_small)
    text_width = bbox[2] - bbox[0]
    x = (width - text_width) // 2
    y = height - 60
    draw.text((x, y), instruction, fill=(128, 128, 128), font=font_small)
    
    # Save the image
    os.makedirs('resources', exist_ok=True)
    output_path = 'resources/dmg-background.png'
    img.save(output_path, 'PNG')
    
    print(f"✅ Created DMG background: {output_path}")
    print(f"   Size: {width}x{height} pixels")
    print(f"   Format: PNG")
    
    return output_path

if __name__ == "__main__":
    print("🎨 Creating DMG background for WhisperDesk Enhanced...")
    create_dmg_background()
    print("🎉 Done! You can now run 'make build' successfully.")