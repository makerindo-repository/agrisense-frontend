// Baca & parse user tersimpan dari localStorage secara AMAN.
//
// Jika data korup/rusak (partial write, tampering, quota error, ekstensi
// browser), JSON.parse akan melempar. Tanpa guard ini, error terjadi saat
// render awal App → white-screen yang tak bisa dipulihkan (error terulang
// tiap reload). Helper ini menangkap error, membersihkan sesi, dan
// mengembalikan null. Ref: audit temuan H-1 (2026-07-04).
export function getStoredUser(): any | null {
  try {
    const saved = localStorage.getItem('agrisense_user');
    return saved ? JSON.parse(saved) : null;
  } catch {
    // Data korup — bersihkan agar tidak crash berulang, paksa login ulang.
    localStorage.removeItem('agrisense_user');
    localStorage.removeItem('agrisense_token');
    return null;
  }
}
