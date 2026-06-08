import type { AIReasoningProvider, FundingPrecheckInput, FundingPrecheckResult } from './types';
import type { ContractCheckInput, ContractCheckResult } from './contract-check/types';

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

  // ─── Contract check (mock) ────────────────────────────────────────────────────

  async runContractCheck(input: ContractCheckInput): Promise<ContractCheckResult> {
    const name = input.documentName.toLowerCase();

    // Detect fixture scenarios from filename hints
    const hasPrematureStart =
      name.includes('vorzeitigem_beginn') || name.includes('vorzeitiger_beginn');
    const hasGoodContract =
      name.includes('mit_foerdervorbehalt') || name.includes('foerdervorbehalt');
    const missingReservation = name.includes('ohne_foerdervorbehalt');
    const textEmpty = input.extractionStatus === 'empty' || input.extractionStatus === 'failed';

    let overall_assessment: ContractCheckResult['overall_assessment'];
    let risk_level: ContractCheckResult['risk_level'];
    let confidence: ContractCheckResult['confidence'];

    if (textEmpty) {
      overall_assessment = 'needs_revision';
      risk_level = 'yellow';
      confidence = 'low';
    } else if (hasPrematureStart) {
      overall_assessment = 'critical';
      risk_level = 'red';
      confidence = 'medium';
    } else if (missingReservation) {
      overall_assessment = 'needs_revision';
      risk_level = 'red';
      confidence = 'medium';
    } else if (hasGoodContract) {
      overall_assessment = 'pass';
      risk_level = 'green';
      confidence = 'medium';
    } else {
      overall_assessment = 'needs_revision';
      risk_level = 'yellow';
      confidence = 'low';
    }

    const prematureDetected = hasPrematureStart;
    const reservationPresent = hasGoodContract && !missingReservation && !hasPrematureStart;

    const summary = textEmpty
      ? 'Aus dem PDF konnte kein Text gelesen werden. Für gescannte PDFs wird später OCR benötigt. Eine inhaltliche Prüfung ist nicht möglich.'
      : hasPrematureStart
        ? 'Der Vertrag enthält eine Klausel, die einen vorzeitigen Maßnahmenbeginn signalisiert. Dies gefährdet die KfW-Förderung. Der Vertrag muss vor Antragstellung korrigiert werden.'
        : missingReservation
          ? 'Der Vertrag enthält keinen erkennbaren Fördervorbehalt. Eine aufschiebende oder auflösende Bedingung geknüpft an die KfW Förderzusage fehlt. Der Vertrag muss vor Antragstellung überarbeitet werden.'
          : hasGoodContract
            ? 'Der Vertrag enthält einen Fördervorbehalt. Kein vorzeitiger Beginn erkennbar. Der Vertrag ist förderrechtlich grundsätzlich plausibel. Manuelle Prüfung empfohlen.'
            : 'Die Vertragsprüfung konnte auf Basis des verfügbaren Textes keine eindeutige Einschätzung liefern. Manuelle Prüfung erforderlich.';

    return {
      overall_assessment,
      risk_level,
      summary_de: summary,
      detected_contract_type: 'Liefer-/Leistungsvertrag [MOCK]',
      contract_parties: {
        customer_name: null,
        contractor_name: null,
        project_address: input.projectCity ?? null,
      },
      funding_reservation: {
        present: reservationPresent,
        type: reservationPresent ? 'aufschiebend' : 'missing',
        mentions_kfw_funding_approval: reservationPresent,
        relevant_excerpt_de: reservationPresent
          ? '[MOCK] „Dieser Vertrag steht unter der aufschiebenden Bedingung der KfW Förderzusage."'
          : null,
        assessment_de: reservationPresent
          ? 'Fördervorbehalt erkannt und auf KfW Förderzusage bezogen.'
          : 'Kein Fördervorbehalt erkennbar – Vertrag gefährdet Förderung.',
      },
      premature_start_risk: {
        detected: prematureDetected,
        severity: prematureDetected ? 'high' : 'none',
        problematic_excerpt_de: prematureDetected
          ? '[MOCK] „Die Ausführung beginnt unmittelbar nach Unterzeichnung dieses Vertrages."'
          : null,
        assessment_de: prematureDetected
          ? 'Vorzeitige Ausführungsklausel erkannt. Dies gefährdet die KfW-Förderung.'
          : 'Kein vorzeitiger Beginn erkannt.',
      },
      implementation_period: {
        present: !textEmpty,
        excerpt_de: textEmpty ? null : '[MOCK] Ausführungszeitraum: nach KfW-Genehmigung',
        assessment_de: textEmpty
          ? 'Ausführungszeitraum nicht prüfbar – Text nicht lesbar.'
          : 'Ausführungszeitraum vorhanden.',
      },
      missing_or_unclear_items: [
        ...(!reservationPresent && !hasPrematureStart ? ['Fördervorbehalt fehlt oder ist unklar'] : []),
        ...(textEmpty ? ['Vertragstext nicht lesbar (möglicherweise gescanntes PDF)'] : []),
      ],
      critical_findings: prematureDetected
        ? ['Vorzeitige Ausführungsklausel gefunden – Förderung gefährdet']
        : missingReservation
          ? ['Kein Fördervorbehalt vorhanden – Vertrag nicht KfW-konform']
          : [],
      recommended_changes: [
        ...(!reservationPresent
          ? ['Aufschiebende oder auflösende Bedingung geknüpft an KfW Förderzusage hinzufügen']
          : []),
        ...(prematureDetected
          ? ['Klausel zum sofortigen/unmittelbaren Beginn entfernen oder korrigieren']
          : []),
      ],
      safe_clause_suggestion_de: !reservationPresent
        ? '[MOCK] Musterformulierung: „Dieser Vertrag steht unter der aufschiebenden Bedingung der Bewilligung der beantragten KfW-Förderung. Erteilt die KfW keine Förderzusage, tritt dieser Vertrag nicht in Kraft." – Formulierung muss vom Fachbetrieb und ggf. Rechtsberater geprüft werden.'
        : null,
      recommended_next_steps: [
        ...(!reservationPresent
          ? ['Vertrag um korrekten Fördervorbehalt ergänzen lassen']
          : []),
        ...(prematureDetected
          ? ['Sofortausführungsklausel aus dem Vertrag entfernen', 'Korrigierten Vertrag erneut prüfen lassen']
          : []),
        'Manuelle Prüfung durch qualifizierten Sachbearbeiter durchführen',
        ...(overall_assessment === 'pass' ? ['Vertrag kann nach positivem Review als geprüft markiert werden'] : []),
      ],
      customer_message_draft_de: [
        'Sehr geehrte Kundin, sehr geehrter Kunde,',
        '',
        prematureDetected
          ? 'bei der Prüfung Ihres Vertrags wurde eine Klausel zum vorzeitigen Baubeginn festgestellt, die Ihre KfW-Förderung gefährden kann. Bitte besprechen Sie dies mit Ihrem Fachbetrieb und lassen Sie den Vertrag entsprechend anpassen.'
          : !reservationPresent
            ? 'bei der Prüfung Ihres Vertrags wurde festgestellt, dass ein Fördervorbehalt fehlt. Dieser ist für die KfW-Heizungsförderung zwingend erforderlich. Bitte lassen Sie den Vertrag entsprechend ergänzen.'
            : 'Ihr Vertrag wurde geprüft und enthält die wesentlichen Merkmale für die KfW-Heizungsförderung. Die abschließende Prüfung erfolgt durch unseren Sachbearbeiter.',
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
        `Dokument: ${input.documentName}`,
        `Extraktionsstatus: ${input.extractionStatus}`,
        ...(input.pageCount ? [`Seitenanzahl: ${input.pageCount}`] : []),
      ],
      confidence,
      human_review_required: true,
    };
  }
}
