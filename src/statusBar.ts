import * as vscode from "vscode";

let statusBarItem: vscode.StatusBarItem | undefined;

export function createStatusBar(): vscode.StatusBarItem {
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = "Piknik";
  statusBarItem.tooltip = "Piknik - Network Clipboard";
  statusBarItem.show();
  return statusBarItem;
}

export function updateStatusBar(text: string): void {
  if (statusBarItem) {
    statusBarItem.text = text;
  }
}

export function disposeStatusBar(): void {
  statusBarItem?.dispose();
  statusBarItem = undefined;
}
