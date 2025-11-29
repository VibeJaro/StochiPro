# Update-Bericht

## Was wurde geändert?
- **Einheiten vereinheitlicht:** Physikalische Werte (z. B. Schmelz- oder Siedepunkte) werden nach Möglichkeit in °C angezeigt, damit alles in vertrauten SI-Einheiten bleibt.
- **Mehr Kontext aus PubChem:** Zu jedem Treffer wird jetzt eine Kurzbeschreibung mitgeladen und in der Detailansicht gezeigt.
- **Tabelle editierbar:** Mengen, Namen oder Formeln lassen sich direkt in der Tabelle anpassen. Überschriebene PubChem-Werte werden als „manuell“ markiert, damit klar bleibt, woher die Zahlen stammen.
- **Manuelle Einträge möglich:** Über eine Schaltfläche können komplett neue Zeilen hinzugefügt werden, falls eine Substanz in keiner Datenbank auftaucht.
- **Prompts neu formuliert:** Das KI-Modell kennt jetzt nur noch die Rollen Edukt, Produkt, Lösemittel, Additiv und Katalysator und soll keine Werte erfinden. So landen z. B. keine CAS-Nummern mehr im Ergebnis, wenn sie nicht im Text vorkommen.
- **Mehr Kontext beim zweiten Versuch:** Wenn PubChem eine Substanz nicht findet, bekommt die KI den fehlgeschlagenen Versuch (inklusive der getesteten Namen) als Zusatzinfo. Dadurch schlägt sie nur noch alternative Schreibweisen für die wirklich fehlenden Stoffe vor.
- **Erweiterte PubChem-Daten:** Die Abfrage holt jetzt neben Name, Formel und Molmasse auch physikalische Eigenschaften wie Dichte, Schmelz- oder Siedepunkt. Fallback-Daten enthalten ebenfalls Dichte-Infos.
- **Dichte für Berechnungen:** Wenn im Text nur Volumina (z. B. in ml) stehen, wird die Dichte genutzt, um Masse und Stoffmenge automatisch zu berechnen.
- **Übersichtlichere Detailansicht:** In der Detailansicht werden physikalische Eigenschaften separat angezeigt, damit klar ist, welche Zusatzinfos aus PubChem stammen.
- **Tests gepflegt:** Automatische Tests wurden angepasst und durchlaufen, damit die neuen Abläufe stabil bleiben.

## Warum ist das wichtig?
- Alle physikalischen Angaben erscheinen einheitlich, wodurch weniger Umrechnung nötig ist.
- Die Beschreibungstexte aus PubChem helfen, Stoffe schneller einzuordnen.
- Manuell bearbeitete Zeilen bleiben nachvollziehbar, weil Änderungen und Quellen klar erkennbar sind.
- Zusätzliche Stoffe können ohne Wartezeit auf Datenbanken ergänzt werden.
- Weniger Fehlzuordnungen, weil die KI nur noch Rollen und Daten verwendet, die ausdrücklich genannt sind.
- Bessere Trefferquote bei fehlenden PubChem-Ergebnissen dank Kontext zum ersten, gescheiterten Versuch.
- Mehr chemische Detaildaten im Tool, die direkt für Berechnungen (z. B. über die Dichte) genutzt werden.
- Klare Darstellung im Frontend, damit Ergebnisse nachvollziehbar bleiben.

## Wie nutzen?
1. Reaktionstext eingeben wie bisher.
2. Falls PubChem einen Stoff nicht sofort findet, versucht die KI automatisch mit mehr Kontext eine alternative Schreibweise.
3. In der Detailansicht erscheinen jetzt auch physikalische Werte und Beschreibungstexte; Volumenangaben werden mit Dichte zu Masse/Stoffmenge umgerechnet.
4. Mengen oder Namen können direkt in der Tabelle geändert werden; bei Änderungen wechselt die Quelle sichtbar auf „manuell“.
5. Über „Zeile hinzufügen“ lassen sich fehlende Substanzen ergänzen und sofort mitrechnen.
