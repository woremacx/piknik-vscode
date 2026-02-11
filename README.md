# Piknik for VS Code

[piknik](https://github.com/jedisct1/piknik) のクライアントを TypeScript で移植した VS Code 拡張。Go 版サーバー（プロトコル v6）とそのまま通信できる。

サーバーは平文にアクセスできない（XChaCha20 + Ed25519 による E2E 暗号化）。

## インストール

### ビルド

```sh
cd piknik-vscode
./build.sh
```

`piknik-vscode-0.1.1.vsix` が生成される。

### VS Code にインストール

**GUI**: Extensions サイドバー (`Cmd+Shift+X`) → 右上の `...` メニュー → **Install from VSIX...** → 生成された `.vsix` を選択

**CLI**:

```sh
code --install-extension piknik-vscode-0.1.1.vsix
```

## 設定

`~/.piknik.toml` の値を VS Code の `settings.json` に転記する。

```jsonc
{
  "piknik.connect":   "127.0.0.1:8075",
  "piknik.psk":       "627ea3...(64文字hex)",
  "piknik.signPk":    "c2e469...(64文字hex)",
  "piknik.signSk":    "7599da...(64文字hex)",
  "piknik.encryptSk": "f313e1...(64文字hex)"
}
```

| 設定 | デフォルト | 説明 |
|---|---|---|
| `piknik.connect` | `127.0.0.1:8075` | サーバーアドレス |
| `piknik.psk` | — | 事前共有鍵 (32バイト hex) |
| `piknik.signPk` | — | Ed25519 公開署名鍵 (32バイト hex) |
| `piknik.signSk` | — | Ed25519 秘密署名鍵シード (32バイト hex) |
| `piknik.encryptSk` | — | XChaCha20 暗号化鍵 (32バイト hex) |
| `piknik.encryptSkId` | `0` | 暗号化鍵 ID（0 = 自動計算） |
| `piknik.timeout` | `10` | 接続タイムアウト（秒） |
| `piknik.dataTimeout` | `3600` | データ転送タイムアウト（秒） |
| `piknik.ttl` | `604800` | クリップボード有効期限（秒、デフォルト7日） |

## 使い方

コマンドパレット (`Cmd+Shift+P`) から:

- **Piknik: Copy** — 選択テキストをサーバーに送信
- **Piknik: Paste** — サーバーから取得してエディタに挿入
- **Piknik: Move** — 取得 + サーバー側削除

キーバインド（エディタフォーカス時）:

| コマンド | macOS | Windows/Linux |
|---|---|---|
| Copy | `Cmd+Shift+C` | `Ctrl+Shift+C` |
| Paste | `Cmd+Shift+V` | `Ctrl+Shift+V` |
| Move | `Cmd+Shift+M` | `Ctrl+Shift+M` |

## 鍵の生成

鍵の生成は Go 版 piknik で行う。

```sh
piknik -genkeys
```

生成された TOML の各値を `settings.json` にコピーすればよい。

## 開発

```sh
npm install
npm run build    # esbuild でバンドル
npm test         # vitest でユニットテスト
npm run watch    # ファイル変更を監視してリビルド
```
