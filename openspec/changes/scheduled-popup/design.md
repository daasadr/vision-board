# Design

## Context

Staví na fázích 1 a 2: nástěnka v SQLite, nastavení jako jeden JSON v Rustu (`domain::settings`, `preferences`), `domain::placement::rect_in` pro umístění, `Entitlements`, okna na vyžádání ničená při zavření a nativní vrstva `platform/` (Win32 už používá `windows` 0.61 se stejnými features jako tao). Požadavky viz specs/popup-schedule, activity-detection, popup-display.

Poznatky z fáze 2, které design ovlivňují:
- Webview, které je jediným oknem, stojí ~80 MB (celý WebView2). Pop-up je ale krátkodobý (sekundy až minuty), proto smí být webview. Po zavření se ruší a WebView2 doběhne do ~1 min.
- Okno vytvořené s `focused(false)` se na Windows ukáže bez aktivace. Ověřilo se u ovládacího prvku.
- Ruční testy nativního chování: DPI-aware PowerShell (`SetProcessDPIAware`), jinak souřadnice nesedí.

## Goals / Non-Goals

**Goals:**
- Plánovač bez pollingu, když je vypnutý. Když je zapnutý, probouzí se jen k nejbližšímu okamžiku (plus pojistka, viz níže) a během čekání na pauzu nejvýš jednou za 5 s.
- Rozhodovací logika (kdy, zda vynechat, zmeškané po spánku) jako čisté funkce v `domain` s `cargo test`.
- Pop-up nevezme fokus, dokud s ním uživatel neinteraguje. Po zavření vrátí fokus původní aplikaci.

**Non-Goals:**
- Notifikace OS, zvuky, tapeta (fáze 4).
- Detekce „nerušit“ na macOS a Linuxu tam, kde ji OS nenabízí bez zvláštních oprávnění.

## Decisions

### Model plánu (`domain::schedule`)
`Settings.schedule` (nová pole se doplní tolerantním načtením, starší JSON funguje):

```
Schedule {
  times: [minuty od půlnoci]        0–12 pevných časů      (výchozí [9:00])
  interval: minuty | null           15–480                 (výchozí null)
  windowStart, windowEnd: minuty    časové okno intervalu  (9:00–18:00)
  days: [bool; 7]                   po–ne                  (všechny)
  durationSecs: 10–600              délka zobrazení        (30)
  pauseSecs: 2–30                   pauza ve vstupu        (5)
  maxDelayMin: 5–120                maximální odklad       (30)
}
```

Zapnutí je `Settings.startup.scheduledPopup` (existuje z fáze 2, spec „kombinace spouštěcích režimů“). Validace ořízne rozsahy, seřadí časy a odstraní duplicity.

`next_after(schedule, t: NaiveDateTime) -> Option<NaiveDateTime>` vrací nejbližší okamžik po `t` (pevné časy a intervalové časy `windowStart + k·interval < windowEnd`) v povolené dny. Pracuje v místním čase (`chrono::Local`), takže změna časového pásma se projeví při dalším přepočtu.

### Plánovač (`scheduler.rs`, async úloha)
- Běží jen při zapnutém plánu a oprávnění `ScheduledPopup`. Změna nastavení úlohu zruší a spustí znovu (`preferences::apply`).
- Smyčka: spočítá nejbližší okamžik a spí do něj, nejvýš ale **15 min**. Pak přepočítá podle hodin (wall clock). Pojistka řeší spánek počítače a změnu času, protože monotónní čas se během spánku nemusí posouvat. Stojí čtyři mikrosekundová probuzení za hodinu. Spec chtěla „jen k nejbližšímu okamžiku“, odchylka je zapsaná níže.
- **Zmeškané** (počítač spal): když plánovač zjistí, že od posledního zpracovaného okamžiku jeden nebo víc okamžiků uplynulo, sloučí je do jednoho. Zobrazí ho, jen pokud je to dnes a (u intervalu) jsme pořád v časovém okně. Večerní okamžik se ráno nezobrazí.
- **Čekání na vhodnou chvíli** (`domain::activity::decide`): od okamžiku, kdy plánovač začne čekat, se počítá maximální odklad. Každých ≤ 5 s:
  - po uplynutí odkladu → **vynechat**;
  - obrazovka zamčená / uživatel pryč (nečinnost > 10 min) → čekat;
  - fullscreen / prezentace / nerušit → čekat;
  - nečinnost ≥ pauza → **zobrazit**;
  - jinak čekat `pauza − nečinnost` (nejvýš 5 s).
- **Odložit** (5/15/60 min) naplánuje jednorázový okamžik `teď + n`, který pak prochází stejnou kontrolou aktivity.

### Detekce aktivity (`platform`)
`activity() -> Activity { idle: Option<Duration>, busy: bool, away: bool }`. Nic jiného se nečte ani neukládá.
- **Windows:** `GetLastInputInfo` + `GetTickCount` (idle), `SHQueryUserNotificationState`: `NOT_PRESENT` → away (zamčeno, spořič, přepnutý uživatel), `BUSY` / `RUNNING_D3D_FULL_SCREEN` / `PRESENTATION_MODE` / `QUIET_TIME` → busy. Funkce tao už zapíná (`Win32_UI_Shell`, `Win32_System_SystemInformation`), nic nepřibude. Bez oprávnění.
- **macOS:** `CGEventSourceSecondsSinceLastEventType` (CoreGraphics, bez oprávnění Input Monitoring). Fullscreen, nerušit a zámek zatím neznámé (`busy = false`), doplní se po ověření na Macu.
- **Linux:** `idle = None` (XScreenSaver by přidal závislost na X11 a na Waylandu nefunguje). Pop-up se pak zobrazí v plánovaný čas bez čekání na pauzu. Zapsat do uživatelské dokumentace.

### Pop-up (`popup.rs` + `src/app/popup/`)
- Jedno okno na monitor, štítky `popup-0…n`. Velikost: celá obrazovka monitoru (režim „celá obrazovka“), nebo `rect_in(pracovní plocha)` (částečné). Okno je bez rámečku, průhledné, vždy navrch, bez hlavního panelu, `focused(false)` a nevidí ho Alt+Tab (tool window jako u prvku).
- Obsah: nástěnka jen ke čtení (`BoardView`: plátno 1920×1080 se škálováním, položky přes `ItemContentView`, rámy a „jen obrázky“ podle nastavení) a dole lišta **Zavřít**, **Odložit 5 / 15 / 60 min** a ukazatel odpočtu. Celá obrazovka má za nástěnkou ztlumené pozadí (scrim). Prolnutí dovnitř i ven je CSS (respektuje reduced motion).
- Odpočet běží ve frontendu, najetí myší ho pozastaví. Esc zavře (funguje, jakmile uživatel do okna klikne, do té doby okno klávesy nedostává, což je požadované chování). Konec odpočtu, Zavřít, Odložit i Esc volají `popup_close { snoozeMinutes }`. Rust zruší všechna okna pop-upu najednou a případné odložení předá plánovači.
- **Fokus:** před zobrazením si Rust zapamatuje okno v popředí (`platform::foreground_window`). Když se pop-up při zavření nachází v popředí (uživatel do něj klikl), vrátí fokus původnímu oknu (`platform::restore_foreground`). Jinak se fokusu nedotkne.
- Ruční spuštění: tray „Zobrazit nástěnku teď“ (bez ohledu na plán a aktivitu). Totéž umí command `popup_show_now`, který použije tlačítko „Vyzkoušet“ v nastavení.
- Paměť: webview existuje jen po dobu zobrazení. Po zavření se okna ruší, WebView2 doběhne sám.

### Nastavení „Časování“
Nová sekce: přepínač (se zámkem bez oprávnění), pevné časy (přidat/odebrat, `<input type="time">`), interval s oknem od–do, dny v týdnu (7 přepínacích tlačítek), délka zobrazení, pauza, maximální odklad a tlačítko **Vyzkoušet**. Pod tím text „Příští zobrazení: …“ z commandu `schedule_next` (Rust spočítá stejnou funkcí jako plánovač).

## Risks / Trade-offs

- [Spánek a monotónní čas] → pojistné probuzení po 15 min a přepočet podle hodin. Alternativa (`WM_POWERBROADCAST`, `WM_TIMECHANGE`) potřebuje skryté okno a platformní kód na každém OS.
- [`SHQueryUserNotificationState` nehlásí Focus Assist (nerušit) spolehlivě] → `QUIET_TIME` pokrývá jen část. Nedokumentované WNF API nepoužívat. Zapsat do dokumentace.
- [Pop-up na více monitorech = více webview] → jen během zobrazení. Měřit, zda se stihne zobrazit do 1 s.
- [Okno navrchu přes fullscreen hru] → pop-up se při fullscreen vůbec nespustí (busy), takže nehrozí.

## Ověření a odchylky (2026-10-10)

- Release build, Windows 11, dva monitory: „Zobrazit teď“ otevře pop-up na obou monitorech (celá obrazovka 3840×2160 a 1920×1080 fyzických px), vždy navrch, mimo Alt+Tab. Okno v popředí se nezměnilo, fokus tedy nebral. Odložení zavřelo obě okna a za 1 min (plus čekání na pauzu) se pop-up vrátil. Obsah: nástěnka uživatele, tlačítka v jazyce aplikace.
- Vytvoření oken trvá ~2,2 s (dvě webview). U plánovaného zobrazení na tom nesejde. Kdyby vadilo u „Vyzkoušet“, okna lze připravit skrytá při čekání na vhodnou chvíli.
- Návrat fokusu po kliknutí do pop-upu, čekání na pauzu, fullscreen, zámek a spánek jsou v ručním checklistu (`docs/testing.md`) a čekají na ověření.
- Plánovač se kvůli spánku a změně času probouzí nejvýš po 15 min (spec chtěla jen k nejbližšímu okamžiku). Vypnutý plán neběží vůbec.
- `QUNS_QUIET_TIME` není režim Windows „Nerušit“ (Focus Assist), ten se zatím nerozpozná (není veřejné API).

## Review (úkol 6.2)

- **Soukromí:** `platform::activity` čte jen `GetLastInputInfo` + `GetTickCount` (čas od vstupu, ne obsah) a `SHQueryUserNotificationState` (výčet stavu). Na macOS čítač `CGEventSourceSecondsSinceLastEventType`, který nevyžaduje oprávnění Input Monitoring. Nic se neukládá ani neodesílá. `foreground_window` ukládá jen číselný handle okna v paměti (ne titulek), aby se dal vrátit fokus.
- **FFI:** `restore_foreground` předá handle `SetForegroundWindow` až po kontrole `IsWindow`. `GetTickCount` přetéká po 49 dnech, rozdíl se počítá přes `wrapping_sub`. Žádné ukazatele mimo vlastní struktury na zásobníku.
- **IPC:** `popup_close` omezí odložení na 1–1440 min. Plán validuje `Schedule::normalized` (rozsahy, max. 12 časů, okno od < do). `popup_show_now` nic nepřijímá.
- **Souběh:** úloha plánovače se při změně nastavení zruší (`abort`), mutexy se drží jen krátce a nikdy přes `await`.
