import * as vscode from "vscode";
import { loadConfig } from "../config.js";
import { pasteFromServer } from "../protocol/client.js";
import { updateStatusBar } from "../statusBar.js";

export async function executePaste(): Promise<void> {
  const editor = vscode.window.activeTextEditor;

  try {
    const config = loadConfig();
    updateStatusBar("$(sync~spin) Piknik: Receiving...");
    const data = await pasteFromServer(config, false);
    const text = new TextDecoder().decode(data);

    if (editor) {
      await editor.edit((editBuilder) => {
        if (editor.selection.isEmpty) {
          editBuilder.insert(editor.selection.active, text);
        } else {
          editBuilder.replace(editor.selection, text);
        }
      });
    } else {
      await vscode.env.clipboard.writeText(text);
      vscode.window.showInformationMessage(
        "Piknik: Content copied to clipboard (no active editor)"
      );
    }

    updateStatusBar("$(check) Piknik: Received");
    setTimeout(() => updateStatusBar("Piknik"), 3000);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Piknik paste failed: ${msg}`);
    updateStatusBar("$(error) Piknik: Error");
    setTimeout(() => updateStatusBar("Piknik"), 5000);
  }
}
