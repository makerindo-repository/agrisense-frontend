// ============================================================
// Utilitas Validasi File / Gambar
// Sumber: SettingsView.tsx L100-L124 + ProfileView.tsx L85-L99
// ============================================================

import { toast } from 'sonner';

/**
 * Memvalidasi file gambar (ukuran & tipe) lalu membacanya sebagai Base64 Data URL.
 * Menampilkan toast error otomatis jika validasi gagal.
 *
 * @param file - File dari input type="file"
 * @param maxSizeMB - Batas ukuran maksimal dalam MB (default: 2)
 * @param validTypes - Array MIME type yang diizinkan (opsional, jika tidak diisi maka semua tipe diterima)
 * @returns Promise<string | null> - Base64 Data URL jika valid, null jika gagal
 */
export const validateAndReadImage = (
  file: File,
  maxSizeMB = 2,
  validTypes?: string[]
): Promise<string | null> => {
  return new Promise((resolve) => {
    // Validasi tipe file (jika diberikan)
    if (validTypes && validTypes.length > 0) {
      if (!validTypes.includes(file.type)) {
        toast.error(`Format file tidak didukung. Gunakan: ${validTypes.map(t => t.split('/')[1]?.toUpperCase()).join(', ')}.`);
        resolve(null);
        return;
      }
    }

    // Validasi ukuran file
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`Ukuran file terlalu besar. Maksimal ${maxSizeMB}MB.`);
      resolve(null);
      return;
    }

    // Baca file sebagai Base64
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      toast.error('Gagal membaca file.');
      resolve(null);
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Mengubah path relatif penyimpanan backend Laravel menjadi URL statis yang dapat dibaca browser.
 * @param path - Relative path (misal: 'komoditi/xyz.jpg' atau '/storage/komoditi/xyz.jpg')
 * @returns string - Storage URL (misal: '/storage/komoditi/xyz.jpg')
 */
export const getStorageUrl = (path?: string | null): string => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  const cleanPath = path.replace(/^\/?storage\//, '').replace(/^\//, '');
  return `/storage/${cleanPath}`;
};
