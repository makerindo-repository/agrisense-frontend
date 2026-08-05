// ============================================================
// Utilitas Geolokasi
// Sumber: AreaManagementView.tsx L246-L271 + BMKGView.tsx L164-L174
// ============================================================

/**
 * Membersihkan string alamat dari kata-kata umum yang tidak informatif.
 * Menghapus: "Indonesia", "Jawa" (standalone), dan kode pos 5 digit.
 *
 * @param address - String alamat mentah, bisa undefined
 * @param fallback - Teks pengganti jika address kosong/undefined (default: '')
 */
export const cleanAddress = (address: string | undefined, fallback = ''): string => {
  if (!address) return fallback;
  const parts = address.split(',').map(s => s.trim());
  const cleaned = parts.filter(p => {
    const lower = p.toLowerCase();
    // Hapus "Jawa" standalone (tapi pertahankan "Jawa Barat", "Jawa Tengah", dll.)
    if (lower === 'jawa') return false;
    if (lower === 'indonesia') return false;
    if (/^\d{5}$/.test(p)) return false; // Kode pos
    return true;
  });
  return cleaned.join(', ');
};

/**
 * Melakukan reverse geocoding melalui Nominatim OpenStreetMap API.
 * Mengembalikan alamat yang sudah dibersihkan.
 *
 * @param lat - Latitude
 * @param lng - Longitude
 */
export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=id`,
      { headers: { 'User-Agent': 'AgriSense/1.0' } }
    );
    const data = await res.json();
    return cleanAddress(data.display_name || '');
  } catch {
    return '';
  }
};
