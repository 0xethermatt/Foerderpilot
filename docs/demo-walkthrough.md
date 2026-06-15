# Förderpilot V0 – Demo-Walkthrough

Internes Dokument · Stand 2026-06-15 · Phase 18

---

## Voraussetzungen

- Node.js ≥ 20
- Supabase-Umgebung (lokal oder remote)
- `.env.local` mit `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`

**Lokaler Start:**

```bash
npm install
npm run dev
# → http://localhost:3000
```

**Demo-Daten lokal einspielen:**

```bash
supabase db reset   # oder: supabase db seed
```

Die `supabase/seed.sql` legt automatisch 4 TESTDATEN-Fälle an.

---

## Demo-Fälle

| # | Kunde | Fall-Titel | Phase | Erwarteter Schritt |
|---|-------|-----------|-------|-------------------|
| 1 | Müller | TESTDATEN – Müller Wärmepumpe EFH München | Unterlagen fehlen | Unterlagen |
| 2 | Schmidt | TESTDATEN – Schmidt Sole-WP Doppelhaus Berlin | Dokumente prüfen | Prüfung |
| 3 | Weber | TESTDATEN – Weber Luft-WP Reihenhaus Köln | BzA-bereit | BzA |
| 4 | Hoffmann | TESTDATEN – Hoffmann Wärmepumpe Hamburg | KfW-Zusage erhalten | Nachweise |

---

## Demo-Ablauf

### Schritt 1: Dashboard (Übersicht)

1. `/dashboard` öffnen
2. Zeigen: 4 Testfälle in unterschiedlichen Phasen
3. Zeigen: Spalte "Schritt" – sofort erkennbar, wo jeder Fall steht
4. Zeigen: Offene Aufgaben-Badge (orange Zahl)
5. Zeigen: Risikobewertung (grün/gelb/rot)
6. "Übersicht hilft dem SHK-Betrieb, das nächste Fall-Gespräch vorzubereiten"

---

### Schritt 2: Fall 1 – Unvollständige Unterlagen (Müller)

1. Fall "Müller" aus der Liste öffnen
2. Zeigen: Workflow-Stepper → Schritt 1 "Unterlagen" aktiv
3. Zeigen: Nächste Aktionen (rechte Spalte) → 3 fehlende Dokumente
4. Zeigen: Dokumententabelle → alle 5 Pflichtunterlagen als "Fehlend" markiert (orange)
5. Zeigen: Offene Aufgaben → 3 Aufgaben für Kundenanfragen
6. Botschaft: "Förderpilot zeigt dem Betrieb sofort, was noch fehlt – kein Vergessen, keine Zettelwirtschaft"

**Was NICHT klicken:** KI-Fördercheck (keine Dokumente vorhanden → Fehler)

---

### Schritt 3: Fall 2 – Dokumente prüfen (Schmidt)

1. Fall "Schmidt" öffnen
2. Zeigen: Stepper → Schritt 2 "Prüfung" aktiv
3. Zeigen: Dokumententabelle → 3 Dokumente hochgeladen (Status: "Ausstehend")
4. KI-Angebotsprüfung zeigen: bereits durchgeführt, "Prüfung offen" (KI-Checks Abschnitt)
5. **Demo-Aktion:** KI-Prüfungsergebnis freigeben oder ablehnen
   - KI-Prüfungen aufklappen → Ergebnis anzeigen → "Freigeben" klicken
6. Zeigen: Status wechselt zu "Freigegeben"
7. **Demo-Aktion (optional):** Dokument-Status auf "Geprüft" setzen
   - MoreHorizontal (···) öffnen → Status-Dropdown → "Geprüft" → OK
8. Botschaft: "Keine Förderunterlagen mehr in E-Mail-Anhängen suchen – alles in einem System"

---

### Schritt 4: Fall 3 – BzA-Vorbereitung (Weber)

1. Fall "Weber" öffnen
2. Zeigen: Stepper → Schritt 3 "BzA" aktiv
3. Zeigen: Alle 5 Pflichtunterlagen "Geprüft" (grüne Punkte)
4. Zeigen: KI-Prüfungen → Angebot + Vertrag freigegeben (grün)
5. Zeigen: BzA-Vorbereitung (Abschnitt geöffnet) → Bereit-Badge
6. **Demo-Aktion:** BzA beim Fachunternehmen anfordern (Button im BzA-Abschnitt)
7. Botschaft: "Der Betrieb sieht sofort: jetzt BzA anfordern – nicht erst nach Wochen erinnern"

**KfW-Antragsvorbereitung zeigen:**
- Abschnitt KfW-Antragsvorbereitung aufklappen
- BzA-ID-Feld zeigen (15-stellige Nummer)
- Erklären: "Diese ID kommt vom Fachunternehmen – wir tragen sie hier ein, dann ist der Antrag vorbereitet"

---

### Schritt 5: Fall 4 – Nach der Förderzusage (Hoffmann)

1. Fall "Hoffmann" öffnen
2. Zeigen: Stepper → Schritt 5 "Nachweise" aktiv, Sublabel: "Umsetzung starten"
3. Zeigen: KfW-Antragsvorbereitung → Status "Förderzusage erhalten"
4. Zeigen: Nachweisphase-Abschnitt → 6-Schritt-Tracker
5. **Demo-Aktion:** "Umsetzung gestartet" markieren
6. **Demo-Aktion (optional):** BnD-ID eintragen
7. Botschaft: "Kein manuelles Kalkulieren mehr – Förderpilot zeigt den nächsten Schritt automatisch"

**Wichtig beim Erklären:**
- "Der Kunde reicht die Nachweise selbst in 'Meine KfW' ein – Förderpilot stellt das NICHT automatisch ein"
- "Wir bereiten alles intern vor und geben dem Kunden eine klare Checkliste"

---

### Schritt 6: Förderakte exportieren

1. Im Fall Weber oder Hoffmann: Abschnitt "Förderakte Export" öffnen
2. Variante auswählen: "Interner Export"
3. Klick "Export generieren"
4. Vorschau zeigen
5. "Markdown kopieren" → in Notizen-App einfügen
6. Variante wechseln: "Kundenzusammenfassung" – kurze Version ohne interne Details
7. "Fachbetrieb/BzA-Übergabe" – für Weitergabe an Installateur

**Botschaft:** "Ein Klick für die komplette Dokumentation – als Markdown für jedes CRM oder E-Mail"

---

## Was NICHT behaupten

| Falsch | Richtig |
|--------|---------|
| "Förderpilot stellt den Antrag automatisch" | "Der Kunde stellt den Antrag selbst in 'Meine KfW'" |
| "Förderung ist sicher" | "KI-Prüfung ist eine Vorprüfung – keine Garantie" |
| "KfW validiert die Unterlagen automatisch" | "Förderpilot prüft lokal – finale Entscheidung bei KfW" |
| "Wir haben Zugang zu Meine KfW" | "Förderpilot speichert keine Meine-KfW-Zugangsdaten" |
| "Keine manuelle Prüfung nötig" | "Menschliche Freigabe bleibt bei jedem KI-Check erforderlich" |

---

## Bekannte Einschränkungen (V0)

- Demo-Dokumente haben keine echten Dateien hinter sich (Download-Button erscheint nicht bei Test-Daten)
- KI-Fördercheck benötigt echten `ANTHROPIC_API_KEY`
- Kein Multi-User-Login / Rollen (V0 ist Single-Tenant)
- Keine automatische KfW-Einreichung (by design)
- Nachweise müssen manuell vorbereitet und dem Kunden für Meine KfW übergeben werden

---

## Sicherheitshinweise für die Demo

- Keine echten Kundendaten in Demo-Umgebung einpflegen
- `SUPABASE_SERVICE_ROLE_KEY` niemals im Browser-Code oder in Logs exponieren
- Demo-Umgebung nicht öffentlich zugänglich machen ohne Authentifizierung

---

## Empfohlener nächster Schritt (Phase 19)

- Benutzer-Login / Auth (Supabase Auth oder NextAuth)
- Multi-Tenant (mehrere SHK-Betriebe)
- Echtzeit-Benachrichtigungen bei neuen Dokumenten
- PDF-Export statt Markdown
