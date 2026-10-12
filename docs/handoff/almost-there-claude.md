# Pokyn pro Claude Code v repu Almost-there.eu

Pro: Claude Code, který vyvíjí Almost-there.eu (Next.js, PWA, webview mobilní aplikace, vlastní server). Projekt je v pokročilém stádiu. Tento pokyn zavádí stejný pracovní postup, jaký používá Vision Board (OpenSpec + Beads, testy s každým úkolem, vlastní bezpečnostní review), a popisuje první úkol: napojení Vision Boardu.

Uživatelka (Dagmar) je majitelka obou projektů. Rozhoduje o produktu a schvaluje commity a pushe.

---

## 1. Proč a jak

- **OpenSpec** drží _co a proč_: každá větší změna má složku `openspec/changes/<název>/` s `proposal.md` (proč, co, non-goals), `specs/<capability>/spec.md` (požadavky SHALL/MUST se scénáři WHEN/THEN), `design.md` (jak, rozhodnutí, rizika) a `tasks.md` (zaškrtávací úkoly, každý s ověřením). Po dokončení se změna archivuje a její požadavky se přesunou do `openspec/specs/`, takže specifikace popisují skutečný stav systému.
- **Beads (`bd`)** drží _práci_: epic na změnu, úkoly pod ním, závislosti, stav. Žádné TODO v markdownu, žádný TodoWrite.
- **`bd remember`** drží poznatky mezi sezeními (ne MEMORY.md).

Projekt už existuje, takže **nespecifikuj zpětně celý systém.** Specifikace vznikají jen pro oblasti, na kterých se pracuje. Kód je zdroj pravdy pro to, co tu už je.

## 2. Jednorázové nastavení repa

Nástroje (globálně přes npm; pokud příkaz chybí v PATH, globální složka npm je `D:\home\dasa\.npm-global`):

```bash
npm i -g @fission-ai/openspec@1.13.2 @beads/bd@1.3.0
openspec init          # vybrat Claude Code; vytvoří openspec/ a /opsx:* příkazy a skilly
bd init                # lokální databáze úkolů; prefix třeba "at"
bd setup claude        # hooky, aby se kontext Beads načetl na začátku sezení
```

Pak:

1. **`openspec/config.yaml`**: do `context` napiš 10–20 řádků o projektu (stack, tvrdá omezení, jazyk). Vzor z Vision Boardu:

   ```yaml
   schema: spec-driven
   context: |
     Language: cs
     All artifacts must be written in cs.
     Keep OpenSpec structural headings and SHALL/MUST keywords in English.
     Projekt: Almost-there.eu – aplikace na plánování a plnění dlouhodobých cílů (Next.js, PWA,
     webview mobilní aplikace, vlastní server). Kód, identifikátory a komentáře anglicky.
     Tvrdá omezení: <doplň – např. soukromí, výkon, podporované prohlížeče>
   rules:
     proposal:
       - Vždy uveď sekci "Non-goals".
     design:
       - U každé nové závislosti uveď dopad (velikost bundlu, výkon).
     tasks:
       - Úkol max. ~2 hodiny práce.
       - Každý úkol uvádí způsob ověření (test, příkaz nebo pozorovatelné chování).
       - Úkoly dotýkající se autentizace, plateb nebo licencí mají navazující úkol "Review bezpečnosti".
   ```

2. **`CLAUDE.md`** (a stejný obsah do `AGENTS.md`, pokud existuje): doplň blok z oddílu 6.
3. **Baseline**: projdi repo a do `docs/` (nebo `CLAUDE.md`) zapiš krátce architekturu a příkazy (build, lint, typecheck, test, e2e), pokud tam ještě nejsou. Nic nepřepisuj, jen doplň, co chybí.
4. Commit nastavení až po souhlasu uživatelky.

## 3. Pracovní smyčka (každý úkol)

1. `bd ready`: vyber úkol, `bd show <id>`, `bd update <id> --claim`.
2. Přečti `openspec/changes/<změna>/{proposal,specs,design,tasks}.md`. Pokud `design.md` nebo `tasks.md` chybí, napiš je nejdřív. Design se píše **just-in-time**, až před začátkem změny, ne dopředu pro všechno.
3. Implementuj (`/opsx:apply <změna>`). **Testy a dokumentace patří k úkolu**, ne na konec.
4. Spusť kontroly (lint, typecheck, unit, e2e, build). Úkol není hotový, dokud neprochází.
5. Zaškrtni checkbox v `tasks.md`, `bd close <id>`.
6. Odchylky od designu zapiš do `design.md` (oddíl „Odchylky při implementaci“ s datem a důvodem).
7. Nové poznatky, které se budou hodit v dalších sezeních (záludnosti nástrojů, rozhodnutí uživatelky), ulož přes `bd remember "…"`.
8. Po poslední položce změny: review (oddíl 4), pak archivace (`/opsx:archive`, nebo ručně: požadavky z delta specs do `openspec/specs/<cap>/spec.md`, `openspec validate --specs --strict`, přesun do `openspec/changes/archive/YYYY-MM-DD-<název>`).

Pravidla:

- Nová práce, na kterou narazíš, = nový úkol v Beads (`bd create … --parent=<epic>`), ne poznámka v textu.
- Úkol, který vyžaduje rozhodnutí uživatelky, označ a zeptej se; nerozhoduj produktové otázky sám.
- **Git:** commit a push jen se souhlasem uživatelky. Zprávy commitů anglicky, konvenční prefixy (`feat:`, `fix:`, `docs:`).
- Po pushi zkontroluj CI a chyby oprav hned.

## 4. Review bezpečnosti

Uživatelka nemá placený Codex. Review dělá Claude sám jako samostatný úkol na konci změny, která se dotýká autentizace, licencí, plateb, vstupů od uživatele nebo nové závislosti. Postup: projít diff proti hrozbám (neověřené vstupy, autorizace, únik tajemství, CSRF/clickjacking, rate limit, logování citlivých dat), nálezy opravit, přijatá rizika zapsat do `design.md` oddílu „Review“.

## 5. První změna: napojení Vision Boardu

Zdroj pravdy je kontrakt v repu Vision Boardu:
**https://github.com/daasadr/vision-board/blob/main/docs/almost-there-api.md**
(lokálně `D:\Projekty\VisionBoard\docs\almost-there-api.md`). Nic v kontraktu neměň sám. Když je potřeba změna, navrhni ji uživatelce a ta ji předá oknu Vision Boardu, aby se obě strany změnily zároveň.

Model (rozhodnutí uživatelky 2026-10-12):

- Každý registrovaný uživatel Almost-there.eu má licenci na Vision Board ke svému účtu.
- Každý má osobní pozvánku (odkaz), kterou může poslat komukoli a kolikrát chce. Pozvaný se zaregistruje a dostane licenci jako každý jiný. Účel: získat nové registrované (a možné platící) uživatele Almost-there.eu.
- Aplikace Vision Board pozvánky nezná. Aktivuje se vždy přihlášením k účtu.

Navržená změna `openspec/changes/visionboard-licensing/`:

- **Capabilities:** `visionboard-license` (kdo má licenci, evidence instalací, limit 3 zařízení, stránka „Moje zařízení“), `visionboard-activation` (stránka `/visionboard/activate`, aktivační kód, PKCE, přesměrování na `visionboard://activate`), `visionboard-api` (`POST /api/visionboard/v1/licenses`, `/renew`, `/deactivate`, chyby), `visionboard-invite` (osobní pozvánka s `ref`, veřejná landing page `/visionboard`, kdo koho pozval), `visionboard-download` (stránka ke stažení podle `latest.json`).
- **Úkoly (návrh pořadí):**
  1. Datový model (Prisma nebo co repo používá): licence, instalace, aktivační kódy (hash), pozvánky (kód uživatele, kdo koho pozval). Migrace a testy.
  2. Podepisování licencí (`jose`, EdDSA), klíč z prostředí serveru. Test proti vektorům z oddílu 9 kontraktu.
  3. API `/licenses` (výměna kódu, PKCE, limit zařízení, rate limit) s testy všech chybových kódů.
  4. Stránka aktivace (zachování parametrů přes přihlášení/registraci, potvrzení POSTem s CSRF, zobrazení kódu, přesměrování) s e2e testem.
  5. `/renew` a `/deactivate`, stránka „Moje zařízení“.
  6. Pozvánky: osobní odkaz v účtu (kopírovat, sdílet), veřejná landing page `/visionboard`, uložení pozvajícího při registraci, počet pozvaných v účtu.
  7. Stránka ke stažení (čte `latest.json` z GitHub Releases, cache).
  8. Review bezpečnosti (oddíl 4 a oddíl 8 kontraktu).
  9. Vygenerovat produkční pár klíčů. Soukromý do prostředí serveru a správce hesel, **veřejný klíč a `kid` předat uživatelce pro Vision Board**. Teprve verze Vision Boardu s tímto klíčem začne licence vynucovat. Do té doby je v aplikaci vše odemčené, takže web lze nasadit a vyzkoušet bez rizika.
- **Integrační test:** Vision Board v debug buildu jde nasměrovat na lokální server (`VISION_BOARD_API_URL=http://localhost:3000`, `VISION_BOARD_DEV_LICENSE_KEY=<veřejný klíč>`, `kid` `dev`), viz oddíl 10 kontraktu.

## 6. Blok do CLAUDE.md repa Almost-there

```markdown
## Workflow (OpenSpec + Beads)

- Úkoly: Beads (`bd ready`, `bd update <id> --claim`, `bd close <id>`). Žádné TODO v markdownu ani TodoWrite. Poznatky: `bd remember`.
- Specifikace: `openspec/changes/<změna>/` (proposal, specs, design, tasks). Design a tasks just-in-time před začátkem změny. Po dokončení archivovat (`/opsx:archive`).
- Každý úkol v Beads odkazuje na svou změnu OpenSpec. Testy a dokumentace patří k úkolu.
- Před zavřením úkolu: lint, typecheck, testy, e2e, build. Úkol není hotový, dokud neprochází.
- Změny autentizace, licencí, plateb a vstupů: na konci změny úkol "Review bezpečnosti" (dělá Claude, nálezy do design.md).
- Git: commit a push jen se souhlasem uživatelky. Po pushi zkontrolovat CI.
- Specifikace a projektová dokumentace česky, kód a komentáře anglicky.

## Vision Board

Desktopová aplikace (repo daasadr/vision-board) se aktivuje účtem Almost-there.eu. Kontrakt: https://github.com/daasadr/vision-board/blob/main/docs/almost-there-api.md. Neměnit jednostranně, změny navrhnout uživatelce.
```

## 7. První zpráva pro nové sezení (zkopírovat do okna Almost-there)

> Přečti si prosím `D:\Projekty\VisionBoard\docs\handoff\almost-there-claude.md` (nebo https://github.com/daasadr/vision-board/blob/main/docs/handoff/almost-there-claude.md) a kontrakt `docs/almost-there-api.md` vedle něj. Nejdřív v tomto repu zaveď OpenSpec a Beads podle oddílů 2 a 6 a ukaž mi, co měníš. Pak založ změnu `visionboard-licensing` (proposal, specs, design, tasks) a epic s úkoly v Beads podle oddílu 5 a počkej, až to schválím. Produktové otázky, které kontrakt neřeší (např. texty stránek, kde v účtu bude „Pozvat“), mi polož najednou.
