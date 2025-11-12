#!/bin/bash

# Test script for Cloudflare Tunnel setup
# This script helps validate your tunnel configuration before deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_header() {
    echo ""
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
    echo ""
}

# Test 1: Check if Docker is installed
test_docker() {
    print_header "Testing Docker Installation"

    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version)
        print_success "Docker is installed: $DOCKER_VERSION"
        return 0
    else
        print_error "Docker is not installed"
        print_info "Install from: https://docs.docker.com/get-docker/"
        return 1
    fi
}

# Test 2: Check if Docker Compose is available
test_docker_compose() {
    print_header "Testing Docker Compose"

    if docker compose version &> /dev/null; then
        COMPOSE_VERSION=$(docker compose version)
        print_success "Docker Compose is available: $COMPOSE_VERSION"
        return 0
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_VERSION=$(docker-compose --version)
        print_success "Docker Compose is available: $COMPOSE_VERSION"
        return 0
    else
        print_error "Docker Compose is not available"
        return 1
    fi
}

# Test 3: Check for required files
test_required_files() {
    print_header "Checking Required Files"

    local all_found=true

    files=(
        "Dockerfile"
        "docker-compose.yml"
        "start.js"
        "src/index.js"
        "package.json"
    )

    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            print_success "Found: $file"
        else
            print_error "Missing: $file"
            all_found=false
        fi
    done

    if [ "$all_found" = true ]; then
        return 0
    else
        return 1
    fi
}

# Test 4: Check if cloudflared is in Dockerfile
test_dockerfile_content() {
    print_header "Validating Dockerfile"

    if grep -q "cloudflared" Dockerfile; then
        print_success "Dockerfile includes cloudflared installation"
    else
        print_error "Dockerfile missing cloudflared installation"
        return 1
    fi

    if grep -q "node:20" Dockerfile; then
        print_success "Using Node.js 20"
    else
        print_warning "Not using Node.js 20"
    fi

    return 0
}

# Test 5: Check environment configuration
test_env_config() {
    print_header "Checking Environment Configuration"

    if [ -f ".env" ]; then
        print_success "Found .env file"

        if grep -q "TUNNEL_TOKEN" .env; then
            if grep "^TUNNEL_TOKEN=" .env | grep -v "^#" | grep -q "=.\+"; then
                print_success "TUNNEL_TOKEN is set in .env"
            else
                print_warning "TUNNEL_TOKEN exists but appears empty"
            fi
        else
            print_info "TUNNEL_TOKEN not found in .env (optional)"
        fi
    else
        print_warning "No .env file found (will use docker-compose environment)"
    fi

    if [ ! -z "$TUNNEL_TOKEN" ]; then
        print_success "TUNNEL_TOKEN is set in environment"
    else
        print_info "TUNNEL_TOKEN not set in environment (optional)"
    fi

    return 0
}

# Test 6: Build Docker image
test_docker_build() {
    print_header "Testing Docker Build"

    print_info "Building Docker image (this may take a few minutes)..."

    if docker build -t self-streme-test . > /tmp/docker-build.log 2>&1; then
        print_success "Docker image built successfully"
        return 0
    else
        print_error "Docker build failed"
        print_info "Check /tmp/docker-build.log for details"
        tail -n 20 /tmp/docker-build.log
        return 1
    fi
}

# Test 7: Verify cloudflared in image
test_cloudflared_in_image() {
    print_header "Verifying cloudflared Installation"

    if docker run --rm self-streme-test which cloudflared &> /dev/null; then
        print_success "cloudflared is installed in the image"

        CF_VERSION=$(docker run --rm self-streme-test cloudflared --version 2>&1 | head -n 1)
        print_info "Version: $CF_VERSION"
        return 0
    else
        print_error "cloudflared not found in image"
        return 1
    fi
}

# Test 8: Test container startup (without tunnel)
test_container_startup() {
    print_header "Testing Container Startup"

    print_info "Starting container without tunnel..."

    # Start container in background
    CONTAINER_ID=$(docker run -d \
        -e NODE_ENV=production \
        -e PORT=3000 \
        --name self-streme-test-container \
        self-streme-test 2>&1)

    if [ $? -ne 0 ]; then
        print_error "Failed to start container"
        return 1
    fi

    print_success "Container started: $CONTAINER_ID"

    # Wait for startup
    print_info "Waiting for application to start (10 seconds)..."
    sleep 10

    # Check if container is still running
    if docker ps | grep -q self-streme-test-container; then
        print_success "Container is running"

        # Show logs
        print_info "Container logs:"
        docker logs self-streme-test-container 2>&1 | tail -n 20

        # Cleanup
        print_info "Stopping test container..."
        docker stop self-streme-test-container > /dev/null 2>&1
        docker rm self-streme-test-container > /dev/null 2>&1

        return 0
    else
        print_error "Container stopped unexpectedly"
        print_info "Container logs:"
        docker logs self-streme-test-container 2>&1

        # Cleanup
        docker rm self-streme-test-container > /dev/null 2>&1
        return 1
    fi
}

# Test 9: Test with tunnel token (if available)
test_with_tunnel() {
    print_header "Testing with Cloudflare Tunnel"

    if [ -z "$TUNNEL_TOKEN" ]; then
        print_warning "TUNNEL_TOKEN not set, skipping tunnel test"
        print_info "To test tunnel: export TUNNEL_TOKEN=your_token"
        return 0
    fi

    print_info "Starting container with tunnel token..."

    # Start container with tunnel
    CONTAINER_ID=$(docker run -d \
        -e NODE_ENV=production \
        -e PORT=3000 \
        -e TUNNEL_TOKEN="$TUNNEL_TOKEN" \
        --name self-streme-tunnel-test \
        self-streme-test 2>&1)

    if [ $? -ne 0 ]; then
        print_error "Failed to start container with tunnel"
        return 1
    fi

    print_success "Container started with tunnel"

    # Wait for tunnel connection
    print_info "Waiting for tunnel connection (15 seconds)..."
    sleep 15

    # Check logs for tunnel connection
    LOGS=$(docker logs self-streme-tunnel-test 2>&1)

    if echo "$LOGS" | grep -q "Registered tunnel connection\|Connection registered"; then
        print_success "Tunnel connected successfully"
        echo "$LOGS" | grep -i tunnel | tail -n 5
    else
        print_warning "Could not confirm tunnel connection"
        print_info "Recent logs:"
        echo "$LOGS" | tail -n 20
    fi

    # Cleanup
    print_info "Stopping tunnel test container..."
    docker stop self-streme-tunnel-test > /dev/null 2>&1
    docker rm self-streme-tunnel-test > /dev/null 2>&1

    return 0
}

# Cleanup function
cleanup() {
    print_info "Cleaning up test containers and images..."
    docker stop self-streme-test-container self-streme-tunnel-test > /dev/null 2>&1 || true
    docker rm self-streme-test-container self-streme-tunnel-test > /dev/null 2>&1 || true
    docker rmi self-streme-test > /dev/null 2>&1 || true
    print_success "Cleanup complete"
}

# Main test execution
main() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  Cloudflare Tunnel Setup Test Suite       ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
    echo ""

    local failed_tests=0
    local total_tests=0

    # Run tests
    tests=(
        "test_docker"
        "test_docker_compose"
        "test_required_files"
        "test_dockerfile_content"
        "test_env_config"
        "test_docker_build"
        "test_cloudflared_in_image"
        "test_container_startup"
        "test_with_tunnel"
    )

    for test in "${tests[@]}"; do
        total_tests=$((total_tests + 1))
        if ! $test; then
            failed_tests=$((failed_tests + 1))
        fi
    done

    # Summary
    print_header "Test Summary"

    passed_tests=$((total_tests - failed_tests))

    if [ $failed_tests -eq 0 ]; then
        print_success "All tests passed! ($passed_tests/$total_tests)"
        echo ""
        print_info "Your setup is ready for deployment!"
        print_info "Next steps:"
        echo "  1. Set TUNNEL_TOKEN environment variable (if using tunnel)"
        echo "  2. Run: docker-compose up -d"
        echo "  3. Monitor logs: docker-compose logs -f"
        echo ""
        return 0
    else
        print_error "$failed_tests test(s) failed out of $total_tests"
        echo ""
        print_warning "Please fix the issues above before deployment"
        echo ""
        return 1
    fi
}

# Handle script arguments
case "${1:-}" in
    --cleanup)
        cleanup
        exit 0
        ;;
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --cleanup    Clean up test containers and images"
        echo "  --help       Show this help message"
        echo ""
        echo "Environment variables:"
        echo "  TUNNEL_TOKEN    Optional Cloudflare tunnel token for testing"
        echo ""
        exit 0
        ;;
    "")
        # Run main tests
        main
        exit $?
        ;;
    *)
        print_error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac
