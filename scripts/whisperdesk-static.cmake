# WhisperDesk Static Linking Configuration
# This file configures whisper.cpp for static linking to eliminate runtime dependencies

cmake_minimum_required(VERSION 3.15)

# Ensure we're using static runtime linking
if(MSVC)
    # Set the runtime library to static for all configurations
    set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")

    # Disable shared library generation
    set(BUILD_SHARED_LIBS OFF CACHE BOOL "Build shared libraries" FORCE)

    # Disable position independent code for better optimization
    set(CMAKE_POSITION_INDEPENDENT_CODE OFF)

    # Enable whole program optimization for release builds
    if(CMAKE_BUILD_TYPE STREQUAL "Release" OR CMAKE_CONFIGURATION_TYPES)
        set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} /GL /Gy")
        set(CMAKE_EXE_LINKER_FLAGS_RELEASE "${CMAKE_EXE_LINKER_FLAGS_RELEASE} /LTCG")

        # Additional optimization flags
        set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} /O2 /Ob2 /DNDEBUG")
        set(CMAKE_EXE_LINKER_FLAGS_RELEASE "${CMAKE_EXE_LINKER_FLAGS_RELEASE} /OPT:REF /OPT:ICF")
    endif()

    # Ensure static linking for debug builds as well
    if(CMAKE_BUILD_TYPE STREQUAL "Debug" OR CMAKE_CONFIGURATION_TYPES)
        set(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} /MTd")
    endif()
endif()

# Configure whisper.cpp specific options
set(WHISPER_BUILD_TESTS OFF CACHE BOOL "Build whisper tests" FORCE)
set(WHISPER_BUILD_EXAMPLES ON CACHE BOOL "Build whisper examples" FORCE)
set(WHISPER_BUILD_SERVER OFF CACHE BOOL "Build whisper server" FORCE)

# Disable optional dependencies that might introduce dynamic linking
set(WHISPER_SDL2 OFF CACHE BOOL "Use SDL2 for audio" FORCE)
set(WHISPER_COREML OFF CACHE BOOL "Enable Core ML" FORCE)
set(WHISPER_OPENVINO OFF CACHE BOOL "Enable OpenVINO" FORCE)

# CPU-only build for maximum compatibility
set(WHISPER_CUDA OFF CACHE BOOL "Enable CUDA" FORCE)
set(WHISPER_VULKAN OFF CACHE BOOL "Enable Vulkan" FORCE)
set(WHISPER_METAL OFF CACHE BOOL "Enable Metal" FORCE)

# Function to apply static linking to all targets
function(apply_static_linking_to_targets)
    get_property(all_targets DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR} PROPERTY BUILDSYSTEM_TARGETS)
    foreach(target ${all_targets})
        get_target_property(target_type ${target} TYPE)
        if(target_type STREQUAL "EXECUTABLE" OR target_type STREQUAL "STATIC_LIBRARY")
            if(MSVC)
                set_target_properties(${target} PROPERTIES
                    MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>"
                )
            endif()
        endif()
    endforeach()
endfunction()

# Apply configuration after all targets are defined
cmake_language(DEFER CALL apply_static_linking_to_targets)

# Validation function to check static linking
function(validate_static_linking target_name)
    if(WIN32 AND MSVC)
        add_custom_command(TARGET ${target_name} POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E echo "Validating static linking for ${target_name}"
            COMMAND dumpbin /dependents $<TARGET_FILE:${target_name}> || echo "dumpbin not available"
            COMMENT "Checking dependencies for ${target_name}"
        )
    endif()
endfunction()

# Message to confirm configuration
message(STATUS "WhisperDesk static linking configuration applied")
message(STATUS "Runtime library: ${CMAKE_MSVC_RUNTIME_LIBRARY}")
message(STATUS "Shared libraries: ${BUILD_SHARED_LIBS}")
```
