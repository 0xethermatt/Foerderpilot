#!/usr/bin/env node
/**
 * Generates synthetic test documents for Förderpilot V0 manual testing.
 * No real personal data – all names, addresses, and figures are fictional.
 * Run: node generate-test-fixtures.js
 * Requires: pdfkit  (npm install --save-dev pdfkit)
 */

'use strict';

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, 'test-fixtures', 'documents');
fs.mkdirSync(OUT, { recursive: true });

// ─────────────────────────────────────────────────────────────
// Minimal PNG encoder (pure Node.js built-ins only)
// ─────────────────────────────────────────────────────────────
function buildCrcTable() {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
}
const CRC_T = buildCrcTable();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_T[(c ^ buf[i]) & 0xff];
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const lb = Buffer.alloc(4); lb.writeUInt32BE(data.length);
  const tb = Buffer.from(type, 'ascii');
  const cb = Buffer.alloc(4); cb.writeUInt32BE(crc32(Buffer.concat([tb, data])));
  return Buffer.concat([lb, tb, data, cb]);
}
function writePNG(filename, w, h, drawFn) {
  const px = new Uint8Array(w * h * 3).fill(245); // off-white bg
  drawFn(px, w, h);
  const rows = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    rows[y * (1 + w * 3)] = 0; // filter: None
    for (let x = 0; x < w; x++) {
      const pi = (y * w + x) * 3, ri = y * (1 + w * 3) + 1 + x * 3;
      rows[ri] = px[pi]; rows[ri + 1] = px[pi + 1]; rows[ri + 2] = px[pi + 2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const buf = Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(rows, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(path.join(OUT, filename), buf);
  console.log('Created:', filename);
}
function fillRect(px, w, x0, y0, rw, rh, r, g, b) {
  for (let y = y0; y < y0 + rh; y++)
    for (let x = x0; x < x0 + rw; x++) {
      const i = (y * w + x) * 3;
      if (i >= 0 && i + 2 < px.length) { px[i] = r; px[i + 1] = g; px[i + 2] = b; }
    }
}
function drawHLine(px, w, x0, y0, len, r, g, b) { fillRect(px, w, x0, y0, len, 2, r, g, b); }
function drawVLine(px, w, x0, y0, len, r, g, b) { fillRect(px, w, x0, y0, 2, len, r, g, b); }

// 3x5 pixel micro-font for digits + a few letters  (column-encoded, LSB = top)
const MICRO = {
  '0': [0x1f, 0x11, 0x1f], '1': [0x12, 0x1f, 0x10], '2': [0x1d, 0x15, 0x17],
  '3': [0x11, 0x15, 0x1f], '4': [0x07, 0x04, 0x1f], '5': [0x17, 0x15, 0x1d],
  '6': [0x1f, 0x15, 0x1d], '7': [0x01, 0x01, 0x1f], '8': [0x1f, 0x15, 0x1f],
  '9': [0x17, 0x15, 0x1f], ' ': [0, 0, 0], '.': [0x10, 0, 0],
  'T': [0x01, 0x1f, 0x01], 'E': [0x1f, 0x15, 0x11], 'S': [0x17, 0x15, 0x1d],
  'A': [0x1f, 0x05, 0x1f], 'F': [0x1f, 0x05, 0x01], 'O': [0x1f, 0x11, 0x1f],
  'B': [0x1f, 0x15, 0x1f], 'J': [0x18, 0x10, 0x1f], 'R': [0x1f, 0x05, 0x1b],
  'H': [0x1f, 0x04, 0x1f], 'L': [0x1f, 0x10, 0x10], 'I': [0x11, 0x1f, 0x11],
  'Z': [0x19, 0x15, 0x13], 'G': [0x1f, 0x15, 0x1d], 'N': [0x1f, 0x02, 0x1f],
  'W': [0x1f, 0x0c, 0x1f], 'K': [0x1f, 0x04, 0x1b], ':': [0x0a, 0, 0],
};
function drawText(px, w, text, x0, y0, scale, r, g, b) {
  let cx = x0;
  for (const ch of text.toUpperCase()) {
    const col = MICRO[ch] || MICRO[' '];
    for (let ci = 0; ci < col.length; ci++) {
      for (let ri = 0; ri < 5; ri++) {
        if (col[ci] & (1 << ri)) fillRect(px, w, cx + ci * scale, y0 + ri * scale, scale, scale, r, g, b);
      }
    }
    cx += (col.length + 1) * scale;
  }
}

// ─────────────────────────────────────────────────────────────
// PDF helpers
// ─────────────────────────────────────────────────────────────
function createPDF(filename, drawFn) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: filename } });
    const fp = path.join(OUT, filename);
    const stream = fs.createWriteStream(fp);
    doc.pipe(stream);
    drawFn(doc);
    doc.end();
    stream.on('finish', () => { console.log('Created:', filename); resolve(); });
    stream.on('error', reject);
  });
}

const RED = '#CC0000';
const DARK = '#1a1a1a';
const GRAY = '#555555';
const LGRAY = '#e8e8e8';
const GREEN = '#1a7a2e';

function addTestBanner(doc) {
  doc.save()
     .fontSize(7).fillColor(RED)
     .text('★  TESTDOKUMENT – KEINE ECHTEN KUNDENDATEN – NUR FÜR INTERNE TESTZWECKE  ★',
           50, doc.y, { align: 'center', width: 495 })
     .restore();
}

function addRedBar(doc, title, subtitle) {
  doc.rect(50, doc.y, 495, 4).fill(RED).moveDown(0.3);
  doc.fontSize(8).fillColor(RED).font('Helvetica-Bold')
     .text('⚠  TESTDOKUMENT  ⚠', { align: 'center' }).moveDown(0.2);
  doc.fontSize(15).fillColor(DARK).font('Helvetica-Bold').text(title).moveDown(0.1);
  if (subtitle) doc.fontSize(10).fillColor(GRAY).font('Helvetica').text(subtitle).moveDown(0.2);
  doc.rect(50, doc.y, 495, 1).fill('#bbb').moveDown(0.6);
  doc.font('Helvetica').fillColor(DARK);
}

function addPageFooter(doc, page) {
  const y = 792;
  doc.fontSize(7).fillColor('#aaa')
     .text(`TESTDOKUMENT · Keine echten Kunden- oder Unternehmensdaten · Seite ${page}`,
           50, y, { width: 495, align: 'center' });
}

function sectionHead(doc, text) {
  doc.moveDown(0.5)
     .rect(50, doc.y, 495, 18).fill(LGRAY)
     .fontSize(10).fillColor(DARK).font('Helvetica-Bold')
     .text(text, 55, doc.y - 15).moveDown(0.4)
     .font('Helvetica');
}

function kvRow(doc, label, value, indent = 0) {
  const x = 50 + indent;
  const lw = 200;
  const y = doc.y;
  doc.fontSize(9).fillColor(GRAY).text(label, x, y, { width: lw, continued: false });
  doc.fontSize(9).fillColor(DARK).text(value, x + lw, y, { width: 495 - lw - indent });
  doc.moveDown(0.1);
}

function positionRow(doc, nr, desc, einheit, menge, ep, gp) {
  const y = doc.y;
  const colW = [25, 195, 55, 35, 65, 65];
  const cols = [50, 75, 270, 325, 360, 430];
  doc.fontSize(8.5).fillColor(DARK);
  doc.text(nr.toString(), cols[0], y, { width: colW[0] });
  doc.text(desc, cols[1], y, { width: colW[1] });
  doc.text(einheit, cols[2], y, { width: colW[2], align: 'right' });
  doc.text(menge, cols[3], y, { width: colW[3], align: 'right' });
  doc.text(ep, cols[4], y, { width: colW[4], align: 'right' });
  doc.text(gp, cols[5], y, { width: colW[5], align: 'right' });
  doc.moveDown(0.3);
  if (nr !== '') {
    doc.moveTo(50, doc.y).lineTo(495, doc.y).lineWidth(0.3).strokeColor('#ddd').stroke();
    doc.moveDown(0.15);
  }
}

function positionHeader(doc) {
  doc.rect(50, doc.y, 495, 16).fill('#ddeeff');
  const y = doc.y + 2;
  const cols = [50, 75, 270, 325, 360, 430];
  doc.fontSize(8).fillColor(DARK).font('Helvetica-Bold');
  doc.text('Pos.', cols[0], y, { width: 25 });
  doc.text('Bezeichnung', cols[1], y, { width: 195 });
  doc.text('Einheit', cols[2], y, { width: 55, align: 'right' });
  doc.text('Menge', cols[3], y, { width: 35, align: 'right' });
  doc.text('EP (€)', cols[4], y, { width: 65, align: 'right' });
  doc.text('GP (€)', cols[5], y, { width: 65, align: 'right' });
  doc.font('Helvetica').moveDown(1.2);
}

function totalRow(doc, label, value, bold = false) {
  doc.rect(50, doc.y, 495, 16).fill(bold ? '#ddeeff' : LGRAY);
  const y = doc.y + 3;
  doc.fontSize(9).fillColor(DARK).font(bold ? 'Helvetica-Bold' : 'Helvetica');
  doc.text(label, 300, y, { width: 190 });
  doc.text(value, 490, y, { width: 55, align: 'right' });
  doc.font('Helvetica').moveDown(1.1);
}

// ─────────────────────────────────────────────────────────────
// Document 1: Vollständiges Angebot
// ─────────────────────────────────────────────────────────────
async function doc01() {
  await createPDF('01_angebot_vollstaendig.pdf', (doc) => {
    // ---- Page 1 ----
    addRedBar(doc, 'Angebot Nr. 2024-0471', 'Wärmepumpenanlage Einfamilienhaus – vollständiges Angebot');

    sectionHead(doc, 'Auftragnehmer');
    kvRow(doc, 'Firma', 'Haustechnik Frey Muster GmbH');
    kvRow(doc, 'Straße', 'Musterstraße 42');
    kvRow(doc, 'PLZ/Ort', '12345 Musterstadt');
    kvRow(doc, 'Tel.', '+49 123 456780');
    kvRow(doc, 'E-Mail', 'info@haustechnik-frey-muster.test');
    kvRow(doc, 'Meisterbetrieb', 'SHK-Innung Musterkreis, Reg.-Nr. 99-0042');

    sectionHead(doc, 'Auftraggeber / Bauherr');
    kvRow(doc, 'Name', 'Max Mustermann');
    kvRow(doc, 'Straße', 'Birkenweg 7');
    kvRow(doc, 'PLZ/Ort', '54321 Testdorf');
    kvRow(doc, 'Objekt', 'Einfamilienhaus, Birkenweg 7, 54321 Testdorf');

    sectionHead(doc, 'Projektbeschreibung');
    kvRow(doc, 'Maßnahme', 'Austausch der bestehenden Ölheizungsanlage gegen eine Luft-Wasser-Wärmepumpe');
    kvRow(doc, 'Bestandsanlage', 'Ölkessel Typ MusterTherm MH-22, Baujahr 1999, Nennleistung 22 kW');
    kvRow(doc, 'Neue Anlage', 'Viessmann Vitocal 250-A AWO-E-AC 251.A10 (Luft-Wasser-WP, monovalent)');
    kvRow(doc, 'Heizleistung', 'ca. 10 kW bei A-7/W35 (EN14511)');
    kvRow(doc, 'Anlagentyp', 'Monoblock-Außengerät mit Inneneinheit');
    kvRow(doc, 'Förderprogramm', 'KfW-Heizungsförderung (BEG EZ, KfW-Programm 458) – Antragstellung ausschließlich über Meine KfW (kfw.de)');
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor(GRAY)
       .text('Angebotsnummer: 2024-0471  |  Datum: 03.09.2024  |  Gültig bis: 03.12.2024', { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor(RED).font('Helvetica-Bold')
       .text('Geplanter Ausführungszeitraum: 15.01.2025 – 28.02.2025')
       .font('Helvetica').fillColor(DARK);

    // ---- Page 2: Leistungsverzeichnis ----
    doc.addPage();
    addTestBanner(doc);
    doc.moveDown(0.4);
    doc.fontSize(12).font('Helvetica-Bold').text('Leistungsverzeichnis').font('Helvetica').moveDown(0.5);

    positionHeader(doc);

    positionRow(doc, 1, 'Demontage und fachgerechte Entsorgung\nÖlheizkessel, Öltank (2000 L erdvergraben),\nRohrleitungen und Zubehör gemäß EfBV',
                'pauschal', '1', '1.850,00', '1.850,00');
    positionRow(doc, 2, 'Lieferung Außengerät Viessmann Vitocal 250-A\nAWO-E-AC 251.A10, monovalent,\ninkl. Kältemittel R290',
                'Stk.', '1', '5.980,00', '5.980,00');
    positionRow(doc, 3, 'Lieferung Inneneinheit Viessmann Vitotronic\nHydromodul HEM-A, integrierte\nElektroheizung 9 kW als Backup',
                'Stk.', '1', '1.240,00', '1.240,00');
    positionRow(doc, 4, 'Warmwasserspeicher Viessmann Vitocell 100-W\n300 Liter, stehend, emailliert, Magnesiumanode',
                'Stk.', '1', '890,00', '890,00');
    positionRow(doc, 5, 'Pufferspeicher 200 L für hydraulische\nEntkopplung Wärmepumpe / Heizkreis',
                'Stk.', '1', '680,00', '680,00');
    positionRow(doc, 6, 'Hydraulische Einbindung: Vor- und Rücklauf,\nAbsperrventile, Sicherheitsgruppe,\nExpansionsgefäß 18 L, Manometer',
                'pauschal', '1', '1.450,00', '1.450,00');
    positionRow(doc, 7, 'Elektroarbeiten: Unterverteiler WP,\nSteuerleitung, Netzanschluss 400 V / 32 A,\nSmart-Grid-Schnittstelle',
                'pauschal', '1', '1.100,00', '1.100,00');
    positionRow(doc, 8, 'Hydraulischer Abgleich nach Verfahren B\n(VdZ-Formblatt), inkl. Einregulierung aller\nHeizkörper und FBH-Kreise',
                'pauschal', '1', '480,00', '480,00');
    positionRow(doc, 9, 'Inbetriebnahme, Einweisung Betreiber,\nÜbergabe Dokumentation und\nPrüfbericht gemäß BEG-Anforderungen',
                'pauschal', '1', '320,00', '320,00');
    positionRow(doc, 10, 'Förderfähige Umfeldmaßnahmen:\nEinbau Thermostatventile an allen\nHeizkörpern (16 Stk.), Dämmung Verteiler',
                'pauschal', '1', '760,00', '760,00');
    positionRow(doc, 11, 'Baustelleneinrichtung, Schutzmaßnahmen,\nEntsorgung Verpackung',
                'pauschal', '1', '180,00', '180,00');

    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(495, doc.y).lineWidth(1).strokeColor('#333').stroke().moveDown(0.3);
    totalRow(doc, 'Netto-Gesamtbetrag', '14.930,00 €');
    totalRow(doc, 'Mehrwertsteuer 19 %', '2.836,70 €');
    totalRow(doc, 'Brutto-Gesamtbetrag', '17.766,70 €', true);
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor(GREEN).font('Helvetica-Bold')
       .text('Davon voraussichtlich förderfähige Kosten (netto): ca. 12.460,00 €')
       .font('Helvetica').fillColor(DARK);

    // ---- Page 3: Bedingungen ----
    doc.addPage();
    addTestBanner(doc);
    doc.moveDown(0.4);

    sectionHead(doc, 'Zahlungsbedingungen');
    doc.fontSize(9).text(
      '• 30 % bei Auftragserteilung\n' +
      '• 50 % nach Lieferung der Hauptkomponenten auf Baustelle\n' +
      '• 20 % nach Abnahme und Übergabe der vollständigen Dokumentation\n' +
      'Zahlungsziel: 14 Tage netto nach Rechnungsdatum.'
    ).moveDown(0.5);

    sectionHead(doc, 'Hinweise zu Fördervoraussetzungen');
    doc.fontSize(9).text(
      'Dieser Auftrag steht unter dem Vorbehalt der KfW-Förderzusage im Rahmen der ' +
      'KfW-Heizungsförderung (BEG EZ, KfW-Programm 458). Die Ausführung darf erst nach Erhalt der ' +
      'KfW-Förderzusage und schriftlicher Freigabe durch den Auftraggeber beginnen.\n\n' +
      'Voraussetzungen gemäß KfW-Heizungsförderung:\n' +
      '• COP ≥ 3,0 (EN 14511, A-7/W35 oder A2/W35)\n' +
      '• JAZ ≥ 3,0 für die Heizungsanlage\n' +
      '• Nachweis hydraulischer Abgleich nach Verfahren B\n' +
      '• BzA (Bestätigung zum Antrag) durch zugelassenen Energieberater vor Antragstellung\n' +
      '• Fachunternehmerbestätigung durch ausführenden SHK-Betrieb\n' +
      '• Antragstellung ausschließlich im KfW-Portal „Meine KfW" (kfw.de)'
    ).moveDown(0.5);

    sectionHead(doc, 'Ausführungszeitraum');
    doc.fontSize(9).text(
      'Geplanter Beginn:  15. Januar 2025\n' +
      'Geplantes Ende:    28. Februar 2025\n\n' +
      'Bindefrist dieses Angebots: 03. Dezember 2024\n' +
      'Wichtig: Die Maßnahme darf erst nach Eingang der KfW-Förderzusage begonnen werden.'
    ).moveDown(0.5);

    sectionHead(doc, 'Gewährleistung');
    doc.fontSize(9).text(
      '• Auf Arbeitsleistungen: 5 Jahre gemäß VOB/B\n' +
      '• Auf Viessmann-Geräte: 2 Jahre gesetzlich, optional 5 Jahre Hersteller-Garantie (Verlängerung\n' +
      '  durch Registrierung unter viessmann.de/garantie)\n' +
      '• Serviceverträge auf Anfrage'
    ).moveDown(0.5);

    doc.fontSize(8).fillColor(GRAY)
       .text('Alle Preise verstehen sich in Euro, netto zzgl. gesetzlicher Mehrwertsteuer. Irrtümer und Druckfehler vorbehalten.\n' +
             'Es gelten unsere allgemeinen Geschäftsbedingungen sowie die VOB/B in der aktuellen Fassung.');

    doc.moveDown(1.5);
    doc.fontSize(9).fillColor(DARK)
       .text('______________________________                    ______________________________', 50, doc.y)
       .text('Musterstadt, den ________________                    Testdorf, den ________________', 50, doc.y + 3)
       .text('Haustechnik Frey Muster GmbH                         Max Mustermann (Auftraggeber)', 50, doc.y + 3);

    addPageFooter(doc, '1 / 3');
  });
}

// ─────────────────────────────────────────────────────────────
// Document 2: Unvollständiges Angebot
// ─────────────────────────────────────────────────────────────
async function doc02() {
  await createPDF('02_angebot_unvollstaendig.pdf', (doc) => {
    addRedBar(doc, 'Angebot Nr. 2024-0388', 'Heizungstausch – UNVOLLSTÄNDIGES ANGEBOT (Testfall)');

    sectionHead(doc, 'Auftragnehmer');
    kvRow(doc, 'Firma', 'Muster Heizung & Sanitär');
    kvRow(doc, 'PLZ/Ort', '99999 Beispielort');

    sectionHead(doc, 'Auftraggeber');
    kvRow(doc, 'Name', 'Erika Musterfrau');
    kvRow(doc, 'Adresse', 'Testgasse 3, 99998 Beispieldorf');

    sectionHead(doc, 'Projektbeschreibung');
    kvRow(doc, 'Maßnahme', 'Einbau einer Wärmepumpe');
    kvRow(doc, 'Bestandsanlage', 'Alte Ölheizung (Baujahr unbekannt)');
    kvRow(doc, 'Neue Anlage', '⚠  FEHLT: Kein genaues Modell angegeben – nur „Wärmepumpe, ca. 10 kW"');
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor(RED).font('Helvetica-Bold')
       .text('⚠  Kein geplanter Ausführungszeitraum angegeben!')
       .font('Helvetica').fillColor(DARK);

    doc.moveDown(0.5);
    sectionHead(doc, 'Leistungsverzeichnis (unvollständig / Pauschalangebot)');
    positionHeader(doc);
    positionRow(doc, 1, 'Heizungseinbau komplett\n(Pauschalangebot, keine Einzelpositionen)',
                'Psch.', '1', '???', '14.500,00');
    positionRow(doc, 2, 'Sonstiges Material', 'Psch.', '1', '???', '2.000,00');
    positionRow(doc, '', '⚠  FEHLT: Hydraulischer Abgleich nicht aufgeführt', '', '', '', '');
    positionRow(doc, '', '⚠  FEHLT: Warmwasserspeicher nicht separat ausgewiesen', '', '', '', '');
    positionRow(doc, '', '⚠  FEHLT: Inbetriebnahme nicht aufgeführt', '', '', '', '');

    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(495, doc.y).lineWidth(1).strokeColor('#333').stroke().moveDown(0.3);
    totalRow(doc, 'Gesamtbetrag (brutto)', '19.635,00 €', true);

    doc.moveDown(0.8);
    doc.fontSize(9).fillColor(RED).font('Helvetica-Bold')
       .text('Erkannte Mängel (Testdokumentation):', { underline: true }).font('Helvetica');
    doc.fontSize(9).fillColor(RED).text(
      '1. Kein exaktes Wärmepumpenmodell – KfW-Förderfähigkeit (Programm 458) nicht prüfbar\n' +
      '2. Hydraulischer Abgleich Verfahren B fehlt – BEG-Pflichtnachweis!\n' +
      '3. Pauschalpreise ohne Einzelpositionen – Förderfähigkeit nicht belegbar\n' +
      '4. Kein geplanter Ausführungszeitraum – Planung der Antragstellung unklar\n' +
      '5. Kein Hinweis auf Förderung oder Voraussetzungen\n' +
      '6. Entsorgungsnachweis Altanlage fehlt'
    );

    addPageFooter(doc, '1 / 1');
  });
}

// ─────────────────────────────────────────────────────────────
// Document 3: Vertrag mit Förderungsvorbehalt
// ─────────────────────────────────────────────────────────────
async function doc03() {
  await createPDF('03_vertrag_mit_foerdervorbehalt.pdf', (doc) => {
    addRedBar(doc, 'Lieferungs- und Leistungsvertrag', 'Nr. V-2024-0471 · mit Fördervorbehalt (KfW-Heizungsförderung, KfW 458)');

    sectionHead(doc, 'Vertragsparteien');
    kvRow(doc, 'Auftragnehmer (AN)', 'Haustechnik Frey Muster GmbH, Musterstraße 42, 12345 Musterstadt');
    kvRow(doc, 'Auftraggeber (AG)', 'Max Mustermann, Birkenweg 7, 54321 Testdorf');
    kvRow(doc, 'Vertragsdatum', '10. September 2024');
    kvRow(doc, 'Grundlage', 'Angebot Nr. 2024-0471 vom 03.09.2024 (Anlage 1)');

    sectionHead(doc, '§ 1  Vertragsgegenstand');
    doc.fontSize(9).text(
      'Gegenstand dieses Vertrages ist die Lieferung und fachgerechte Installation einer ' +
      'Luft-Wasser-Wärmepumpenanlage (Viessmann Vitocal 250-A AWO-E-AC 251.A10) einschließlich ' +
      'aller im Angebot Nr. 2024-0471 aufgeführten Leistungen am Objekt Birkenweg 7, 54321 Testdorf, ' +
      'gemäß dem beiliegenden Leistungsverzeichnis (Anlage 1).'
    ).moveDown(0.5);

    sectionHead(doc, '§ 2  Vergütung');
    doc.fontSize(9).text(
      'Netto-Vergütung:   14.930,00 €\n' +
      'MwSt. 19 %:          2.836,70 €\n' +
      'Brutto-Vergütung: 17.766,70 €\n\n' +
      'Zahlungsplan: 30 % Anzahlung bei Auftragserteilung (wirksam nach Bedingung § 4), ' +
      '50 % bei Lieferung der Geräte, 20 % nach Abnahme.'
    ).moveDown(0.5);

    sectionHead(doc, '§ 3  Ausführungszeitraum');
    doc.fontSize(9).text(
      'Der Ausführungsbeginn ist für den 15. Januar 2025 vorgesehen, das Ausführungsende spätestens ' +
      'am 28. Februar 2025.\n\n' +
      'Die Termine stehen unter dem Vorbehalt des § 4 (Aufschiebende Bedingung – Förderzusage). ' +
      'Bei Verzögerung der Förderzusage verschieben sich die Termine entsprechend.'
    ).moveDown(0.5);

    doc.addPage();
    addTestBanner(doc);
    doc.moveDown(0.5);

    sectionHead(doc, '§ 4  Fördervorbehalt / Bedingte Wirksamkeit (WESENTLICHE VERTRAGSKLAUSEL)');
    doc.rect(50, doc.y, 495, 3).fill(GREEN).moveDown(0.3);
    doc.fontSize(9).fillColor(GREEN).font('Helvetica-Bold')
       .text('§ 4.1  Aufschiebende Bedingung – KfW-Förderzusage').font('Helvetica').fillColor(DARK);
    doc.fontSize(9).text(
      'Dieser Vertrag steht unter der aufschiebenden Bedingung (§ 158 Abs. 1 BGB), dass dem ' +
      'Auftraggeber eine Förderzusage durch die KfW im Rahmen der KfW-Heizungsförderung ' +
      '(BEG EZ, Programm 458) erteilt wird.\n\n' +
      'Dieser Vertrag wird vor der Antragstellung bei KfW abgeschlossen und als Anlage zum ' +
      'KfW-Antrag im Portal „Meine KfW" (kfw.de) hochgeladen. Die Unterzeichnung dieses Vertrags ' +
      'begründet keinen Ausführungsbeginn. Die Leistungen werden erst ausgeführt, wenn die ' +
      'KfW-Förderzusage vorliegt und der Auftraggeber die schriftliche Ausführungsfreigabe erteilt hat.'
    ).moveDown(0.5);

    doc.fontSize(9).fillColor(GREEN).font('Helvetica-Bold')
       .text('§ 4.2  Ausführungsverbot vor KfW-Förderzusage').font('Helvetica').fillColor(DARK);
    doc.fontSize(9).text(
      'Die Ausführung der Leistungen darf NICHT vor Erhalt der KfW-Förderzusage und ausdrücklicher ' +
      'schriftlicher Freigabe durch den Auftraggeber beginnen.\n\n' +
      'Ein vorzeitiger Maßnahmenbeginn vor Eingang der KfW-Förderzusage führt gemäß KfW-Richtlinie ' +
      '(BEG EZ, Programm 458) zum vollständigen Verlust des KfW-Förderanspruchs. Als vorzeitiger ' +
      'Beginn gilt jede Beauftragung oder Ausführungshandlung vor Eingang der Förderzusage.'
    ).moveDown(0.5);

    doc.fontSize(9).fillColor(GREEN).font('Helvetica-Bold')
       .text('§ 4.3  Auflösende Bedingung bei Nichtgewährung').font('Helvetica').fillColor(DARK);
    doc.fontSize(9).text(
      'Wird die KfW-Förderzusage innerhalb von sechs (6) Monaten ab Vertragsdatum nicht erteilt, ' +
      'tritt dieser Vertrag unter der auflösenden Bedingung (§ 158 Abs. 2 BGB) außer Kraft. ' +
      'Der Auftraggeber kann kostenfrei zurücktreten. Der Auftragnehmer hat in diesem Fall keinen ' +
      'Anspruch auf Schadensersatz oder entgangenen Gewinn.'
    ).moveDown(0.5);

    sectionHead(doc, '§ 5  Sonstige Bestimmungen');
    doc.fontSize(9).text(
      'Erfüllungsort und Gerichtsstand ist Musterstadt. Es gilt deutsches Recht. ' +
      'Nebenabreden bedürfen der Schriftform. Im Übrigen gelten die VOB/B und die ' +
      'AGB der Haustechnik Frey Muster GmbH (Anlage 2).'
    ).moveDown(1);

    doc.fontSize(9).fillColor(DARK)
       .text('Musterstadt / Testdorf, den 10. September 2024', 50, doc.y).moveDown(1.5);
    doc.text('______________________________           ______________________________')
       .text('Haustechnik Frey Muster GmbH             Max Mustermann')
       .text('(Auftragnehmer)                           (Auftraggeber)');

    doc.moveDown(1);
    doc.rect(50, doc.y, 495, 2).fill(GREEN).moveDown(0.3);
    doc.fontSize(8).fillColor(GREEN).font('Helvetica-Bold')
       .text('✓  Dieser Vertrag enthält einen ordnungsgemäßen Fördervorbehalt (aufschiebende/auflösende Bedingung) gemäß KfW-Heizungsförderung (KfW 458).')
       .font('Helvetica').fillColor(DARK);

    addPageFooter(doc, '2 / 2');
  });
}

// ─────────────────────────────────────────────────────────────
// Document 4: Vertrag OHNE Förderungsvorbehalt
// ─────────────────────────────────────────────────────────────
async function doc04() {
  await createPDF('04_vertrag_ohne_foerdervorbehalt.pdf', (doc) => {
    addRedBar(doc, 'Lieferungs- und Leistungsvertrag', 'Nr. V-2024-0388 · OHNE Fördervorbehalt (Testfall)');

    sectionHead(doc, 'Vertragsparteien');
    kvRow(doc, 'Auftragnehmer (AN)', 'Muster Heizung & Sanitär, Teststraße 1, 99999 Beispielort');
    kvRow(doc, 'Auftraggeber (AG)', 'Erika Musterfrau, Testgasse 3, 99998 Beispieldorf');
    kvRow(doc, 'Vertragsdatum', '05. Oktober 2024');

    sectionHead(doc, '§ 1  Vertragsgegenstand');
    doc.fontSize(9).text(
      'Lieferung und Montage einer Wärmepumpenanlage am Objekt Testgasse 3, 99998 Beispieldorf, ' +
      'gemäß Angebot Nr. 2024-0388 vom 01.10.2024. Der Auftragnehmer verpflichtet sich zur ' +
      'fachgerechten Ausführung aller im Angebot aufgeführten Leistungen.'
    ).moveDown(0.5);

    sectionHead(doc, '§ 2  Vergütung und Zahlung');
    doc.fontSize(9).text(
      'Gesamtvergütung (brutto): 19.635,00 €\n' +
      'Zahlungsbedingungen: 50 % Anzahlung, 50 % nach Abnahme. Zahlungsziel 14 Tage netto.'
    ).moveDown(0.5);

    sectionHead(doc, '§ 3  Ausführungstermin');
    doc.fontSize(9).text(
      'Die Arbeiten werden voraussichtlich im Zeitraum November/Dezember 2024 ausgeführt. ' +
      'Ein verbindlicher Starttermin wird nach Auftragserteilung abgestimmt.'
    ).moveDown(0.5);

    sectionHead(doc, '§ 4  Gewährleistung');
    doc.fontSize(9).text(
      'Für Mängel der Werkleistung gewährt der Auftragnehmer Gewährleistung gemäß gesetzlichen ' +
      'Vorschriften (§§ 634 ff. BGB), Gewährleistungsfrist 2 Jahre ab Abnahme. Auf Materialien ' +
      'und Geräte gilt die jeweilige Herstellergarantie.'
    ).moveDown(0.5);

    sectionHead(doc, '§ 5  Sonstiges');
    doc.fontSize(9).text(
      'Es gelten die AGB des Auftragnehmers. Gerichtsstand: Beispielort.'
    ).moveDown(1);

    doc.fontSize(9).fillColor(DARK)
       .text('Beispielort / Beispieldorf, den 05. Oktober 2024', 50, doc.y).moveDown(1.5);
    doc.text('______________________________           ______________________________')
       .text('Muster Heizung & Sanitär                  Erika Musterfrau')
       .text('(Auftragnehmer)                           (Auftraggeber)');

    doc.moveDown(1.5);
    doc.rect(50, doc.y, 495, 2).fill(RED).moveDown(0.3);
    doc.fontSize(8).fillColor(RED).font('Helvetica-Bold')
       .text('⚠  ACHTUNG TESTFALL: Dieser Vertrag enthält KEINEN Fördervorbehalt!')
       .font('Helvetica');
    doc.fontSize(8).fillColor(RED).text(
      'Gemäß BEG-Richtlinie muss jeder Werkvertrag, der vor Eingang der Förderzusage abgeschlossen wird, ' +
      'eine aufschiebende Bedingung oder einen ausdrücklichen Fördervorbehalt enthalten. ' +
      'Das Fehlen dieser Klausel kann zur Ablehnung des Förderantrags führen.'
    ).fillColor(DARK);

    addPageFooter(doc, '1 / 1');
  });
}

// ─────────────────────────────────────────────────────────────
// Document 5: Vertrag mit vorzeitigem Beginn
// ─────────────────────────────────────────────────────────────
async function doc05() {
  await createPDF('05_vertrag_mit_vorzeitigem_beginn.pdf', (doc) => {
    addRedBar(doc, 'Lieferungs- und Leistungsvertrag', 'Nr. V-2024-0399 · VORZEITIGER BEGINN (Testfall)');

    sectionHead(doc, 'Vertragsparteien');
    kvRow(doc, 'Auftragnehmer (AN)', 'Schnell-Montage Haustechnik GbR, Eilstraße 10, 88888 Schnellhausen');
    kvRow(doc, 'Auftraggeber (AG)', 'Hans-Peter Mustermeier, Hauptstraße 22, 77777 Testheim');
    kvRow(doc, 'Vertragsdatum', '12. November 2024');

    sectionHead(doc, '§ 1  Vertragsgegenstand');
    doc.fontSize(9).text(
      'Lieferung und Montage einer Wärmepumpenanlage (Typ: Stiebel Eltron WPL 15 AC) am Objekt ' +
      'Hauptstraße 22, 77777 Testheim. Leistungsumfang gemäß Angebot Nr. SE-2024-0399.'
    ).moveDown(0.5);

    sectionHead(doc, '§ 2  Ausführungsbeginn');
    doc.rect(50, doc.y, 495, 3).fill(RED).moveDown(0.3);
    doc.fontSize(10).fillColor(RED).font('Helvetica-Bold')
       .text('⚠  PROBLEMATISCHE VERTRAGSKLAUSEL (BEG-schädlich):').font('Helvetica');
    doc.moveDown(0.2);
    doc.rect(50, doc.y, 495, 40).fill('#fff0f0').moveDown(0.1);
    doc.fontSize(11).fillColor('#aa0000').font('Helvetica-BoldOblique')
       .text('"Die Ausführung beginnt unmittelbar nach Unterzeichnung."', 60, doc.y, { width: 480 })
       .font('Helvetica').fillColor(DARK);
    doc.moveDown(0.5);
    doc.fontSize(9).text(
      'Die Arbeiten sollen demnach ab 13. November 2024 beginnen. Zum Zeitpunkt der ' +
      'Vertragsunterzeichnung liegt noch keine Förderzusage vor.'
    ).moveDown(0.5);

    sectionHead(doc, '§ 3  Vergütung');
    doc.fontSize(9).text(
      'Gesamtvergütung (brutto): 16.800,00 €\n' +
      'Zahlungsbedingungen: 40 % bei Auftragserteilung, 60 % nach Abnahme.'
    ).moveDown(0.5);

    sectionHead(doc, '§ 4  Sonstiges');
    doc.fontSize(9).text(
      'Es gelten die AGB der Schnell-Montage Haustechnik GbR. Förderung wird angestrebt, ' +
      'aber nicht garantiert.'
    ).moveDown(1);

    doc.fontSize(9).fillColor(DARK)
       .text('Schnellhausen / Testheim, den 12. November 2024', 50, doc.y).moveDown(1.5);
    doc.text('______________________________           ______________________________')
       .text('Schnell-Montage Haustechnik GbR          Hans-Peter Mustermeier')
       .text('(Auftragnehmer)                           (Auftraggeber)');

    doc.moveDown(1.5);
    doc.rect(50, doc.y, 495, 2).fill(RED).moveDown(0.3);
    doc.fontSize(8).fillColor(RED).font('Helvetica-Bold')
       .text('⚠  TESTFALL: Vorzeitiger Maßnahmenbeginn vor Förderzusage!').font('Helvetica');
    doc.fontSize(8).fillColor(RED).text(
      'Die Klausel "Ausführung beginnt unmittelbar nach Unterzeichnung" begründet einen ' +
      'vorzeitigen Maßnahmenbeginn im Sinne der BEG-Richtlinie, da die Maßnahme vor Eingang ' +
      'der Förderzusage begonnen würde. Dies führt zur Ablehnung des Förderantrags.\n' +
      'Förderpilot sollte dieses Dokument als "nicht förderfähig – vorzeitiger Beginn" einstufen.'
    ).fillColor(DARK);

    addPageFooter(doc, '1 / 1');
  });
}

// ─────────────────────────────────────────────────────────────
// Document 6: Eigentumsnachweis (Mock)
// ─────────────────────────────────────────────────────────────
async function doc06() {
  await createPDF('06_eigentumsnachweis_mock.pdf', (doc) => {
    addRedBar(doc, 'Eigentumsnachweis – Grundbuchauszug (Muster)', 'Testdorf, Gemarkung Testdorf, Flur 4, Flurstück 212');

    doc.rect(50, doc.y, 495, 1).fill('#888').moveDown(0.3);
    doc.fontSize(8).fillColor(RED).font('Helvetica-Bold')
       .text('HINWEIS: Dies ist ein synthetisch erstellter Eigentumsnachweis zu Testzwecken.')
       .text('Es handelt sich NICHT um einen echten Grundbuchauszug. Keine realen Eigentümerdaten.')
       .font('Helvetica').fillColor(DARK).moveDown(0.5);

    sectionHead(doc, 'Angaben laut Grundbuch (FIKTIV)');
    kvRow(doc, 'Amtsgericht', 'Amtsgericht Testdorf (fiktiv)');
    kvRow(doc, 'Grundbuch von', 'Testdorf');
    kvRow(doc, 'Band / Blatt', 'Band 22, Blatt 0212');
    kvRow(doc, 'Lfd. Nr.', 'Bestandsverzeichnis 1');

    sectionHead(doc, 'Bestandsverzeichnis');
    kvRow(doc, 'Gemarkung', 'Testdorf');
    kvRow(doc, 'Flur', '4');
    kvRow(doc, 'Flurstück', '212');
    kvRow(doc, 'Wirtschaftsart', 'Gebäude- und Freifläche, Wohngebäude');
    kvRow(doc, 'Straße/Hausnummer', 'Birkenweg 7');
    kvRow(doc, 'Größe', '625 m²');

    sectionHead(doc, 'Abteilung I – Eigentümer');
    kvRow(doc, 'Eigentümer', 'Max Mustermann (fiktiv)');
    kvRow(doc, 'Geburtsdatum', '01. Januar 1975 (fiktiv)');
    kvRow(doc, 'Anschrift', 'Birkenweg 7, 54321 Testdorf');
    kvRow(doc, 'Erwerbsgrund', 'Auflassung vom 15.03.2010, eingetragen 28.04.2010');
    kvRow(doc, 'Anteil', '1/1 (Alleineigentum)');

    sectionHead(doc, 'Abteilung II – Lasten und Beschränkungen');
    doc.fontSize(9).text('Keine Eintragungen vorhanden. (Fiktiv – TESTDOKUMENT)').moveDown(0.5);

    sectionHead(doc, 'Abteilung III – Hypotheken und Grundschulden');
    doc.fontSize(9).text('Keine Eintragungen vorhanden. (Fiktiv – TESTDOKUMENT)').moveDown(0.5);

    doc.moveDown(0.5);
    doc.fontSize(9).text('Testdorf, den 01. September 2024').moveDown(0.3);
    doc.fontSize(9).fillColor(GRAY)
       .text('Amtsgericht Testdorf (fiktiv) – Grundbuchamt').moveDown(0.2);
    doc.text('__________________________________').moveDown(0.2);
    doc.text('Musterrechtspfleger/in (fiktiv)').moveDown(0.2);
    doc.text('Rechtspfleger/in').moveDown(1);

    doc.rect(50, doc.y, 495, 2).fill(RED).moveDown(0.3);
    doc.fontSize(8).fillColor(RED).font('Helvetica-Bold')
       .text('TESTDOKUMENT – Kein echter Grundbuchauszug. Nur für interne Testzwecke von Förderpilot V0.')
       .font('Helvetica').fillColor(DARK);

    addPageFooter(doc, '1 / 1');
  });
}

// ─────────────────────────────────────────────────────────────
// Document 7: Typenschild Ölheizung (PNG)
// ─────────────────────────────────────────────────────────────
function doc07() {
  const W = 600, H = 380;
  writePNG('07_typenschild_oelheizung_mock.png', W, H, (px) => {
    // Background: light steel blue
    fillRect(px, W, 0, 0, W, H, 200, 215, 230);

    // Dark header bar
    fillRect(px, W, 0, 0, W, 60, 40, 55, 70);

    // Manufacturer logo area (white box)
    fillRect(px, W, 20, 8, 180, 44, 255, 255, 255);
    fillRect(px, W, 25, 13, 170, 34, 220, 235, 250);

    // Red accent bar below header
    fillRect(px, W, 0, 60, W, 6, 180, 30, 30);

    // Main data area (white)
    fillRect(px, W, 20, 80, W - 40, H - 110, 255, 255, 255);
    // Border
    for (let t = 0; t < 3; t++) {
      // top
      for (let x = 20; x < W - 20; x++) { const i = ((80 + t) * W + x) * 3; px[i] = 80; px[i+1] = 100; px[i+2] = 120; }
      // bottom
      for (let x = 20; x < W - 20; x++) { const i = ((H - 31 + t) * W + x) * 3; px[i] = 80; px[i+1] = 100; px[i+2] = 120; }
      // left
      for (let y = 80; y < H - 30; y++) { const i = (y * W + 20 + t) * 3; px[i] = 80; px[i+1] = 100; px[i+2] = 120; }
      // right
      for (let y = 80; y < H - 30; y++) { const i = (y * W + W - 21 + t) * 3; px[i] = 80; px[i+1] = 100; px[i+2] = 120; }
    }

    // Data rows (colored stripes for visual structure)
    const rows = [100, 135, 170, 205, 240, 275];
    for (let i = 0; i < rows.length; i += 2) {
      fillRect(px, W, 23, rows[i], W - 46, 30, 240, 248, 255);
    }

    // Horizontal separators
    for (const ry of rows) {
      fillRect(px, W, 23, ry + 29, W - 46, 1, 180, 195, 210);
    }

    // Label column (light blue)
    fillRect(px, W, 23, 83, 220, H - 116, 225, 238, 252);
    fillRect(px, W, 242, 83, 1, H - 116, 150, 170, 190);

    // Vertical label text markers (small colored blocks representing text)
    const labels = [
      [40, 107, 'HERSTELLER'], [40, 142, 'MODELL'], [40, 177, 'BAUJAHR'],
      [40, 212, 'LEISTUNG'], [40, 247, 'BRENNSTOFF'], [40, 282, 'SERIENNR'],
    ];
    const values = [
      [260, 107, 'MUSTERTHERM'],
      [260, 142, 'MH-22 STANDARD'],
      [260, 177, '1999'],
      [260, 212, '22 KW'],
      [260, 247, 'HEIZOEL EL'],
      [260, 282, 'SN: MT-1999-004217'],
    ];
    const scale = 2;
    for (const [x, y, t] of labels) drawText(px, W, t, x, y, scale, 50, 70, 100);
    for (const [x, y, t] of values) drawText(px, W, t, x, y, scale, 20, 30, 60);

    // TEST watermark diagonal stripe
    for (let i = 0; i < W + H; i += 80) {
      for (let t = 0; t < 3; t++) {
        for (let d = 0; d < Math.min(W, H); d++) {
          const x = i - d, y = d;
          if (x >= 0 && x < W && y >= 0 && y < H) {
            const pi = (y * W + x) * 3;
            px[pi] = Math.min(255, px[pi] + 20);
            px[pi + 2] = Math.min(255, px[pi + 2] - 10);
          }
        }
      }
    }

    // Red TEST banner at bottom
    fillRect(px, W, 0, H - 30, W, 30, 180, 30, 30);
    drawText(px, W, 'TEST - MUSTERTHERM MH-22 - BJ 1999 - 22KW - KEIN ECHTES TYPENSCHILD', 10, H - 22, 2, 255, 255, 200);

    // CE mark area (small square)
    fillRect(px, W, W - 80, 85, 55, 55, 220, 230, 245);
    drawText(px, W, 'CE', W - 72, 100, 4, 30, 50, 100);
  });
}

// ─────────────────────────────────────────────────────────────
// Document 8: Foto Altanlage (PNG)
// ─────────────────────────────────────────────────────────────
function doc08() {
  const W = 640, H = 480;
  writePNG('08_foto_altanlage_mock.png', W, H, (px) => {
    // Room background: warm beige/cream
    fillRect(px, W, 0, 0, W, H, 210, 195, 175);

    // Floor
    fillRect(px, W, 0, H - 80, W, 80, 140, 120, 95);
    // Floor planks
    for (let x = 0; x < W; x += 60) fillRect(px, W, x, H - 80, 1, 80, 110, 90, 70);
    for (let y = H - 80; y < H; y += 20) fillRect(px, W, 0, y, W, 1, 120, 100, 80);

    // Wall / baseboard
    fillRect(px, W, 0, H - 85, W, 5, 120, 110, 95);

    // Oil heater body: dark gray metal box
    fillRect(px, W, 160, 150, 310, 260, 85, 85, 90);
    // Front panel
    fillRect(px, W, 170, 160, 290, 230, 95, 95, 100);
    // Highlight (metal sheen)
    fillRect(px, W, 175, 163, 285, 8, 140, 140, 148);

    // Control panel area
    fillRect(px, W, 190, 185, 250, 60, 70, 70, 75);
    // Display/dial
    fillRect(px, W, 200, 195, 60, 40, 20, 20, 22);
    fillRect(px, W, 205, 200, 50, 30, 30, 35, 45); // screen glow
    // Dial
    for (let dy = -10; dy <= 10; dy++)
      for (let dx = -10; dx <= 10; dx++)
        if (dx * dx + dy * dy <= 100)
          fillRect(px, W, 295 + dx, 215 + dy, 1, 1, 50, 50, 55);
    for (let dy = -9; dy <= 9; dy++)
      for (let dx = -9; dx <= 9; dx++)
        if (dx * dx + dy * dy <= 81)
          fillRect(px, W, 295 + dx, 215 + dy, 1, 1, 110, 110, 115);

    // Pipe connections (top)
    fillRect(px, W, 230, 110, 20, 55, 100, 100, 105);
    fillRect(px, W, 280, 120, 20, 45, 100, 100, 105);
    fillRect(px, W, 330, 130, 20, 35, 100, 100, 105);
    // Pipe horizontal
    fillRect(px, W, 200, 105, 200, 15, 90, 90, 95);

    // Exhaust flue pipe
    fillRect(px, W, 350, 60, 40, 200, 80, 80, 85);
    fillRect(px, W, 345, 55, 50, 15, 65, 65, 70);

    // Burner inspection port
    fillRect(px, W, 220, 300, 190, 60, 75, 75, 80);
    fillRect(px, W, 225, 305, 60, 50, 45, 45, 50);

    // Rust/age effects (scattered orange-brown pixels)
    for (let i = 0; i < 800; i++) {
      const rx = 160 + Math.floor((Math.sin(i * 7) * 0.5 + 0.5) * 310);
      const ry = 150 + Math.floor((Math.cos(i * 11) * 0.5 + 0.5) * 260);
      if (rx >= 160 && rx < 470 && ry >= 150 && ry < 410)
        fillRect(px, W, rx, ry, 2, 2, 140, 90, 40);
    }

    // Shadow on floor
    fillRect(px, W, 180, H - 82, 280, 5, 120, 105, 85);

    // Wall outlet / pipe
    fillRect(px, W, 90, 220, 80, 20, 140, 135, 125);

    // Aging yellow/sepia tint overlay (simulate old photo)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      px[i] = Math.min(255, px[i] + 8);
      px[i + 1] = Math.min(255, px[i + 1] + 4);
    }

    // TEST overlay banner
    fillRect(px, W, 0, 0, W, 35, 0, 0, 0);
    drawText(px, W, 'FOTO ALTANLAGE OELHEIZUNG TEST - KEIN ECHTES FOTO', 8, 8, 2, 255, 240, 100);

    // Bottom label
    fillRect(px, W, 0, H - 28, W, 28, 50, 40, 30);
    drawText(px, W, 'TESTBILD - OELKESSEL BJ1999 - KEINE ECHTE ANLAGE - FOERDERPILOT V0', 8, H - 20, 2, 220, 210, 180);
  });
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
(async () => {
  console.log('Generating Förderpilot V0 test fixtures...\n');
  await doc01();
  await doc02();
  await doc03();
  await doc04();
  await doc05();
  await doc06();
  doc07();
  doc08();
  console.log('\nDone. All files written to:', OUT);
})().catch(err => { console.error(err); process.exit(1); });
