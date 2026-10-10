# Tasks

## 1. Plán a rozhodování (domain)

- [x] 1.1 `domain::schedule` (model v `Settings`, validace, `next_after`, sloučení zmeškaných) a ověřit `cargo test` (pevné časy, interval s oknem, dny, přelom dne, změna času, zmeškané po spánku)
- [x] 1.2 `domain::activity::decide` (pauza, nečinnost, zámek, busy, maximální odklad) a ověřit `cargo test` všech scénářů ze spec activity-detection

## 2. Nativní detekce aktivity

- [x] 2.1 `platform::activity` na Windows (GetLastInputInfo, SHQueryUserNotificationState), macOS (CGEventSourceSecondsSinceLastEventType), Linux (neznámé) a ověřit ručně na Windows (psaní, zamčení, fullscreen video, prezentace)

## 3. Plánovač

- [x] 3.1 Async plánovač (start/stop podle nastavení a oprávnění, spánek do okamžiku s pojistkou 15 min, čekání na vhodnou chvíli po ≤ 5 s, odložení) a ověřit unit testy řízení + ručně (bez probouzení při vypnutém plánu)

## 4. Pop-up

- [x] 4.1 Okna pop-upu na všech monitorech (umístění, bez fokusu, mimo Alt+Tab), commands `popup_show_now` / `popup_close`, návrat fokusu, tray „Zobrazit nástěnku teď“ a ověřit ručně na dvou monitorech
- [x] 4.2 Frontend pop-upu (nástěnka jen ke čtení, lišta Zavřít / Odložit, odpočet s pauzou při najetí, Esc, prolnutí) a ověřit E2E (mock) + axe v obou tématech

## 5. Nastavení

- [x] 5.1 Sekce Časování (přepínač se zámkem, časy, interval s oknem, dny, délka, pauza, odklad, Vyzkoušet, příští zobrazení) cs/en/de a ověřit E2E scénáři „Denní připomenutí“ a „Bez oprávnění“

## 6. Dokončení

- [ ] 6.1 Měření: čas od spuštění do zobrazení, paměť při zobrazení a 60 s po zavření, CPU plánovače v klidu (vypnutý i zapnutý plán), zapsat do `docs/performance.md`
- [x] 6.2 Review bezpečnosti a soukromí (FFI aktivity, co se čte, IPC vstupy plánu) a zapracovat nálezy
- [x] 6.3 Dokumentace: `docs/architecture.md`, `docs/user/popup.md` (cs), ruční checklist v `docs/testing.md`
