import React from 'react';
import { Sprout, Cpu, Layers, CloudSun, MapPin, FileSpreadsheet, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';

const AboutView = React.memo(() => {
  const { t } = useTranslation();

  const featureCards = [
    {
      icon: Sprout,
      color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:border-emerald-500/40",
      title: t('Pemantauan Presisi Telemetri'),
      desc: t('Pengumpulan data telemetri emisi karbon dan kondisi mikroklimat tanah secara seketika di seluruh plot lahan.')
    },
    {
      icon: Cpu,
      color: "bg-teal-500/10 text-teal-600 dark:text-teal-400 hover:border-teal-500/40",
      title: t('Analisis Kecerdasan Buatan'),
      desc: t('Model ML (XGBoost dan RandomForest) untuk proyeksi laju pertukaran karbon (Carbon Flux) dan peringatan anomali.')
    },
    {
      icon: CloudSun,
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:border-amber-500/40",
      title: t('Integrasi Klimatologi BMKG'),
      desc: t('Sinkronisasi langsung dengan stasiun cuaca BMKG untuk prediksi indikator iklim dan mitigasi cuaca ekstrem.')
    },
    {
      icon: MapPin,
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:border-blue-500/40",
      title: t('Pemetaan Spasial Interaktif'),
      desc: t('Visualisasi geospasial lokasi node sensor, batas lahan perkebunan, dan indikator risiko lingkungan.')
    },
    {
      icon: FileSpreadsheet,
      color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:border-purple-500/40",
      title: t('Laporan dan Ekspor Otomatis'),
      desc: t('Generasi laporan berkala format PDF dan CSV untuk audit emisi karbon dan kepatuhan lingkungan.')
    },
    {
      icon: Layers,
      color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:border-rose-500/40",
      title: t('Skalabilitas dan Konektivitas IoT'),
      desc: t('Arsitektur multi-node dengan protokol WebSocket dan MQTT yang dirancang untuk skala perkebunan luas.')
    }
  ];

  return (
    <div className="w-full space-y-6 max-w-5xl mx-auto pb-24 select-none">

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/60">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs shrink-0">
            <Info size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-foreground">
              {t('Tentang AgriSense')}
            </h1>
            <p className="text-xs font-semibold text-muted-foreground mt-0.5">
              {t('Platform pemantauan iklim mikro dan serapan karbon berbasis IoT AI')}
            </p>
          </div>
        </div>
      </div>

      {/* Hero Glassmorphism Banner Header (Tanpa Badge V1.0 Enterprise) */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-900 text-white p-8 sm:p-12 shadow-2xl relative overflow-hidden text-center sm:text-left"
      >
        {/* Pattern Background */}
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-80 h-80 rounded-full bg-white/10 blur-3xl pointer-events-none"></div>
        <div className="absolute left-1/3 bottom-0 w-64 h-64 rounded-full bg-teal-400/20 blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-8">
          {/* Logo Brand Container */}
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-white/15 backdrop-blur-md ring-4 ring-white/30 flex items-center justify-center p-3 shadow-2xl shrink-0">
            <Sprout size={48} className="text-emerald-200" />
          </div>

          <div className="space-y-3 flex-1">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight drop-shadow-sm">
              {t('Tentang AgriSense')}
            </h1>
            <p className="text-emerald-100 text-xs sm:text-sm leading-relaxed font-medium opacity-95 max-w-3xl">
              {t('Sistem pemantauan analitik cerdas yang memadukan Internet untuk Segala (IoT) dan algoritma Kecerdasan Buatan (AI) untuk merekam, memetakan, serta memprediksi jejak emisi karbon lingkungan secara seketika.')}
            </p>
          </div>
        </div>
      </motion.section>

      {/* Grid 6 Kartu Fitur & Kapabilitas Unggulan */}
      <section className="space-y-6">
        <div className="text-center sm:text-left">
          <h2 className="text-xl font-extrabold tracking-tight text-foreground">{t('Fitur dan Kapabilitas Unggulan')}</h2>
          <p className="text-xs text-muted-foreground font-semibold mt-0.5">{t('Teknologi canggih yang menggerakkan ekosistem analitik lingkungan AgriSense')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featureCards.map((card, idx) => {
            const IconComponent = card.icon;
            return (
              <motion.div 
                key={idx}
                whileHover={{ y: -4 }}
                className="p-6 bg-card rounded-3xl border border-border/80 shadow-md flex flex-col space-y-3 relative overflow-hidden group transition-all"
              >
                <div className={`p-3 w-12 h-12 rounded-2xl flex items-center justify-center font-bold ${card.color.split(' ')[0]} ${card.color.split(' ')[1]} ${card.color.split(' ')[2]}`}>
                  <IconComponent size={24} />
                </div>
                <h3 className="font-extrabold text-base text-foreground tracking-tight">{card.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                  {card.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Partner Logos Grid */}
      <section className="pt-6 border-t border-border/60">
        <div className="flex flex-col items-center space-y-5 text-center">
          <div>
            <p className="text-xs font-black tracking-widest uppercase text-emerald-600 dark:text-emerald-400">{t('Didukung Oleh')}</p>
            <p className="text-xs text-muted-foreground font-semibold mt-0.5">{t('Mitra Kolaborasi Riset dan Institusi')}</p>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-8 opacity-80 transition-all hover:opacity-100">
            <img src="/logo-unikom.png" alt="UNIKOM" className="h-10 w-auto object-contain hover:scale-105 transition-transform" width={40} height={40} />
            <img src="/Logo_LPDP.png" alt="LPDP" className="h-10 w-auto object-contain hover:scale-105 transition-transform" width={80} height={40} />
            <img src="/Logo_Waseda.png" alt="Waseda" className="h-10 w-auto object-contain hover:scale-105 transition-transform" width={127} height={40} />
            <img src="/Logo_CMU.png" alt="CMU" className="h-10 w-auto object-contain hover:scale-105 transition-transform" width={40} height={40} />
            <img src="/Logo_UTokyo.png" alt="UTokyo" className="h-11 w-auto object-contain hover:scale-105 transition-transform" width={44} height={44} />
            <img src="/tutwuri-handayan.png" alt="Kemdikbud" className="h-10 w-auto object-contain hover:scale-105 transition-transform" width={38} height={40} />
          </div>
        </div>
      </section>
    </div>
  );
});

AboutView.displayName = 'AboutView';

export default AboutView;
