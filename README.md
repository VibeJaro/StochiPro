# Smart Stoichiometry

Ein schlanker Prototyp für die AI-gestützte Extraktion, Validierung und Berechnung chemischer Reaktionen.  
Die Anwendung besteht aus einer statischen UI mit einem einzigen Eingabefeld und einer Vercel-Serverless-Function (`/api/analyze`) für:

- LLM-basierte Extraktion der Chemikalien aus Freitext (GPT-5 oder kompatibles GPT-Modell)
- mehrstufige PubChem-Abfragen (inkl. Disambiguierung)
- Stöchiometrie-Berechnungen
- Aufbereitung und Anzeige relevanter Stoffdaten.

Externe API-Keys werden nicht im Browser benötigt.

---

## Use Case & Server-Workflow

Beispiel-Eingabe:

> `4 g Ethanol, 8 g Essigsäure, 14 h kochen, Produkt: Essigester`

Der komplette Ablauf läuft standardmäßig vollautomatisch über ein LLM (z. B. GPT-5) auf dem Server:

1. **Freitext verstehen**  
   Das LLM liest die Eingabe und extrahiert:
   - Edukte, Produkte, Lösungsmittel, Katalysatoren (Rollen),
   - Mengenangaben und Einheiten,
   - Namen (Deutsch/Englisch, trivial/IUPAC), CAS-Nummern oder SMILES.

2. **PubChem-Suchstrategie planen**  
   Das LLM entscheidet selbst, wie PubChem abgefragt werden soll (z. B. Suche nach CAS, Name, Summenformel, SMILES) und erstellt dafür strukturierte Suchanfragen.

3. **PubChem-Abfragen ausführen**  
   Die Serverless-Function ruft PubChem (PUG REST) mit diesen Suchanfragen auf.  
   Die Antworten werden wieder an das LLM gegeben, das:
   - die Treffer bewertet,
   - Mehrfachtreffer disambiguiert,
   - bei Bedarf Folgeabfragen formuliert (z. B. enger gefilterte Suche).

4. **Automatische Zuordnung & Stoffdaten-Lookup**  
   Wenn das LLM für eine Substanz eine eindeutige Zuordnung findet, verknüpft es:
   - Molmasse,
   - Dichte,
   - Siedepunkt, Schmelzpunkt,
   - Summenformel und ggf. weitere Stoffdaten  
   mit der jeweiligen Komponente in der Reaktion.

5. **Stöchiometrie berechnen**  
   Auf Basis der gefundenen Stoffdaten erzeugt der Server:
   - eine Stöchiometrie-Tabelle (m, n, V, Äquivalente, Rolle),
   - identifiziert den limiting reagent,
   - berechnet eine einfache theoretische Ausbeute für das Produkt.

6. **Transparente Ergebnis-Darstellung**  
   Das LLM fasst alle Schritte und Entscheidungen so zusammen, dass sie im UI als:
   - Stöchiometrie-Tabelle,
   - Stoffdaten-Panel je Substanz,
   - Schritt-für-Schritt-Log (Was wurde wie erkannt? Welche PubChem-Treffer wurden verworfen?)  
   angezeigt werden.

7. **Fallback: User greift nur bei Problemen ein**  
   Nur wenn das LLM trotz mehrerer Versuche keine robuste Zuordnung hinbekommt (z. B. widersprüchliche Treffer oder unklare Namen), wird:
   - die entsprechende Zeile im UI als „unklar / bitte prüfen“ markiert,
   - der User gebeten, den richtigen Eintrag auszuwählen oder Stoffdaten manuell nachzutragen.  
   Im Normalfall läuft die ganze Kette von Freitext bis Stöchiometrie ohne manuelle Eingriffe.

---

## Features

- **Ein einziges Eingabefeld**  
  Für Freitext in Deutsch oder Englisch, Trivialnamen, IUPAC-Namen, CAS-Nummern oder SMILES.

- **Vollautomatischer LLM-Agenten-Workflow**  
  Das LLM übernimmt:
  - Extraktion und Normalisierung der Chemikalien und Mengen,
  - Planung der PubChem-Suchabfragen,
  - Bewertung und Disambiguierung der Suchergebnisse,
  - Befüllung der Stöchiometrie-Tabelle.  
  Der User muss nur eingreifen, wenn das System eine Substanz explizit als „unklar“ kennzeichnet.

- **Mehrstufige PubChem-Integration**  
  - Automatische Abfragen gegen PubChem (PUG REST) auf Basis der LLM-Entscheidungen.  
  - Iterative Verbesserung der Suche bei Mehrdeutigkeiten.  
  - Lokaler Fallback-Datensatz, falls PubChem nicht verfügbar ist.

- **Stöchiometrie-Modul**  
  - Automatische Berechnung von Stoffmengen, Äquivalenten und limiting reagent.  
  - Berechnung einer einfachen theoretischen Ausbeute.  
  - Ausgabe als übersichtliche Tabelle mit allen relevanten Größen.

- **Stoffdaten-Panel**  
  - Automatische Anzeige wichtiger Daten je Substanz (z. B. Molmasse, Summenformel, Dichte, Siedepunkt, Schmelzpunkt).  
  - Datenbasis ist PubChem oder, falls nötig, der lokale Fallback.

- **Transparente Prozessdarstellung**  
  - UI zeigt, welche Schritte das LLM durchlaufen hat (Extraktion, Suche, Auswahl, eventuelle Konflikte).  
  - Klare Hinweise, an welchen Stellen der User eingreifen muss – und wo alles vollautomatisch geklappt hat.

- **Sichere Architektur**  
  - Keine API-Keys im Browser.  
  - Sämtliche LLM- und PubChem-Abfragen laufen serverseitig in einer Vercel-Serverless-Function.



---

## Projektstruktur

```text
├─ api/                # Vercel-Serverless-Function (POST /api/analyze)
├─ lib/                # Kernlogik: LLM-Workflow, PubChem-Client/Mock, Stoichiometrie
├─ tests/              # Unit-Tests mit minimalem Node-Test-Harness
├─ index.html          # Statische UI mit einem Textfeld
├─ app.js / styles.css # UI-Logik und Gestaltung
├─ server.js           # Lokaler Dev-Server (Fallback für einfache Deployments)
└─ package.json
