import type { Database } from '@/lib/supabase/database.types';

type FundingCaseRow = Database['public']['Tables']['funding_cases']['Row'];
type CustomerRow    = Database['public']['Tables']['customers']['Row'];

export type InstructionFormat = 'whatsapp' | 'email';

export function generateCustomerInstructions(
  fundingCase: FundingCaseRow,
  customer: CustomerRow | null,
  bzaId: string | null,
  format: InstructionFormat,
): string {
  const name = customer
    ? `${customer.first_name} ${customer.last_name}`
    : 'Antragsteller/in';

  const address = [
    fundingCase.project_address_street,
    [fundingCase.project_address_postal_code, fundingCase.project_address_city]
      .filter(Boolean)
      .join(' '),
  ]
    .filter(Boolean)
    .join(', ');

  return format === 'whatsapp'
    ? buildWhatsApp(name, address, bzaId, fundingCase.title)
    : buildEmail(name, address, bzaId, fundingCase.title);
}

function buildWhatsApp(
  name: string,
  address: string,
  bzaId: string | null,
  title: string,
): string {
  const lines = [
    `Hallo ${name},`,
    '',
    `für Ihr Projekt *${title}*${address ? ` (${address})` : ''} können Sie jetzt den KfW-Förderantrag stellen.`,
    '',
    '*So stellen Sie den KfW-Antrag:*',
    '1. Öffnen Sie www.kfw.de und melden Sie sich unter „Meine KfW" an',
    '2. Wählen Sie „Bundesförderung für effiziente Gebäude – Einzelmaßnahmen (BEG EM)"',
    '3. Füllen Sie den Antrag vollständig aus',
  ];

  if (bzaId) {
    lines.push(`4. Geben Sie die BzA-Referenznummer ein: *${bzaId}*`);
  }

  lines.push(
    '',
    '⚠️ *Wichtig: Beginnen Sie erst nach Erhalt der schriftlichen KfW-Förderzusage mit den Arbeiten!*',
    '',
    'Bei Fragen melden Sie sich gerne bei uns.',
    '',
    '_Interne Vorbereitung · keine Fördergarantie · keine automatische Antragstellung_',
  );

  return lines.join('\n');
}

function buildEmail(
  name: string,
  address: string,
  bzaId: string | null,
  title: string,
): string {
  const lines = [
    `Sehr geehrte/r ${name},`,
    '',
    `alle Unterlagen für Ihr Wärmepumpenprojekt „${title}"${address ? ` (${address})` : ''} sind geprüft. Sie können jetzt den KfW-Förderantrag stellen.`,
    '',
    'Bitte gehen Sie wie folgt vor:',
    '',
    '1. Öffnen Sie www.kfw.de und melden Sie sich unter „Meine KfW" an.',
    '2. Wählen Sie „Bundesförderung für effiziente Gebäude – Einzelmaßnahmen (BEG EM)".',
    '3. Füllen Sie alle Felder des Antrags vollständig aus.',
  ];

  if (bzaId) {
    lines.push(`4. Tragen Sie folgende BzA-Referenznummer ein: ${bzaId}`);
  }

  lines.push(
    '',
    'WICHTIG: Beginnen Sie mit keinen Arbeiten, bevor Sie die schriftliche KfW-Förderzusage erhalten haben. Ein vorzeitiger Maßnahmenbeginn führt zum Verlust des Förderanspruchs.',
    '',
    'Bei Rückfragen stehen wir Ihnen gerne zur Verfügung.',
    '',
    'Mit freundlichen Grüßen',
    '',
    '---',
    'Interne Vorbereitung | Keine Fördergarantie | Keine automatische KfW-Antragstellung',
  );

  return lines.join('\n');
}
