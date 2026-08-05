// ============================================================
// Utilitas Generator Kode Unik
// Sumber: AreaManagementView.tsx L239-L243
// ============================================================

/**
 * Menghasilkan kode unik berformat: PREFIX-TIMESTAMP36-RANDOM.
 * Contoh output: "LHN-M1ABC-XYZ"
 *
 * @param prefix - Awalan kode (misal: 'LHN' untuk Lahan, 'KBN' untuk Kebun)
 */
export const generateUniqueCode = (prefix: string): string => {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
};
