/**
 * Item Master Import Validation Module
 *
 * Pure logic module for validating parsed Excel rows before database insertion.
 */

/**
 * Validates an array of parsed spreadsheet rows for item master import.
 *
 * @param {Array<Object>} rows - Parsed spreadsheet rows (keys are column headers)
 * @param {Set<string>} existingCodes - item_codes already present in the database
 * @returns {{ valid: Array, errors: Array<{row: number, message: string}> }}
 */
function validateImportRows(rows, existingCodes) {
  const valid = [];
  const errors = [];
  const seenInBatch = new Set(); // detect duplicates within the same file

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // Excel row (1=header, 2=first data row)
    const row = rows[i];

    const itemCode = (row.item_code || '').toString().trim();
    const itemDesc = (row.item_description || '').toString().trim();

    if (!itemCode) {
      errors.push({ row: rowNum, message: 'Missing required field: item_code' });
      continue;
    }
    if (!itemDesc) {
      errors.push({ row: rowNum, message: 'Missing required field: item_description' });
      continue;
    }
    if (existingCodes.has(itemCode)) {
      errors.push({ row: rowNum, message: `Duplicate item_code: ${itemCode}` });
      continue;
    }
    if (seenInBatch.has(itemCode)) {
      errors.push({ row: rowNum, message: `Duplicate item_code within file: ${itemCode}` });
      continue;
    }

    seenInBatch.add(itemCode);
    valid.push({
      item_code: itemCode,
      item_description: itemDesc,
      item_name: (row.item_name || itemDesc).toString().trim(),
      uom: (row.uom || 'Nos').toString().trim(),
      category: (row.category || '').toString().trim() || null,
      standard_cost: parseFloat(row.standard_cost) || 0,
      currency: (row.currency || 'INR').toString().trim(),
    });
  }

  return { valid, errors };
}

module.exports = { validateImportRows };
