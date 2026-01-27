# Agent Skills

This directory contains agent skills that Cursor automatically discovers and makes available to the AI agent.

## Skills Structure

Skills are maintained in two locations:
- `.cursor/skills/` - Project-specific skills (auto-discovered by Cursor)
- `packages/skills/` - Reusable skills library (symlinked here)

## Available Skills

| Skill | Description |
|-------|-------------|
| `nextjs-16` | Next.js 16 development with Turbopack, Cache Components, proxy.ts |
| `vault-markets` | Vault Markets project conventions and architecture |

## Usage

Skills are automatically applied when relevant, or can be manually invoked:
- Type `/nextjs-16` in Agent chat for Next.js guidance
- Type `/vault-markets` for project-specific conventions

## Adding New Skills

1. Create a folder in `packages/skills/` with a `SKILL.md` file
2. Symlink or copy to `.cursor/skills/`
3. Follow the frontmatter format:

```yaml
---
name: skill-name
description: Description used by agent to determine relevance
---
```

## Reference

- [Agent Skills Documentation](https://docs.cursor.com/context/agent-skills)
- [Agent Skills Standard](https://agentskills.io)
