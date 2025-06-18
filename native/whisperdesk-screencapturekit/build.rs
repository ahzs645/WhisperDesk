fn main() {
    // Link ScreenCaptureKit framework
    println!("cargo:rustc-link-lib=framework=ScreenCaptureKit");
    println!("cargo:rustc-link-lib=framework=CoreMedia");
    println!("cargo:rustc-link-lib=framework=CoreVideo");
    println!("cargo:rustc-link-lib=framework=AVFoundation");
    println!("cargo:rustc-link-lib=framework=Foundation");
    println!("cargo:rustc-link-lib=framework=AppKit");
    
    // Set minimum macOS version for ScreenCaptureKit
    println!("cargo:rustc-env=MACOSX_DEPLOYMENT_TARGET=12.3");
    
    napi_build::setup();
} 