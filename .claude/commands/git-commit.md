---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*)
description: Create a git commit
---

## Context

- Current git status: !`git status`
- Current git diff (staged and unstaged changes): !`git diff HEAD`
- Current branch: !`git branch --show-current`
- Recent commits: !`git log --oneline -10`

## Your task

- Based on the above changes, create a single git commit.
- You **must** follow the formatting guidelines below:

---
description: Git commit message best practices including conventional commits, message lengths, and tagging types
---

# Git Best Practices

## Conventional Commit Format

Use the conventional commit format for all commit messages:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Commit Types

### Primary Types

- **feat**: A new feature for the user
- **fix**: A bug fix for the user
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes that affect the build system or external dependencies
- **ci**: Changes to CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

### Breaking Changes

- Use `!` after the type/scope to indicate breaking changes: `feat!: remove deprecated API`
- Or include `BREAKING CHANGE:` in the footer

## Message Length Guidelines

### Subject Line (First Line)

- **Maximum 50 characters** (hard limit: 72 characters)
- Use imperative mood ("Add feature" not "Added feature")
- No period at the end
- Capitalize the first letter

### Body (Optional)

- **Maximum 72 characters per line**
- Separate from subject with blank line
- Explain the "what" and "why", not the "how"
- Use present tense

### Footer (Optional)

- Reference issues: `Fixes #123`, `Closes #456`
- Breaking changes: `BREAKING CHANGE: describe the breaking change`

## Best Practices

### DO ✅

- Use clear, descriptive commit messages
- Make atomic commits (one logical change per commit)
- Use conventional commit types consistently
- Reference issues and pull requests
- Write commits as if completing the sentence: "If applied, this commit will..."

### DON'T ❌

- Don't use vague messages like "fix bug" or "update code"
- Don't commit unrelated changes together
- Don't exceed character limits
- Don't use past tense ("Fixed" → "Fix")
- Don't include file names in the subject line

## Examples

### Good Commit Messages

```
feat(auth): add JWT token validation

- Implement token expiration checking
- Add refresh token mechanism
- Include proper error handling for invalid tokens

Fixes #234
```

```
fix: resolve memory leak in image processing

The previous implementation didn't properly dispose of image
resources, causing memory usage to grow over time.

Closes #456
```

```
docs(api): update authentication examples

Add examples for new OAuth2 flow and clarify token usage
```

### Bad Commit Messages

```
❌ Fixed stuff
❌ WIP
❌ Updated files
❌ Bug fix
❌ changes
```

## Scope Examples

Use meaningful scopes to provide context:

- `feat(api): add user registration endpoint`
- `fix(ui): resolve button alignment issue`
- `docs(readme): update installation instructions`
- `test(auth): add integration tests for login flow`
- `refactor(utils): simplify date formatting function`

## Multi-line Example

```
feat(shopping-cart): add item quantity validation

- Prevent adding items with quantity <= 0
- Show user-friendly error messages
- Update cart total calculation logic
- Add unit tests for edge cases

The validation ensures data integrity and improves user
experience by providing clear feedback.

Fixes #789
Closes #790
```