# Plan: Remove Non-Default Agents and Skills

## Objective
Remove all workspace-specific agent and skill definitions to restore the project to a clean state, relying only on default system-provided skills.

## Scope
The following directories contain user-installed or generated agent definitions that will be removed:
- `.cursor/rules/` (contains `*.mdc` files)
- `.opencode/agents/` (contains `*.md` files)

## Implementation Steps
1.  Delete all files in `.cursor/rules/`.
2.  Delete all files in `.opencode/agents/`.
3.  Ensure the directories themselves remain (empty) if they are required by the tooling, or remove them if they are no longer needed. (I will verify if the directories should be kept - usually keeping the directory is safer).

## Verification
1.  Run `ls -F .cursor/rules/ .opencode/agents/` to confirm they are empty.
2.  Run `activate_skill name="senior-developer"` (as a test) to ensure the system can still load the default skill from the global extension, proving that the workspace overrides are gone but the capability remains.
