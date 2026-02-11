import * as vscode from "vscode";
import { executeCopy } from "./commands/copy.js";
import { executePaste } from "./commands/paste.js";
import { executeMove } from "./commands/move.js";
import { createStatusBar, disposeStatusBar } from "./statusBar.js";

export function activate(context: vscode.ExtensionContext): void {
  const statusBar = createStatusBar();
  context.subscriptions.push(statusBar);

  context.subscriptions.push(
    vscode.commands.registerCommand("piknik.copy", executeCopy),
    vscode.commands.registerCommand("piknik.paste", executePaste),
    vscode.commands.registerCommand("piknik.move", executeMove)
  );
}

export function deactivate(): void {
  disposeStatusBar();
}
