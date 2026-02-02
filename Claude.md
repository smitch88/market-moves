# Claude AI Instructions

## OpenAI API Development

Always use the OpenAI developer documentation MCP server if you need to work with the OpenAI API, ChatGPT Apps SDK, Codex, or related docs without me having to explicitly ask.

### GPT-5.2 Best Practices

When working with OpenAI models in this project:

- **Default model**: Use `gpt-5.2` for complex reasoning and agentic tasks
- **Reasoning effort**: Defaults to `none`; increase to `medium` or `high` for complex problems
- **Verbosity**: Use `low` for concise outputs, `medium` (default) for balanced, `high` for thorough explanations
- **Smaller tasks**: Use `gpt-5-mini` for cost-optimized reasoning, `gpt-5-nano` for high-throughput simple tasks
- **Parameter compatibility**: `temperature`, `top_p`, `logprobs` only work when `reasoning.effort` is `none`

## Documentation Maintenance

**IMPORTANT**: When making changes to the Vault Markets application, you MUST update the relevant documentation in this `/docs` folder.

### When to Update Documentation

1. **New Pages Added**: Update `SOLUTION.md` with the new page route and purpose
2. **User Workflows Changed**: Update `WORKFLOWS.md` with the modified flow
3. **API Endpoints Added/Changed**: Update `API.md` with the new endpoint details
4. **Component Library Changes**: Update `COMPONENTS.md` if new shared components are added
5. **Database Schema Changes**: Update `SOLUTION.md` data models section

### Documentation Files

| File | Purpose |
|------|---------|
| `SOLUTION.md` | Complete technical overview of the application |
| `WORKFLOWS.md` | User journey documentation with step-by-step flows |
| `API.md` | API endpoint reference |
| `COMPONENTS.md` | Shared component documentation |

### Documentation Standards

- Use clear, concise language
- Include code examples where helpful
- Keep diagrams/flows updated
- Document all user-facing features
- Include error states and edge cases

### Review Checklist

Before completing any task that modifies the application:

- [ ] Have I added a new page? → Update SOLUTION.md and WORKFLOWS.md
- [ ] Have I changed authentication flow? → Update WORKFLOWS.md
- [ ] Have I added/modified an API endpoint? → Update API.md
- [ ] Have I changed the database schema? → Update SOLUTION.md
- [ ] Have I added new UI components to vault-ui? → Update COMPONENTS.md
