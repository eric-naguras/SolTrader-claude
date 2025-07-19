# /sync-todos

This command automatically syncs your current todo list with an external `todos.md` file. It keeps track of all the project's tool calls and maintains a persistent records of tasks across sessions.

## Instructions

When this command is executed:

1. **Read thje current todo list** from the active session
2. **Create or update** a `todos.md` file in the project root
3. **Format the todos** in a readable markdown format with:
    - Tast status (pending, in_progress, completed)
    - Priority level (high, medium, low)
    - Task content
    - Timestamp of last update

4. **Maintain sync** by:
    - Preserving completed tasks for reference
    - Updating task statuses when they change
    - Adding new task srtatuses as they are created
    - Removing tasks that are no longer relevant

## Outputformat

The `todos.md` file should be structured as:

