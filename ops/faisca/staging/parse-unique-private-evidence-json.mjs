/**
 * R261: refuse repeated object member names in Docker inspect JSON, including
 * Unicode-escaped aliases. JSON.parse silently keeps the LAST occurrence;
 * ambiguous operator evidence must not reach any local HTTP review.
 * Input is bounded by the R260 CLI and this helper adds depth/key limits.
 */
const MAX_DEPTH = 64;
const MAX_KEYS_PER_OBJECT = 4096;

export function parseUniquePrivateEvidenceJson(text) {
  if (typeof text !== 'string' || text.length > 512 * 1024) {
    throw new TypeError('invalid private evidence JSON');
  }
  let index = 0;
  const fail = () => { throw new TypeError('invalid private evidence JSON'); };
  const space = () => {
    while (index < text.length && /[\t\n\r ]/.test(text[index])) index++;
  };
  const quoted = () => {
    if (text[index] !== '"') fail();
    const start = index++;
    let closed = false;
    while (index < text.length) {
      const char = text[index++];
      if (char === '\\') { index++; continue; }
      if (char === '"') { closed = true; break; }
    }
    if (!closed) fail();
    // Native parsing below independently validates escapes and JSON grammar.
    return text.slice(start, index);
  };
  const value = depth => {
    if (depth > MAX_DEPTH) fail();
    space();
    if (text[index] === '{') {
      index++;
      const seen = new Set();
      space();
      if (text[index] === '}') { index++; return; }
      while (index < text.length) {
        space();
        const name = JSON.parse(quoted());
        if (seen.has(name) || seen.size >= MAX_KEYS_PER_OBJECT) fail();
        seen.add(name);
        space();
        if (text[index++] !== ':') fail();
        value(depth + 1);
        space();
        const separator = text[index++];
        if (separator === '}') return;
        if (separator !== ',') fail();
      }
      fail();
    }
    if (text[index] === '[') {
      index++;
      space();
      if (text[index] === ']') { index++; return; }
      while (index < text.length) {
        value(depth + 1);
        space();
        const separator = text[index++];
        if (separator === ']') return;
        if (separator !== ',') fail();
      }
      fail();
    }
    if (text[index] === '"') { quoted(); return; }
    const start = index;
    while (index < text.length && !/[\t\n\r ,\]}]/.test(text[index])) index++;
    if (index === start) fail();
  };
  value(0);
  space();
  if (index !== text.length) fail();
  return JSON.parse(text);
}
