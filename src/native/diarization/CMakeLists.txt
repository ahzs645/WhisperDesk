# src/native/diarization/CMakeLists.txt - FIXED for macOS ARM64
cmake_minimum_required(VERSION 3.15)
project(diarize-cli VERSION 1.0.0 DESCRIPTION "WhisperDesk Speaker Diarization CLI")

# Set C++ standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Build type default
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

# Platform detection
if(APPLE)
    message(STATUS "🍎 Building for macOS")
elseif(WIN32)
    message(STATUS "🪟 Building for Windows")
else()
    message(STATUS "🐧 Building for Linux")
endif()

# FIXED: Multiple search paths for ONNX Runtime
set(ONNXRUNTIME_ROOT_PATHS
    # Original path (for compatibility)
    "${CMAKE_CURRENT_SOURCE_DIR}/../../../temp/onnxruntime"
    # New build script path
    "${CMAKE_CURRENT_SOURCE_DIR}/../../../temp/diarization-build/onnxruntime"
    # Extracted archive path patterns
    "${CMAKE_CURRENT_SOURCE_DIR}/../../../temp/diarization-build/onnxruntime/onnxruntime-osx-arm64-1.16.3"
    "${CMAKE_CURRENT_SOURCE_DIR}/../../../temp/diarization-build/onnxruntime/onnxruntime-linux-x64-1.16.3"
    "${CMAKE_CURRENT_SOURCE_DIR}/../../../temp/diarization-build/onnxruntime/onnxruntime-win-x64-1.16.3"
)

# Find ONNX Runtime library
find_library(ONNXRUNTIME_LIB 
    NAMES onnxruntime libonnxruntime
    HINTS ${ONNXRUNTIME_ROOT_PATHS}
    PATH_SUFFIXES lib Release Debug
    DOC "ONNX Runtime library"
)

# Find ONNX Runtime headers
find_path(ONNXRUNTIME_INCLUDE 
    NAMES onnxruntime_cxx_api.h
    HINTS ${ONNXRUNTIME_ROOT_PATHS}
    PATH_SUFFIXES include include/onnxruntime
    DOC "ONNX Runtime include directory"
)

# FIXED: Better error messages with path debugging
if(NOT ONNXRUNTIME_LIB OR NOT ONNXRUNTIME_INCLUDE)
    message(STATUS "🔍 ONNX Runtime search paths:")
    foreach(path ${ONNXRUNTIME_ROOT_PATHS})
        message(STATUS "  - ${path}")
        if(EXISTS "${path}")
            message(STATUS "    ✅ Path exists")
            if(EXISTS "${path}/lib")
                message(STATUS "    📁 lib/ directory found")
            endif()
            if(EXISTS "${path}/include")
                message(STATUS "    📁 include/ directory found")
            endif()
        else()
            message(STATUS "    ❌ Path does not exist")
        endif()
    endforeach()
    
    message(FATAL_ERROR "❌ ONNX Runtime not found. Please check the paths above.")
else()
    message(STATUS "✅ Found ONNX Runtime library: ${ONNXRUNTIME_LIB}")
    message(STATUS "✅ Found ONNX Runtime headers: ${ONNXRUNTIME_INCLUDE}")
endif()

# Find jsoncpp
find_package(PkgConfig REQUIRED)
pkg_check_modules(JSONCPP jsoncpp)

if(NOT JSONCPP_FOUND)
    # Try manual search
    find_library(JSONCPP_LIB 
        NAMES jsoncpp libjsoncpp
        HINTS /opt/homebrew/lib /usr/local/lib /usr/lib
    )
    find_path(JSONCPP_INCLUDE 
        NAMES json/json.h
        HINTS /opt/homebrew/include /usr/local/include /usr/include
    )
    
    if(JSONCPP_LIB AND JSONCPP_INCLUDE)
        set(JSONCPP_LIBRARIES ${JSONCPP_LIB})
        set(JSONCPP_INCLUDE_DIRS ${JSONCPP_INCLUDE})
        message(STATUS "✅ Found jsoncpp manually: ${JSONCPP_LIB}")
    else()
        message(STATUS "❌ jsoncpp not found. Installing...")
        if(APPLE)
            execute_process(COMMAND brew install jsoncpp)
        else()
            message(FATAL_ERROR "Please install jsoncpp: apt-get install libjsoncpp-dev")
        endif()
    endif()
else()
    message(STATUS "✅ Found jsoncpp via pkg-config")
endif()

# Optional: libsndfile
pkg_check_modules(SNDFILE sndfile)
if(SNDFILE_FOUND)
    message(STATUS "✅ Found libsndfile - enabling enhanced audio support")
    add_definitions(-DUSE_LIBSNDFILE)
else()
    message(STATUS "⚠️ libsndfile not found - using simple audio loading")
    if(APPLE)
        message(STATUS "💡 Install with: brew install libsndfile")
    endif()
endif()

# Include directories
include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${ONNXRUNTIME_INCLUDE}
    ${JSONCPP_INCLUDE_DIRS}
)

if(SNDFILE_FOUND)
    include_directories(${SNDFILE_INCLUDE_DIRS})
endif()

# Source files
set(SOURCES
    diarize-cli.cpp
    speaker-segmenter.cpp
    speaker-embedder.cpp
    utils.cpp
)

# Create executable
add_executable(diarize-cli ${SOURCES})

# Link libraries
target_link_libraries(diarize-cli 
    ${ONNXRUNTIME_LIB}
    ${JSONCPP_LIBRARIES}
)

if(SNDFILE_FOUND)
    target_link_libraries(diarize-cli ${SNDFILE_LIBRARIES})
endif()

# Platform-specific settings
if(APPLE)
    # macOS-specific settings
    message(STATUS "🍎 Configuring for macOS...")
    
    # macOS frameworks
    find_library(CORE_AUDIO_FRAMEWORK CoreAudio)
    find_library(AUDIO_TOOLBOX_FRAMEWORK AudioToolbox)
    
    if(CORE_AUDIO_FRAMEWORK AND AUDIO_TOOLBOX_FRAMEWORK)
        target_link_libraries(diarize-cli 
            ${CORE_AUDIO_FRAMEWORK}
            ${AUDIO_TOOLBOX_FRAMEWORK}
        )
        message(STATUS "✅ Linked macOS audio frameworks")
    endif()
    
    # Set RPATH for dylibs
    set_target_properties(diarize-cli PROPERTIES
        INSTALL_RPATH "@executable_path"
        BUILD_WITH_INSTALL_RPATH TRUE
    )
    
    # FIXED: macOS doesn't need providers_shared (statically linked)
    message(STATUS "ℹ️ macOS: providers_shared not needed (statically linked)")
    
elseif(WIN32)
    # Windows-specific settings
    target_compile_definitions(diarize-cli PRIVATE 
        _WIN32_WINNT=0x0A00
        NOMINMAX
    )
    
    # Copy DLLs to output directory
    get_filename_component(ONNX_DIR ${ONNXRUNTIME_LIB} DIRECTORY)
    file(GLOB ONNX_DLLS "${ONNX_DIR}/*.dll")
    foreach(DLL ${ONNX_DLLS})
        add_custom_command(TARGET diarize-cli POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E copy_if_different
            ${DLL} $<TARGET_FILE_DIR:diarize-cli>
        )
    endforeach()
    
else()
    # Linux-specific settings
    set_target_properties(diarize-cli PROPERTIES
        INSTALL_RPATH "$ORIGIN"
        BUILD_WITH_INSTALL_RPATH TRUE
    )
endif()

# Copy to binaries directory
add_custom_command(TARGET diarize-cli POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy 
    $<TARGET_FILE:diarize-cli> 
    ${CMAKE_CURRENT_SOURCE_DIR}/../../../binaries/
    COMMENT "📦 Copying diarize-cli to binaries directory"
)

# Print configuration summary
message(STATUS "")
message(STATUS "🎯 WhisperDesk Diarization Build Summary")
message(STATUS "══════════════════════════════════════")
message(STATUS "Platform: ${CMAKE_SYSTEM_NAME} ${CMAKE_SYSTEM_PROCESSOR}")
message(STATUS "Build type: ${CMAKE_BUILD_TYPE}")
message(STATUS "C++ Standard: ${CMAKE_CXX_STANDARD}")
message(STATUS "ONNX Runtime: ${ONNXRUNTIME_LIB}")
message(STATUS "ONNX Headers: ${ONNXRUNTIME_INCLUDE}")
message(STATUS "jsoncpp: ${JSONCPP_LIBRARIES}")
if(SNDFILE_FOUND)
    message(STATUS "libsndfile: ${SNDFILE_LIBRARIES}")
else()
    message(STATUS "libsndfile: Not found (optional)")
endif()
message(STATUS "══════════════════════════════════════")
message(STATUS "")