# Tasks

## 1. Úložiště

- [x] 1.1 Přidat rusqlite (bundled) + rusqlite_migration, otevření `board.db` ve WAL a migraci v1 (boards, items, media, app_state) a ověřit `cargo test` na migraci do dočasné DB
- [x] 1.2 Repository v `domain/board` (načtení nástěnky, dávkové `apply_ops` v transakci) a ověřit unit testy vč. rollbacku při chybě v dávce
- [x] 1.3 Commands `board_load` a `board_apply_ops` s TS typy (tauri-specta) a mock v `e2e/mocks` a ověřit typovou kontrolou a smoke E2E

## 2. Plátno a položky

- [x] 2.1 Komponenta plátna s logickými souřadnicemi 1920×1080 a škálováním do okna a ověřit unit testem převodu souřadnic + ručně změnou velikosti okna
- [x] 2.2 Renderery položek image/quote/text stylované tokeny obou témat a ověřit na stránce `/design` v Galerii i Noci
- [x] 2.3 Prázdný stav s výzvou a akcemi (lokalizovaný cs/en/de) a ověřit E2E „první spuštění“
- [x] 2.4 Přidání citátu a textu (dialog, validace prázdného obsahu) a ověřit E2E scénáře „Přidání citátu“ a „Prázdný text“
- [x] 2.5 Přesun tažením (pointer events, rAF, přichycení 10 % na plátně) a ověřit unit testem clampingu a E2E tažením
- [x] 2.6 Změna velikosti (poměr stran u obrázků) a natočení ±15° a ověřit unit testy geometrie
- [x] 2.7 Výběr, pořadí vrstev, úprava textu na místě, smazání, ovládání klávesnicí a ověřit E2E + axe kontrolou
- [x] 2.8 Zustand store s historií příkazů (zpět/znovu, 50 kroků) a ověřit Vitest testy inverzí všech typů příkazů
- [x] 2.9 Debounced ukládání dávek (300 ms / max 1 s) a flush při ukončení a ověřit unit testem s fake timery

## 3. Import médií

- [x] 3.1 `domain/media` pipeline (magické bajty, limit 50 MB, dekódování, EXIF orientace, resize 2560, WebP q80, náhled, atomický zápis) a ověřit `cargo test` s testovacími obrázky (orientace, alfa, GPS odstraněno, velikost)
- [x] 3.2 Command `media_import_paths` / `media_import_bytes` na `spawn_blocking` a asset protokol se scope `media/` a ověřit, že UI během importu 40MB souboru reaguje
- [x] 3.3 Drag & drop z OS, vložení ze schránky, dialog výběru; zástupný stav a chybové hlášky pro nepodporované soubory a ověřit E2E (mockované IPC) + ruční test přetažení 3 JPG a PNG+PDF
- [ ] 3.4 Úklid neodkazovaných médií při startu a ukončení a ověřit `cargo test`
- [ ] 3.5 Codex review: parsování souborů a asset protokol scope (vstup od uživatele → bezpečnost) a zapracovat nálezy

## 4. Tray a životní cyklus

- [ ] 4.1 Tray ikona s lokalizovanou nabídkou, klik otevře nástěnku a ověřit ručně na Windows (checklist v docs/testing.md)
- [ ] 4.2 Zavření okna = destroy webview, prevent_exit, jednorázové upozornění a ověřit ručně + měřením paměti v tray (< 40 MB, zapsat do docs/performance.md)
- [ ] 4.3 „Ukončit“ s flush ukládání a importu (max 5 s) a ověřit ručně scénářem „Ukončení během importu“

## 5. Entitlements

- [x] 5.1 `domain/entitlements` + command + hook `useEntitlement` (vše true) a ověřit unit testy scénářů ze spec entitlements

## 6. Integrace a dokumentace

- [ ] 6.1 Playwright E2E kritického flow „vložit obrázek → přesunout → restart (reload s perzistentním mockem) → pozice zachována“
- [ ] 6.2 Výkon: 100 položek, tažení 60 fps (Performance panel), zapsat do docs/performance.md
- [ ] 6.3 Aktualizovat docs/architecture.md (datový model, souřadnice, pipeline médií) a uživatelskou dokumentaci docs/user/board.md (cs)
