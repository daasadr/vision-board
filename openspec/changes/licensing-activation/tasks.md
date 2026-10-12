# Tasks

## 1. Kontrakt a licence

- [x] 1.1 API kontrakt `docs/almost-there-api.md` (stránka aktivace, 3 endpointy, formát JWT, chyby, testovací vektory) a ověřit `openspec validate licensing-activation --strict`
- [x] 1.2 `domain::license` (parsování a ověření JWT EdDSA, claims, `iid`, `exp`) a `license_keys` (prázdný produkční seznam = nevynucovat) a ověřit `cargo test` (podpis, cizí `alg`, `none`, cizí `kid`, upravený payload, jiné `iid`, expirace)
- [x] 1.3 `domain::activation` (PKCE, `state`, čekající aktivace v `app_state` 15 min, normalizace kódu) a ověřit `cargo test`

## 2. Aktivace v aplikaci

- [ ] 2.1 HTTP klient (aktivace, obnova, deaktivace, mapování chyb) a ověřit `cargo test` proti lokálnímu testovacímu serveru
- [ ] 2.2 Deep link `visionboard://activate` (plugin, single-instance, kontrola `state`) a ověřit ručně v release buildu
- [ ] 2.3 `Entitlements` podle licence, `license://changed`, zamčení tapety a pop-upu po ztrátě licence a ověřit `cargo test` + E2E
- [ ] 2.4 Sekce „Licence“ v nastavení (stav, Aktivovat, Mám kód, Deaktivovat, zámky u funkcí) cs/en/de a ověřit E2E s mockem IPC
- [ ] 2.5 Obnova licence (14 dní, 1× denně, start a nastavení) a ověřit `cargo test`

## 3. Dokončení

- [ ] 3.1 Review ověřování licence a aktivačního toku a zapracovat nálezy
- [ ] 3.2 Integrační test s lokálním serverem Almost-there (debug build, vývojový klíč) a ověřit celý tok ručně
- [ ] 3.3 Produkční veřejný klíč od Almost-there do `license_keys`, dokumentace (`docs/user/licence.md`, `docs/architecture.md`)
