import type { AIReasoningProvider, FundingPrecheckInput, FundingPrecheckResult } from './types';

export class MockAIProvider implements AIReasoningProvider {
  readonly providerName = 'mock';
  readonly modelName = 'mock-funding-precheck-v0';

  async runFundingPrecheck(input: FundingPrecheckInput): Promise<FundingPrecheckResult> {
    const hasBlockers = input.blockingCount > 0;
    const hasMissingData =
      !input.buildingType || !input.currentHeatingType || !input.plannedHeatingType || !input.ownerStatus;

    const overall_assessment: FundingPrecheckResult['overall_assessment'] =
      hasBlockers ? 'unclear' : hasMissingData ? 'unclear' : 'likely_eligible';

    const risk_level: FundingPrecheckResult['risk_level'] =
      hasBlockers ? 'red' : hasMissingData ? 'yellow' : 'green';

    const confidence: FundingPrecheckResult['confidence'] =
      hasBlockers || hasMissingData ? 'low' : 'medium';

    const missingData: string[] = [
      ...(!input.buildingType ? ['Gebäudetyp nicht angegeben'] : []),
      ...(!input.currentHeatingType ? ['Bestehende Heizung nicht angegeben'] : []),
      ...(!input.plannedHeatingType ? ['Geplante Wärmepumpe nicht angegeben'] : []),
      ...(!input.ownerStatus ? ['Eigentümerstatus nicht angegeben'] : []),
      ...(input.selfOccupied === null ? ['Selbstnutzung nicht angegeben'] : []),
      ...(input.estimatedCost == null ? ['Geschätzte Kosten nicht angegeben'] : []),
    ];

    const blockingItems = input.missingDocumentTypes.map(
      (t) => `Pflichtdokument fehlt: ${t}`,
    );

    const nextSteps = [
      ...input.missingDocumentTypes.map((t) => `Dokument "${t}" anfordern und hochladen`),
      ...(hasMissingData ? ['Stammdaten im Förderfall vervollständigen'] : []),
      'Manuelle Prüfung durch qualifizierten Berater durchführen',
      ...(input.blockingCount === 0 ? ['Antragstellung vorbereiten sobald alle Unterlagen geprüft sind'] : []),
    ];

    const summaryParts = [
      `Vorprüfung für „${input.caseTitle}".`,
      hasBlockers
        ? `${input.blockingCount} Pflichtdokument(e) fehlen – Antragstellung noch nicht möglich.`
        : `Dokumentenstatus: ${input.reviewedCount}/${input.totalRequiredBeforeApp} Pflichtunterlagen geprüft.`,
      hasMissingData
        ? 'Einige Stammdaten sind unvollständig, was die Einschätzung einschränkt.'
        : 'Stammdaten sind weitgehend vollständig.',
    ];

    return {
      overall_assessment,
      risk_level,
      summary_de: summaryParts.join(' '),
      missing_information: missingData,
      blocking_items: blockingItems,
      possible_bonuses: [
        {
          name: 'Selbstnutzer-Bonus (§ 21 BEG)',
          status: input.selfOccupied === true ? 'possible' : 'unclear',
          reason_de:
            input.selfOccupied === true
              ? 'Selbstnutzung angegeben – Bonus wahrscheinlich anwendbar.'
              : 'Selbstnutzung nicht eindeutig angegeben – Klärung erforderlich.',
        },
        {
          name: 'Effizienzbonus',
          status: 'unclear',
          reason_de:
            'Abhängig vom geplanten Wärmepumpenmodell und Jahresarbeitszahl – Modell oder JAZ fehlt.',
        },
      ],
      detected_risks: [
        ...(hasBlockers
          ? [
              {
                severity: 'high' as const,
                risk_de: `${input.blockingCount} Pflichtdokument(e) für Antragstellung fehlen`,
                recommended_action_de:
                  'Fehlende Unterlagen vor Antragstellung bei KfW vollständig einreichen.',
              },
            ]
          : []),
        ...(hasMissingData
          ? [
              {
                severity: 'medium' as const,
                risk_de: 'Unvollständige Stammdaten schränken Förderprüfung ein',
                recommended_action_de:
                  'Fehlende Angaben im Förderfall ergänzen (Gebäudetyp, Heizung, Eigentumsverhältnisse).',
              },
            ]
          : []),
      ],
      recommended_next_steps: nextSteps,
      customer_message_draft_de: [
        'Sehr geehrte Kundin, sehr geehrter Kunde,',
        '',
        'vielen Dank für Ihr Vertrauen in unseren Förderpilot-Service.',
        '',
        hasBlockers
          ? `Für die Vorbereitung Ihres Förderantrags benötigen wir noch folgende Unterlagen: ${input.missingDocumentTypes.join(', ')}. Bitte stellen Sie uns diese so bald wie möglich zur Verfügung.`
          : 'Wir haben den aktuellen Stand Ihrer Förderakte geprüft und werden uns zeitnah bei Ihnen melden.',
        '',
        'Bei Fragen stehen wir Ihnen gerne zur Verfügung.',
        '',
        'Mit freundlichen Grüßen',
        'Ihr Förderpilot-Team',
        '',
        '[MOCK-PROVIDER – Diese E-Mail nicht versenden]',
      ].join('\n'),
      internal_notes_de: [
        '[MOCK-PROVIDER AKTIV – Kein ANTHROPIC_API_KEY konfiguriert]',
        `Dokumentenstatus: ${input.reviewedCount}/${input.totalRequiredBeforeApp} geprüft, ${input.blockingCount} blockierend`,
        ...(input.openTaskTitles.length > 0
          ? [`Offene Aufgaben: ${input.openTaskTitles.join(', ')}`]
          : ['Keine offenen Aufgaben']),
      ],
      confidence,
      human_review_required: true,
    };
  }
}
