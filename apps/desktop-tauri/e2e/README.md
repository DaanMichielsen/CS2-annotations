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

```powershell
$ver = (Get-Item "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe").VersionInfo.ProductVersion
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
