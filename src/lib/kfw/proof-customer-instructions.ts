import type { Database } from '@/lib/supabase/database.types';

type FundingCaseRow = Database['public']['Tables']['funding_cases']['Row'];
type CustomerRow    = Database['public']['Tables']['customers']['Row'];

export type ProofInstructionFormat = 'whatsapp' | 'email';

export function generateProofCustomerInstructions(
  fundingCase: FundingCaseRow,
  customer: CustomerRow | null,
  format: ProofInstructionFormat,
): string {
  const firstName = customer?.first_name ?? 'Frau/Herr …';
  const ref = fundingCase.kfw_application_reference
    ? ` (Referenz: ${fundingCase.kfw_application_reference})`
    : '';

  if (format === 'whatsapp') {
    return `Hallo ${firstName},

Ihre KfW-Förderung${ref} wurde bewilligt – herzlichen Glückwunsch!

Damit die Fördermittel ausgezahlt werden können, müssen Sie jetzt die Nachweise in „Meine KfW" hochladen und einreichen.

So gehen Sie vor:
1. Melden Sie sich unter meinekfw.de an
2. Öffnen Sie Ihren Förderantrag
3. Laden Sie die Nachweise hoch:
   • Rechnung des ausführenden Fachunternehmens
   • Bestätigung nach Durchführung (BnD) vom Fachunternehmen
4. Reichen Sie die Unterlagen in „Meine KfW" ein

Wichtig: Die Nachweiseinreichung erfolgt ausschließlich durch Sie persönlich in „Meine KfW". Wir reichen keine Nachweise automatisch ein.

Bei Fragen melden Sie sich gerne.`;
  }

  return `Betreff: KfW-Förderung${ref} – Nachweise einreichen

Sehr geehrte/r ${firstName},

Ihre KfW-Förderung wurde bewilligt. Um die Fördermittel zu erhalten, müssen Sie jetzt die Nachweise in „Meine KfW" einreichen.

Bitte gehen Sie wie folgt vor:

1. Melden Sie sich unter meinekfw.de mit Ihren Zugangsdaten an.
2. Öffnen Sie Ihren Förderantrag.
3. Laden Sie folgende Unterlagen hoch:
   - Rechnung des ausführenden Fachunternehmens
   - Bestätigung nach Durchführung (BnD) vom Fachunternehmen
4. Reichen Sie die Unterlagen in „Meine KfW" ein.

Wichtiger Hinweis: Die Einreichung der Nachweise erfolgt ausschließlich durch Sie persönlich in „Meine KfW". Eine automatische Einreichung durch uns ist nicht möglich und auch nicht vorgesehen.

Bitte beachten Sie, dass für die Auszahlung alle Nachweise vollständig und fristgerecht eingereicht werden müssen.

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen`;
}
