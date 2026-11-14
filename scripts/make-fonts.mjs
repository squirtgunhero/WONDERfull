// One-off: turns open-licensed font files into the outline format 3D text uses (printable ASCII only).
// Run with: node scripts/make-fonts.mjs   The results in lib/fonts are checked in.
import fs from 'node:fs';
import opentype from 'opentype.js';
const FONTS = { anton: 'anton/files/anton-latin-400-normal.woff', playfair: 'playfair-display/files/playfair-display-latin-900-normal.woff',
  spacemono: 'space-mono/files/space-mono-latin-700-normal.woff', pacifico: 'pacifico/files/pacifico-latin-400-normal.woff', inter: 'inter/files/inter-latin-800-normal.woff' };
for (const [name, file] of Object.entries(FONTS)) {
  const buf = fs.readFileSync('node_modules/@fontsource/' + file);
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const scale = 100000 / ((font.unitsPerEm || 2048) * 72), round = Math.round, glyphs = {};
  for (let code = 32; code < 127; code++) {
    const g = font.charToGlyph(String.fromCharCode(code));
    const token = { ha: round(g.advanceWidth * scale), x_min: round((g.xMin || 0) * scale), x_max: round((g.xMax || 0) * scale), o: '' };
    g.path.commands.forEach((c) => {
      let t = c.type.toLowerCase();
      if (t === 'c') t = 'b';
      token.o += t + ' ';
      if (c.x !== undefined) token.o += round(c.x * scale) + ' ' + round(c.y * scale) + ' ';
      if (c.x1 !== undefined) token.o += round(c.x1 * scale) + ' ' + round(c.y1 * scale) + ' ';
      if (c.x2 !== undefined) token.o += round(c.x2 * scale) + ' ' + round(c.y2 * scale) + ' ';
    });
    glyphs[String.fromCharCode(code)] = token;
  }
  const out = { glyphs, familyName: font.getEnglishName('fullName'), ascender: round(font.ascender * scale), descender: round(font.descender * scale),
    underlinePosition: round(font.tables.post.underlinePosition * scale), underlineThickness: round(font.tables.post.underlineThickness * scale),
    boundingBox: { xMin: font.tables.head.xMin, xMax: font.tables.head.xMax, yMin: font.tables.head.yMin, yMax: font.tables.head.yMax }, resolution: 1000,
    original_font_information: { license: 'SIL Open Font License 1.1' } };
  fs.writeFileSync('lib/fonts/' + name + '.json', JSON.stringify(out));
  console.log(name, out.familyName, fs.statSync('lib/fonts/' + name + '.json').size);
}
