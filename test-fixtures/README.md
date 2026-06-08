# Förderpilot V0 – Synthetische Testdokumente

Diese Dokumente wurden ausschließlich für manuelle Tests von Förderpilot V0 erstellt.
**Sie enthalten keinerlei echte Kunden-, Unternehmens- oder Grundstücksdaten.**
Alle Namen, Adressen, Registriernummern und Beträge sind frei erfunden.

---

## Dokumente

### Angebote

| Datei | Beschreibung | Erwartetes Verhalten in Förderpilot |
|---|---|---|
| `01_angebot_vollstaendig.pdf` | Vollständiges SHK-Angebot: Haustechnik Frey Muster GmbH an Max Mustermann, Viessmann Vitocal 250-A, alle BEG-relevanten Positionen, Ausführungszeitraum 01/2025–02/2025, Hinweis auf Fördervorbehalt, Netto/Brutto-Summe | ✅ Angebot vollständig – alle Pflichtpositionen erkannt, Ausführungszeitraum vorhanden, Förderfähigkeit bestätigbar |
| `02_angebot_unvollstaendig.pdf` | Lückenhaftes Pauschalangebot: kein exaktes WP-Modell, kein hydraulischer Abgleich, keine Einzelpositionen, kein Ausführungszeitraum | ❌ Angebot unvollständig – fehlende Pflichtangaben erkannt: WP-Modell, hydr. Abgleich, Ausführungstermin |

### Verträge

| Datei | Beschreibung | Erwartetes Verhalten in Förderpilot |
|---|---|---|
| `03_vertrag_mit_foerdervorbehalt.pdf` | Ordnungsgemäßer Werkvertrag mit aufschiebender Bedingung (§ 158 BGB) – Ausführung nur nach KfW/BAFA-Förderzusage, klares Ausführungsverbot vor Bewilligung, Rücktrittsrecht | ✅ Fördervorbehalt erkannt – Vertrag BEG-konform |
| `04_vertrag_ohne_foerdervorbehalt.pdf` | Normal wirkender Werkvertrag ohne jede Förderklausel – kein Vorbehalt, keine aufschiebende Bedingung | ❌ Kein Fördervorbehalt – Vertrag nicht BEG-konform, Ablehnung möglich |
| `05_vertrag_mit_vorzeitigem_beginn.pdf` | Vertrag mit explizit problematischer Klausel: „Die Ausführung beginnt unmittelbar nach Unterzeichnung." – keine Förderzusage vor Beginn | ❌ Vorzeitiger Maßnahmenbeginn erkannt – Förderanspruch verwirkt |

### Eigentumsnachweis

| Datei | Beschreibung | Erwartetes Verhalten in Förderpilot |
|---|---|---|
| `06_eigentumsnachweis_mock.pdf` | Synthetischer Grundbuchauszug – Max Mustermann, Birkenweg 7, Alleineigentum 1/1, keine Lasten | ✅ Eigentümerschaft verifizierbar – passt zum Auftraggeber in Dokument 01 |

### Bilder

| Datei | Beschreibung | Erwartetes Verhalten in Förderpilot |
|---|---|---|
| `07_typenschild_oelheizung_mock.png` | Synthetisches Typenschild einer Ölheizung: MusterTherm MH-22, Baujahr 1999, 22 kW | ✅ Altanlage identifiziert: Ölheizung ≤ Baujahr 2000 – förderfähig für BEG-Heizungstausch |
| `08_foto_altanlage_mock.png` | Platzhalter-Foto einer alten Ölheizungsanlage | Nutzbar als Fotodokumentation der Altanlage im Förderantrag |

---

## Regenerierung

Die Dokumente werden mit folgendem Skript erzeugt (benötigt: `pdfkit`):

```bash
npm install --save-dev pdfkit
node generate-test-fixtures.js
```

Das Skript liegt im Projektstamm: `generate-test-fixtures.js`

---

## Testszenarien

### Szenario A – Happy Path (vollständige Unterlagen)
Upload: `01` + `03` + `06` + `07` + `08`  
Erwartung: Alle Prüfungen grün, Förderpilot bestätigt Förderfähigkeit

### Szenario B – Unvollständiges Angebot
Upload: `02` + `03`  
Erwartung: Förderpilot meldet fehlende Positionen im Angebot

### Szenario C – Fehlender Fördervorbehalt
Upload: `01` + `04`  
Erwartung: Förderpilot warnt vor fehlendem Fördervorbehalt im Vertrag

### Szenario D – Vorzeitiger Maßnahmenbeginn
Upload: `01` + `05`  
Erwartung: Förderpilot erkennt kritische Vertragsklausel, blockiert Weiterverarbeitung

### Szenario E – Kombiniert fehlerhaft
Upload: `02` + `04`  
Erwartung: Mehrere Fehler gleichzeitig erkannt (Angebot unvollständig + kein Fördervorbehalt)

---

## Wichtige Hinweise

- Alle Dokumente sind mit dem Vermerk **TESTDOKUMENT** versehen
- Keine echten personenbezogenen Daten (kein DSGVO-Risiko)
- Keine echten Unternehmensnamen – nur fiktive Testnamen
- Keine realen Grundbuchdaten
- Beträge und technische Angaben sind plausibel, aber frei erfunden
- Nicht für externe Weitergabe geeignet
