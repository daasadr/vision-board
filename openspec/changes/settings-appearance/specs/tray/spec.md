# Spec Delta

## MODIFIED Requirements

### Requirement: Klidová zátěž bez okna
Bez otevřeného okna MUST aplikace spotřebovávat méně než 40 MB paměti a MUST NOT provádět žádnou periodickou činnost, kterou nevyžaduje zapnutá funkce. Ovládací prvek na ploše se za otevřené okno nepočítá: se skrytým prvkem MUST NOT běžet žádný proces webview, se zobrazeným prvkem platí jeho vlastní limit (nejvýše +30 MB, spec control-widget).

#### Scenario: Aplikace jen v tray
- **WHEN** hlavní okno je zavřené 60 sekund a ovládací prvek je skrytý
- **THEN** paměť procesu aplikace je pod 40 MB a nejsou spuštěné procesy webview

#### Scenario: Tray s ovládacím prvkem
- **WHEN** hlavní okno je zavřené 60 sekund a ovládací prvek je zobrazený
- **THEN** paměť aplikace včetně procesů webview přesahuje stav „jen v tray“ nejvýše o 30 MB a procesor je v klidu
