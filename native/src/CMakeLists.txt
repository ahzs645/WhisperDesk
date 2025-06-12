cmake_minimum_required(VERSION 3.14)
project(diarize-cli)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Set ONNX Runtime paths
set(ONNXRUNTIME_ROOT_PATH "${CMAKE_CURRENT_SOURCE_DIR}/../../native")
set(ONNXRUNTIME_INCLUDE_DIRS "${ONNXRUNTIME_ROOT_PATH}/include")

# Platform-specific library settings
if(WIN32)
    set(ONNXRUNTIME_LIB "${ONNXRUNTIME_ROOT_PATH}/onnxruntime.lib")
    set(ONNXRUNTIME_DLL "${ONNXRUNTIME_ROOT_PATH}/onnxruntime.dll")
elseif(APPLE)
    set(ONNXRUNTIME_LIB "${ONNXRUNTIME_ROOT_PATH}/libonnxruntime.dylib")
else()
    set(ONNXRUNTIME_LIB "${ONNXRUNTIME_ROOT_PATH}/libonnxruntime.so")
endif()

# Check if ONNX Runtime files exist
if(NOT EXISTS "${ONNXRUNTIME_INCLUDE_DIRS}/onnxruntime_cxx_api.h")
    message(FATAL_ERROR "ONNX Runtime headers not found at ${ONNXRUNTIME_INCLUDE_DIRS}")
endif()

if(NOT EXISTS "${ONNXRUNTIME_LIB}")
    message(FATAL_ERROR "ONNX Runtime library not found at ${ONNXRUNTIME_LIB}")
endif()

message(STATUS "ONNX Runtime include dir: ${ONNXRUNTIME_INCLUDE_DIRS}")
message(STATUS "ONNX Runtime library: ${ONNXRUNTIME_LIB}")

# Create executable
add_executable(diarize-cli main.cpp)

# Set include directories
target_include_directories(diarize-cli PRIVATE ${ONNXRUNTIME_INCLUDE_DIRS})

# Link libraries
if(WIN32)
    # On Windows, link against the import library
    target_link_libraries(diarize-cli PRIVATE "${ONNXRUNTIME_ROOT_PATH}/onnxruntime.lib")
else()
    # On Unix-like systems, link against the shared library
    target_link_libraries(diarize-cli PRIVATE "${ONNXRUNTIME_LIB}")
endif()

# Set runtime path for finding shared libraries
if(APPLE)
    set_target_properties(diarize-cli PROPERTIES
        BUILD_RPATH "${ONNXRUNTIME_ROOT_PATH}"
        INSTALL_RPATH "@executable_path"
    )
elseif(UNIX)
    set_target_properties(diarize-cli PROPERTIES
        BUILD_RPATH "${ONNXRUNTIME_ROOT_PATH}"
        INSTALL_RPATH "$ORIGIN"
    )
endif()

# Compiler-specific flags
if(MSVC)
    target_compile_options(diarize-cli PRIVATE /W3)
else()
    target_compile_options(diarize-cli PRIVATE -Wall -Wextra)
endif()

# Copy ONNX Runtime library to output directory on Windows
if(WIN32 AND EXISTS "${ONNXRUNTIME_DLL}")
    add_custom_command(TARGET diarize-cli POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${ONNXRUNTIME_DLL}"
        $<TARGET_FILE_DIR:diarize-cli>)
endif()

message(STATUS "diarize-cli configuration complete")