# Update-Bericht

## Was wurde geändert?
- **Prompts neu formuliert:** Das KI-Modell kennt jetzt nur noch die Rollen Edukt, Produkt, Lösemittel, Additiv und Katalysator und soll keine Werte erfinden. So landen z. B. keine CAS-Nummern mehr im Ergebnis, wenn sie nicht im Text vorkommen.
- **Mehr Kontext beim zweiten Versuch:** Wenn PubChem eine Substanz nicht findet, bekommt die KI den fehlgeschlagenen Versuch (inklusive der getesteten Namen) als Zusatzinfo. Dadurch schlägt sie nur noch alternative Namen für die wirklich fehlenden Stoffe vor.
- **Erweiterte PubChem-Daten:** Die Abfrage holt jetzt neben Name, Formel und Molmasse auch physikalische Eigenschaften wie Dichte, Schmelz- oder Siedepunkt. Fallback-Daten enthalten ebenfalls Dichte-Infos.
- **Dichte für Berechnungen:** Wenn im Text nur Volumina (z. B. in ml) stehen, wird die Dichte genutzt, um Masse und Stoffmenge automatisch zu berechnen.
- **Übersichtlichere Detailansicht:** In der Detailansicht werden physikalische Eigenschaften separat angezeigt, damit klar ist, welche Zusatzinfos aus PubChem stammen.
- **Tests gepflegt:** Automatische Tests wurden angepasst und durchlaufen, damit die neuen Abläufe stabil bleiben.

## Warum ist das wichtig?
- Weniger Fehlzuordnungen, weil die KI nur noch Rollen und Daten verwendet, die ausdrücklich genannt sind.
- Bessere Trefferquote bei fehlenden PubChem-Ergebnissen dank Kontext zum ersten, gescheiterten Versuch.
- Mehr chemische Detaildaten im Tool, die direkt für Berechnungen (z. B. über die Dichte) genutzt werden.
- Klare Darstellung im Frontend, damit Ergebnisse nachvollziehbar bleiben.

## Wie nutzen?
1. Reaktionstext eingeben wie bisher.
2. Falls PubChem einen Stoff nicht sofort findet, versucht die KI automatisch mit mehr Kontext eine alternative Schreibweise.
3. In der Detailansicht erscheinen jetzt auch physikalische Werte; Volumenangaben werden mit Dichte zu Masse/Stoffmenge umgerechnet.
