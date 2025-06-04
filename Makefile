# Makefile for WhisperDesk Enhanced Cross-Platform Building
# Usage: make [target]

.PHONY: all clean install build test docker help
.DEFAULT_GOAL := help

# Variables
PROJECT_NAME := WhisperDesk Enhanced
VERSION := $(shell node -p "require('./package.json').version")
BUILD_DIR := dist
PLATFORM := $(shell uname -s | tr '[:upper:]' '[:lower:]')
ARCH := $(shell uname -m)

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
NC := \033[0m # No Color

# Helper functions
define print_status
	@echo "$(BLUE)[INFO]$(NC) $(1)"
endef

define print_success
	@echo "$(GREEN)[SUCCESS]$(NC) $(1)"
endef

define print_warning
	@echo "$(YELLOW)[WARNING]$(NC) $(1)"
endef

define print_error
	@echo "$(RED)[ERROR]$(NC) $(1)"
endef

## Help target
help: ## Show this help message
	@echo "$(PROJECT_NAME) Build System"
	@echo "=============================="
	@echo ""
	@echo "Available targets:"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "Platform-specific targets:"
	@echo "  $(YELLOW)build-macos$(NC)          Build for macOS (requires macOS)"
	@echo "  $(YELLOW)build-linux$(NC)          Build for Linux"
	@echo "  $(YELLOW)build-windows$(NC)        Build for Windows (requires Windows or Wine)"
	@echo "  $(YELLOW)build-all$(NC)            Build for all platforms"
	@echo ""
	@echo "Docker targets:"
	@echo "  $(YELLOW)docker-build$(NC)         Build using Docker containers"
	@echo "  $(YELLOW)docker-setup$(NC)         Setup Docker buildx for multi-platform"

## Check dependencies
check-deps: ## Check if required dependencies are installed
	$(call print_status,"Checking dependencies...")
	@command -v node >/dev/null 2>&1 || { $(call print_error,"Node.js is required but not installed"); exit 1; }
	@command -v npm >/dev/null 2>&1 || { $(call print_error,"npm is required but not installed"); exit 1; }
	@command -v git >/dev/null 2>&1 || { $(call print_error,"git is required but not installed"); exit 1; }
	$(call print_success,"All dependencies are available")

## Clean build artifacts
clean: ## Clean all build artifacts and temporary files
	$(call print_status,"Cleaning build artifacts...")
	@rm -rf $(BUILD_DIR)
	@rm -rf node_modules/.cache
	@rm -rf src/renderer/whisperdesk-ui/dist
	@rm -rf src/renderer/whisperdesk-ui/node_modules/.cache
	@rm -rf temp
	$(call print_success,"Clean completed")

clean-all: clean ## Clean everything including binaries and models
	$(call print_status,"Cleaning binaries and models...")
	@rm -rf binaries
	@rm -rf models
	$(call print_success,"Deep clean completed")

## Install dependencies
install: check-deps ## Install all project dependencies
	$(call print_status,"Installing main dependencies...")
	@npm install
	
	$(call print_status,"Installing renderer dependencies...")
	@cd src/renderer/whisperdesk-ui && (pnpm install 2>/dev/null || npm install --legacy-peer-deps)
	
	$(call print_success,"Dependencies installed")

## Build whisper.cpp binary
build-whisper: ## Build whisper.cpp from source using npm script
	$(call print_status,"Building whisper.cpp from source via npm run build:whisper...")
	@npm run build:whisper
	$(call print_success,"whisper.cpp binary build process completed via npm script")

## Download essential models
download-models: ## Download essential Whisper models
	$(call print_status,"Downloading essential models...")
	@mkdir -p models
	@if [ ! -f models/ggml-tiny.bin ]; then \
		$(call print_status,"Downloading Whisper Tiny model..."); \
		curl -L -o models/ggml-tiny.bin \
			https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin; \
	fi
	$(call print_success,"Models ready")

## Build renderer
build-renderer: install ## Build the React renderer
	$(call print_status,"Building renderer...")
	@cd src/renderer/whisperdesk-ui && (pnpm run build 2>/dev/null || npm run build)
	$(call print_success,"Renderer built")

## Full build process
build: build-whisper download-models build-renderer ## Complete build process
	$(call print_status,"Building Electron application...")
	@npm run dist
	$(call print_success,"Build completed for current platform")

## Platform-specific builds
build-macos: build-whisper download-models build-renderer ## Build for macOS
ifeq ($(PLATFORM),darwin)
	$(call print_status,"Building for macOS...")
	@export CSC_IDENTITY_AUTO_DISCOVERY=false && npm run dist:mac
	$(call print_success,"macOS build completed")
else
	$(call print_error,"macOS builds require running on macOS")
	@exit 1
endif

build-linux: build-whisper download-models build-renderer ## Build for Linux
	$(call print_status,"Building for Linux...")
ifeq ($(PLATFORM),linux)
	@npm run dist:linux
else
	$(call print_warning,"Cross-compiling for Linux from $(PLATFORM)")
	@npm run dist:linux || $(call print_error,"Linux build failed")
endif
	$(call print_success,"Linux build completed")

build-windows: build-whisper download-models build-renderer ## Build for Windows
	$(call print_status,"Building for Windows...")
ifeq ($(PLATFORM),linux)
	$(call print_warning,"Cross-compiling for Windows requires Wine")
endif
	@export CSC_LINK="" && npm run dist:win
	$(call print_success,"Windows build completed")

build-all: build-whisper download-models build-renderer ## Build for all platforms
	$(call print_status,"Building for all platforms...")
ifeq ($(PLATFORM),darwin)
	@export CSC_IDENTITY_AUTO_DISCOVERY=false && npm run dist:all
else
	$(call print_warning,"Building all platforms works best on macOS")
	@npm run dist:all
endif
	$(call print_success,"All platform builds completed")

## Test targets
test: ## Run all tests
	$(call print_status,"Running tests...")
	@npm run test:native
	@npm run test:transcription
	$(call print_success,"All tests passed")

test-native: build-whisper ## Test native services
	$(call print_status,"Testing native services...")
	@npm run test:native

test-transcription: build-whisper download-models ## Test transcription with sample audio
	$(call print_status,"Testing transcription...")
	@npm run test:transcription

## Development targets
dev: install build-whisper download-models ## Start development environment
	$(call print_status,"Starting development environment...")
	@npm run dev

dev-web: install build-whisper download-models ## Start web development server
	$(call print_status,"Starting web development server...")
	@npm run web

## Docker targets
docker-setup: ## Setup Docker buildx for multi-platform builds
	$(call print_status,"Setting up Docker buildx...")
	@chmod +x scripts/setup-docker-buildx.sh
	@./scripts/setup-docker-buildx.sh

docker-build: ## Build using Docker containers
	$(call print_status,"Building with Docker...")
	@chmod +x scripts/docker-build.sh
	@./scripts/docker-build.sh

## Release targets
release-prepare: clean build-all ## Prepare release artifacts
	$(call print_status,"Preparing release...")
	@echo "Release artifacts:"
	@ls -la $(BUILD_DIR)/

release-github: release-prepare ## Create GitHub release (requires gh CLI)
	$(call print_status,"Creating GitHub release...")
	@gh release create v$(VERSION) $(BUILD_DIR)/* --generate-notes

## Version bumping
version-patch: ## Bump patch version and push tags
	@npm version patch
	@git push && git push --tags

version-minor: ## Bump minor version and push tags
	@npm version minor
	@git push && git push --tags

version-major: ## Bump major version and push tags
	@npm version major
	@git push && git push --tags

## Show build info
info: ## Show build information
	@echo "$(PROJECT_NAME) Build Information"
	@echo "=================================="
	@echo "Version: $(VERSION)"
	@echo "Platform: $(PLATFORM)"
	@echo "Architecture: $(ARCH)"
	@echo "Build Directory: $(BUILD_DIR)"
	@echo ""
	@echo "Dependencies:"
	@command -v node >/dev/null 2>&1 && echo "  Node.js: $$(node --version)" || echo "  Node.js: Not installed"
	@command -v npm >/dev/null 2>&1 && echo "  npm: $$(npm --version)" || echo "  npm: Not installed"
	@command -v git >/dev/null 2>&1 && echo "  Git: $$(git --version)" || echo "  Git: Not installed"
	@command -v docker >/dev/null 2>&1 && echo "  Docker: $$(docker --version)" || echo "  Docker: Not installed"
	@echo ""
	@echo "Build Status:"
	@[ -f binaries/whisper ] && echo "  whisper.cpp binary: ✅" || echo "  whisper.cpp binary: ❌"
	@[ -f models/ggml-tiny.bin ] && echo "  Tiny model: ✅" || echo "  Tiny model: ❌"
	@[ -d src/renderer/whisperdesk-ui/dist ] && echo "  Renderer built: ✅" || echo "  Renderer built: ❌"
	@[ -d $(BUILD_DIR) ] && echo "  App built: ✅" || echo "  App built: ❌"

## Quick setup for new developers
setup: install build-whisper download-models ## Quick setup for new developers
	$(call print_success,"WhisperDesk setup completed!")
	@echo ""
	@echo "Next steps:"
	@echo "  $(YELLOW)make dev$(NC)        - Start development environment"
	@echo "  $(YELLOW)make build$(NC)      - Build for current platform"
	@echo "  $(YELLOW)make test$(NC)       - Run tests"
	@echo "  $(YELLOW)make help$(NC)       - Show all available commands"