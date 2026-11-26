import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/** Renders a simple, printable PDF document (waiver records, receipts). Markdown markers are stripped. */
export async function renderPdf(title: string, sections: { heading?: string; body: string }[], footer: string) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 612, H = 792, M = 54, size = 10, lh = 14;
  let page = doc.addPage([W, H]); let y = H - M;
  const clean = (s: string) => s.replace(/\*\*|__|#{1,6}\s?|`/g, "").replace(/[^\x20-\x7E\n•–—’‘“”é]/g, "").replace(/[–—]/g, "-").replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/•/g, "-");
  const write = (text: string, f = font, s = size, color = rgb(0.1, 0.14, 0.12)) => {
    for (const para of clean(text).split("\n")) {
      const words = para.split(" "); let line = "";
      const flush = () => { if (y < M + lh) { page = doc.addPage([W, H]); y = H - M; } page.drawText(line, { x: M, y, size: s, font: f, color }); y -= s * 1.4; line = ""; };
      for (const w of words) { const t = line ? `${line} ${w}` : w; if (f.widthOfTextAtSize(t, s) > W - 2 * M) { flush(); line = w; } else line = t; }
      flush();
    }
  };
  write(title, bold, 16); y -= 6;
  for (const sec of sections) { if (sec.heading) { y -= 4; write(sec.heading, bold, 11); } write(sec.body); y -= 6; }
  y -= 10; write(footer, font, 8, rgb(0.4, 0.4, 0.4));
  return doc.save();
}
