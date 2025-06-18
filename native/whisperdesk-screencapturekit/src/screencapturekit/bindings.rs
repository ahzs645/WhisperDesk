use objc2::runtime::AnyObject;
use objc2::{msg_send, Encode, Encoding};
use objc2_foundation::{NSArray, NSString, NSNumber};

// We'll use raw class access instead of custom ClassType implementations
// since the ScreenCaptureKit classes aren't available in the objc2 framework crates yet

// SCShareableContent bindings
pub struct SCShareableContent;

// SCDisplay bindings
pub struct SCDisplay;

// SCWindow bindings
pub struct SCWindow;

// SCContentFilter bindings
pub struct SCContentFilter;

// SCStream bindings
pub struct SCStream;

// SCStreamConfiguration bindings
pub struct SCStreamConfiguration;

// CGRect and related structures for window frame handling
#[repr(C)]
pub struct CGRect {
    pub origin: CGPoint,
    pub size: CGSize,
}

#[repr(C)]
pub struct CGPoint {
    pub x: f64,
    pub y: f64,
}

#[repr(C)]
pub struct CGSize {
    pub width: f64,
    pub height: f64,
}

unsafe impl Encode for CGRect {
    const ENCODING: Encoding = Encoding::Struct("CGRect", &[CGPoint::ENCODING, CGSize::ENCODING]);
}

unsafe impl Encode for CGPoint {
    const ENCODING: Encoding = Encoding::Struct("CGPoint", &[f64::ENCODING, f64::ENCODING]);
}

unsafe impl Encode for CGSize {
    const ENCODING: Encoding = Encoding::Struct("CGSize", &[f64::ENCODING, f64::ENCODING]);
} 