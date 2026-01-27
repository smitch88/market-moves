#!/bin/bash
# Setup script to symlink skills from packages/skills to .cursor/skills

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SKILLS_SOURCE="$ROOT_DIR/packages/skills"
SKILLS_TARGET="$ROOT_DIR/.cursor/skills"

echo "Setting up agent skills..."
echo "Source: $SKILLS_SOURCE"
echo "Target: $SKILLS_TARGET"

# Create .cursor/skills if it doesn't exist
mkdir -p "$SKILLS_TARGET"

# Link each skill from packages/skills
for skill_dir in "$SKILLS_SOURCE"/*/; do
    if [ -d "$skill_dir" ]; then
        skill_name=$(basename "$skill_dir")
        target_link="$SKILLS_TARGET/$skill_name"
        
        # Remove existing link/directory if it exists
        if [ -L "$target_link" ] || [ -d "$target_link" ]; then
            rm -rf "$target_link"
        fi
        
        # Create relative symlink
        ln -s "../../packages/skills/$skill_name" "$target_link"
        echo "✓ Linked: $skill_name"
    fi
done

echo ""
echo "Skills setup complete!"
echo "Available skills in .cursor/skills/:"
ls -la "$SKILLS_TARGET"
