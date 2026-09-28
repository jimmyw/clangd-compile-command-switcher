// @ts-check
const vscode = require('vscode');
const path = require('path');

const FLAG_RE = /^--?compile-commands-dir(=|$)/;
const FLAG = '--compile-commands-dir';

/** @type {vscode.StatusBarItem} */
let item;

function activate(context) {
  item = vscode.window.createStatusBarItem('clangdSwitcher', vscode.StatusBarAlignment.Left, 0);
  item.name = 'Clangd compile commands';
  item.command = 'clangdSwitcher.pick';
  context.subscriptions.push(
    item,
    vscode.commands.registerCommand('clangdSwitcher.pick', pick),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('clangd.arguments')) refresh();
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(refresh),
  );
  refresh();
}

function rootFolder() {
  const folders = vscode.workspace.workspaceFolders;
  return folders && folders.length ? folders[0].uri.fsPath : undefined;
}

/** @returns {string[]} */
function getArgs() {
  return vscode.workspace.getConfiguration('clangd').get('arguments', []);
}

/** @param {string[]} args */
function currentDir(args) {
  for (let i = 0; i < args.length; i++) {
    const m = FLAG_RE.exec(args[i]);
    if (!m) continue;
    return m[1] === '=' ? args[i].slice(args[i].indexOf('=') + 1) : args[i + 1];
  }
  return undefined;
}

/** @param {string[]} args */
function stripFlag(args) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    const m = FLAG_RE.exec(args[i]);
    if (!m) out.push(args[i]);
    else if (m[1] !== '=') i++;
  }
  return out;
}

/** Expand the variables vscode-clangd substitutes in clangd.arguments. */
function resolve(dir) {
  if (!dir) return undefined;
  const root = rootFolder() || '';
  const out = dir
    .replace(/\$\{(workspaceFolder|workspaceRoot)\}/g, root)
    .replace(/\$\{userHome\}/g, require('os').homedir())
    .replace(/\$\{env:([^}]+)\}/g, (_, v) => process.env[v] || '');
  return path.resolve(root, out);
}

/** Store as ${workspaceFolder}/... when possible so the setting survives copying between worktrees. */
function toSetting(dir) {
  const root = rootFolder();
  if (root) {
    const rel = path.relative(root, dir);
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
      return rel ? '${workspaceFolder}/' + rel.split(path.sep).join('/') : '${workspaceFolder}';
    }
  }
  return dir;
}

function display(dir) {
  return vscode.workspace.asRelativePath(dir, true) || dir;
}

function refresh() {
  const raw = currentDir(getArgs());
  const dir = resolve(raw);
  item.text = `$(database) ${dir ? display(dir) : 'clangd: auto'}`;
  item.tooltip = dir
    ? `clangd compile commands: ${dir}\nClick to switch`
    : 'clangd finds compile_commands.json itself (.clangd / parent dirs)\nClick to switch';
  item.show();
}

async function pick() {
  const exclude = vscode.workspace.getConfiguration('clangdSwitcher').get('exclude');
  const uris = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Window, title: 'Scanning for compile_commands.json' },
    () => vscode.workspace.findFiles('**/compile_commands.json', exclude || null),
  );
  const current = resolve(currentDir(getArgs()));

  const found = await Promise.all(
    uris.map(async (uri) => {
      const dir = path.dirname(uri.fsPath);
      let mtime = 0;
      try {
        mtime = (await vscode.workspace.fs.stat(uri)).mtime;
      } catch {}
      return { dir, mtime };
    }),
  );
  found.sort((a, b) => display(a.dir).localeCompare(display(b.dir)));

  /** @type {(vscode.QuickPickItem & {dir?: string})[]} */
  const items = [
    {
      label: `${current ? '' : '$(check) '}Automatic`,
      description: 'no --compile-commands-dir',
      detail: 'clangd uses .clangd CompilationDatabase or searches parent directories',
      dir: undefined,
    },
    { label: '', kind: vscode.QuickPickItemKind.Separator },
    ...found.map(({ dir, mtime }) => ({
      label: `${dir === current ? '$(check) ' : ''}${display(dir)}`,
      description: mtime ? `built ${new Date(mtime).toLocaleString()}` : undefined,
      detail: dir,
      dir,
    })),
  ];
  if (!found.length) items.splice(1);

  const choice = await vscode.window.showQuickPick(items, {
    title: 'Clangd compile commands',
    placeHolder: found.length ? 'Select compile_commands.json for clangd' : 'No compile_commands.json found in workspace',
    matchOnDetail: true,
  });
  if (!choice || choice.dir === current) return;
  await apply(choice.dir);
}

/** @param {string | undefined} dir */
async function apply(dir) {
  const cfg = vscode.workspace.getConfiguration('clangd');
  const args = stripFlag(getArgs());
  if (dir) args.push(`${FLAG}=${toSetting(dir)}`);
  const target = rootFolder() ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
  await cfg.update('arguments', args, target);

  // vscode-clangd restarts by itself only when clangd.onConfigChanged is "restart".
  if (cfg.get('onConfigChanged') === 'restart') return;
  try {
    await vscode.commands.executeCommand('clangd.restart');
  } catch (e) {
    vscode.window.showWarningMessage(`Compile commands updated, but restarting clangd failed: ${e.message || e}`);
  }
}

function deactivate() {}

module.exports = { activate, deactivate };
