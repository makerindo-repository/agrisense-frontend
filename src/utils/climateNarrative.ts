// ============================================================
// Generator Narasi Klimatologi untuk Analisis Carbon Flux
// Sumber: Diekstrak dari BMKGView.tsx L92-L153 (getAgronomicAdvice)
// ============================================================

/**
 * Menghasilkan teks analisis narasi klimatologi berdasarkan data cuaca saat ini.
 * Termasuk perhitungan VPD (Vapor Pressure Deficit) secara internal.
 *
 * @param data - Objek data cuaca dari API BMKG { current: { temp, humidity, weather }, windSpeed }
 * @param customStation - Nama lokasi/stasiun kustom (opsional)
 * @returns Teks narasi klimatologi dalam Bahasa Indonesia
 */
export const generateClimateNarrative = (
  data: any,
  customStation?: string
): string => {
  if (!data || !data.current) return "Menunggu data cuaca untuk analisis dinamika karbon...";

  const temp: number = data.current.temp;
  const humidity: number = data.current.humidity;
  const weather: string = data.current.weather.toLowerCase();
  const wind: number = data.windSpeed || 0;
  const station: string = customStation || data.station || "Anda";

  // VPD (Vapor Pressure Deficit) — indikator aktivitas pertukaran gas CO₂
  const svp = 0.6108 * Math.exp((17.27 * temp) / (temp + 237.3)); // kPa
  const avp = svp * (humidity / 100);
  const vpd = svp - avp;
  const vpdStr = vpd.toFixed(2);

  let adviceText = `Berdasarkan data klimatologi wilayah ${station} — `;

  const isRaining = weather.includes('rain') || weather.includes('hujan') || weather.includes('drizzle') || weather.includes('gerimis') || weather.includes('thunderstorm') || weather.includes('badai');

  // 1. Hujan + Angin Kencang
  if (isRaining && wind > 20) {
    return adviceText + `Hujan disertai angin kencang (${wind.toFixed(1)} km/j) pada suhu ${temp.toFixed(1)}°C. Cahaya matahari hampir tidak ada sehingga proses penyerapan CO₂ oleh tanaman (fotosintesis) berhenti total. VPD saat ini ${vpdStr} kPa, pertukaran gas antara tanaman dan udara sangat terbatas. Di sisi lain, genangan air meningkatkan pelepasan CO₂ dari tanah akibat proses penguraian tanpa oksigen. Secara keseluruhan, ekosistem melepaskan lebih banyak karbon ke atmosfer dibanding yang diserap.`;
  }

  // 2. Hujan Normal
  if (isRaining) {
    return adviceText + `Hujan terdeteksi pada suhu ${temp.toFixed(1)}°C dengan kelembapan ${humidity}% (VPD: ${vpdStr} kPa). Cahaya matahari sangat rendah sehingga laju penyerapan CO₂ oleh tanaman menurun tajam. Pori-pori daun (stomata) cenderung tertutup, mengurangi kemampuan tanaman menyerap karbon. Di sisi lain, tanah yang basah membuat mikroorganisme pengurai lebih aktif — mempercepat pelepasan CO₂ dari tanah. Saat ini, ekosistem cenderung menjadi pelepas karbon (carbon source) sementara hingga hujan reda.`;
  }

  // 3. Stres Panas Ekstrem (Kering)
  if (temp > 32 && humidity < 50) {
    return adviceText + `Kondisi sangat terik (${temp.toFixed(1)}°C) dan kering (kelembapan ${humidity}%). Tekanan uap udara sangat tinggi (VPD: ${vpdStr} kPa) — tanaman menutup pori-pori daunnya untuk mencegah kehilangan air, sehingga penyerapan CO₂ terhenti. Sementara itu, proses pernapasan tanaman (yang melepas CO₂) justru meningkat seiring naiknya suhu. Akibatnya, lebih banyak karbon yang dilepas ke udara dibanding yang diserap. Potensi penyimpanan karbon harian pada kondisi ini sangat rendah.`;
  }

  // 4. Stres Panas Lembap (Gerah)
  if (temp > 32 && humidity >= 50) {
    return adviceText + `Suhu tinggi (${temp.toFixed(1)}°C) dengan kelembapan ${humidity}% (VPD: ${vpdStr} kPa). Meskipun pori-pori daun masih terbuka sebagian, efisiensi tanaman dalam menangkap CO₂ menurun drastis di atas 32°C. Perbandingan antara karbon yang diserap vs yang dilepas kembali memburuk — artinya lebih banyak CO₂ yang dikeluarkan tanaman melalui proses pernapasan. Efisiensi konversi cahaya menjadi penyimpanan karbon turun 30–50% dari kondisi ideal.`;
  }

  // 5. Kondisi Optimal — Penyerapan CO₂ maksimal
  if (temp >= 24 && temp <= 30 && humidity >= 50 && humidity <= 80 && wind < 15) {
    return adviceText + `Kondisi sangat ideal untuk penyimpanan karbon — suhu ${temp.toFixed(1)}°C, kelembapan ${humidity}%, VPD ${vpdStr} kPa. Proses fotosintesis berjalan pada kapasitas penuh: pori-pori daun terbuka lebar, memaksimalkan masuknya CO₂ ke dalam daun. Laju penyerapan karbon (GPP) mencapai puncaknya, sementara pelepasan CO₂ dari tanaman dan tanah tetap terkendali. Ekosistem berfungsi sebagai penyerap karbon (carbon sink) yang sangat efisien. Pada kondisi ini, penyerapan CO₂ diestimasi dapat mencapai 15–25 gram karbon per m² per hari.`;
  }

  // 6. Kelembapan Sangat Tinggi + Sejuk
  if (humidity > 85 && temp < 26) {
    return adviceText + `Suhu sejuk (${temp.toFixed(1)}°C) dengan kelembapan sangat tinggi (${humidity}%, VPD rendah: ${vpdStr} kPa). Fotosintesis berjalan moderat karena cahaya dan suhu belum optimal, namun aktivitas mikroorganisme pengurai di dalam tanah sangat tinggi. Kelembapan tinggi mempercepat penguraian bahan organik — meningkatkan pelepasan CO₂ dan metana (CH₄) dari tanah. Emisi dari tanah bisa menyumbang 40–60% dari total pelepasan karbon ekosistem. Potensi sebagai penyerap karbon berkurang karena pelepasan karbon dari tanah hampir menyamai penyerapan oleh tanaman.`;
  }

  // 7. Angin Kencang
  if (wind > 25) {
    return adviceText + `Angin kencang (${wind.toFixed(1)} km/j) pada suhu ${temp.toFixed(1)}°C. Turbulensi udara meningkatkan pencampuran udara di sekitar kanopi tanaman dengan udara bebas, mempercepat pergerakan CO₂. Konsentrasi CO₂ di bawah tanaman menurun karena terdispersi cepat. Namun, kemampuan tanaman menyerap CO₂ melalui pori-pori daun tetap stabil. Secara fisiologis, tekanan angin membuat tanaman lebih banyak mengalokasikan karbon ke batang dan akar (untuk memperkuat struktur) dibanding ke daun.`;
  }

  // 8. Suhu Dingin
  if (temp < 20) {
    return adviceText + `Suhu relatif dingin (${temp.toFixed(1)}°C, VPD: ${vpdStr} kPa). Proses fotosintesis melambat karena reaksi kimia di dalam daun berjalan lebih lambat pada suhu rendah. Namun, proses pernapasan tanaman juga berkurang — sehingga rasio penyerapan terhadap pelepasan karbon masih bisa positif. Penguraian bahan organik di tanah juga melambat, mengurangi emisi CO₂ dari tanah sebesar 20–40%. Secara keseluruhan, ekosistem masih berfungsi sebagai penyerap karbon meskipun dengan kapasitas yang lebih rendah.`;
  }

  // 9. Default Stabil
  return adviceText + `Suhu termonitor ${temp.toFixed(1)}°C dengan kelembapan ${humidity}% (VPD: ${vpdStr} kPa). Kondisi cuaca cukup stabil untuk siklus karbon normal. Penyerapan CO₂ (fotosintesis) dan pelepasan CO₂ (pernapasan tanaman + penguraian tanah) berada dalam keseimbangan dinamis — ekosistem berfungsi sebagai penyerap karbon (carbon sink) moderat. Perhatikan suhu malam hari: kenaikan 1°C suhu malam dapat meningkatkan pelepasan CO₂ di malam hari sebesar 8–12%. Pantau rasio penyerapan vs pelepasan karbon untuk evaluasi efisiensi harian.`;
};
