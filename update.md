# Update-Bericht

## Was wurde geändert?
- Die KI-Prompts wurden vereinfacht und auf die Rollen **Edukt, Produkt, Lösemittel, Additiv, Katalysator** beschränkt. Die KI trägt jetzt nur noch Daten ein, die wirklich im Text stehen – keine erfundenen CAS-Nummern oder Mengen.
- Wenn PubChem beim ersten Versuch keine Treffer liefert, bekommt der zweite KI-Versuch nun den kompletten Kontext des Fehlversuchs (inklusive bereits getesteter Namen) und fragt nur nach fehlenden Stoffen.
- Bei der PubChem-Abfrage werden jetzt zusätzliche physikalische Eigenschaften wie **Dichte, Schmelzpunkt, Siedepunkt** und **Aussehen** mit abgeholt. Diese Werte werden separat in der Detailansicht angezeigt.
- Die Dichte wird, wenn verfügbar, automatisch genutzt, um aus Volumenangaben (z. B. ml) die Masse und Stoffmenge zu berechnen.
- Die Tabellen-Logik wurde um eine Hilfsfunktion erweitert, damit die automatischen Tests wieder durchlaufen.

## Was bedeutet das für die Nutzung?
- Beim Ausfüllen des Texteingabefelds musst du weiterhin keine speziellen Vorgaben beachten. Die KI achtet jetzt selbst darauf, nur sichere, im Text vorkommende Informationen zu verwenden.
- Wenn eine Chemikalie nicht gefunden wird, informiert das Log ausführlicher und versucht eine erneute Suche mit dem Kontext aus dem ersten Versuch.
- In der Detailansicht siehst du neben Grunddaten jetzt auch physikalische Kennwerte, falls PubChem diese liefern konnte.
