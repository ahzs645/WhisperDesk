# src/native/diarization/CMakeLists.txt
# Modular build configuration for WhisperDesk Speaker Diarization

cmake_minimum_required(VERSION 3.15)
project(diarize-cli VERSION 1.0.0 DESCRIPTION "WhisperDesk Speaker Diarization CLI")

# Set C++ standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Build type default
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

# Compiler-specific options
if(MSVC)
    # Visual Studio
    add_compile_options(/W4 /permissive-)
    if(CMAKE_BUILD_TYPE STREQUAL "Release")
        add_compile_options(/O2 /DNDEBUG)
    endif()
else()
    # GCC/Clang
    add_compile_options(-Wall -Wextra -pedantic)
    if(CMAKE_BUILD_TYPE STREQUAL "Release")
        add_compile_options(-O3 -DNDEBUG)
    endif()
    if(CMAKE_BUILD_TYPE STREQUAL "Debug")
        add_compile_options(-g -O0)
    endif()
endif()

# Find required packages
find_package(PkgConfig)

# Find ONNX Runtime
set(ONNXRUNTIME_ROOT_PATH "${CMAKE_CURRENT_SOURCE_DIR}/../../../temp/onnxruntime")
find_library(ONNXRUNTIME_LIB 
    NAMES onnxruntime libonnxruntime
    HINTS 
        ${ONNXRUNTIME_ROOT_PATH}/lib
        ${CMAKE_CURRENT_SOURCE_DIR}/../../../binaries
    PATH_SUFFIXES
        lib
        Release
        Debug
)

find_path(ONNXRUNTIME_INCLUDE 
    NAMES onnxruntime_cxx_api.h
    HINTS 
        ${ONNXRUNTIME_ROOT_PATH}/include
        ${ONNXRUNTIME_ROOT_PATH}/include/onnxruntime
        ${CMAKE_CURRENT_SOURCE_DIR}/../../../temp/onnxruntime-*/include
)

if(NOT ONNXRUNTIME_LIB OR NOT ONNXRUNTIME_INCLUDE)
    message(FATAL_ERROR "ONNX Runtime not found. Please run the build script first.")
else()
    message(STATUS "Found ONNX Runtime: ${ONNXRUNTIME_LIB}")
    message(STATUS "ONNX Runtime includes: ${ONNXRUNTIME_INCLUDE}")
endif()

# Find jsoncpp
pkg_check_modules(JSONCPP jsoncpp)
if(NOT JSONCPP_FOUND)
    # Try to find it manually
    find_library(JSONCPP_LIB 
        NAMES jsoncpp libjsoncpp
        HINTS /usr/lib /usr/local/lib
    )
    find_path(JSONCPP_INCLUDE 
        NAMES json/json.h
        HINTS /usr/include /usr/local/include
    )
    
    if(JSONCPP_LIB AND JSONCPP_INCLUDE)
        set(JSONCPP_LIBRARIES ${JSONCPP_LIB})
        set(JSONCPP_INCLUDE_DIRS ${JSONCPP_INCLUDE})
        message(STATUS "Found jsoncpp manually: ${JSONCPP_LIB}")
    else()
        message(FATAL_ERROR "jsoncpp not found. Please install: apt-get install libjsoncpp-dev")
    endif()
else()
    message(STATUS "Found jsoncpp via pkg-config")
endif()

# Optional: Find libsndfile for better audio support
pkg_check_modules(SNDFILE sndfile)
if(SNDFILE_FOUND)
    message(STATUS "Found libsndfile - enabling enhanced audio support")
    add_definitions(-DUSE_LIBSNDFILE)
else()
    message(WARNING "libsndfile not found - using simple audio loading")
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

# Header files (for IDE)
set(HEADERS
    include/diarize-cli.h
    include/speaker-segmenter.h
    include/speaker-embedder.h
    include/utils.h
)

# Create executable
add_executable(diarize-cli ${SOURCES} ${HEADERS})

# Link libraries
target_link_libraries(diarize-cli 
    ${ONNXRUNTIME_LIB}
    ${JSONCPP_LIBRARIES}
)

if(SNDFILE_FOUND)
    target_link_libraries(diarize-cli ${SNDFILE_LIBRARIES})
endif()

# Platform-specific settings
if(WIN32)
    # Windows-specific settings
    target_compile_definitions(diarize-cli PRIVATE 
        _WIN32_WINNT=0x0A00
        NOMINMAX
    )
    
    # Copy DLLs to output directory
    if(ONNXRUNTIME_LIB)
        get_filename_component(ONNX_DIR ${ONNXRUNTIME_LIB} DIRECTORY)
        file(GLOB ONNX_DLLS "${ONNX_DIR}/*.dll")
        foreach(DLL ${ONNX_DLLS})
            add_custom_command(TARGET diarize-cli POST_BUILD
                COMMAND ${CMAKE_COMMAND} -E copy_if_different
                ${DLL} $<TARGET_FILE_DIR:diarize-cli>
            )
        endforeach()
    endif()
    
elseif(APPLE)
    # macOS-specific settings
    target_compile_definitions(diarize-cli PRIVATE 
        __APPLE__
    )
    
    # macOS frameworks
    find_library(CORE_AUDIO_FRAMEWORK CoreAudio)
    find_library(AUDIO_TOOLBOX_FRAMEWORK AudioToolbox)
    
    if(CORE_AUDIO_FRAMEWORK AND AUDIO_TOOLBOX_FRAMEWORK)
        target_link_libraries(diarize-cli 
            ${CORE_AUDIO_FRAMEWORK}
            ${AUDIO_TOOLBOX_FRAMEWORK}
        )
    endif()
    
    # Set RPATH for dylibs
    set_target_properties(diarize-cli PROPERTIES
        INSTALL_RPATH "@executable_path"
        BUILD_WITH_INSTALL_RPATH TRUE
    )
    
else()
    # Linux-specific settings
    target_compile_definitions(diarize-cli PRIVATE 
        __linux__
    )
    
    # Set RPATH for .so files
    set_target_properties(diarize-cli PROPERTIES
        INSTALL_RPATH "$ORIGIN"
        BUILD_WITH_INSTALL_RPATH TRUE
    )
endif()

# Compiler flags
target_compile_options(diarize-cli PRIVATE 
    ${JSONCPP_CFLAGS_OTHER}
)

if(SNDFILE_FOUND)
    target_compile_options(diarize-cli PRIVATE 
        ${SNDFILE_CFLAGS_OTHER}
    )
endif()

# Installation
install(TARGETS diarize-cli
    RUNTIME DESTINATION bin
)

# Development: Copy to binaries directory
add_custom_command(TARGET diarize-cli POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy 
    $<TARGET_FILE:diarize-cli> 
    ${CMAKE_CURRENT_SOURCE_DIR}/../../../binaries/
    COMMENT "Copying diarize-cli to binaries directory"
)

# Print configuration summary
message(STATUS "")
message(STATUS "=== WhisperDesk Diarization Build Configuration ===")
message(STATUS "Build type: ${CMAKE_BUILD_TYPE}")
message(STATUS "C++ Standard: ${CMAKE_CXX_STANDARD}")
message(STATUS "ONNX Runtime: ${ONNXRUNTIME_LIB}")
message(STATUS "jsoncpp: ${JSONCPP_LIBRARIES}")
if(SNDFILE_FOUND)
    message(STATUS "libsndfile: ${SNDFILE_LIBRARIES}")
else()
    message(STATUS "libsndfile: Not found (optional)")
endif()
message(STATUS "Target platform: ${CMAKE_SYSTEM_NAME}")
message(STATUS "==================================================")
message(STATUS "")