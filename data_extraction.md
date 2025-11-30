SMILES
- JSON-Pfad: Section → Names and Identifiers → Computed Descriptors → SMILES
- Erklärung: Die SMILES-Notation (CCC1=CC(=CC=C1)O) gibt die chemische Struktur als Textsequenz wieder. In stoichiometrischen Anwendungen kann SMILES genutzt werden, um Strukturen in Reaktionsgleichungen darzustellen oder automatisch physikalisch-chemische Eigenschaften abzuleiten. In Sicherheitsanwendungen hilft SMILES bei der strukturbasierten Suche nach ähnlichen Stoffen und ihren Gefahrenprofilen.

Wikipedia
- JSON-Pfad: Section → Names and Identifiers → Other Identifiers → Wikipedia
- Erklärung: Verweis auf den Wikipedia-Artikel „3-Ethylphenol“. Wikipedia liefert einen allgemeinen Überblick zur Chemikalie (Eigenschaften, Vorkommen, Risiken). Für einen KI-Agenten ist dies nützlich, um Nutzern Basiswissen bereitzustellen. Aus stoichiometrischer Sicht kann Wikipedia z.B. Synthesewege oder Reaktionen erwähnen; aus Sicherheits-Sicht sind oft Abschnitte zu Toxizität oder Umgang enthalten.

XLogP3
- JSON-Pfad: Section → Chemical and Physical Properties → Computed Properties → XLogP3
- Erklärung: XLogP3 = 2,4 (logarithmisches n-Octanol/Wasser-Verteilungskoeffizient). Dieser Wert zeigt die hydrophobe vs. hydrophile Balance. Für Stöchiometrie per se unwichtig, aber in einer Anwendung zur Chemikalienbewertung oder Formulierung wesentlich: Ein XLogP von ~2,4 bedeutet mäßig hydrophob – 3-Ethylphenol löst sich mäßig in Wasser und eher in organischen Lösemitteln. Sicherheitsrelevant ist das z.B. für die Verteilung im Körper (Resorption über Haut, Bioakkumulationstendenz) und für Umweltverhalten (Verteilung zwischen Wasser und Fett/Organismen).

Physical Description
- JSON-Pfad: Section → Chemical and Physical Properties → Experimental Properties → Physical Description
- Erklärung: Physischer Zustand und generelle Beschreibung: Flüssigkeit, farblos. Diese Angabe informiert, dass 3-Ethylphenol bei Raumtemperatur eine farblose Flüssigkeit ist. Für stoichiometrische Anwendungen relevant, um z.B. Dichten zu berücksichtigen oder Handhabungsweisen (eine Flüssigkeit dosiert man anders als einen Feststoff). Für Sicherheitsanwendungen ist dies entscheidend: Als Flüssigkeit kann es leicht verschüttet werden, bildet ggf. Dämpfe und erfordert andere Schutzmaßnahmen als ein Feststoff. Die Farblosigkeit bedeutet zusätzlich, dass Lecks schwer visuell erkennbar sind – was z.B. bei der Lagerung wichtig ist.

Color/Form
- JSON-Pfad: Section → Chemical and Physical Properties → Experimental Properties → Color/Form
- Erklärung: Bestätigt die Erscheinung: „COLORLESS LIQUID“ (farblose Flüssigkeit). Dies stammt aus Literatur (z.B. Hawley’s Condensed Chemical Dictionary). Für unseren Agenten deckt es sich mit obiger Physical Description, also v.a. redunante Info zur Farbe. Stoichiometrisch nicht relevant, aber praktisch: farblose Flüssigkeiten müssen ggf. mit Farbstoff markiert werden, um Leckagen zu erkennen (bei Sicherheitsbetrachtungen in Industrie).

Solubility
- JSON-Pfad: Section → Chemical and Physical Properties → Experimental Properties → Solubility
- Erklärung: Löslichkeit: „SLIGHTLY SOLUBLE IN WATER, CHLOROFORM; VERY SOLUBLE IN ALCOHOL, ETHER“. 3-Ethylphenol ist geringfügig in Wasser löslich, sehr gut in organischen Lösungsmitteln wie Alkohol und Ether. Stoichiometrisch relevant, wenn wässrige vs. organische Reaktionsmedien gewählt werden (in Wasserphase kaum vorhanden, eher in organischer Phase). Sicherheitstechnisch äußerst wichtig: begrenzte Wasserlöslichkeit heißt, dass bei einem Löschwassereinsatz oder einer Kontamination 3-Ethylphenol sich nicht komplett im Wasser verteilt, sondern evtl. als separate Phase bleibt. Die hohe Löslichkeit in organischen Lösemitteln bedeutet, dass es z.B. schnell durch die Haut (fettlöslich) dringen kann oder in Lösungsmittelabfällen vollständig gelöst vorliegt.

Vapor Pressure
- JSON-Pfad: Section → Chemical and Physical Properties → Experimental Properties → Vapor Pressure
- Erklärung: Dampfdruck = 0,05 mmHg (bei 25 °C). Das ist sehr gering (0,05 mmHg ≈ 0,0067 kPa). Bedeutet: Bei Raumtemperatur verdampft 3-Ethylphenol nur minimal (z.B. im Vergleich: Wasser hat ~23 mmHg). Für stoichiometrische Reaktionen gut – Verluste durch Verdampfen sind gering, man kann es erhitzen ohne dass sofort alles weg ist (bis Sdp. ~218 °C). Sicherheitsrelevant: niedriger Dampfdruck heißt geringe akute Vergiftungsgefahr durch Dämpfe bei Raumtemp. (die Konzentration in Luft bleibt niedrig). Allerdings: in geschlossenen, warmen Räumen kann es sich über Zeit ansammeln. Und: Phenoldämpfe sind schon in kleinen Mengen toxisch und stechend – 0,05 mmHg reicht evtl. aus, Geruch wahrnehmbar zu machen.

LogP
- JSON-Pfad: Section → Chemical and Physical Properties → Experimental Properties → LogP
- Erklärung: Experimenteller Verteilungskoeffizient: Log K_ow = 2,40. Dieser Wert entspricht in etwa dem berechneten XLogP3 und ist durch Messung bestätigt (Hansch & Leo Datenbank). LogP ~2,4 zeigt moderate Lipophilie. Für stoichiometrische Anwendungen uninteressant, aber in Sicherheitschemie sehr wichtig: LogP fließt in die GHS-Bewertung für Gewässergefährdung und Bioakkumulation ein. Mit 2,4 hat 3-Ethylphenol ein gewisses Bioakkumulationspotenzial, aber nicht extrem (Werte >4 wären kritisch). Außerdem beeinflusst LogP die Hautresorption (lipophile Stoffe dringen schneller durch die Hautbarriere).

Dissociation Constants (pKa)
- JSON-Pfad: Section → Chemical and Physical Properties → Experimental Properties → Dissociation Constants
- Erklärung: Säurekonstante: pKa ≈ 9,9. 3-Ethylphenol ist ein Phenol und demnach eine schwache Säure – pKa ~9,9 heißt, bei pH 7 liegt es weitgehend als neutraler Phenol vor, erst in stark basischer Lösung (pH > 9–10) deprotoniert es signifikant zum Phenolat. Stoichiometrisch relevant in basischen Reaktionen (evtl. muss man Phenolat bilden). Sicherheitsrelevant: In Kontakt mit starken Basen (Laugen) entsteht das Phenolat, welches besser wasserlöslich ist und evtl. andere Gefahren birgt (z.B. ätzendere Wirkung, da Phenolate korrosiv sein können).

Kovats Retention Index
- JSON-Pfad: Section → Chemical and Physical Properties → Experimental Properties → Kovats Retention Index
- Erklärung: Gaschromatographische Retentionsindices auf Standardphasen: z.B. ~1140–1180 (nicht-polar, je nach Säule). Der Kovats-Index erlaubt die Identifizierung per GC: 3-Ethylphenol hat einen Retentionsindex um 1140 auf unpolaren Säulen, was im Bereich anderer Alkylphenole liegt. Stoichiometrisch uninteressant, aber analytisch und somit sicherheitsrelevant: Bei Brandrückstandsanalysen, Produktreinheitstests etc. nutzt man solche Indizes. Der KI-Agent könnte z.B. anhand des Kovats-Index feststellen, ob ein Peak in einer GC-Chromatographie 3-Ethylphenol ist.

Sources/Uses
- JSON-Pfad: Section → Use and Manufacturing → Uses → Sources/Uses
- Erklärung: Beschreibt hauptsächliche Verwendung: „Used as a starting material for photochemicals“. 3-Ethylphenol dient also als Ausgangsstoff zur Herstellung von Fotochemikalien (vermutlich bestimmte Entwickler oder lichtempfindliche Polymere). Für Stöchiometrie bedeutet das, dass es in mehrstufigen Synthesen eingesetzt wird – unser Agent könnte also in einer Reaktionskette 3-Ethylphenol als Edukt erkennen. Sicherheitsrelevant: Die Verwendungsart gibt Hinweise auf Expositionsszenarien – z.B. in der Fotoindustrie oder Laboren kommt der Stoff vor. Dadurch weiß man, in welchen Branchen Schutzmaßnahmen nötig sind.

Use Classification
- JSON-Pfad: Section → Use and Manufacturing → Uses → Section → Use Classification
- Erklärung: Klassifizierung der Nutzung: „Fragrance Ingredients“. Das deutet darauf hin, dass 3-Ethylphenol auch als Duftstoff-Komponente klassifiziert ist (evtl. in sehr geringer Menge, da viele Alkylphenole einen geruchlichen Beitrag leisten). Für Stöchiometrie unwichtig, aber aus Anwendungssicht interessant: Könnte in Parfüms oder Aromen vorkommen. Sicherheitsaspekt: Wenn es in Konsumgütern (Duftstoffe) auftaucht, gibt es Exposition der Allgemeinbevölkerung – hier muss geprüft sein, ob die Konzentrationen ungefährlich sind. Ein KI-Agent kann dies dem Nutzer anzeigen, um z.B. bei Allergikern Vorsicht zu signalisieren.

Industry Uses
- JSON-Pfad: Section → Use and Manufacturing → Uses → Section → Industry Uses
- Erklärung: Industrielle Verwendungskategorien (EPA ChemDataReporting): u.a. „Cleaning agent“, „Corrosion inhibitor“. Das heißt, 3-Ethylphenol wird von der Industrie in Reinigungsmitteln und als Korrosionsinhibitor eingesetzt. Für stoichiometrische Planung weniger relevant, aber es zeigt, dass die Chemikalie funktionelle Eigenschaften hat (antimikrobiell? antioxidativ?), die in Produkten ausgenutzt werden. Sicherheitsrelevant: Reinigungsmittel mit Phenolanteil können hautreizend oder toxisch sein – Mitarbeiter in Industrie oder Reinigungskräfte könnten exponiert sein. Als Korrosionsinhibitor könnte es etwa in Kühlwasserkreisläufen oder Treibstoffen verwendet werden, was bestimmte Sicherheitsvorkehrungen (Atemschutz bei Nebel, Kontaktvermeidung) erfordert.

Consumer Uses
- JSON-Pfad: Section → Use and Manufacturing → Uses → Section → Consumer Uses
- Erklärung: (Datenbank-Kategorie für Verbraucheranwendungen, Details hier nicht angezeigt). Oft werden Produktkategorien aufgezählt, in denen der Stoff vorkommt. Mögliche Consumer Uses (abgeleitet vom Duftstoff-Hinweis): Parfüm, Raumduft, evtl. Reinigungsmittel. Für Stoichiometrie irrelevant, für Sicherheit jedoch zentral: Ist 3-Ethylphenol in verbrauchernahen Produkten, gelten strengere Grenzwerte und Kennzeichnungspflichten. Ein KI-Agent könnte so dem Nutzer mitteilen: „Kommt in folgenden Verbraucherprodukten vor…“ und entsprechende Vorsichtshinweise (z.B. nicht auf die Haut bringen).

Methods of Manufacturing
- JSON-Pfad: Section → Use and Manufacturing → Methods of Manufacturing
- Erklärung: Herstellverfahren: z.B. „durch Sulfonierung von Ethylbenzol und nachfolgende Alkalischmelze der 3-Ethylbenzolsulfonsäure…“. Hier wird ein industrieller Syntheseweg beschrieben, der 3-Ethylphenol mit hoher Reinheit liefert. Stoichiometrisch interessant, da es Reaktionsschritte nennt (Sulfonierung, Isomerisierung, Hydrolyse, Schmelze) – ein Agent könnte daraus schlussfolgern, welche Nebenprodukte entstehen (z.B. 2- und 4-Ethylphenol). Sicherheitsrelevant: Das Herstellverfahren weist hin auf mögliche Verunreinigungen (andere Ethylphenole, Sulfate) und auf gefährliche Prozessbedingungen (150–340 °C, ätzende Alkalischmelze, H₂SO₄). Ein KI-System kann aus dieser Info ableiten, welche Gefahren in der Produktion bestehen (hohe Temperatur, korrosive Medien, Druck?).

Pictogram(s)
- JSON-Pfad: Section → Safety and Hazards → Hazards Identification → GHS Classification → Pictogram(s)
- Erklärung: Gemäß Globally Harmonized System (GHS) sind für 3-Ethylphenol folgende Gefahrenpiktogramme relevant: GHS05 (Ätzwirkung), GHS06 (Totenkopf: akute Toxizität) und GHS07 (Ausrufezeichen: Warnung). Das deutet auf schwere Gefahren hin: ätzend (vermutlich hautätzend oder schwere Augenschädigung), hoch akut toxisch (giftig, z.B. beim Verschlucken oder Hautkontakt) und reizend/gesundheitsschädlich in geringeren Expositionen. Diese Symbole fassen die wichtigsten Risiken visuell zusammen. Ein KI-Agent zeigt sie dem Nutzer als sofort erkennbare Warnung.

Signal (Signalwort)
- JSON-Pfad: Section → Safety and Hazards → Hazards Identification → GHS Classification → Signal
- Erklärung: Das GHS-Signalwort lautet „Danger“ („Gefahr“). Von den beiden möglichen Signalwörtern (Warning = „Achtung“ für moderate Gefahren, Danger = „Gefahr“ für hohe Gefahren) ist hier das stärkere gewählt. Für den KI-Agenten heißt das: in der Anzeige sollten Warnhinweise prominent und in roter Farbe erfolgen. Für den Anwender bedeutet „Gefahr“, dass dieser Stoff schwerwiegende Risiken birgt – alle Sicherheitsanweisungen sind strikt zu befolgen.

GHS Hazard Statements (H-Sätze)
- JSON-Pfad: Section → Safety and Hazards → Hazards Identification → GHS Classification → GHS Hazard Statements
- Erklärung: Enthaltene H-Sätze und Prozentsätze ihrer Nennung in Einstufungen: z.B. H301 (39%): Toxic if swallowed, H311 (39%): Toxic in contact with skin, H314 (62.5%): Causes severe skin burns and eye damage, H302+H312+H332 (20%): Harmful if swallowed, in contact with skin or if inhaled, H315 (36%): Causes skin irritation, etc.. Diese Aussagen bedeuten: Akute Toxizität oral (H301) und dermal (H311) – „Giftig bei Verschlucken/Hautkontakt“, H314 – „Verursacht schwere Verätzungen der Haut und Augenschäden“ (dies ist besonders gravierend, daher GHS05 Symbol), sowie kombinierte Aussagen für geringere Grade (H302+H312+H332 „Gesundheitsschädlich beim Verschlucken, Hautkontakt oder Einatmen“ mit Warning). Die Prozentangaben zeigen, wie häufig Unternehmen diese Klassifizierung gemeldet haben – 62,5% meldeten z.B. H314, was bedeutet die Mehrheit sieht es als ätzend. Ein KI-Agent kann alle relevanten H-Sätze ausgeben, um den Nutzer über jede Gefahr zu informieren.

Precautionary Statement Codes (P-Sätze)
- JSON-Pfad: Section → Safety and Hazards → Hazards Identification → GHS Classification → Precautionary Statement Codes
- Erklärung: Hier würden die empfohlenen Sicherheitsratschläge (P-Codes) stehen, z.B. P280 (Schutzhandschuhe/Schutzkleidung/Augenschutz tragen), P301+P310 (BEI VERSCHLUCKEN: sofort Giftinformationszentrum/Arzt anrufen), P303+P361+P353 (BEI HAUTKONTAKT: Kontaminierte Kleidung ausziehen, Haut abspülen), P305+P351+P338 (BEI KONTAKT MIT DEN AUGEN: behutsam spülen, Kontaktlinsen entfernen), P260 (Staub/Rauch/Gas/Nebel/Dampf nicht einatmen) etc. Diese stehen im Dokument verschlüsselt als Codes. Ein KI-Agent muss diese Codes in Klartext dem Nutzer anzeigen. Sie sind für den Anwender essenziell, um zu wissen, welche konkreten Schutzmaßnahmen und Erste-Hilfe-Schritte vorgeschrieben sind.

Hazard Classes and Categories
- JSON-Pfad: Section → Safety and Hazards → Hazards Identification → GHS Classification → Hazard Classes and Categories
- Erklärung: Listet die Zuordnung zu GHS-Gefahrklassen: Zum Beispiel „Acute toxicity (oral) – Category 3“, „Acute toxicity (dermal) – Category 3“, „Skin corrosion – Category 1B“, „Skin irritation – Category 2“ etc. (Der genaue Auszug deutet z.B. H314 auf Kategorie 1B hin für Ätzwirkung). Diese Kategorien sind wichtig für Regulierung: Kategorie 1B bei Hautätzung heißt, es verursacht Verätzungen in ≤3 Minuten Einwirkung auf Haut. Kategorie 3 bei akuter Toxizität heißt LD50 50-300 mg/kg. Für den Agenten: Er kann daraus noch genauer abschätzen, wie gefährlich – hier ziemlich gefährlich. Für Stoichiometrie uninteressant, aber sicherheitsmäßig zentral für Kennzeichnung (ergibt sich aus H-Sätzen).

Environmental Fate/Exposure Summary
- JSON-Pfad: Section → Ecological Information → Environmental Fate/Exposure Summary
- Erklärung: Zusammenfassung der Umweltverbleibs: 3-Ethylphenol wird bei dessen Verwendung (Photochemikalien, Lacke) über Abwässer freigesetzt; es kann aus Kohleextraktion oder Zigarettenrauch in die Umwelt gelangen. In der Atmosphäre liegt es hauptsächlich gasförmig vor und wird durch OH-Radikale mit ~5 Stunden Halbwertzeit abgebaut. Im Boden moderate Mobilität (Koc ~480), kann in Böden und Wasser biodegradieren (93% Abbau in 37 Tagen in Versuch). Volatilisiert von Wasseroberflächen langsam (Henry-Konst. 1,1×10^-6 atm·m³/mol), modellierte Halbwertszeiten: Fluss ~37 Tage, See ~274 Tage. Bioakkumulation in Fischen moderat (BCF ~40). Allgemein: Bevölkerung exponiert via Zigarettenrauch und Hautkontakt mit Produkten. Diese ausführliche Info zeigt, dass 3-Ethylphenol in der Umwelt recht abbaubar ist und sich nicht stark anreichert, aber lokal (im Boden, in stehenden Gewässern) einige Zeit verbleiben kann. Für den Agenten: Er kann dem Nutzer sagen, dass der Stoff zwar giftig, aber kein Persistent Organic Pollutant ist; dennoch Problem bei akuter Einleitung in Gewässer (bleibt dort Wochen/Monate).

