# Tasks

## 1. Hotspoty – data

- [x] 1.1 `Hotspot` v obsahu obrázku, validace (≤ 5, souřadnice, délky, jen http/https, ≤ 20 existujících médií), úklid médií z detailů a ověřit `cargo test`
- [x] 1.2 Command `open_link` (ověření schématu, výchozí prohlížeč přes opener) a ověřit `cargo test` validace + ručně

## 2. Hotspoty – UI

- [x] 2.1 Zobrazení hotspotů na obrázcích (nástěnka, pop-up; ne tapeta), akce odkaz / detail a ověřit E2E
- [x] 2.2 Režim úprav hotspotů (přidat klikem, posun tažením, dialog s názvem, akcí, URL, detailem a fotkami, zpět/znovu) a ověřit E2E scénáři „Přidání odkazu“ a „Nepovolené schéma“
- [x] 2.3 Okno detailu (nadpis, text, galerie se šipkami, Esc) a ověřit E2E scénářem „Prohlížení detailu“ + axe

## 3. Úkoly

- [ ] 3.1 Migrace v3, `domain::tasks`, commands `tasks_list` / `tasks_apply` a ověřit `cargo test`
- [ ] 3.2 Store a seznam úkolů (Dnes / Zítra, přidat, odškrtnout, upravit, smazat, přeřadit) a ověřit Vitest + E2E scénářem „Plánování večer“
- [ ] 3.3 Přenos nedokončených úkolů na nový den a ověřit E2E scénářem „Nový den“

## 4. Split-screen

- [ ] 4.1 `Settings.split`, `SplitView` v hlavním okně a nastavení (strana, kde platí) cs/en/de a ověřit E2E „Zapnutí v hlavním okně“
- [ ] 4.2 Split-screen v pop-upu (odškrtávání) a na tapetě (jen ke čtení, obnova po změně úkolů a o půlnoci) a ověřit E2E + ručně v release buildu

## 5. Dokončení

- [ ] 5.1 Review (odkazy, validace vstupů, nové okno, opener) a zapracovat nálezy
- [ ] 5.2 Dokumentace: `docs/architecture.md`, `docs/user/hotspots.md` a `docs/user/tasks.md` (cs), ruční checklist, body do úkolu vb-8my
