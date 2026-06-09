export interface PdfExtractionResult {
  text: string;
  page_count?: number;
  extraction_status: 'success' | 'empty' | 'failed';
  error?: string;
}

export async function extractPdfText(buffer: Buffer): Promise<PdfExtractionResult> {
  return new Promise((resolve) => {
    try {
      type PDFParserClass = new (context: null, verbosity: number) => {
        on(event: 'pdfParser_dataReady', cb: () => void): void;
        on(event: 'pdfParser_dataError', cb: (err: { parserError: string }) => void): void;
        getRawTextContent(): string;
        getPageCount?(): number;
        parseBuffer(buf: Buffer): void;
      };
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const PDFParser = require('pdf2json') as PDFParserClass;
      const parser = new PDFParser(null, 1);

      parser.on('pdfParser_dataError', (err) => {
        resolve({
          text: '',
          extraction_status: 'failed',
          error: err.parserError,
        });
      });

      parser.on('pdfParser_dataReady', () => {
        try {
          const raw = parser.getRawTextContent() ?? '';
          // getRawTextContent separates pages with form-feed chars; normalise
          const text = raw.replace(/\f/g, '\n').trim();
          if (!text) {
            resolve({ text: '', extraction_status: 'empty' });
          } else {
            resolve({ text, extraction_status: 'success' });
          }
        } catch (e) {
          resolve({
            text: '',
            extraction_status: 'failed',
            error: e instanceof Error ? e.message : String(e),
          });
        }
      });

      parser.parseBuffer(buffer);
    } catch (err) {
      resolve({
        text: '',
        extraction_status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
