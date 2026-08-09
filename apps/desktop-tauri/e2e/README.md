# E2E smoke suite

Requires `tauri-driver` on PATH: `cargo install tauri-driver --locked`.
On Windows this also requires Microsoft Edge WebDriver matching the
installed WebView2 runtime version (download from
https://developer.microsoft.com/microsoft-edge/tools/webdriver/ and
ensure it's on PATH before running `pnpm e2e`).

Run: `pnpm build` (produces the release binary tauri-driver launches),
then `pnpm e2e`.

## Windows driver download note

As of mid-2026, `msedgedriver.azureedge.net` (the historically documented
download host) no longer resolves. Use `msedgedriver.microsoft.com`
instead, e.g.:

Match the driver to the **WebView2 Runtime**, not to `msedge.exe`. A Tauri app
hosts WebView2; the Edge browser is a separate product with its own version.
They usually track each other, which is why reading `msedge.exe` appears to work
— until they drift, at which point every session fails with
`session not created: DevToolsActivePort file doesn't exist`.

```powershell
# WebView2 Evergreen Runtime version (falls back to the install directory)
$guid = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
$ver = (Get-ItemProperty "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\$guid" -Name pv).pv
Invoke-WebRequest -Uri "https://msedgedriver.microsoft.com/$ver/edgedriver_win64.zip" -OutFile edgedriver_win64.zip
Expand-Archive edgedriver_win64.zip -DestinationPath .
```

This repo's convention: extract `msedgedriver.exe` into `e2e/.drivers/`
(gitignored) and put it on PATH before running `pnpm e2e`, e.g.:

```powershell
$env:PATH = "$PWD\e2e\.drivers;$env:PATH"
pnpm e2e
```

`tauri-driver` looks for `msedgedriver.exe` on PATH by default. If PATH
wiring proves flaky in a given shell, pass `--native-driver <absolute path
to msedgedriver.exe>` to `tauri-driver` instead (see `wdio.conf.ts`, where
the spawn args can be extended with `['--native-driver', '<path>']`).
