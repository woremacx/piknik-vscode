import * as vscode from "vscode";
import { loadConfig } from "../config.js";
import { copyToServer } from "../protocol/client.js";
import { updateStatusBar } from "../statusBar.js";

export async function executeCopy(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("Piknik: No active editor");
    return;
  }

  const selection = editor.selection;
  const text = editor.document.getText(selection);
  if (!text) {
    vscode.window.showWarningMessage("Piknik: No text selected");
    return;
  }

  try {
    const config = loadConfig();
    const data = new TextEncoder().encode(text);
    updateStatusBar("$(sync~spin) Piknik: Sending...");
    await copyToServer(config, data);
    updateStatusBar("$(check) Piknik: Sent");
    setTimeout(() => updateStatusBar("Piknik"), 3000);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Piknik copy failed: ${msg}`);
    updateStatusBar("$(error) Piknik: Error");
    setTimeout(() => updateStatusBar("Piknik"), 5000);
  }
}
