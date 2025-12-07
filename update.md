# Update-Bericht

## Was wurde geändert?
- UI-Reihenfolge angepasst: Eingabefeld ➜ Stofftabelle ➜ einklappbare Detailansicht ➜ KI-Analyse ➜ zentrale Prompt-Sektion ➜ Debug/Log.
- Detailansicht standardmäßig eingeklappt mit farbigem Hinweis-Button; Kurzinfos (Name, CAS, Formel, CID, SMILES, Wikipedia) bleiben sichtbar, volle Karte wird weich animiert aufgeklappt.
- Tabellenbearbeitung verbessert: Inline-Änderungen bleiben fokussiert, berechnete Werte aktualisieren sich live.
- Manuell hinzugefügte Zeilen erhalten einen direkten PubChem-Button, der mit den eingegebenen Werten eine Abfrage auslöst und die Stoffdaten anreichert.
- Prompts gesammelt in eigenem Abschnitt, inklusive KI-Analyse-Prompt; Debug-Bereich hält LLM- und PubChem-Traces samt UI-Log bereit.

## Warum ist das wichtig?
- Die Nutzerführung folgt nun dem Arbeitsablauf und zeigt zuerst Eingabe und Tabelle, bevor Analysen oder Logs auftauchen.
- Die lange Detailkarte überlädt die Seite nicht mehr und bleibt dennoch leicht auffindbar.
- Tabellenwerte lassen sich flüssig bearbeiten, ohne nach jedem Zeichen erneut zu klicken.
- PubChem-Recherchen für manuelle Einträge sind direkt aus der Tabelle möglich, was die Datenqualität erhöht.

## Wie nutzen?
1. Reaktionstext eingeben und analysieren.
2. Stofftabelle bei Bedarf manuell ergänzen; per Lupen-Button PubChem-Abfrage für die Zeile starten.
3. Detailansicht über den orangenen Button aufklappen, um vollständige Stoffdaten zu sehen.
4. KI-Analyse starten und Prompts im separaten Abschnitt anpassen; Debug/Log bei Bedarf ausklappen.
