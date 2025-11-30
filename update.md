# Update-Bericht

## Was wurde geändert?
- **LLM- & Log-Bereich als Ausklappmenü:** Prompts und Logs wandern in einen eigenen, ausklappbaren Abschnitt. Dort stehen jetzt auch komplette Prompts/Antworten sowie alle PubChem-Requests mit ihren Antworten, um Debugging zu erleichtern.
- **Detailierter PubChem-Trace:** Jeder PubChem-Versuch protokolliert URLs, Rohantworten und Fehler. So lassen sich Suchstrategien und Treffer nachvollziehen.
- **Explizite Zeilenauswahl:** Die Stofftabelle hat ein eigenes Auswahlfeld je Zeile. Eine Zeile kann jetzt gezielt angeklickt werden, ohne sofort in ein Eingabefeld zu geraten.
- **Beschreibung sichtbar:** Geladene Stoffbeschreibungen werden in der Detailansicht zuverlässig angezeigt; fehlt eine Beschreibung, gibt es einen klaren Hinweis.
- **Prompts neu formuliert:** Das KI-Modell kennt jetzt nur noch die Rollen Edukt, Produkt, Lösemittel, Additiv und Katalysator und soll keine Werte erfinden. So landen z. B. keine CAS-Nummern mehr im Ergebnis, wenn sie nicht im Text vorkommen.
- **Mehr Kontext beim zweiten Versuch:** Wenn PubChem eine Substanz nicht findet, bekommt die KI den fehlgeschlagenen Versuch (inklusive der getesteten Namen) als Zusatzinfo. Dadurch schlägt sie nur noch alternative Namen für die wirklich fehlenden Stoffe vor.
- **Erweiterte PubChem-Daten:** Die Abfrage holt jetzt neben Name, Formel und Molmasse auch physikalische Eigenschaften wie Dichte, Schmelz- oder Siedepunkt. Fallback-Daten enthalten ebenfalls Dichte-Infos.
- **SI-Einheiten bevorzugt:** Physikalische Kenndaten aus PubChem werden auf °C normalisiert, damit überall SI-Werte erscheinen.
- **Mehr Kontext pro Stoff:** Aus PubChem wird zusätzlich die verbale Stoffbeschreibung geladen und in der Detailansicht angezeigt.
- **Dichte für Berechnungen:** Wenn im Text nur Volumina (z. B. in ml) stehen, wird die Dichte genutzt, um Masse und Stoffmenge automatisch zu berechnen.
- **Übersichtlichere Detailansicht:** In der Detailansicht werden physikalische Eigenschaften separat angezeigt, damit klar ist, welche Zusatzinfos aus PubChem stammen.
- **Bearbeitbare Tabelle:** Stoffzeilen lassen sich direkt in der Tabelle ändern oder komplett neu hinzufügen. Änderungen an PubChem-Daten werden markiert, damit klar ist, dass die Quelle nachträglich überschrieben wurde.
- **Tests gepflegt:** Automatische Tests wurden angepasst und durchlaufen, damit die neuen Abläufe stabil bleiben.

## Warum ist das wichtig?
- Debugging ist einfacher, weil sämtliche LLM- und PubChem-Aufrufe transparent dokumentiert sind.
- Nutzerinnen können Zeilen auswählen, ohne versehentlich in die Bearbeitung zu springen.
- Fehlende Beschreibungen sind sofort erkennbar, vorhandene Beschreibungen werden prominent gezeigt.

## Wie nutzen?
1. Reaktionstext eingeben wie bisher.
2. Falls PubChem einen Stoff nicht sofort findet, versucht die KI automatisch mit mehr Kontext eine alternative Schreibweise.
3. In der Detailansicht erscheinen jetzt auch Beschreibungen und physikalische Werte; Volumenangaben werden mit Dichte zu Masse/Stoffmenge umgerechnet.
4. Den Bereich "LLM & Log" nur bei Bedarf ausklappen, um Prompts anzupassen oder komplette LLM-/PubChem-Traces einzusehen.
