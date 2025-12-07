# Update-Bericht

## Was wurde geändert?
- **UI-Reihenfolge neu sortiert:** Eingabefeld ➜ Tabelle ➜ einklappbare Detailansicht ➜ KI-Analyse ➜ gebündelte Prompt-Sektion ➜ Debug/Log.
- **Detailansicht standardmäßig zu:** Farbig hervorgehobener Toggle mit animiertem Ausklappen, kompakter Vorschau (Name, CAS, Formel, CID, SMILES, Wikipedia) auch im eingeklappten Zustand.
- **Prompt-Sektion gebündelt:** Alle LLM-Prompts (Extraktion, Retry, KI-Analyse) liegen nun in einem eigenen Block unterhalb der Analyse.
- **Tabellen-Editing repariert:** Inline-Eingaben verlieren den Cursor nicht mehr; berechnete Werte werden live und ohne Fokusverlust aktualisiert.
- **PubChem-Shortcut für manuelle Zeilen:** Jede manuell gepflegte Zeile bietet einen PubChem-Button, der mit Name/CAS/Formel/SMILES einen Lookup auslöst und die Daten in Tabelle, Detail und Debug-Trace übernimmt.
- **Detail-Animation & Stil:** Neue Collapsible-Stile sorgen für weiches Ausklappen und bleiben auch nach Auswahlwechsel stabil.
- **Neue KI-Analyse-Kachel:** Zwischen Stoffliste und Detailansicht gibt es jetzt eine GPT-5.1-gestützte Einschätzung (Kurzfassung, Sicherheitsrisiken, Optimierung, Analytik). Sie startet nur per Button, zeigt den vollständigen Prompt an und nutzt alle Detaildaten als Kontext.
- **KI-Analyse nutzt den Originaltext:** Der Reaktionstext (Ziel, Bedingungen, Setup) wird zusammen mit den Detaildaten an das LLM übergeben, damit Sicherheits- und Optimierungshinweise den vollständigen Experimentkontext berücksichtigen.
- **Lesbare KI-Ausgabe:** Die KI-Antwort wird nur noch einmal angezeigt und mit Markdown gerendert (Überschriften, Listen), damit Sicherheitshinweise und Vorschläge besser erfassbar sind.
- **Mehrstufige Markdown-Aufzählungen:** Die KI-Ausgabe unterstützt jetzt verschachtelte Listen und größere Überschriften, sodass Struktur und Hierarchie der Hinweise klarer erkennbar sind.
- **Neue Detailkarten mit allen PubChem-Punkten:** Die Detailansicht zeigt jetzt SMILES, Wikipedia-Link, XLogP3/LogP, pKa, Kovats-Index sowie alle GHS-, Verwendungs- und Umweltangaben in klar getrennten Karten (Struktur, Physik, Verwendung, Sicherheit, Umwelt).
- **PubChem-Parser erweitert:** Die PUG-View-Auswertung extrahiert jetzt sämtliche in `data_extraction.md` genannten Felder (u. a. Solubility, Vapor Pressure, Piktogramme, P- und H-Sätze, Hazard Classes, Environmental Fate) und übergibt sie an die UI.
- **Fallback für 3-Ethylphenol:** Ein lokaler Datensatz mit allen extrahierten PubChem-Werten stellt sicher, dass Tests und Demoansichten (Screenshot) ohne Netzwerkkonnektivität funktionieren.
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
- Die KI-Bewertung liefert eine kompakte Sicherheits- und Optimierungs-Sicht auf Basis der Detaildaten, ohne die Ladezeit der Stoffliste zu blockieren.
- Debugging ist einfacher, weil sämtliche LLM- und PubChem-Aufrufe transparent dokumentiert sind.
- Nutzerinnen können Zeilen auswählen, ohne versehentlich in die Bearbeitung zu springen.
- Fehlende Beschreibungen sind sofort erkennbar, vorhandene Beschreibungen werden prominent gezeigt.
- Alle relevanten Sicherheits-, Umwelt- und Verwendungsangaben aus PubChem sind jetzt sichtbar, wodurch der Agent fachlich vollständiger wird.

## Wie nutzen?
1. Reaktionstext eingeben wie bisher.
2. Falls PubChem einen Stoff nicht sofort findet, versucht die KI automatisch mit mehr Kontext eine alternative Schreibweise.
3. In der Detailansicht erscheinen jetzt Beschreibungen, physikalische Werte, LogP/pKa/Kovats-Index, GHS-Piktogramme, H-/P-Sätze sowie Umwelt- und Use-&-Manufacturing-Informationen; Volumenangaben werden mit Dichte zu Masse/Stoffmenge umgerechnet.
4. Den Bereich "LLM & Log" nur bei Bedarf ausklappen, um Prompts anzupassen oder komplette LLM-/PubChem-Traces einzusehen.
