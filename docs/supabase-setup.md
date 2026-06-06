# Supabase Setup – Förderpilot V0

## Voraussetzungen

- [Supabase CLI](https://supabase.com/docs/guides/cli) installiert (`brew install supabase/tap/supabase`)
- Supabase-Projekt unter [app.supabase.com](https://app.supabase.com) erstellt

---

## 1. Umgebungsvariablen einrichten

```bash
cp .env.local.example .env.local
```

Werte unter **Supabase Dashboard → Project Settings → API** eintragen:

| Variable | Wo zu finden |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` / `public` Key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` Key (nur Server) |

---

## 2. Supabase CLI verbinden

```bash
supabase login
supabase link --project-ref <project-id>
```

Die `project-id` findet sich in der URL des Dashboards: `app.supabase.com/project/<project-id>`.

---

## 3. Migrationen ausführen

### Remote (empfohlen für Staging/Produktion)

```bash
supabase db push
```

Führt alle noch nicht angewendeten Migrationen aus `supabase/migrations/` aus.

### Lokal (mit Supabase-Emulator)

```bash
supabase start          # startet lokale Postgres + Studio Instanz
supabase db reset       # wendet alle Migrationen neu an
```

Nach `supabase start` läuft Studio unter [http://localhost:54323](http://localhost:54323).

---

## 4. TypeScript-Typen aus dem Projekt generieren

Nach Schema-Änderungen die Datei `src/lib/supabase/database.types.ts` regenerieren:

```bash
supabase gen types typescript \
  --project-id <project-id> \
  > src/lib/supabase/database.types.ts
```

> **Hinweis:** Die generierten Typen in `database.types.ts` müssen manuell mit
> den Anwendungstypen in `src/lib/types/index.ts` abgeglichen werden – insbesondere
> die CHECK-Constraint-Werte für `status`, `risk_level`, `document type` usw.

---

## 5. Migrationsübersicht

| Datei | Inhalt |
|---|---|
| `20250606000001_create_schema.sql` | Alle 6 Tabellen + `updated_at`-Trigger |
| `20250606000002_add_indexes.sql` | Performance-Indizes für häufige Abfragen |
| `20250606000003_enable_rls.sql` | RLS aktivieren + Dev-Policies (permissiv) |

---

## 6. RLS – Hinweis für Produktion

Die aktuellen Policies (`dev_allow_all_*`) sind permissiv und **nur für lokale
Entwicklung** geeignet. Vor dem Produktivbetrieb müssen sie durch
unternehmensbasierte Policies ersetzt werden, z. B.:

```sql
-- Beispiel: Nur Mitglieder der eigenen company dürfen Fälle sehen
CREATE POLICY "company_isolation" ON funding_cases
  FOR ALL
  USING (
    company_id = (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );
```

Die `profiles`-Tabelle (Verknüpfung von `auth.users` zu `companies`) wird in
Phase 3 (Authentifizierung) angelegt.

---

## 7. Supabase Storage (Dokumente)

Noch nicht konfiguriert. Für Phase X (Dokumenten-Upload) wird ein Storage-Bucket
`foerderpilot-documents` benötigt mit passender RLS-Policy auf den Bucket-Objekten.
