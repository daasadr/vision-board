# Design systém

Vision Board má dvě ručně navržená témata. Každá obrazovka musí vypadat záměrně v obou. Živá ukázka všeho níže je na stránce `/design` (`pnpm dev`, pak http://localhost:1420/design).

## Principy

1. **Tokeny, ne hodnoty.** Komponenty používají jen CSS proměnné z [`src/design/tokens.css`](../src/design/tokens.css). Barvy, stíny, přechody a písma zapsané přímo v komponentě shodí `pnpm lint` (Stylelint, `declaration-strict-value`).
2. **Sémantika, ne vzhled.** Token popisuje roli (`--color-ink-muted`, `--shadow-item`), ne barvu. Témata se tak liší jen hodnotami.
3. **Klid.** Nástěnka je hlavní obsah, UI ustupuje: tlumené povrchy, jeden akcent, žádné nekonečné animace.
4. **Přístupnost je podmínka.** Kontrast WCAG AA hlídá unit test tokenů, axe běží v E2E v obou tématech a animace respektují `prefers-reduced-motion`.

## Témata

|              | Galerie                                | Noc                                           |
| ------------ | -------------------------------------- | --------------------------------------------- |
| Nálada       | tichá galerijní stěna, papír a inkoust | temná místnost, kouřové sklo, mosaz           |
| Režim OS     | světlý                                 | tmavý                                         |
| Akcent       | pálená siena `#97462c`                 | kartáčovaná mosaz (kovový přechod) `#d2b27a`  |
| Povrchy      | neprůhledné, teplé                     | poloprůhledné s `backdrop-filter: blur(18px)` |
| Rohy         | téměř ostré (2–6 px)                   | měkké (6–16 px)                               |
| Stíny        | měkké, teple tónované                  | hluboké, s jemným horním světlem (inset)      |
| Písmo citátů | Fraunces italic (variabilní serif)     | Instrument Serif italic                       |
| Písmo UI     | Figtree                                | Geist                                         |

Výchozí téma se řídí světlým nebo tmavým režimem OS a mění se za běhu ([`theme.ts`](../src/design/theme.ts), `followTheme("system")`). Ruční volbu přidá fáze 2 (nastavení).

## Tokeny

| Skupina        | Tokeny                                                                                                                                                                                                            | Kde            |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Barvy          | `--color-bg`, `surface`, `surface-raised`, `surface-sunken`, `ink`, `ink-muted`, `ink-subtle`, `border`, `border-strong`, `accent`, `accent-hover`, `on-accent`, `focus`, `danger`, `on-danger`, `scrim`, `frame` | téma           |
| Přechody       | `--gradient-accent`, `--gradient-surface`                                                                                                                                                                         | téma           |
| Typografie     | `--font-ui`, `--font-quote`, `--font-display`, `--quote-style`, `--display-weight`, `--tracking-display`; škála `--text-xs` … `--text-3xl`, `--leading-*`                                                         | téma / `:root` |
| Tvar a hloubka | `--radius-sm/md/lg/pill`, `--shadow-sm/md/lg/item/inset`, `--blur-surface`, `--border-width`                                                                                                                      | téma           |
| Mezery         | `--space-1` (4 px) … `--space-8` (64 px)                                                                                                                                                                          | `:root`        |
| Pohyb          | `--duration-fast/normal/slow`, `--ease-standard`, `--ease-emphasized` (při omezení pohybu 0 ms)                                                                                                                   | `:root`        |

Pravidla:

- Všechny `ink` tokeny jsou pro text a musí mít kontrast ≥ 4,5:1 na pozadí i povrchu, na kterém se používají. `accent` a `focus` jako prvky UI ≥ 3:1. Hlídá to [`tokens.test.ts`](../src/design/tokens.test.ts).
- Obě témata musí definovat stejnou sadu tokenů. Nový token se přidává do obou najednou, jinak test selže.
- `--shadow-item` a `--color-frame` jsou vyhrazené pro položky nástěnky (fotky, citáty).

## Písma

Přibalená jako WOFF2, jen latinka a latin-ext (čeština, němčina), celkem ~300 kB. Licence OFL-1.1 jsou v [`src/design/fonts/LICENSES`](../src/design/fonts/LICENSES). Aplikace nenačítá nic ze sítě.

Nový řez se přidává zkopírováním souborů `*-latin-*.woff2` a `*-latin-ext-*.woff2` (např. z balíčků `@fontsource`) a doplněním `@font-face` do [`fonts.css`](../src/design/fonts.css) se stejnými rozsahy `unicode-range`.

## Komponenty

Importují se z `src/design/components`.

| Komponenta | Použití                                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`   | `variant`: `primary` (jedna hlavní akce na obrazovce, akcentový přechod), `secondary` (výchozí), `ghost` (vedlejší akce, zrušit), `danger` (nevratné akce). `size`: `md`, `sm`. |
| `Field`    | Textové pole s popiskem. `hint` a `error` jsou propojené přes `aria-describedby`, s `error` se nastaví i `aria-invalid`.                                                        |
| `Switch`   | Zapnutí/vypnutí nastavení s okamžitým účinkem (bez tlačítka Uložit). Ovládá se mezerníkem.                                                                                      |
| `Dialog`   | Modální okno (Radix): drží fokus uvnitř, zavírá se klávesou Esc a vrací fokus na spouštěč. `actions` se zobrazí vpravo dole, tlačítko zabalené do `DialogClose` dialog zavře.   |

Headless primitiva z Radix se používají jen tam, kde přinášejí přístupnost (fokus, klávesnice, ARIA). Vzhled je vždy vlastní. Předstylované knihovny komponent a Tailwind se nepoužívají.

## Postup pro novou komponentu

1. `src/design/components/Nazev.tsx` a `Nazev.module.css`, třídy v camelCase, hodnoty jen z tokenů.
2. Přidat export do `components/index.ts` a ukázku na stránku `/design`.
3. Zkontrolovat obě témata a doplnit E2E test do `e2e/design-system.spec.ts`, pokud má komponenta vlastní chování (klávesnice, fokus).
