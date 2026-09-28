# Clangd compile command switcher

Status bar entry showing which `compile_commands.json` clangd uses (the `--compile-commands-dir`
in `clangd.arguments`). Click it to scan the workspace for every `compile_commands.json`, pick one,
and the workspace `clangd.arguments` is updated and clangd restarted.

- **Automatic** removes the flag, so clangd falls back to `.clangd` `CompilationDatabase:` entries
  or its parent-directory search. Note the flag, when set, overrides `.clangd`.
- Paths inside the workspace are stored as `${workspaceFolder}/...`, so settings copied between
  worktrees keep pointing at their own build dirs.
- `clangdSwitcher.exclude` controls which paths the scan skips.
- To avoid vscode-clangd's own "restart?" prompt on top of the restart, set
  `"clangd.onConfigChanged": "restart"` (the switcher then leaves the restart to clangd).
