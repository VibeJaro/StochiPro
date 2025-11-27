# Smart Stoichiometry

Ein schlanker Prototyp für die AI-gestützte Extraktion, Validierung und Berechnung chemischer Reaktionen. Die Anwendung besteht aus einer statischen UI mit einem einzigen Eingabefeld und einer Vercel-Serverless-Function (`/api/analyze`).

## Features
- **Ein einziges Eingabefeld:** Freitext in Deutsch oder Englisch, Trivialnamen, IUPAC-Namen, CAS-Nummern oder SMILES.
- **Vollautomatischer LLM-Agenten-Workflow:** Extraktion und Normalisierung der Chemikalien und Mengen, Planung der PubChem-Suchabfragen, Bewertung und Disambiguierung der Suchergebnisse, Befüllung der Stöchiometrie-Tabelle.
- **Mehrstufige PubChem-Integration:** Automatische Abfragen gegen PubChem (PUG REST) auf Basis der LLM-Entscheidungen inkl. Hyphen-Fallback (z. B. 4-Ethylphenol ➜ 4 ethylphenol).
- **Stöchiometrie-Modul:** Automatische Berechnung von Stoffmengen, Äquivalenten und limiting reagent.
- **Stoffdaten-Panel:** Automatische Anzeige wichtiger Daten je Substanz (z. B. Molmasse, Summenformel) auf Basis der PubChem-Daten.
- **Transparente Prozessdarstellung:** UI-Log für die wichtigsten Schritte.
- **Sichere Architektur:** Keine API-Keys im Browser. Sämtliche LLM- und PubChem-Abfragen laufen serverseitig in einer Vercel-Serverless-Function. Ohne `OPENAI_API_KEY` wird heuristisch geparst.

## Projektstruktur
```
├─ api/                # Vercel-Serverless-Function (POST /api/analyze)
├─ lib/                # Kernlogik: LLM-Workflow, PubChem-Client/Mock, Stoichiometrie
├─ tests/              # Unit-Tests mit Node Test Runner
├─ index.html          # Statische UI mit einem Textfeld
├─ app.js / styles.css # UI-Logik und Gestaltung
├─ server.js           # Lokaler Dev-Server (Fallback für einfache Deployments)
└─ package.json
```

## Entwicklung
```bash
npm install
npm run dev   # lokaler Server unter http://localhost:3000
npm test      # Unit-Tests (PubChem-Mock + Stöchiometrie)
```

## Deployment auf Vercel
- Projekt importieren, als Framework "Other" wählen.
- `OPENAI_API_KEY` als Umgebungsvariable hinterlegen (Optional, heuristische Fallbacks funktionieren auch ohne Key).
- Build-Step: kein Build nötig, statische Dateien werden direkt ausgeliefert, API liegt in `/api/analyze`.

## API
`POST /api/analyze` mit `{ "input": "4 g Ethanol, 8 g Essigsäure, Produkt: Ethylacetat" }`.
Antwort enthält die angereicherten Komponenten inkl. PubChem-Daten und Stöchiometrie-Feldern.
