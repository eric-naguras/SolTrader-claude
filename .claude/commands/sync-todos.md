# /sync-todos

This command automatically syncs your current todo list with an external `todos.md` file. It keeps track of all TodoWrite tool calls and maintains a persistent record of tasks across sessions.

## Instructions

When this command is executed:

1. **Read the current todo list** from the active session
2. **Create or update** a `todos.md` file in the project root
3. **Format the todos** in a readable markdown format with:
   - Task status (pending, in_progress, completed)
   - Priority level (high, medium, low)
   - Task content
   - Timestamp of last update

4. **Maintain sync** by:
   - Preserving completed tasks for reference
   - Updating task statuses when they change
   - Adding new tasks as they're created
   - Removing tasks that are no longer relevant

## Output Format

The `todos.md` file should be structured as:

```markdown
# Project Todo List

Last updated: [timestamp]

## In Progress
- [ ] Task content (Priority: high)

## Pending
- [ ] Task content (Priority: medium)
- [ ] Task content (Priority: low)

## Completed
- [x] Task content (Priority: high) - Completed on [timestamp]
```

## Usage

Run `/sync-todos` whenever you want to:
- Save your current todo list to a file
- Update the external file with new task statuses
- Create a backup of your task progress
- Share your todo list with others

The command will automatically detect any changes since the last sync and update the file accordingly.