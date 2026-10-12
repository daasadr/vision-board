# Napojení Vision Boardu na Almost-there.eu (API kontrakt v1)

Pro: vývoj Almost-there.eu (Next.js) a vývoj Vision Boardu. Popisuje, co musí Almost-there.eu poskytnout, aby se Vision Board dal aktivovat účtem, a co aplikace od webu čeká. Návrh strany aplikace je v `openspec/changes/licensing-activation/design.md`.

Stav: **návrh v1** (2026-10-12). Změny kontraktu dělat v obou repech zároveň a zvýšit verzi (`v=1` v URL a `/v1/` v API).

## 1. Co dělá kdo

| Almost-there.eu (web, Next.js)                                                 | Vision Board (desktop)                                    |
| ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Účty, registrace, přihlášení                                                   | Neukládá hesla ani tokeny účtu                            |
| Kdo má licenci: každý registrovaný uživatel                                    | Ověří licenci offline podle veřejného klíče               |
| Pozvánka: osobní odkaz pro kohokoli, pozvaný se zaregistruje a dostane licenci | Pozvánky nezná. Pozvaný aktivuje stejně jako kdokoli jiný |
| Stránka aktivace `/visionboard/activate`                                       | Otevře ji v prohlížeči a čeká na návrat                   |
| API: vydání, obnova a deaktivace licence                                       | Volá API jen při aktivaci, obnově a deaktivaci            |
| Podepisuje licence soukromým klíčem Ed25519                                    | Má zabudovaný jen veřejný klíč                            |
| Stránka ke stažení (odkaz na instalátor z GitHub Releases)                     | Aktualizace si stahuje sám z GitHub Releases              |

## 2. Tok aktivace

1. Uživatel v aplikaci klikne **Aktivovat**. Aplikace vytvoří tajný `verifier` (32 náhodných bajtů, base64url) a `state` a otevře v prohlížeči:

   ```
   https://almost-there.eu/visionboard/activate?v=1&challenge=<C>&state=<S>&platform=windows
   ```

   - `challenge` = base64url(SHA-256(`verifier`)) bez `=`, 43 znaků.
   - `state` = 22 znaků base64url. Web ho jen vrátí zpět, nic s ním nedělá.
   - `platform` = `windows` | `macos` | `linux` (jen pro přehled zařízení).

2. Web vyžaduje přihlášení. Nepřihlášenému nabídne přihlášení i registraci a po nich se vrátí na stejnou URL se stejnými parametry.
3. Přihlášený uživatel **s licencí** vidí potvrzení „Aktivovat Vision Board na tomto počítači?“ a tlačítko **Aktivovat**. Uživatel **bez licence** vidí vysvětlení a odkaz, jak ji získat (aktivační kód se nevydá).
4. Po potvrzení server vytvoří **aktivační kód**:
   - 12 znaků z abecedy `ABCDEFGHJKMNPQRSTVWXYZ23456789`, zobrazit jako `ABCD-EFGH-JKMN`;
   - platí 10 minut, použít jde jednou;
   - uloží se k němu účet a `challenge` (stačí hash kódu, ne kód samotný).
5. Web přesměruje na

   ```
   visionboard://activate?code=ABCD-EFGH-JKMN&state=<S>
   ```

   a **zároveň na stránce ukáže kód** s textem „Pokud se aplikace neotevřela, opište tento kód do Vision Boardu (Nastavení → Licence → Mám kód).“ Doporučení: přesměrování spustit tlačítkem „Otevřít Vision Board“ i automaticky (`window.location`). Prohlížeč se může zeptat, jestli aplikaci otevřít.

6. Aplikace pošle `POST /api/visionboard/v1/licenses` (níže) a dostane licenci.

Kód je bez `verifier` bezcenný. Ten zná jen aplikace, která aktivaci zahájila (PKCE, RFC 7636).

## 3. API

Základ: `https://almost-there.eu/api/visionboard/v1`. Tělo i odpovědi JSON (`Content-Type: application/json`). Bez cookies a bez CORS (volá to desktopová aplikace, ne prohlížeč). Aplikace posílá `User-Agent: VisionBoard/<verze>`.

### 3.1 `POST /licenses`: výměna kódu za licenci

```json
{
  "code": "ABCDEFGHJKMN",
  "verifier": "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc",
  "installationId": "6f1c2a8e-4b7d-4e3a-9c55-2d8f0b1a7e44",
  "platform": "windows",
  "appVersion": "0.2.0"
}
```

- `code` přijde normalizovaný (velká písmena, bez pomlček a mezer). Server ho normalizuje taky.
- Server ověří: kód existuje, neprošel, nebyl použit; base64url(SHA-256(`verifier`)) == uložený `challenge`; účet má licenci; limit zařízení.
- Kód se zneplatní **i při neúspěšném ověření verifieru** (ochrana proti zkoušení).
- Stejné `installationId` u téhož účtu = znovuaktivace téhož zařízení, nezabírá další místo.

Odpověď `200`:

```json
{ "license": "<JWT>" }
```

### 3.2 `POST /licenses/renew`: obnova

```json
{ "license": "<současný JWT>" }
```

Server ověří podpis vlastním klíčem (licence může být i prošlá, max. 90 dní), že instalace není deaktivovaná a účet licenci pořád má. Vrátí `200 { "license": "<nový JWT>" }` se stejným `iid`, `sub` a novým `exp`.

Aplikace volá obnovu jen u licence s `exp`, nejdřív 14 dní před expirací, max. jednou denně.

### 3.3 `POST /licenses/deactivate`: uvolnění zařízení

```json
{ "license": "<JWT>" }
```

Server označí instalaci (`sub` + `iid`) za deaktivovanou. Odpověď `204` i tehdy, když už deaktivovaná byla. Aplikace licenci smaže lokálně vždy, toto volání je jen best-effort.

### 3.4 Chyby

Odpověď `4xx` s tělem `{ "error": "<kód>", "message": "<volitelný text pro log>" }`. Aplikace ukazuje vlastní lokalizované texty podle kódu:

| HTTP | `error`                  | Kdy                                                            |
| ---- | ------------------------ | -------------------------------------------------------------- |
| 400  | `invalid_request`        | chybí pole, špatný formát                                      |
| 400  | `invalid_code`           | kód neexistuje, už byl použit, nebo nesedí verifier            |
| 400  | `expired_code`           | kód je starší než 10 minut                                     |
| 403  | `no_license`             | účet licenci nemá                                              |
| 403  | `too_many_installations` | účet má plný počet zařízení                                    |
| 403  | `revoked`                | (renew) licence nebo instalace byla zrušena                    |
| 400  | `invalid_license`        | (renew, deactivate) podpis nebo formát nesedí                  |
| 429  | `rate_limited`           | moc pokusů. Doporučeno: 10 za minutu z jedné IP na `/licenses` |
| 5xx  | cokoli                   | aplikace ukáže „Zkuste to později“                             |

## 4. Licence (JWT)

Kompaktní JWT (RFC 7519), podpis **EdDSA s Ed25519** (RFC 8037). Jiný algoritmus aplikace odmítne.

Hlavička:

```json
{ "alg": "EdDSA", "typ": "JWT", "kid": "at-2026-1" }
```

Claims:

| Claim      | Typ      | Povinné | Hodnota                                                                                |
| ---------- | -------- | ------- | -------------------------------------------------------------------------------------- |
| `iss`      | string   | ano     | `https://almost-there.eu`                                                              |
| `aud`      | string   | ano     | `eu.almost-there.visionboard`                                                          |
| `sub`      | string   | ano     | id účtu (neprůhledné, ne e-mail)                                                       |
| `iid`      | string   | ano     | `installationId` z požadavku                                                           |
| `features` | string[] | ano     | `["premiumFrames","wallpaper","scheduledPopup"]`                                       |
| `label`    | string   | ano     | co aplikace ukáže jako účet, např. maskovaný e-mail `j***@example.com` (max. 80 znaků) |
| `src`      | string   | ano     | `account` (registrace) nebo `invite` (registrace přes pozvánku)                        |
| `jti`      | string   | ano     | id licence/instalace na serveru                                                        |
| `iat`      | number   | ano     | čas vydání (unix s)                                                                    |
| `exp`      | number   | ne      | expirace (unix s). Doporučeno `iat + 365 dní`, aplikace ji sama obnoví                 |

Celý token max. 4 KB. Nic dalšího do tokenu nedávat (je čitelný).

Podepsání v Next.js knihovnou [`jose`](https://github.com/panva/jose):

```ts
import { SignJWT, importPKCS8 } from "jose";

const key = await importPKCS8(process.env.VISIONBOARD_LICENSE_PRIVATE_KEY!, "EdDSA");
const license = await new SignJWT({ iid, features, label, src })
  .setProtectedHeader({ alg: "EdDSA", typ: "JWT", kid: process.env.VISIONBOARD_LICENSE_KID! })
  .setIssuer("https://almost-there.eu")
  .setAudience("eu.almost-there.visionboard")
  .setSubject(accountId)
  .setJti(installationRecordId)
  .setIssuedAt()
  .setExpirationTime("365d")
  .sign(key);
```

## 5. Klíče

1. Almost-there vygeneruje pár klíčů Ed25519 **jen na serveru nebo u správce**, např.:

   ```bash
   openssl genpkey -algorithm ed25519 -out visionboard-license.pem
   openssl pkey -in visionboard-license.pem -pubout -out visionboard-license.pub.pem
   ```

2. Soukromý klíč patří do proměnné prostředí serveru (`VISIONBOARD_LICENSE_PRIVATE_KEY`, PEM PKCS#8) a do zálohy ve správci hesel. **Nikdy do gitu.**
3. Do Vision Boardu se předá jen **veřejný klíč** (`visionboard-license.pub.pem`) a jeho `kid`. Vision Board ho zabuduje do `src-tauri/src/domain/license_keys.rs` a vydá aktualizaci.
4. **Dokud v aplikaci není produkční veřejný klíč, aplikace licence nevynucuje a vše je odemčené.** Napojení se tedy zapne až vydáním verze s klíčem, ve chvíli, kdy je web připravený.
5. Rotace: nový `kid` nejdřív přidat do aplikace (aktualizace), pak teprve podepisovat novým klíčem.

## 6. Pozvánky (jen na webu)

Rozhodnutí uživatelky 2026-10-12: licenci dostane každý registrovaný uživatel, takže omezený „dárek pro jednoho“ nemá smysl. Místo něj má každý uživatel **osobní pozvánku**, kterou může poslat komukoli a kolikrát chce. Cíl: přivést na Almost-there.eu nové registrované uživatele (a z nich možné platící). Aplikace o pozvánkách neví. Doporučený tok na webu:

1. Uživatel vidí v účtu „Pozvat k Vision Boardu“ se svým trvalým odkazem, např. `https://almost-there.eu/visionboard?ref=<kód>`, a tlačítky Kopírovat / Sdílet (Web Share API v PWA a mobilní aplikaci). Kód je náhodný a neprozrazuje id ani e-mail.
2. Stránka `/visionboard` je **veřejná landing page**: co Vision Board je, ukázky, „Zaregistrovat se a stáhnout zdarma“. Funguje i bez `ref`, takže jde sdílet i obecně.
3. Kdo se přes odkaz zaregistruje, dostane licenci jako každý registrovaný uživatel (`src: "invite"`) a u účtu se uloží, kdo ho pozval (pro statistiky a případné budoucí odměny). Neznámý nebo neplatný `ref` se tiše ignoruje a registraci nikdy neblokuje.
4. Po registraci stránka nabídne stažení aplikace (oddíl 7) a návod: nainstalovat, v aplikaci Nastavení → Licence → **Aktivovat**.
5. Volitelně: uživatel vidí v účtu, kolik lidí se přes jeho pozvánku zaregistrovalo.
6. Ochrana: rate limit registrací z jedné IP a běžná ochrana proti botům. Pozvánka sama nic neodemyká, licence se váže jen na účet.

## 7. Stažení a aktualizace

Vision Board se vydává přes GitHub Releases veřejného repa `daasadr/vision-board` (podrobně `docs/releasing.md`):

- Stálý odkaz na nejnovější vydání: `https://github.com/daasadr/vision-board/releases/latest`.
- Strojově čitelný popis nejnovější verze: `https://github.com/daasadr/vision-board/releases/latest/download/latest.json`. Odkaz na instalátor pro Windows je v `platforms["windows-x86_64"].url`, verze v `version`. Stránka ke stažení si ho může načíst (na serveru, s cache např. 1 h) a nabídnout přímý odkaz na instalátor.
- Nainstalovaná aplikace se aktualizuje sama z GitHub Releases. Změny na webu Almost-there.eu aktualizaci aplikace nevyžadují, pokud se nemění tento kontrakt.

## 8. Bezpečnostní požadavky na straně webu

- Aktivační kód: kryptograficky náhodný, uložit hash, 10 min, jednorázový, zneplatnit i po špatném verifieru, rate limit.
- Stránku aktivace chránit proti clickjackingu (`frame-ancestors 'none'`) a potvrzení dělat POSTem s CSRF ochranou (nevydávat kód jen otevřením URL).
- `challenge` validovat jako 43 znaků base64url, `state` max. 64 znaků base64url, jinak chyba (nevkládat do přesměrování nic neověřeného).
- Přesměrování jen na pevné `visionboard://activate`, nikdy na adresu z parametrů.
- Soukromý klíč jen v prostředí serveru, ne v klientském bundlu Next.js (žádné `NEXT_PUBLIC_`).
- Zařízení: doporučený limit 3 aktivní instalace na účet a stránka „Moje zařízení“ (platforma, datum aktivace, odebrat).

## 9. Testovací vektory

Pouze testovací klíč, nikdy pro produkci. Odvozený z 32bajtového seedu `visionboard-test-key-do-not-use!` (ASCII):

```js
// Node.js: testovací soukromý klíč ze seedu
const seed = Buffer.from("visionboard-test-key-do-not-use!");
const der = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]);
const testKey = crypto.createPrivateKey({ key: der, format: "der", type: "pkcs8" });
```

- `kid`: `test-1`
- veřejný klíč (raw, base64url): `HgpuyQVSnTH56tfOw1DSRtGsN3095zYe1lrY-cWBsWo`
- veřejný klíč (PEM):

  ```
  -----BEGIN PUBLIC KEY-----
  MCowBQYDK2VwAyEAHgpuyQVSnTH56tfOw1DSRtGsN3095zYe1lrY+cWBsWo=
  -----END PUBLIC KEY-----
  ```

- Licence pro `iid` `6f1c2a8e-4b7d-4e3a-9c55-2d8f0b1a7e44`, `iat` 1791763200, `exp` 1823299200:

  ```
  eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCIsImtpZCI6InRlc3QtMSJ9.eyJpc3MiOiJodHRwczovL2FsbW9zdC10aGVyZS5ldSIsImF1ZCI6ImV1LmFsbW9zdC10aGVyZS52aXNpb25ib2FyZCIsInN1YiI6ImFjY3RfMTIzIiwiaWlkIjoiNmYxYzJhOGUtNGI3ZC00ZTNhLTljNTUtMmQ4ZjBiMWE3ZTQ0IiwiZmVhdHVyZXMiOlsicHJlbWl1bUZyYW1lcyIsIndhbGxwYXBlciIsInNjaGVkdWxlZFBvcHVwIl0sImxhYmVsIjoiaioqKkBleGFtcGxlLmNvbSIsInNyYyI6ImFjY291bnQiLCJqdGkiOiJsaWNfNDU2IiwiaWF0IjoxNzkxNzYzMjAwLCJleHAiOjE4MjMyOTkyMDB9.Xf1bJVk-CFD4WTstRyhQL3Lrwx9bBbu_t3tb_E0MkQQ1rwcJ9WEqw8L0TSqsbJcIlyvE0QIFAjXPfbVDQeuJAQ
  ```

- PKCE: `verifier` `BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc` (32 bajtů hodnoty 7) → `challenge` `3Ev4DHdHPRMPoN6GukAY_pi7IUAF5qWJHRK6kURvnoE`.

Stejné vektory používají testy Vision Boardu (`cargo test`), takže shoda obou stran je ověřitelná.

## 10. Vývoj a integrační test

- Debug build Vision Boardu (`pnpm tauri dev`) bere adresu a vývojový klíč z proměnných prostředí:
  - `VISION_BOARD_API_URL=http://localhost:3000` (místo `https://almost-there.eu`, i pro stránku aktivace);
  - `VISION_BOARD_DEV_LICENSE_KEY=<raw base64url veřejný klíč>` s `kid` `dev`.
- Lokální Almost-there tedy může podepisovat testovacím klíčem z oddílu 9 (s `kid: "dev"`) nebo vlastním vývojovým.
- Release build tyto proměnné ignoruje.

## 11. Kontrolní seznam pro Almost-there

- [ ] Model: licence pro každý registrovaný účet, evidence instalací
- [ ] Stránka `/visionboard/activate` (přihlášení/registrace se zachováním parametrů, potvrzení, kód, přesměrování)
- [ ] `POST /api/visionboard/v1/licenses`, `/licenses/renew`, `/licenses/deactivate` s chybami z 3.4
- [ ] Podepisování EdDSA (`jose`), klíč v prostředí serveru, `kid`
- [ ] Testy proti vektorům z oddílu 9
- [ ] Pozvánky: osobní odkaz s `ref`, veřejná landing page `/visionboard`, kdo koho pozval
- [ ] Stránka ke stažení podle `latest.json`
- [ ] Předat veřejný klíč a `kid` do Vision Boardu
