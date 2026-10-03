# Rozhodnutí k zadání (iterace intentu před plánováním)

Doplňuje `zadani.txt`. Otevřené body se po odsouhlasení přenesou do OpenSpec.

## Odsouhlaseno (2026-09-25)

| Téma                    | Rozhodnutí                                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monetizace              | Freemium: nástěnka zdarma, dárek odemyká prémiové styly rámování, wallpaper mód a naplánované pop-upy                                                                           |
| Účet obdarovaného       | Povinný účet Almost-there.eu, aktivace přes přihlášení/token vázaný na účet                                                                                                     |
| Úkoly ve split-screenu  | Lokální seznam v appce, později volitelná synchronizace s Almost-there.eu                                                                                                       |
| Jazyky UI               | čeština, angličtina, němčina (i18n od začátku, výchozí dle systému)                                                                                                             |
| Ovládací prvek (2.2)    | Frameless always-on-top okno v pravém horním rohu obrazovky + tray ikona jako záloha                                                                                            |
| Multi-monitor           | Stejná nástěnka na všech monitorech (tapeta i pop-up)                                                                                                                           |
| Code signing            | Zatím bez placeného podpisu; rozhodnout před veřejným vydáním (Microsoft Store / SignPath / placený podpis)                                                                     |
| Technické body 1–8 níže | Odsouhlaseny                                                                                                                                                                    |
| Vizuální témata         | Dvě témata na výběr: **Galerie** (teplé papírové tóny, serif, paspartá/polaroid) a **Noc** (tmavý minimalismus, sklo, kovové akcenty); výchozí podle světlého/tmavého režimu OS |
| Název                   | Vision Board, identifier `eu.almost-there.visionboard`, deep link `visionboard://`                                                                                              |
| Pořadí licencí          | Appka se nejdřív postaví samostatně (vše odemčené přes vrstvu Entitlements), napojení na Almost-there.eu až ve fázi 6                                                           |
| OpenSpec                | Jedna změna na fázi (0–6); detailní design + tasks just-in-time před začátkem fáze                                                                                              |

## Technické body (odsouhlaseno)

1. Wallpaper mód je pouze zobrazovací (WorkerW okno nepřijímá vstup). Interaktivní hotspoty jen v okně appky / pop-upu.
2. Persistentní ovládací prvek (2.2) = malé frameless always-on-top okno, případně tray ikona.
3. Idle detekce navíc respektuje fullscreen / prezentace / hovory (Windows `SHQueryUserNotificationState`) a má maximální dobu odkladu.
4. Aktivace přes deep link `visionboard://activate?token=…` (instalátor nelze per-user modifikovat kvůli podpisu). Licence = JWT podepsaný Ed25519, v appce jen veřejný klíč, offline ověření.
5. Code signing: odloženo (viz tabulka). Podpis aktualizací Tauri updateru vlastním klíčem je zdarma a zavede se hned.
6. Auto-update přes `tauri-plugin-updater` (podepsané aktualizace).
7. E2E: Playwright proti frontendu s mockovaným Tauri IPC + na Windows přes CDP k WebView2; nativní části Rust testy.
8. Úložiště: SQLite + složka s komprimovanými obrázky (WebP), export/import nástěnky jako záloha.

## Prostředí

- Nutný `rustup update` (je 1.79, Tauri 2 a aktuální crates potřebují novější).
- Doinstalovat: pnpm, Beads (`bd`), OpenSpec, Lefthook.
