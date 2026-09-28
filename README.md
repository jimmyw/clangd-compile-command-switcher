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

Requires the [vscode-clangd](https://marketplace.visualstudio.com/items?itemName=llvm-vs-code-extensions.vscode-clangd)
extension.

## Install

Build a `.vsix` and install it (needs Node.js):

```bash
git clone git@github.com:jimmyw/clangd-compile-command-switcher.git
cd clangd-compile-command-switcher
npx @vscode/vsce package --allow-missing-repository
code --install-extension clangd-compile-command-switcher-*.vsix
```

Or in VSCode: Extensions view → `...` menu → **Install from VSIX...** and pick the file.

Then run **Developer: Reload Window**. The entry appears on the left of the status bar
(`$(database) clangd: auto` or the current build dir); **Clangd: Switch compile commands** in the
command palette does the same.

To update, `git pull`, package again and reinstall.
