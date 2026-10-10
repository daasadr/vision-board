# Design

## Context

Staví na fázích 1–4: položky nástěnky jako JSON v `items.payload` s validací v `domain::board` a zpět/znovu ve frontendovém storu, import médií (WebP), `BoardView` jen ke čtení (pop-up, tapeta), nastavení v Rustu, okna na vyžádání a tapeta jako vyrenderovaný snímek. Požadavky viz specs/hotspots, daily-tasks, split-view.

## Goals / Non-Goals

**Goals:**
- Hotspoty se chovají jako součást obrázku: posouvají a škálují se s ním, zpět/znovu je vrací spolu s obrázkem.
- Úkoly jen lokálně, ale se stabilním id a časy, aby šly později synchronizovat.
- Split-screen ve třech místech (hlavní okno, pop-up, tapeta) jedním komponentem.

**Non-Goals:**
- Synchronizace úkolů, projekty, štítky, připomínky.
- Hotspoty na tapetě (je jen na dívání).

## Decisions

### Hotspoty v obsahu obrázku (místo tabulek `hotspots` a `detail_media`)
`ItemContent::Image { mediaId, hotspots: Hotspot[] }` (výchozí prázdné, starší data se načtou beze změny):

```
Hotspot { id, x, y (0–1, poměr v obrázku), label (≤ 40 zn.),
          action: { kind: "link", url } | { kind: "detail", title (≤ 80), text (≤ 2000), media: [mediaId] (≤ 20) } }
```

Proč ne tabulky z návrhu: hotspot nemá smysl bez obrázku a úprava hotspotu je úprava položky. Uložení v payloadu dává zdarma zpět/znovu, atomické ukládání dávkou, jednu validaci a smazání s obrázkem. Úklid médií (`remove_unreferenced`) počítá i média z detailů (`json_each` přes hotspoty).

Validace v `domain::board`: nejvýš 5 hotspotů, souřadnice 0–1, délky textů, **odkaz jen `http`/`https`** (parsuje se jako URL, jiná schémata se odmítnou; frontend hlídá totéž, aby chybu ukázal hned), nejvýš 20 médií detailu a všechna musí existovat.

### Otevírání
- **Odkaz:** command `open_link(url)` znovu ověří schéma a otevře adresu ve výchozím prohlížeči (`tauri-plugin-opener` jen z Rustu, bez JS oprávnění). Nikdy se neotevře uvnitř aplikace.
- **Detail:** okno `detail` (720×540, na vyžádání, při zavření zrušené) s nadpisem, textem a galerií (šipky, Esc zavře). Dostane id položky a hotspotu přes initialization script a data si načte samo (`board_load`), takže ukazuje vždy uložený stav.
- Hotspoty jsou v klidu nenápadné kroužky, výrazné při najetí na obrázek. V hlavním okně a v pop-upu jsou aktivní, na tapetě se nevykreslí (`BoardView` bez hotspotů).

### Úprava hotspotů
V liště vybraného obrázku přibude **Hotspoty**. Režim úprav: klik do obrázku přidá hotspot (nejvýš 5), tažením se posune a klik otevře dialog (název, akce odkaz / detail, URL, nadpis a text, fotky detailu přes stávající import). Každá změna je běžná úprava položky (`store.update`), takže funguje zpět/znovu.

### Úkoly (`domain::tasks`, migrace v3)
Tabulka `tasks(id TEXT PK (UUID z frontendu), day TEXT 'YYYY-MM-DD', text, done, position, created_at, updated_at)`. Commands `tasks_list(from, to)` a `tasks_apply(ops)` (upsert / delete v transakci, validace délky ≤ 200 a formátu dne). Frontend: store úkolů s optimistickými úpravami po vzoru nástěnky.
- **Seznam** ukazuje dvě části, **Dnes** a **Zítra**. Nový úkol jde do zítřka (večerní plánování), přepínačem dnes. Odškrtnutí, úprava na místě, smazání, přeřazení tažením nebo klávesnicí (Alt+šipky).
- **Přenos nedokončených:** při prvním zobrazení seznamu v novém dni se nedokončené úkoly z minulých dnů nabídnou přesunout na dnešek nebo zahodit (příznak posledního dne zobrazení v `app_state`).
- Žádná síť. Id a časy jsou připravené na budoucí synchronizaci.

### Split-screen
`Settings.split { board, popup, wallpaper: bool; side: left | right }`. Komponenta `SplitView` rozdělí prostor: nástěnka 3/5 a úkoly 2/5 (nástěnka zůstává 16:9 a seznam vyplní zbytek).
- **Hlavní okno:** plátno + seznam úkolů s plnou úpravou.
- **Pop-up:** nástěnka + úkoly s možností odškrtnout.
- **Tapeta:** nástěnka + úkoly jen ke čtení. Tapeta se obnoví po každé změně úkolů a nově i o půlnoci (plánovač tapety si naplánuje probuzení na začátek dne, jinak by tapeta ukazovala včerejší „Dnes“).

## Risks / Trade-offs

- [Payload obrázku roste s detaily] → texty jsou omezené a fotky jsou jen id. Načítání celé nástěnky zůstává malé.
- [Půlnoc a tapeta] → jedno naplánované probuzení denně a jen se zapnutým split-screenem na tapetě.
- [Opener plugin vs. vlastní ShellExecute] → plugin je multiplatformní a malý. Připnout verzi kompatibilní s Tauri 2.11 (jako autostart).
