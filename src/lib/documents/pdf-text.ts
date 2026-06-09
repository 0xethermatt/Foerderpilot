export interface PdfExtractionResult {
  text: string;
  page_count?: number;
  extraction_status: 'success' | 'empty' | 'failed';
  error?: string;
}

// pdfjs-dist (used by pdf-parse) references browser geometry APIs that Node.js
// does not expose as globals. Stub them before the first require().
function ensureBrowserPolyfills() {
  const g = globalThis as Record<string, unknown>;

  if (!g.DOMMatrix) {
    g.DOMMatrix = class DOMMatrix {
      a=1; b=0; c=0; d=1; e=0; f=0;
      m11=1; m12=0; m13=0; m14=0;
      m21=0; m22=1; m23=0; m24=0;
      m31=0; m32=0; m33=1; m34=0;
      m41=0; m42=0; m43=0; m44=1;
      is2D=true; isIdentity=true;
      constructor(_init?: string | number[]) {}
      multiply(_m?: unknown) { return this; }
      translate(_tx=0, _ty=0, _tz=0) { return this; }
      scale(_s=1) { return this; }
      rotate(_rx=0, _ry=0, _rz=0) { return this; }
      inverse() { return this; }
      transformPoint(p: {x?:number;y?:number}) { return { x: p?.x??0, y: p?.y??0, z:0, w:1 }; }
      static fromMatrix(_m?: unknown) { return new (g.DOMMatrix as new()=>object)(); }
      static fromFloat32Array(_a: Float32Array) { return new (g.DOMMatrix as new()=>object)(); }
      static fromFloat64Array(_a: Float64Array) { return new (g.DOMMatrix as new()=>object)(); }
    };
  }

  if (!g.DOMPoint) {
    g.DOMPoint = class DOMPoint {
      x=0; y=0; z=0; w=1;
      constructor(x=0, y=0, z=0, w=1) { this.x=x; this.y=y; this.z=z; this.w=w; }
      static fromPoint(p?: {x?:number;y?:number}) { return new (g.DOMPoint as new(x?:number,y?:number)=>object)(p?.x,p?.y); }
      matrixTransform(_m?: unknown) { return this; }
    };
  }

  if (!g.DOMRect) {
    g.DOMRect = class DOMRect {
      x=0; y=0; width=0; height=0;
      get top() { return this.y; }
      get left() { return this.x; }
      get bottom() { return this.y + this.height; }
      get right() { return this.x + this.width; }
      constructor(x=0, y=0, w=0, h=0) { this.x=x; this.y=y; this.width=w; this.height=h; }
      static fromRect(r?: {x?:number;y?:number;width?:number;height?:number}) {
        return new (g.DOMRect as new(x?:number,y?:number,w?:number,h?:number)=>object)(r?.x,r?.y,r?.width,r?.height);
      }
      toJSON() { return {x:this.x,y:this.y,width:this.width,height:this.height}; }
    };
  }

  if (!g.Path2D) {
    g.Path2D = class Path2D {
      constructor(_d?: string | object) {}
      addPath(_p: unknown, _t?: unknown) {}
      arc(_x=0,_y=0,_r=0,_s=0,_e=0,_ccw=false) {}
      closePath() {}
      lineTo(_x=0,_y=0) {}
      moveTo(_x=0,_y=0) {}
    };
  }
}

export async function extractPdfText(buffer: Buffer): Promise<PdfExtractionResult> {
  try {
    ensureBrowserPolyfills();

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
