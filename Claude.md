# Claude AI Instructions

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
