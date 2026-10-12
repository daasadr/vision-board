# Design

## Context

Vrstva `Entitlements` (fáze 1) zatím vše odemyká. Almost-there.eu je Next.js aplikace (PWA a webview mobilní aplikace) na vlastním serveru uživatelky. Její část (účty, registrace, dárky, vydávání licencí) dělá Claude Code v repu Almost-there podle `docs/almost-there-api.md`. Tento dokument popisuje stranu Vision Boardu a dělbu práce.

Model licencí (uživatelka, 2026-10-12):
- Každý registrovaný uživatel Almost-there.eu má licenci ke svému účtu.
- Každý může jednou darovat Vision Board jednomu člověku odkazem. Obdarovaný si vytvoří účet a licence se připíše jeho účtu.
- Aplikace rozdíl mezi vlastní a darovanou licencí nepotřebuje, jen ho ukáže (`src`).

## Goals / Non-Goals

**Goals:**
- Aktivace na pár kliknutí: tlačítko v aplikaci → přihlášení na webu → zpět v aplikaci a odemčeno.
- Offline po aktivaci, bez tokenů účtu v aplikaci, licence nepřenosná na jiný počítač.
- Strana Almost-there má co nejmenší a jasně popsané API (3 endpointy a 1 stránka).
- Aplikace půjde vydat dřív, než bude API hotové: bez produkčního klíče zůstane vše odemčené.

**Non-Goals:**
- Gift mechanika, evidence zařízení a e-maily (strana Almost-there).
- OAuth server s refresh tokeny, OpenID Connect, platby.

## Decisions

### Tok aktivace (authorization code + PKCE, návrat deep linkem)

```
Vision Board                      prohlížeč / almost-there.eu                    API almost-there.eu
1. verifier (32 B), state (16 B),
   challenge = b64url(SHA-256(verifier))
   uloží "čekající aktivaci" (15 min)
2. otevře  ─────────────────────▶ /visionboard/activate?v=1&challenge=…&state=…&platform=windows
                                  3. přihlášení / registrace, „Aktivovat Vision Board na tomto počítači?“
                                  4. server vytvoří jednorázový kód (10 min, vázaný na účet a challenge)
   ◀──────────────────────────── 5. přesměruje na visionboard://activate?code=…&state=…
                                     a stránka kód zároveň ukáže k opsání (záloha)
6. ověří state, POST ──────────────────────────────────────────────────────▶ /api/visionboard/v1/licenses
   {code, verifier, installationId, platform, appVersion}                     ověří kód, SHA-256(verifier) == challenge,
   ◀───────────────────────────────────────────────────────────────────────── vydá licenci {license: JWT}
7. ověří JWT, uloží, odemkne
```

- **Proč PKCE:** kód, který prohlížeč předá aplikaci (nebo který uživatel opíše), je bez `verifier` bezcenný. Jiná aplikace, která by si schéma `visionboard://` zaregistrovala, ani někdo, kdo kód odkouká, licenci nezíská.
- **Proč ne plný OAuth s tokeny:** aplikace po aktivaci s účtem nekomunikuje. Obnova a deaktivace se prokazují licencí samotnou, takže v aplikaci nejsou žádné tokeny účtu a není potřeba `keyring`.
- **Ruční kód:** 12 znaků z abecedy `ABCDEFGHJKMNPQRSTVWXYZ23456789` ve skupinách po 4 (`ABCD-EFGH-JKMN`). Aplikace převede na velká písmena a odstraní mezery a pomlčky. Bez čekající aktivace se kód neodešle.
- **Čekající aktivace** se ukládá do `app_state` (ne do paměti), protože deep link může aplikaci spustit znovu. Platí 15 minut, po úspěchu nebo nové aktivaci se smaže.

### Licence (JWT, EdDSA / Ed25519)

Hlavička `{"alg":"EdDSA","typ":"JWT","kid":"<id klíče>"}`. Claims:

| Claim | Význam | Kontrola v aplikaci |
| --- | --- | --- |
| `iss` | `https://almost-there.eu` | musí se shodovat |
| `aud` | `eu.almost-there.visionboard` | musí se shodovat |
| `sub` | id účtu (neprůhledné) | jen uložit |
| `iid` | id instalace z požadavku | musí se shodovat s instalací |
| `features` | `["premiumFrames","wallpaper","scheduledPopup"]` | neznámé se ignorují |
| `label` | zobrazitelný účet, např. maskovaný e-mail | jen zobrazit (max. 80 zn.) |
| `src` | `account` nebo `gift` | jen zobrazit |
| `jti` | id licence | jen uložit |
| `iat` | vydáno (s) | nesmí být víc než 1 den v budoucnosti |
| `exp` | volitelná expirace (s) | `now < exp` |

- **Ověření ručně, bez JWT knihovny:** rozdělit na 3 části, `alg` musí být `EdDSA` (nic jiného, ani `none`), klíč podle `kid` z vestavěného seznamu, `ed25519-dalek::verify_strict` nad `header.payload`, pak claims. Max. délka tokenu 4 KB. JWT knihovny (`jsonwebtoken`) táhnou `ring` a řadu algoritmů, které nechceme.
- **Klíče:** `domain/license_keys.rs`, seznam `(kid, 32 B veřejný klíč)`. Soukromý klíč má jen server Almost-there. Rotace = přidat nový `kid` do aplikace, vydat aktualizaci, pak teprve podepisovat novým klíčem.
- **Vynucení až s produkčním klíčem:** dokud je seznam produkčních klíčů prázdný, `Entitlements` vrací vše odemčené (jako dosud). Aplikaci tak lze vydávat a aktualizovat, i když API Almost-there ještě není hotové, a nikomu se nic nezamkne.
- **Debug buildy** přijmou navíc vývojový klíč a adresu z proměnných `VISION_BOARD_API_URL` a `VISION_BOARD_DEV_LICENSE_KEY`, aby šlo testovat proti lokálnímu serveru Almost-there. Release build je ignoruje.
- **Id instalace:** UUID v `app_state`, vznikne při první aktivaci. Licence zkopírovaná na jiný počítač neprojde (`iid`).
- **Uložení:** token v `app_state` (`AppValue::License`). Při startu se ověří znovu, neplatný se ignoruje (nemaže, kvůli diagnostice).

### Obnova a deaktivace
- **Obnova** jen u licence s `exp`: od 14 dní před expirací, max. jednou denně (čas pokusu v `app_state`), při startu a při otevření nastavení. `POST /api/visionboard/v1/licenses/renew {license}` vrátí novou licenci. Chyba nebo offline nic nezamyká. Odpověď `revoked` jen zastaví další pokusy.
- **Deaktivace:** licence se smaže lokálně vždy, `POST /api/visionboard/v1/licenses/deactivate {license}` je best-effort (uvolní místo pro zařízení na webu).
- Server doporučeně omezí počet aktivních instalací na účet (návrh 3) a dovolí je na webu spravovat. Při překročení vrátí `too_many_installations`.

### Napojení na Entitlements
- `domain::entitlements::is_enabled(feature, license: Option<&License>)`. Stav licence drží `license::LicenseState` (načtený při startu).
- Změna licence: emit `license://changed`, frontend smaže cache oprávnění (`src/lib/entitlements.ts` se přestane spoléhat na „pevné po dobu sezení“) a backend přepočítá plánovač, tapetu a prvek přes `preferences::apply`. Zamčená tapeta se vypne a obnoví původní, zamčený pop-up se neplánuje, prémiový rámeček se vykreslí jako výchozí (nastavení zůstane, po aktivaci se vrátí).
- Nastavení ukáže u zamčených funkcí zámek s odkazem do sekce Licence.

### Síť
- HTTP klient `reqwest` s rustls (už ve stromu přes `tauri-plugin-updater`, změna `auto-update`). Jen HTTPS, timeout 15 s, žádné cookies, hlavička `User-Agent: VisionBoard/<verze>`.
- Požadavky jen při aktivaci, deaktivaci a obnově. Žádná telemetrie. Tělo obsahuje jen kód, verifier, id instalace, platformu a verzi aplikace.
- Certificate pinning ne: server je za běžným TLS a pinning by při výměně certifikátu aplikaci zablokoval. Bezpečnost stojí na podpisu licence, ne na kanálu.

### Deep link
- `tauri-plugin-deep-link` (připnutá verze kompatibilní s Tauri 2.11) registruje schéma `visionboard` při instalaci (NSIS, HKCU). Běžící instanci odkaz předá `tauri-plugin-single-instance`.
- Přijímá se jen `visionboard://activate` s parametry `code` a `state` (ostatní se ignorují). Jiné cesty se jen otevřou jako okno nástěnky.

### Nastavení „Licence“
Nová sekce: stav (neaktivováno / aktivováno pro `label`, vlastní nebo dárek, platnost), tlačítko **Aktivovat**, pole **Mám kód** (viditelné po zahájení aktivace), **Deaktivovat na tomto počítači** a odkaz na Almost-there.eu. Všechny texty cs/en/de.

## Risks / Trade-offs

- [Prohlížeč neotevře `visionboard://`] → stránka ukáže kód k opsání.
- [Uživatel změní systémový čas] → může prodloužit licenci s `exp`. Přijato, jde o dárek, ne o DRM.
- [Únik soukromého klíče serveru] → rotace `kid` přes aktualizaci aplikace (`auto-update`).
- [API Almost-there není hotové] → bez produkčního klíče je vše odemčené, vydávání aplikace se nezdrží.

## Dopad závislostí

- `ed25519-dalek` (bez `rand`, jen verify) + `sha2`: ~100 KB v binárce, paměť zanedbatelná. `curve25519-dalek` je čistý Rust.
- `tauri-plugin-deep-link`: registrace schématu, malý (na Windows registr).
- `reqwest`: už ve stromu přes updater, žádný nový kód.
