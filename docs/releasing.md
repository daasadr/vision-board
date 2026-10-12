# Vydávání a aktualizace

Pro: správce Vision Boardu (uživatelka, Claude Code v tomto repu) a vývoj Almost-there.eu, který potřebuje vědět, kde najde instalátor a jak se aplikace aktualizuje.

## Jak to funguje

1. Nová verze vzniká v tomto repu (`daasadr/vision-board`). Změny na webu Almost-there.eu vydání aplikace nepotřebují, pokud se nemění kontrakt `docs/almost-there-api.md`.
2. Vydání = push tagu `vX.Y.Z`. Workflow `.github/workflows/release.yml`:
   - ověří, že tag odpovídá verzi v `package.json`, `src-tauri/tauri.conf.json` a `src-tauri/Cargo.toml` (`scripts/version.mjs --check`),
   - vezme poznámky z `CHANGELOG.md` (`scripts/release-notes.mjs`),
   - sestaví NSIS instalátor pro Windows, podepíše ho klíčem aktualizací a zveřejní GitHub Release s instalátorem, `.sig` a `latest.json`.
3. Nainstalované aplikace se jednou denně (a minutu po startu) podívají na
   `https://github.com/daasadr/vision-board/releases/latest/download/latest.json`.
   Když je tam vyšší verze, nabídnou ji v nastavení, upozorněním na nástěnce a v nabídce ikony. Po kliknutí stáhnou instalátor, **ověří jeho podpis** zabudovaným veřejným klíčem, nainstalují ho (jen ukazatel průběhu) a spustí se znovu. Nástěnka, úkoly a nastavení zůstanou (jsou v `%APPDATA%\eu.almost-there.visionboard`).

## Jednorázové nastavení (podpisový klíč)

Klíč aktualizací byl vygenerován 2026-10-12 (`pnpm tauri signer generate`) a je **mimo repo**:

| Soubor                                               | Co to je                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| `C:\Users\Dasa\.tauri\vision-board.key`              | soukromý klíč (zašifrovaný heslem)                                 |
| `C:\Users\Dasa\.tauri\vision-board.key.password.txt` | heslo ke klíči                                                     |
| `C:\Users\Dasa\.tauri\vision-board.key.pub`          | veřejný klíč (je i v `tauri.conf.json` → `plugins.updater.pubkey`) |

1. **Zálohujte** obsah `vision-board.key` a hesla do správce hesel. Bez klíče nejde vydat aktualizaci, kterou už nainstalované aplikace přijmou. Při ztrátě by si všichni museli novou verzi stáhnout a nainstalovat ručně.
2. Vložte je do GitHubu: repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - `TAURI_SIGNING_PRIVATE_KEY` = celý obsah souboru `vision-board.key`,
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` = obsah `vision-board.key.password.txt`.
3. Soukromý klíč nikdy necommitovat (Gitleaks v CI by to zachytil).

## Vydání nové verze

```bash
node scripts/version.mjs 0.3.0     # verze v package.json, tauri.conf.json, Cargo.toml a Cargo.lock
# do CHANGELOG.md přidat oddíl "## [0.3.0] – RRRR-MM-DD" (pro uživatele, česky)
pnpm lint && pnpm typecheck && pnpm test && pnpm e2e && pnpm rust:lint && pnpm rust:test
git commit -am "chore: release 0.3.0"
git tag v0.3.0
git push && git push origin v0.3.0
```

Za ~15 minut je release na `https://github.com/daasadr/vision-board/releases`. Nainstalované aplikace ho nabídnou nejpozději do 24 hodin (hned po „Zkontrolovat teď“ v Nastavení → Obecné → Aktualizace).

Verze: oprava `0.3.1`, nové funkce `0.4.0`. Tag nejde vydat znovu se stejným číslem. Když se build nepovede, opravte chybu a vydejte další číslo (nebo smažte tag i rozpracovaný release na GitHubu a pushněte tag znovu).

## Lokální build instalátoru

Konfigurace má `createUpdaterArtifacts: true`, takže `pnpm tauri build` chce klíč v prostředí (PowerShell):

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $HOME\.tauri\vision-board.key -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = Get-Content $HOME\.tauri\vision-board.key.password.txt -Raw
pnpm tauri build --bundles nsis
```

Instalátor: `src-tauri/target/release/bundle/nsis/Vision Board_<verze>_x64-setup.exe` (+ `.sig`). Bez klíče jde sestavit jen aplikace bez instalátoru: `pnpm tauri build --no-bundle`.

## Test aktualizace bez GitHubu

Endpoint jde přepsat proměnnou `VISION_BOARD_UPDATE_URL` (podpis se ověřuje vždy, takže to je bezpečné):

Updater přijímá jen HTTPS. Lokální HTTP server proto potřebuje verzi A sestavenou s výjimkou, předanou jen pro tento build (repo zůstane beze změny). Verze B se sestaví normálně:

1. Sestavte a nainstalujte verzi A (např. `0.1.90`) s výjimkou pro HTTP:

   ```powershell
   Set-Content insecure.json '{"plugins":{"updater":{"dangerousInsecureTransportProtocol":true}}}'
   pnpm tauri build --bundles nsis --config insecure.json
   ```

2. `node scripts/version.mjs 0.1.91`, sestavte verzi B.
3. Do prázdné složky dejte instalátor B a `latest.json`:

   ```json
   {
     "version": "0.1.91",
     "notes": "Testovací aktualizace",
     "pub_date": "2026-10-12T12:00:00Z",
     "platforms": {
       "windows-x86_64": {
         "signature": "<obsah souboru .sig instalátoru B>",
         "url": "http://127.0.0.1:8765/Vision%20Board_0.1.91_x64-setup.exe"
       }
     }
   }
   ```

4. `python -m http.server 8765 --bind 127.0.0.1` v té složce, spusťte nainstalovanou A s `$env:VISION_BOARD_UPDATE_URL = "http://127.0.0.1:8765/latest.json"` a v nastavení zvolte Zkontrolovat teď → Nainstalovat.
5. Vraťte verzi v repu (`node scripts/version.mjs <původní>`).

## Pro Almost-there.eu: odkaz ke stažení

- Stránka všech verzí: `https://github.com/daasadr/vision-board/releases/latest`.
- Přímý odkaz na instalátor nejnovější verze je v `latest.json` → `platforms["windows-x86_64"].url` (verze v `version`, poznámky v `notes`). Stránku ke stažení stačí cachovat (např. 1 h) a odkaz brát odtud. Název souboru obsahuje číslo verze, proto ho nepsat napevno.
- Instalátor není podepsaný Authenticode (rozhodnutí: odloženo), takže Windows SmartScreen může při prvním spuštění ukázat „Systém Windows ochránil váš počítač“ → **Další informace → Přesto spustit**. Stránka ke stažení by to měla říct. Aktualizace z aplikace se tím netýkají.

## Co když…

- **Release workflow spadne na „Tag matches the app version“:** verze v souborech nesedí s tagem. `node scripts/version.mjs <verze>`, commit, smazat a znovu vytvořit tag.
- **„Secret TAURI_SIGNING_PRIVATE_KEY is missing“:** viz Jednorázové nastavení.
- **Aplikace aktualizaci nenabízí:** zkontrolovat, že release není draft ani prerelease a že `latest.json` je mezi jeho soubory. V aplikaci Nastavení → Obecné → Zkontrolovat teď.
- **macOS:** zatím se nevydává (bez podpisu Apple by ho Gatekeeper blokoval). `latest.json` obsahuje jen Windows, aplikace na macOS aktualizaci nenajde.
