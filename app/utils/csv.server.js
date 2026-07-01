// Minimal RFC4180-style CSV parser (quoted fields, escaped quotes, CRLF/LF).
// No external dependency is required for the row counts this app imports.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const source = String(text || "").replace(/^\uFEFF/, "");

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char === "\r") {
      // Skip; the following \n (if any) ends the row.
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => String(cell).trim() !== ""));
}

// Parses CSV text into an array of objects keyed by the (trimmed, lowercased,
// snake_case) header row. Blank rows are dropped.
export function parseCsvRecords(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];

  const headers = rows[0].map((header) =>
    String(header || "").trim().toLowerCase().replace(/\s+/g, "_"),
  );

  return rows.slice(1).map((cells) => {
    const record = {};
    headers.forEach((header, index) => {
      if (!header) return;
      record[header] = cells[index] !== undefined ? String(cells[index]).trim() : "";
    });
    return record;
  });
}
