// ============================================================
// Utilitas Ekspor Data (Excel & PDF)
// Sumber: Diekstrak dari UsersView.tsx, SensorsView.tsx, dll.
// ============================================================

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Mengekspor data ke file Excel (.xlsx).
 *
 * @param data - Array objek yang akan diekspor
 * @param sheetName - Nama sheet di dalam file Excel
 * @param fileName - Nama file output (tanpa ekstensi)
 */
export const exportToExcelGeneric = (
  data: Record<string, any>[],
  sheetName: string,
  fileName: string
): void => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

/**
 * Mengekspor data ke file CSV (.csv).
 *
 * @param data - Array objek yang akan diekspor
 * @param sheetName - Nama sheet (untuk kompatibilitas)
 * @param fileName - Nama file output (tanpa ekstensi)
 */
export const exportToCSVGeneric = (
  data: Record<string, any>[],
  sheetName: string,
  fileName: string
): void => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}.csv`, { bookType: 'csv' });
};

/**
 * Mengekspor data ke file PDF (.pdf) dengan tabel.
 *
 * @param title - Judul dokumen yang ditampilkan di atas tabel
 * @param headers - Array nama kolom header
 * @param body - Array 2D berisi data setiap baris
 * @param fileName - Nama file output (tanpa ekstensi)
 * @param headerColor - Warna header RGB (default: AgriSense Emerald [16, 185, 129])
 */
export const exportToPDFGeneric = (
  title: string,
  headers: string[],
  body: (string | number)[][],
  fileName: string,
  headerColor: [number, number, number] = [16, 185, 129]
): void => {
  const doc = new jsPDF();
  doc.text(title, 14, 15);

  autoTable(doc, {
    head: [headers],
    body: body,
    startY: 20,
    theme: 'grid',
    headStyles: { fillColor: headerColor },
  });

  doc.save(`${fileName}.pdf`);
};
