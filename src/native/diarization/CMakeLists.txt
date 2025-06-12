# src/native/diarization/CMakeLists.txt - FIXED for macOS static linking
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
    set(PLATFORM_NAME "macOS")
elseif(WIN32)
    message(STATUS "🪟 Building for Windows")
    set(PLATFORM_NAME "Windows")
else()
    message(STATUS "🐧 Building for Linux")
    set(PLATFORM_NAME "Linux")
endif()

# FIXED: Multiple search paths for ONNX Runtime with better platform handling
set(ONNXRUNTIME_ROOT_PATHS
    # Build script paths
    "${CMAKE_CURRENT_SOURCE_DIR}/../../../temp/diarization-build/onnxruntime"
    "${CMAKE_CURRENT_SOURCE_DIR}/../../../temp/onnxruntime"
    # Platform-specific extracted paths
    "${CMAKE_CURRENT_SOURCE_DIR}/../../../temp/diarization-build/onnxruntime/onnxruntime-osx-arm64-1.16.3"
    "${CMAKE_CURRENT_SOURCE_DIR}/../../../temp/diarization-build/onnxruntime/onnxruntime-osx-x64-1.16.3"
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
                file(GLOB LIB_FILES "${path}/lib/*onnx*")
                if(LIB_FILES)
                    message(STATUS "    📄 Found ONNX files:")
                    foreach(lib_file ${LIB_FILES})
                        get_filename_component(lib_name ${lib_file} NAME)
                        message(STATUS "      - ${lib_name}")
                    endforeach()
                endif()
            endif()
            if(EXISTS "${path}/include")
                message(STATUS "    📁 include/ directory found")
            endif()
        else()
            message(STATUS "    ❌ Path does not exist")
        endif()
    endforeach()
    
    message(FATAL_ERROR "❌ ONNX Runtime not found. Please run the diarization build script first.")
else()
    message(STATUS "✅ Found ONNX Runtime library: ${ONNXRUNTIME_LIB}")
    message(STATUS "✅ Found ONNX Runtime headers: ${ONNXRUNTIME_INCLUDE}")
endif()

# FIXED: Platform-specific jsoncpp handling
if(APPLE)
    # macOS-specific jsoncpp configuration
    find_program(BREW_EXECUTABLE brew)
    if(BREW_EXECUTABLE)
        execute_process(
            COMMAND ${BREW_EXECUTABLE} --prefix
            OUTPUT_VARIABLE BREW_PREFIX
            OUTPUT_STRIP_TRAILING_WHITESPACE
        )
        set(JSONCPP_LIB "${BREW_PREFIX}/lib/libjsoncpp.dylib")
        set(JSONCPP_INCLUDE "${BREW_PREFIX}/include")
    else()
        # Fallback paths for manual installation
        set(JSONCPP_LIB "/usr/local/lib/libjsoncpp.dylib")
        set(JSONCPP_INCLUDE "/usr/local/include")
    endif()
    
    if(EXISTS ${JSONCPP_LIB} AND EXISTS ${JSONCPP_INCLUDE})
        set(JSONCPP_LIBRARIES ${JSONCPP_LIB})
        set(JSONCPP_INCLUDE_DIRS ${JSONCPP_INCLUDE})
        message(STATUS "✅ Found jsoncpp at: ${JSONCPP_LIB}")
    else()
        message(STATUS "❌ jsoncpp not found. Installing with Homebrew...")
        execute_process(
            COMMAND ${BREW_EXECUTABLE} install jsoncpp
            RESULT_VARIABLE BREW_RESULT
        )
        if(BREW_RESULT EQUAL 0 AND EXISTS ${JSONCPP_LIB} AND EXISTS ${JSONCPP_INCLUDE})
            set(JSONCPP_LIBRARIES ${JSONCPP_LIB})
            set(JSONCPP_INCLUDE_DIRS ${JSONCPP_INCLUDE})
            message(STATUS "✅ jsoncpp installed successfully: ${JSONCPP_LIB}")
        else()
            message(FATAL_ERROR "❌ Failed to install jsoncpp. Please install manually: brew install jsoncpp")
        endif()
    endif()
elseif(WIN32)
    # Windows: Look for vcpkg jsoncpp
    find_package(jsoncpp CONFIG)
    if(jsoncpp_FOUND)
        set(JSONCPP_LIBRARIES jsoncpp_lib)
        message(STATUS "✅ Found jsoncpp via vcpkg")
    else()
        message(FATAL_ERROR "❌ jsoncpp not found. Please install via vcpkg: vcpkg install jsoncpp")
    endif()
else()
    # Linux: Use pkg-config
    find_package(PkgConfig REQUIRED)
    pkg_check_modules(JSONCPP REQUIRED jsoncpp)
    if(NOT JSONCPP_FOUND)
        message(FATAL_ERROR "❌ jsoncpp not found. Please install: sudo apt-get install libjsoncpp-dev")
    endif()
endif()

# Include directories
include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${ONNXRUNTIME_INCLUDE}
    ${JSONCPP_INCLUDE_DIRS}
)

# Source files
set(SOURCES
    diarize-cli.cpp
    speaker-segmenter.cpp
    speaker-embedder.cpp
    utils.cpp
)

# Create executable
add_executable(diarize-cli ${SOURCES})

# FIXED: Platform-specific linking strategy
if(APPLE)
    # macOS linking strategy
    message(STATUS "🍎 Configuring macOS linking...")
    
    # Link core ONNX Runtime
    target_link_libraries(diarize-cli ${ONNXRUNTIME_LIB})
    
    # Try to find providers_shared, but don't fail if not found
    get_filename_component(ONNX_DIR ${ONNXRUNTIME_LIB} DIRECTORY)
    find_library(ONNX_PROVIDERS_SHARED
        NAMES libonnxruntime_providers_shared.dylib onnxruntime_providers_shared
        PATHS ${ONNX_DIR}
        NO_DEFAULT_PATH
    )
    
    if(ONNX_PROVIDERS_SHARED)
        message(STATUS "✅ Found ONNX providers_shared: ${ONNX_PROVIDERS_SHARED}")
        target_link_libraries(diarize-cli ${ONNX_PROVIDERS_SHARED})
        
        # Copy providers_shared to binaries directory
        add_custom_command(TARGET diarize-cli POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E copy_if_different
            ${ONNX_PROVIDERS_SHARED} 
            ${CMAKE_CURRENT_SOURCE_DIR}/../../../binaries/
            COMMENT "📦 Copying providers_shared to binaries directory"
        )
    else()
        message(STATUS "ℹ️ ONNX providers_shared not found - assuming static linking")
    endif()
    
    # Link jsoncpp
    target_link_libraries(diarize-cli ${JSONCPP_LIBRARIES})
    
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
    
    # Copy main ONNX Runtime library to binaries
    add_custom_command(TARGET diarize-cli POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_if_different
        ${ONNXRUNTIME_LIB} 
        ${CMAKE_CURRENT_SOURCE_DIR}/../../../binaries/
        COMMENT "📦 Copying ONNX Runtime to binaries directory"
    )
    
elseif(WIN32)
    # Windows linking
    target_link_libraries(diarize-cli 
        ${ONNXRUNTIME_LIB}
        ${JSONCPP_LIBRARIES}
    )
    
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
        add_custom_command(TARGET diarize-cli POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E copy_if_different
            ${DLL} ${CMAKE_CURRENT_SOURCE_DIR}/../../../binaries/
        )
    endforeach()
    
else()
    # Linux linking
    target_link_libraries(diarize-cli 
        ${ONNXRUNTIME_LIB}
        ${JSONCPP_LIBRARIES}
    )
    
    set_target_properties(diarize-cli PROPERTIES
        INSTALL_RPATH "$ORIGIN"
        BUILD_WITH_INSTALL_RPATH TRUE
    )
    
    # Copy shared libraries
    get_filename_component(ONNX_DIR ${ONNXRUNTIME_LIB} DIRECTORY)
    file(GLOB ONNX_SOS "${ONNX_DIR}/*.so*")
    foreach(SO ${ONNX_SOS})
        add_custom_command(TARGET diarize-cli POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E copy_if_different
            ${SO} ${CMAKE_CURRENT_SOURCE_DIR}/../../../binaries/
        )
    endforeach()
endif()

# Copy executable to binaries directory
add_custom_command(TARGET diarize-cli POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy 
    $<TARGET_FILE:diarize-cli> 
    ${CMAKE_CURRENT_SOURCE_DIR}/../../../binaries/
    COMMENT "📦 Copying diarize-cli to binaries directory"
)

# FIXED: Create verification script for macOS
if(APPLE)
    add_custom_command(TARGET diarize-cli POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E echo "🔍 Verifying macOS diarization binary..."
        COMMAND otool -L ${CMAKE_CURRENT_SOURCE_DIR}/../../../binaries/diarize-cli || true
        COMMENT "🔍 Checking library dependencies on macOS"
    )
endif()

# Print configuration summary
message(STATUS "")
message(STATUS "🎯 WhisperDesk Diarization Build Summary")
message(STATUS "══════════════════════════════════════")
message(STATUS "Platform: ${CMAKE_SYSTEM_NAME} ${CMAKE_SYSTEM_PROCESSOR}")
message(STATUS "Build type: ${CMAKE_BUILD_TYPE}")
message(STATUS "C++ Standard: ${CMAKE_CXX_STANDARD}")
message(STATUS "ONNX Runtime: ${ONNXRUNTIME_LIB}")
message(STATUS "ONNX Headers: ${ONNXRUNTIME_INCLUDE}")
if(APPLE)
    message(STATUS "ONNX Providers: ${ONNX_PROVIDERS_SHARED}")
endif()
message(STATUS "jsoncpp: ${JSONCPP_LIBRARIES}")
message(STATUS "Output: ${CMAKE_CURRENT_SOURCE_DIR}/../../../binaries/diarize-cli")
message(STATUS "══════════════════════════════════════")
message(STATUS "")