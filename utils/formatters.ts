/**
 * formatters.ts — Pusat Utilitas Format Tanggal & Data AgriSense
 * 
 * File ini menghilangkan duplikasi import `format`, `addDays`, dan `{ id }`
 * yang sebelumnya diulang di 9+ file halaman secara independen.
 * 
 * CARA PAKAI:
 *   import { formatDateTime, formatDateShort, formatTime, ... } from '@/utils/formatters';
 *   // Langsung pakai tanpa perlu import date-fns lagi!
 * 
 * @see docs/audit/ — Audit arsitektur duplikasi frontend
 */

import { format, addDays } from "date-fns";
import { id } from "date-fns/locale";

// ═══════════════════════════════════════════════════════════
//  Re-export date-fns essentials (agar halaman yang masih
//  perlu akses langsung ke `format` / `addDays` tidak perlu
//  import dari dua tempat berbeda)
// ═══════════════════════════════════════════════════════════
export { format, addDays, id };

// ═══════════════════════════════════════════════════════════
//  Format Tanggal & Waktu Standar AgriSense
// ═══════════════════════════════════════════════════════════

/**
 * Format lengkap: "05/05/2026 15:30:45"
 * Digunakan di: LogsView, SensorsView (tabel & export CSV)
 */
export function formatDateTime(date: string | Date): string {
  return format(new Date(date), "dd/MM/yyyy HH:mm:ss", { locale: id });
}

/**
 * Format ringkas: "05/05/2026 15:30"
 * Digunakan di: UsersView (login terakhir), tabel umum
 */
export function formatDateTimeShort(date: string | Date): string {
  return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: id });
}

/**
 * Format tanggal panjang Indonesia: "05 Mei 2026, 15:30"
 * Digunakan di: UsersView (badge), AnalyticsView (tooltip)
 */
export function formatDateTimeLong(date: string | Date): string {
  return format(new Date(date), "dd MMM yyyy, HH:mm", { locale: id });
}

/**
 * Format tanggal saja (panjang): "5 Mei 2026"
 * Digunakan di: AnalyticsView (keterangan AI Insight)
 */
export function formatDateLong(date: string | Date): string {
  return format(new Date(date), "d MMMM yyyy", { locale: id });
}

/**
 * Format waktu saja: "15:30"
 * Digunakan di: MapView (popup marker)
 */
export function formatTime(date: string | Date): string {
  return format(new Date(date), "HH:mm", { locale: id });
}

/**
 * Format untuk label chart berdasarkan timeRange
 * Digunakan di: DashboardView & AnalyticsView (sumbu X grafik)
 */
export function formatChartLabel(date: string | Date, timeRange: string): string {
  const pattern = timeRange === '24h' ? "d MMM, HH:mm" : "PPP";
  return format(new Date(date), pattern, { locale: id });
}

/**
 * Format untuk prefix nama file export: "20260505_1530"
 * Digunakan di: SensorsView, ReportsView (download CSV/PDF)
 */
export function formatFilePrefix(date?: Date): string {
  return format(date || new Date(), "yyyyMMdd_HHmm");
}

/**
 * Format untuk export laporan hanya tanggal: "20260505"
 * Digunakan di: ReportsView (nama file export)
 */
export function formatFileDateOnly(date?: Date): string {
  return format(date || new Date(), "yyyyMMdd");
}

/**
 * Format timestamp WIB Indonesia untuk AI Insight
 * Digunakan di: AnalyticsView (generated_at)
 */
export function formatTimestampWIB(suffix?: string): string {
  const base = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
  return suffix ? `${base} WIB ${suffix}` : `${base} WIB`;
}
