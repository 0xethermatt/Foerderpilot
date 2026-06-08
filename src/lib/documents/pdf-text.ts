export interface PdfExtractionResult {
  text: string;
  page_count?: number;
  extraction_status: 'success' | 'empty' | 'failed';
  error?: string;
}

export async function extractPdfText(buffer: Buffer): Promise<PdfExtractionResult> {
  try {
    type TextResult = { text: string; pages: Array<{ num: number; text: string }> };
    type PDFParseClass = new (opts: { data: Buffer }) => { getText(): Promise<TextResult> };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PDFParse } = require('pdf-parse') as { PDFParse: PDFParseClass };
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = (result.text ?? '').trim();
    const pageCount = result.pages.length;

    if (!text) {
      return { text: '', page_count: pageCount, extraction_status: 'empty' };
    }
    return { text, page_count: pageCount, extraction_status: 'success' };
  } catch (err) {
    return {
      text: '',
      extraction_status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
