// Nama Program         : IoT Agrisense
// Firmware version     : V1.0 - Dummy Sensor Generator
// Nama Pembuat         : Muhammad Naufal
// Tanggal Update       : 22/06/2026
// Ownership            : PT Makerindo Prima Solusi
// Hardware version     : v1.0
/* Deskripsi            : Kode firmware ESP32 ini adalah program pembuat data sensor dummy yang digunakan untuk menguji koneksi dan dashboard IoT Agrisense. 
                          Program ini menghasilkan nilai acak untuk berbagai parameter lingkungan dengan mengambil patokan nilai awal dari Open-Meteo API. 
                          Data buatan tersebut kemudian dikemas dalam format JSON dan dikirim ke server melalui MQTT */ 


/* 
 DAFTAR FUNGSI DAN KEGUNAANNYA:
 --------------------------------------------------------------------------------------------------
 1.  clampf(v, lo, hi)
     - Mengapit/membatasi nilai float 'v' agar berada dalam rentang minimum 'lo' dan maksimum 'hi'.
 2.  isFiniteNumber(v)
     - Memeriksa apakah nilai float 'v' terdefinisi (bukan NaN atau Infinity).
 3.  randomFloat(minVal, maxVal)
     - Menghasilkan bilangan acak acak bertipe float dalam rentang minVal hingga maxVal.
 4.  noiseLike(scale)
     - Menghasilkan nilai noise acak berdistribusi lebih halus menggunakan penjumlahan uniform random.
 5.  smoothTowards(prev, target, maxStep, alpha)
     - Menghasilkan transisi nilai acak secara halus dari 'prev' menuju 'target' dengan step maksimum.
 6.  reflectWithin(v, lo, hi)
     - Memantulkan nilai 'v' agar membal balik jika melewati batas 'lo' atau 'hi'.
 7.  deg2rad(d)
     - Mengonversi nilai derajat ke radian.
 8.  maxf(a, b)
     - Membandingkan dua bilangan float dan mengembalikan nilai terbesar.
 9.  ugm3ToPPB(ugm3, molecularWeight, tempC, pressureHpa)
     - Mengonversi satuan konsentrasi gas dari µg/m³ ke PPB berpatokan pada suhu dan tekanan.
 10. ugm3ToPPM(ugm3, molecularWeight, tempC, pressureHpa)
     - Mengonversi satuan konsentrasi gas dari µg/m³ ke PPM berpatokan pada suhu dan tekanan.
 11. norm01(x, lo, hi)
     - Menormalisasi nilai 'x' pada skala rentang lo-hi menjadi nilai antara 0.0 hingga 1.0.
 12. centeredNorm(x, lo, hi)
     - Menormalisasi nilai 'x' menjadi rentang simetris terpusat antara -1.0 hingga 1.0.
 13. safeFmod360(v)
     - Mengamankan nilai sudut derajat agar selalu berputar di dalam rentang 0.0 - 360.0.
 14. dayOfYear(epoch)
     - Menghitung urutan hari dalam 1 tahun (1-366) berdasarkan waktu epoch (Unix time).
 15. diurnalCycle(hour, minute, peakHour)
     - Mensimulasikan siklus fluktuasi harian (diurnal) berdasarkan jam dan menit.
 16. seasonalCycle(doy, peakDay)
     - Mensimulasikan siklus fluktuasi musiman (tahunan) berdasarkan urutan hari dalam setahun.
 17. getCurrentEpoch(onlineMode)
     - Mendapatkan waktu epoch (detik Unix) saat ini baik pada mode online (NTP) maupun offline (jam virtual).
 18. formatTimestamp(epoch)
     - Mengonversi waktu epoch Unix menjadi String berformat ISO 8601 (YYYY-MM-DDTHH:MM:SS+07:00).
 19. getTimestampNTP()
     - Mendapatkan String timestamp terkini yang sudah terkalibrasi dengan server NTP.
 20. makeMessageId()
     - Membuat ID pesan unik bertipe string untuk payload (format: MSG-DEVICE_ID-MILLIS).
 21. syncTimeWithNTP()
     - Menghubungkan ke server NTP (Google/Cloudflare/Windows) untuk menyinkronkan jam internal ESP32.
 22. timestampForMode(onlineMode)
     - Mengembalikan String timestamp sesuai mode operasi aktif (waktu NTP online atau jam virtual offline).
 23. updateVirtualClock()
     - Memperbarui akumulasi detik, menit, jam, dan hari untuk jam virtual saat offline.
 24. sanitizeRangeValues(minV, maxV, hardMin, hardMax, defMin, defMax)
     - Memvalidasi dan memastikan batas nilai min/max sensor aman serta sesuai aturan rentang.
 25. sanitizeAllRanges()
     - Menjalankan proses sanitasi nilai rentang pada seluruh variabel sensor dummy.
 26. loadRangesFromPortal()
     - Membaca batas min/max rentang sensor yang diinputkan pengguna melalui portal web WiFiManager.
 27. saveParamCallback()
     - Callback function yang dieksekusi otomatis ketika pengguna menyimpan konfigurasi pada portal web.
 28. parseMqttEndpoint(endpoint, hostOut, portOut, secureOut)
     - Menguraikan (parsing) alamat endpoint MQTT menjadi host broker, port, dan tipe keamanan SSL/TLS.
 29. configureMqttClient()
     - Mengatur konfigurasi objek PubSubClient (host, port, SSL/TLS insecure, buffer 4KB, timeout).
 30. applySendIntervalFromPortal()
     - Mengambil nilai interval pengiriman data dari portal web dan mengonversinya ke milidetik.
 31. probeInternetConnectivity()
     - Menguji keberadaan koneksi internet aktual dengan melakukan HTTP GET ke server verifikasi (generate_204).
 32. ensureStaConnection()
     - Memastikan status koneksi WiFi Station tetap terhubung dan melakukan reconnct jika terputus.
 33. syncExternalClockIfNeeded(force)
     - Melakukan sinkronisasi ulang NTP dan memperbarui konteks API eksternal jika internet baru terhubung.
 34. beginNewSendCycle()
     - Memersihkan status dan reset variabel pengiriman data untuk memulai siklus pengiriman berikutnya.
 35. armSendCycle(payload)
     - Mengunci (arm) payload JSON yang disiapkan dan memulai jadwal percobaan pengiriman data.
 36. processQueuedMqttSend()
     - Mengelola proses pengiriman payload dalam antrean (MQTT/HTTP) dengan mekanisme percobaan ulang (retry).
 37. buildMqttTopic()
     - Menyusun topik MQTT tempat data sensor dummy akan dipublikasikan.
 38. sendPayloadToApi(payload)
     - Mengirimkan string payload JSON ke REST API backend melalui protokol HTTP/HTTPS POST.
 39. ensureMqttConnected()
     - Memeriksa koneksi ke broker MQTT dan melakukan reconnect secara otomatis jika koneksi terputus.
 40. buildWeatherUrl(lat, lon)
     - Menyusun string URL endpoint Open-Meteo Weather API berdasarkan koordinat lokasi.
 41. buildAirQualityUrl(lat, lon)
     - Menyusun string URL endpoint Open-Meteo Air Quality API berdasarkan koordinat lokasi.
 42. applyWeatherFallback(ctx, lat, lon, epoch)
     - Mensimulasikan nilai awal parameter cuaca & kualitas udara berbasis rumus jika API eksternal tidak dapat diakses.
 43. fetchWeatherContext(lat, lon, ctx)
     - Memanggil Open-Meteo Weather API untuk mengambil nilai aktual suhu, kelembapan, tekanan, cuaca, dll.
 44. fetchAirQualityContext(lat, lon, ctx)
     - Memanggil Open-Meteo Air Quality API untuk mengambil nilai aktual CO2, NO2, dan CH4.
 45. sanitizeApiContext(ctx)
     - Mengapit dan memvalidasi data acuan hasil pembacaan API agar tetap dalam batas wajar.
 46. refreshExternalContext(forceFallback)
     - Memperbarui data acuan eksternal (API/Fallback) untuk menjadi patokan awal pembuatan data dummy.
 47. boundedRandomWalk(previous, target, minV, maxV, maxStep, alpha, noiseScale)
     - Menghasilkan nilai dummy baru yang bergerak acak (random walk) secara natural mendekati target tetapi terbatas min/max.
 48. applySolarBatteryModel(epoch, daylightFactor, cloudCoverPct)
     - Mensimulasikan penurunan/peningkatan voltase baterai berdasarkan siklus pengisian solar panel dan beban harian.
 49. mapBatteryPercent(voltage)
     - Mengonversi voltase baterai (11.4V - 13.9V) menjadi nilai persentase 0% - 100%.
 50. dayLightFactor(hour, minute)
     - Menghitung rasio intensitas sinar matahari berdasarkan jam harian (0.0 pada malam hari, 1.0 pada siang hari).
 51. generateDummyData(onlineMode)
     - Fungsi utama pembangkit seluruh parameter data sensor dummy Agrisense.
 52. debugPrintSensorData(d)
     - Mencetak ringkasan snapshot data sensor ke Serial Monitor untuk keperluan pengujian.
 53. buildJsonPayload(d)
     - Menyusun struktur data sensor menjadi format JSON rapi (Pretty JSON) sesuai skema Agrisense.
 54. sendPayloadToServer(payload)
     - Mengkoordinasikan pengiriman payload data ke server melalui MQTT Publish dan HTTP POST.
 55. initialSync()
     - Melakukan proses sinkronisasi awal konteks data eksternal saat program baru dinyalakan.
 56. registerRangeParams()
     - Mendaftarkan seluruh input parameter min/max rentang sensor dummy ke tampilan Web Portal WiFiManager.
 57. applyCurrentPortalValues()
     - Menerapkan nilai-nilai konfigurasi terbaru yang diambil dari portal web WiFiManager ke variabel program.
 58. setupPortalParameters()
     - Menginisialisasi seluruh form parameter konfigurasi untuk Web Portal WiFiManager.
 59. setup()
     - Fungsi inisialisasi utama sistem ESP32 (serial, WiFiManager, MQTT client, NTP, & timer).
 60. updateOfflineTimeIfNeeded()
     - Memperbarui jam virtual jika sistem sedang berada dalam mode offline tanpa koneksi internet.
 61. loop()
     - Fungsi siklus utama yang dijalankan terus-menerus oleh ESP32 (menangani portal, koneksi, antrean, & generasi sensor).
 --------------------------------------------------------------------------------------------------
*/

#include <ArduinoJson.h>
#include <PubSubClient.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>

#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <ESP8266mDNS.h>
#include <math.h>
#include <time.h>

struct SensorData {
  String message_id;
  String device_id;
  String timestamp;

  float latitude;
  float longitude;
  float altitude_m;

  float co2_ppm;
  float tvoc_ppb;
  float ch4_ppm;
  float no2_ppb;
  float n2o_ppb;

  float air_temperature_c;
  float air_humidity_percent;
  float air_pressure_hpa;
  float cloud_cover_percent;
  float wind_speed_kmh;
  float light_lux;

  float soil_moisture_percent;
  float soil_temperature_c;
  float soil_ec_ms_cm;
  float soil_ph;
  int soil_n_mg_kg;
  int soil_p_mg_kg;
  int soil_k_mg_kg;

  float battery_voltage;
  int battery_percent;

  String network_type;
  int rssi_dbm;

  String node_status;
  String sensor_status;
  String firmware_version;
};

struct ApiContext {
  bool weather_ok = false;
  bool air_ok = false;

  float temp_c = 26.0f;
  float humidity_pct = 75.0f;
  float pressure_hpa = 1010.0f;
  float cloud_cover_pct = 45.0f;
  float wind_speed_kmh = 7.0f;
  float soil_temp_c = 25.0f;
  float soil_moisture_pct = 45.0f;

  float co2_ppm = 430.0f;
  float no2_ppb = 18.0f;
  float ch4_ppm = 1.90f;
};

struct DummyState {
  float co2_ppm = 430.0f;
  float tvoc_ppb = 55.0f;
  float ch4_ppm = 1.90f;
  float no2_ppb = 18.0f;
  float n2o_ppb = 333.0f;

  float temp_c = 26.0f;
  float humidity_pct = 75.0f;
  float pressure_hpa = 1010.0f;
  float cloud_cover_pct = 45.0f;
  float wind_speed_kmh = 7.0f;
  float light_lux = 32000.0f;

  float soil_moisture_pct = 45.0f;
  float soil_temp_c = 25.0f;
  float soil_ec_ms_cm = 1.2f;
  float soil_ph = 6.6f;
  float soil_n_mg_kg = 175.0f;
  float soil_p_mg_kg = 40.0f;
  float soil_k_mg_kg = 230.0f;

  float battery_voltage = 12.6f;
};

struct RangeField {
  float *minValue;
  float *maxValue;
  float hardMin;
  float hardMax;
  float defaultMin;
  float defaultMax;
  const char *prettyLabel;
  WiFiManagerParameter *pMin;
  WiFiManagerParameter *pMax;
};

void sanitizeApiContext(ApiContext &ctx);
void configureMqttClient();
void refreshExternalContext(bool forceFallback = false);

static void applySendIntervalFromPortal();
static bool probeInternetConnectivity();
static void ensureStaConnection();
static void syncExternalClockIfNeeded(bool force = false);
static float applySolarBatteryModel(time_t epoch, float daylightFactor,
                                    float cloudCoverPct);
static void beginNewSendCycle();
static void armSendCycle(const String &payload);
static void processQueuedMqttSend();
bool sendPayloadToServer(const String &payload);

static inline float clampf(float v, float lo, float hi) {
  return (v < lo) ? lo : ((v > hi) ? hi : v);
}

static inline bool isFiniteNumber(float v) { return !(isnan(v) || isinf(v)); }

static inline float randomFloat(float minVal, float maxVal) {
  if (maxVal < minVal) {
    float t = minVal;
    minVal = maxVal;
    maxVal = t;
  }
  return minVal + (float)random(100000) / 100000.0f * (maxVal - minVal);
}

static inline float noiseLike(float scale) {
  // Sum of uniforms -> smoother than a single uniform sample.
  float n = randomFloat(-1.0f, 1.0f) + randomFloat(-1.0f, 1.0f) +
            randomFloat(-1.0f, 1.0f);
  return n * (scale / 3.0f);
}

static inline float smoothTowards(float prev, float target, float maxStep,
                                  float alpha) {
  if (!isFiniteNumber(prev) || !isFiniteNumber(target))
    return target;
  float delta = target - prev;
  float blended = prev + delta * alpha;
  float step = blended - prev;
  step = clampf(step, -maxStep, maxStep);
  return prev + step;
}

static inline float reflectWithin(float v, float lo, float hi) {
  if (lo > hi) {
    float t = lo;
    lo = hi;
    hi = t;
  }
  if (v < lo)
    return lo + (lo - v);
  if (v > hi)
    return hi - (v - hi);
  return v;
}

static inline float deg2rad(float d) { return d * 0.01745329252f; }
static inline float maxf(float a, float b) { return (a > b) ? a : b; }

static inline float ugm3ToPPB(float ugm3, float molecularWeight, float tempC,
                              float pressureHpa) {
  float factor =
      24.45f * ((tempC + 273.15f) / 298.15f) * (1013.25f / pressureHpa);
  return (ugm3 * factor) / molecularWeight;
}

static inline float ugm3ToPPM(float ugm3, float molecularWeight, float tempC,
                              float pressureHpa) {
  return ugm3ToPPB(ugm3, molecularWeight, tempC, pressureHpa) / 1000.0f;
}

static inline float norm01(float x, float lo, float hi) {
  if (hi <= lo)
    return 0.5f;
  return clampf((x - lo) / (hi - lo), 0.0f, 1.0f);
}

static inline float centeredNorm(float x, float lo, float hi) {
  return norm01(x, lo, hi) * 2.0f - 1.0f;
}

static inline float safeFmod360(float v) {
  while (v < 0.0f)
    v += 360.0f;
  while (v >= 360.0f)
    v -= 360.0f;
  return v;
}

static int dayOfYear(time_t epoch) {
  struct tm t;
  localtime_r(&epoch, &t);
  return t.tm_yday + 1;
}

static float diurnalCycle(int hour, int minute, float peakHour = 14.0f) {
  float h = (float)hour + (float)minute / 60.0f;
  return sinf(2.0f * PI * ((h - peakHour) / 24.0f));
}

static float seasonalCycle(int doy, float peakDay = 172.0f) {
  return sinf(2.0f * PI * (((float)doy - peakDay) / 365.0f));
}

#define RANGE_LIST(X)                                                          \
  X(air_temperature_c, "Air Temperature", -10.0f, 60.0f, 20.0f, 38.0f)         \
  X(air_humidity_percent, "Air Humidity", 0.0f, 100.0f, 40.0f, 95.0f)          \
  X(air_pressure_hpa, "Air Pressure", 850.0f, 1100.0f, 950.0f, 1015.0f)        \
  X(cloud_cover_percent, "Cloud Cover", 0.0f, 100.0f, 0.0f, 100.0f)            \
  X(wind_speed_kmh, "Wind Speed", 0.0f, 120.0f, 0.0f, 20.0f)                   \
  X(light_lux, "Light Lux", 1.0f, 100000.0f, 20.0f, 100000.0f)                 \
  X(co2_ppm, "CO2", 350.0f, 5000.0f, 430.0f, 800.0f)                           \
  X(tvoc_ppb, "TVOC", 0.0f, 5000.0f, 20.0f, 450.0f)                            \
  X(ch4_ppm, "CH4", 0.0f, 10.0f, 1.6f, 2.5f)                                   \
  X(no2_ppb, "NO2", 0.0f, 2000.0f, 10.0f, 100.0f)                              \
  X(n2o_ppb, "N2O ppb", 250.0f, 500.0f, 330.0f, 345.0f)                        \
  X(soil_moisture_percent, "Soil Moisture", 0.0f, 100.0f, 15.0f, 80.0f)        \
  X(soil_temperature_c, "Soil Temperature", -10.0f, 60.0f, 20.0f, 38.0f)       \
  X(soil_ec_ms_cm, "Soil EC", 0.0f, 10.0f, 1.2f, 3.0f)                         \
  X(soil_ph, "Soil pH", 3.0f, 10.0f, 6.0f, 7.5f)                               \
  X(soil_n_mg_kg, "Soil N", 0.0f, 500.0f, 100.0f, 300.0f)                      \
  X(soil_p_mg_kg, "Soil P", 0.0f, 200.0f, 20.0f, 80.0f)                        \
  X(soil_k_mg_kg, "Soil K", 0.0f, 600.0f, 100.0f, 350.0f)                      \
  X(battery_voltage, "Battery Voltage", 9.0f, 15.0f, 11.5f, 14.4f)             \
  X(battery_percent, "Battery Percent", 0.0f, 100.0f, 0.0f, 100.0f)

#define DECL_RANGE_VARS(name, label, hardMin, hardMax, defMin, defMax)         \
  float name##_min = defMin;                                                   \
  float name##_max = defMax;                                                   \
  WiFiManagerParameter *p_##name##_min = nullptr;                              \
  WiFiManagerParameter *p_##name##_max = nullptr;

RANGE_LIST(DECL_RANGE_VARS)
#undef DECL_RANGE_VARS

struct ConfigParam {
  WiFiManagerParameter **param;
  const char *id;
  const char *label;
  int length;
  String defaultValue;
};

WiFiManager wm;
// MQTT transport
WiFiClient mqttPlainClient;
WiFiClientSecure mqttSecureClient;
PubSubClient mqttClient(mqttPlainClient);

String mqttBrokerHost = "broker.emqx.io";
uint16_t mqttBrokerPort = 1883;
bool mqttUseSecure = false;
String mqttPublishTopicBase = "agrisense/iot/readings";
unsigned long lastMqttReconnectAttempt = 0;



WiFiManagerParameter *p_device_id, *p_lat, *p_lng, *p_alt;
WiFiManagerParameter *p_mqtt_topic, *p_mqtt_broker, *p_mqtt_port, *p_mqtt_user,
    *p_mqtt_pass;

String device_id_val = "AGRISENSE-CC-001";

String mqttTopicPortal = "agrisense/iot/readings";
String mqttBrokerPortal = "broker.emqx.io";
uint16_t mqttPortPortal = 1883;
String mqttUserPortal = "";
String mqttPassPortal = "";
String sendIntervalPortal = "60";
uint32_t sendIntervalMinutes = 60;
unsigned long sendIntervalMs = 60UL * 60000UL;
unsigned long nextScheduledSendAt = 0;
unsigned long currentCycleStartedAt = 0;
unsigned long nextAttemptAt = 0;
uint8_t currentAttempt = 0;
bool sendCycleActive = false;
bool mqttDeliveredInCycle = false;
String queuedPayload = "";
unsigned long lastInternetProbe = 0;
bool internetReachable = false;
bool internetReachableKnown = false;
time_t lastBatteryEpoch = 0;
float lat_sumedang = -6.841540f;
float lng_sumedang = 107.902100f;
float alt_sumedang = 483.0f;

const char *ntpServer = "time.google.com";
const char *ntpServer2 = "time.cloudflare.com";
const char *ntpServer3 = "time.windows.com";
const long gmtOffset_sec = 25200;
const int daylightOffset_sec = 0;



bool ntpSynced = false;
unsigned long lastNtpSync = 0;
const unsigned long ntpInterval = 3600000UL;
bool initialSyncDone = false;
unsigned long lastApiFetch = 0;
const unsigned long apiInterval = 600000UL;

bool isOfflineMode = false;
uint32_t minutesPassed = 60;
unsigned long nextDelayMs = 300000UL;
unsigned long lastTick = 0;
unsigned long lastSensorMillis = 0;
const unsigned long sensorInterval = 300000UL; // 5 menit

int v_hour = 8;
int v_min = 0;
int v_sec = 0;
int v_day = 23;
int v_month = 4;
int v_year = 2026;

ApiContext apiContext;
DummyState dummyState;

RangeField ranges[] = {
#define MAKE_RANGE(name, label, hardMin, hardMax, defMin, defMax)              \
  {&name##_min, &name##_max, hardMin, hardMax, defMin,                         \
   defMax,      label,       nullptr, nullptr},
    RANGE_LIST(MAKE_RANGE)
#undef MAKE_RANGE
};



static time_t getCurrentEpoch(bool onlineMode) {
  if (onlineMode) {
    return time(nullptr);
  }
  struct tm t;
  memset(&t, 0, sizeof(t));
  t.tm_year = v_year - 1900;
  t.tm_mon = v_month - 1;
  t.tm_mday = v_day;
  t.tm_hour = v_hour;
  t.tm_min = v_min;
  t.tm_sec = v_sec;
  return mktime(&t);
}

static String formatTimestamp(time_t epoch) {
  struct tm ti;
  localtime_r(&epoch, &ti);
  char buf[32];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S+07:00", &ti);
  return String(buf);
}

String getTimestampNTP() {
  time_t now = time(nullptr);
  if (now < 1600000000) {
    return "1970-01-01T00:00:00+07:00";
  }
  return formatTimestamp(now);
}

String makeMessageId() {
  char buf[64];
  snprintf(buf, sizeof(buf), "MSG-%s-%010lu", device_id_val.c_str(),
           (unsigned long)millis());
  return String(buf);
}

void syncTimeWithNTP() {
  if (WiFi.status() != WL_CONNECTED) {
    ntpSynced = false;
    Serial.println("[NTP] WiFi not connected, skip.");
    return;
  }

  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer, ntpServer2,
             ntpServer3);

  time_t now = time(nullptr);
  int retry = 0;
  while (now < 1600000000 && retry < 10) {
    delay(300);
    now = time(nullptr);
    retry++;
  }

  ntpSynced = (now >= 1600000000);
  if (ntpSynced) {
    Serial.println("[NTP] Sync OK: " + getTimestampNTP());
  } else {
    Serial.println("[NTP] Sync failed");
  }
}

String timestampForMode(bool onlineMode) {
  if (onlineMode && ntpSynced) {
    return getTimestampNTP();
  }
  time_t epoch = getCurrentEpoch(false);
  return formatTimestamp(epoch);
}

void updateVirtualClock() {
  unsigned long now = millis();
  if (now - lastTick >= 1000UL) {
    lastTick = now;
    v_sec++;
    if (v_sec >= 60) {
      v_sec = 0;
      v_min++;
      if (v_min >= 60) {
        v_min = 0;
        v_hour++;
        if (v_hour >= 24) {
          v_hour = 0;
          v_day++;
        }
      }
    }
  }
}

void sanitizeRangeValues(float &minV, float &maxV, float hardMin, float hardMax,
                         float defMin, float defMax) {
  if (!isFiniteNumber(minV) || !isFiniteNumber(maxV)) {
    minV = defMin;
    maxV = defMax;
  }

  if (minV > maxV) {
    float t = minV;
    minV = maxV;
    maxV = t;
  }

  minV = clampf(minV, hardMin, hardMax);
  maxV = clampf(maxV, hardMin, hardMax);

  if ((maxV - minV) < 0.0001f) {
    minV = defMin;
    maxV = defMax;
  }

  if (minV > maxV) {
    minV = defMin;
    maxV = defMax;
  }

  minV = clampf(minV, hardMin, hardMax);
  maxV = clampf(maxV, hardMin, hardMax);
}

void sanitizeAllRanges() {
#define SANITIZE(name, label, hardMin, hardMax, defMin, defMax)                \
  sanitizeRangeValues(name##_min, name##_max, hardMin, hardMax, defMin, defMax);
  RANGE_LIST(SANITIZE)
#undef SANITIZE
}

void loadRangesFromPortal() {
#define LOAD_RANGE(name, label, hardMin, hardMax, defMin, defMax)              \
  if (p_##name##_min)                                                          \
    name##_min = atof(p_##name##_min->getValue());                             \
  if (p_##name##_max)                                                          \
    name##_max = atof(p_##name##_max->getValue());
  RANGE_LIST(LOAD_RANGE)
#undef LOAD_RANGE
  sanitizeAllRanges();
}

void saveParamCallback() {
  device_id_val = String(p_device_id->getValue());
  lat_sumedang = atof(p_lat->getValue());
  lng_sumedang = atof(p_lng->getValue());
  alt_sumedang = atof(p_alt->getValue());

  if (p_mqtt_topic)
    mqttTopicPortal = String(p_mqtt_topic->getValue());
  if (p_mqtt_broker)
    mqttBrokerPortal = String(p_mqtt_broker->getValue());
  if (p_mqtt_port) {
    int portVal = atoi(p_mqtt_port->getValue());
    mqttPortPortal =
        (portVal > 0 && portVal <= 65535) ? (uint16_t)portVal : 8883;
  }
  if (p_mqtt_user)
    mqttUserPortal = String(p_mqtt_user->getValue());
  if (p_mqtt_pass)
    mqttPassPortal = String(p_mqtt_pass->getValue());


  applySendIntervalFromPortal();

  loadRangesFromPortal();
  configureMqttClient();
  Serial.println(">>> Config Updated via Web Portal <<<");
}

void configureMqttClient() {
  if (mqttBrokerPortal.length() > 0) {
    mqttBrokerHost = mqttBrokerPortal;
    mqttBrokerPort = (mqttPortPortal > 0) ? mqttPortPortal : 1883;
    // TLS hanya aktif jika port 8883
    mqttUseSecure = (mqttBrokerPort == 8883);
  } else {
    mqttBrokerHost = "broker.emqx.io";
    mqttBrokerPort = 1883;
    mqttUseSecure = false;
  }

  mqttPublishTopicBase =
      mqttTopicPortal.length() > 0 ? mqttTopicPortal : "agrisense/iot/readings";

  mqttClient.setClient(mqttUseSecure ? (Client &)mqttSecureClient
                                     : (Client &)mqttPlainClient);
  mqttClient.setServer(mqttBrokerHost.c_str(), mqttBrokerPort);
  mqttClient.setBufferSize(2048);
  mqttClient.setKeepAlive(60);
  mqttClient.setSocketTimeout(15);

  if (mqttUseSecure) {
    mqttSecureClient.setInsecure();
    mqttSecureClient.setBufferSizes(4096, 512); // Stabil untuk HiveMQ Cloud
  }
}

static void applySendIntervalFromPortal() {
  if (sendIntervalMinutes < 1)
    sendIntervalMinutes = 1;
  sendIntervalMs = sendIntervalMinutes * 60000UL;
  if (sendIntervalMs == 0)
    sendIntervalMs = 60000UL;
}

static bool probeInternetConnectivity() {
  if (WiFi.status() != WL_CONNECTED)
    return false;

  WiFiClient client;
  HTTPClient http;
  http.setTimeout(3000);
  if (!http.begin(client, "http://clients3.google.com/generate_204")) {
    return false;
  }

  int code = http.GET();
  http.end();
  return (code == 204 || code == 200);
}

static void ensureStaConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
  }
}

static void syncExternalClockIfNeeded(bool force) {
  if (WiFi.status() != WL_CONNECTED)
    return;
  if (force || !internetReachableKnown || !internetReachable) {
    syncTimeWithNTP();
    refreshExternalContext(false);
  }
}

static void beginNewSendCycle() {
  queuedPayload = "";
  sendCycleActive = false;
  currentAttempt = 0;
  currentCycleStartedAt = 0;
  nextAttemptAt = 0;
  mqttDeliveredInCycle = false;
}

static void armSendCycle(const String &payload) {
  queuedPayload = payload;
  sendCycleActive = true;
  currentAttempt = 0;
  mqttDeliveredInCycle = false;
  currentCycleStartedAt = millis();
  nextAttemptAt = currentCycleStartedAt;
  nextScheduledSendAt = currentCycleStartedAt + sendIntervalMs;
}

static void processQueuedMqttSend() {
  if (!sendCycleActive)
    return;
  if (isOfflineMode)
    return;
  if (WiFi.status() != WL_CONNECTED)
    return;

  unsigned long now = millis();
  if ((long)(now - nextAttemptAt) < 0) {
    return;
  }

  currentAttempt++;
  Serial.printf("[MQTT/HTTP] Percobaan kirim %u/4\n",
                (unsigned int)currentAttempt);

  bool ok = sendPayloadToServer(queuedPayload);
  if (ok) {
    Serial.println("[MQTT/HTTP] Data terkirim pada siklus ini.");
    beginNewSendCycle();
    nextScheduledSendAt = now + sendIntervalMs;
    return;
  }

  if (currentAttempt >= 4) {
    Serial.println("[MQTT/HTTP] Gagal 4 kali, skip ke jadwal berikutnya.");
    unsigned long cycleStart = currentCycleStartedAt;
    beginNewSendCycle();
    nextScheduledSendAt = cycleStart + sendIntervalMs;
    if ((long)(nextScheduledSendAt - now) < 0) {
      nextScheduledSendAt = now + sendIntervalMs;
    }
    return;
  }

  unsigned long retryStep = sendIntervalMs / 4UL;
  if (retryStep < 1000UL)
    retryStep = 1000UL;
  nextAttemptAt = now + retryStep;
  Serial.printf("[MQTT/HTTP] Retry berikutnya dalam %lu ms\n", retryStep);
}

String buildMqttTopic() { return mqttPublishTopicBase; }



bool ensureMqttConnected() {
  if (WiFi.status() != WL_CONNECTED)
    return false;

  if (mqttClient.connected()) {
    mqttClient.loop();
    return true;
  }

  if (millis() - lastMqttReconnectAttempt < 5000UL) {
    return false;
  }
  lastMqttReconnectAttempt = millis();

  configureMqttClient();

  String clientId = "Agrisense-" + device_id_val + "-" +
                    String(ESP.getChipId(), HEX);
  clientId.toUpperCase();

  bool ok;
  if (mqttUserPortal.length() > 0) {
    ok = mqttClient.connect(clientId.c_str(), mqttUserPortal.c_str(),
                            mqttPassPortal.c_str());
  } else {
    ok = mqttClient.connect(clientId.c_str());
  }
  if (ok) {
    Serial.print("[MQTT] Connected to broker ");
    Serial.print(mqttBrokerHost);
    Serial.print(":");
    Serial.println(mqttBrokerPort);
  } else {
    Serial.print("[MQTT] Connect failed, state=");
    Serial.println(mqttClient.state());
  }
  return ok;
}

String buildWeatherUrl(float lat, float lon) {
  String url =
      "https://api.open-meteo.com/v1/forecast?latitude=" + String(lat, 6) +
      "&longitude=" + String(lon, 6) +
      "&current=temperature_2m,relative_humidity_2m,surface_pressure,cloud_"
      "cover,wind_speed_10m,soil_temperature_6cm,soil_moisture_3_to_9cm&"
      "timezone=auto";
  return url;
}

String buildAirQualityUrl(float lat, float lon) {
  String url =
      "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=" +
      String(lat, 6) + "&longitude=" + String(lon, 6) +
      "&current=carbon_dioxide,nitrogen_dioxide,methane,carbon_monoxide,pm2_5,"
      "pm10,ozone,sulphur_dioxide&timezone=auto";
  return url;
}

void applyWeatherFallback(ApiContext &ctx, float lat, float lon, time_t epoch) {
  int hour = 12;
  int minute = 0;
  int doy = 180;
  if (epoch >= 1600000000) {
    struct tm t;
    localtime_r(&epoch, &t);
    hour = t.tm_hour;
    minute = t.tm_min;
    doy = t.tm_yday + 1;
  }

  float latBias =
      sinf(deg2rad(lat * 1.8f)) * 2.0f + cosf(deg2rad(lon * 0.9f)) * 1.5f;
  float seasonal = seasonalCycle(doy, 172.0f);
  float diurnal = diurnalCycle(hour, minute, 14.0f);

  ctx.temp_c = 26.0f - fabsf(lat) * 0.08f + latBias + seasonal * 3.5f +
               diurnal * 2.0f - (alt_sumedang * 0.0065f);
  ctx.humidity_pct =
      72.0f + seasonal * -6.0f - diurnal * 14.0f + latBias * 1.4f;
  ctx.pressure_hpa =
      1010.0f - (alt_sumedang * 0.11f) + seasonal * 1.8f + latBias * 0.8f;
  ctx.cloud_cover_pct =
      48.0f + ctx.humidity_pct * 0.22f - diurnal * 12.0f + noiseLike(6.0f);
  ctx.wind_speed_kmh =
      5.0f + fabsf(diurnal) * 7.0f + fabsf(seasonal) * 3.0f + fabsf(latBias);
  ctx.soil_temp_c = ctx.temp_c - 1.7f + seasonal * 0.8f;
  ctx.soil_moisture_pct =
      ctx.humidity_pct * 0.58f + ctx.cloud_cover_pct * 0.12f + noiseLike(4.0f);

  ctx.co2_ppm =
      425.0f + fabsf(latBias) * 3.0f + diurnal * 4.0f + noiseLike(2.0f);
  ctx.no2_ppb =
      14.0f + fabsf(latBias) * 2.2f +
      (1.0f - clampf(ctx.wind_speed_kmh / 40.0f, 0.0f, 1.0f)) * 10.0f +
      noiseLike(2.5f);
  ctx.ch4_ppm = 1.80f + seasonal * 0.06f + noiseLike(0.02f);
}

bool fetchWeatherContext(float lat, float lon, ApiContext &ctx) {
  if (WiFi.status() != WL_CONNECTED)
    return false;

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  String url = buildWeatherUrl(lat, lon);

  http.begin(client, url);
  int code = http.GET();
  if (code != HTTP_CODE_OK) {
    http.end();
    return false;
  }

  String response = http.getString();
  http.end();

  DynamicJsonDocument doc(4096);
  if (deserializeJson(doc, response))
    return false;
  if (!doc.containsKey("current"))
    return false;

  JsonObject current = doc["current"].as<JsonObject>();
  bool ok = false;

  if (current.containsKey("temperature_2m")) {
    ctx.temp_c = current["temperature_2m"].as<float>();
    ok = true;
  }
  if (current.containsKey("relative_humidity_2m")) {
    ctx.humidity_pct = current["relative_humidity_2m"].as<float>();
    ok = true;
  }
  if (current.containsKey("surface_pressure")) {
    ctx.pressure_hpa = current["surface_pressure"].as<float>();
    ok = true;
  }
  if (current.containsKey("cloud_cover")) {
    ctx.cloud_cover_pct = current["cloud_cover"].as<float>();
    ok = true;
  }
  if (current.containsKey("wind_speed_10m")) {
    ctx.wind_speed_kmh = current["wind_speed_10m"].as<float>();
    ok = true;
  }
  if (current.containsKey("soil_temperature_6cm")) {
    ctx.soil_temp_c = current["soil_temperature_6cm"].as<float>();
    ok = true;
  }
  if (current.containsKey("soil_moisture_3_to_9cm")) {
    ctx.soil_moisture_pct =
        current["soil_moisture_3_to_9cm"].as<float>() * 100.0f;
    ok = true;
  }

  ctx.weather_ok = ok;
  return ok;
}

bool fetchAirQualityContext(float lat, float lon, ApiContext &ctx) {
  if (WiFi.status() != WL_CONNECTED)
    return false;

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  String url = buildAirQualityUrl(lat, lon);

  http.begin(client, url);
  int code = http.GET();
  if (code != HTTP_CODE_OK) {
    http.end();
    return false;
  }

  String response = http.getString();
  http.end();

  DynamicJsonDocument doc(4096);
  if (deserializeJson(doc, response))
    return false;
  if (!doc.containsKey("current"))
    return false;

  JsonObject current = doc["current"].as<JsonObject>();
  bool ok = false;

  if (current.containsKey("carbon_dioxide")) {
    ctx.co2_ppm = current["carbon_dioxide"].as<float>();
    ok = true;
  }
  if (current.containsKey("nitrogen_dioxide")) {
    float no2_ugm3 = current["nitrogen_dioxide"].as<float>();
    ctx.no2_ppb = ugm3ToPPB(no2_ugm3, 46.0055f, ctx.temp_c, ctx.pressure_hpa);
    ok = true;
  }
  if (current.containsKey("methane")) {
    float ch4_ugm3 = current["methane"].as<float>();
    ctx.ch4_ppm = ugm3ToPPM(ch4_ugm3, 16.043f, ctx.temp_c, ctx.pressure_hpa);
    ok = true;
  }

  ctx.air_ok = ok;
  return ok;
}

void sanitizeApiContext(ApiContext &ctx) {
  ctx.temp_c = clampf(ctx.temp_c, -20.0f, 60.0f);
  ctx.humidity_pct = clampf(ctx.humidity_pct, 0.0f, 100.0f);
  ctx.pressure_hpa = clampf(ctx.pressure_hpa, 850.0f, 1100.0f);
  ctx.cloud_cover_pct = clampf(ctx.cloud_cover_pct, 0.0f, 100.0f);
  ctx.wind_speed_kmh = clampf(ctx.wind_speed_kmh, 0.0f, 120.0f);
  ctx.soil_temp_c = clampf(ctx.soil_temp_c, -10.0f, 60.0f);
  ctx.soil_moisture_pct = clampf(ctx.soil_moisture_pct, 0.0f, 100.0f);
  ctx.co2_ppm = clampf(ctx.co2_ppm, 350.0f, 5000.0f);
  ctx.no2_ppb = clampf(ctx.no2_ppb, 0.0f, 2000.0f);
  ctx.ch4_ppm = clampf(ctx.ch4_ppm, 0.0f, 10.0f);
}

void refreshExternalContext(bool forceFallback) {
  time_t epoch = getCurrentEpoch(!isOfflineMode);

  ApiContext next;
  next.weather_ok = false;
  next.air_ok = false;
  applyWeatherFallback(next, lat_sumedang, lng_sumedang, epoch);

  if (!forceFallback && WiFi.status() == WL_CONNECTED) {
    fetchWeatherContext(lat_sumedang, lng_sumedang, next);
    fetchAirQualityContext(lat_sumedang, lng_sumedang, next);
  }

  sanitizeApiContext(next);
  apiContext = next;
}

float boundedRandomWalk(float previous, float target, float minV, float maxV,
                        float maxStep, float alpha, float noiseScale) {
  float candidate = smoothTowards(previous, target, maxStep, alpha);
  candidate += noiseLike(noiseScale);
  candidate = reflectWithin(candidate, minV, maxV);

  if (!isFiniteNumber(candidate))
    candidate = target;
  candidate = clampf(candidate, minV, maxV);
  return candidate;
}

static float applySolarBatteryModel(time_t epoch, float daylightFactor,
                                    float cloudCoverPct) {
  if (epoch < 1600000000) {
    return dummyState.battery_voltage;
  }

  if (lastBatteryEpoch == 0 || epoch < lastBatteryEpoch) {
    lastBatteryEpoch = epoch;
    
    // Inisialisasi kapasitas baterai dinamis berdasarkan waktu (jam)
    struct tm ti;
    localtime_r(&epoch, &ti);
    float h = ti.tm_hour + ti.tm_min / 60.0f;
    
    float baseVoltage;
    if (h >= 6.0f && h <= 17.0f) { 
      // Pagi - Sore (Charging via Solar Panel): Naik dari 11.8V ke 13.8V
      float progress = (h - 6.0f) / 11.0f; 
      baseVoltage = 11.8f + (13.8f - 11.8f) * sinf(progress * (PI / 2.0f)); 
    } else { 
      // Malam - Pagi (Discharging): Turun dari 13.8V ke 11.8V
      float progress = (h > 17.0f) ? (h - 17.0f) / 13.0f : (h + 7.0f) / 13.0f;
      baseVoltage = 13.8f - (13.8f - 11.8f) * progress;
    }
    
    dummyState.battery_voltage = baseVoltage;
    return dummyState.battery_voltage;
  }

  float dtHours = (float)(epoch - lastBatteryEpoch) / 3600.0f;
  if (dtHours <= 0.0f) {
    return dummyState.battery_voltage;
  }

  float sun = clampf(daylightFactor, 0.0f, 1.0f);
  float cloudShade = clampf(1.0f - (cloudCoverPct / 100.0f), 0.15f, 1.0f);
  float chargeRateVph = 0.38f * sun * cloudShade;
  float dischargeRateVph = 0.020f + (1.0f - sun) * 0.060f;
  float seasonalDrift = fabsf(seasonalCycle(dayOfYear(epoch))) * 0.004f;

  float target = dummyState.battery_voltage +
                 ((chargeRateVph - dischargeRateVph - seasonalDrift) * dtHours);
  float nextVoltage =
      smoothTowards(dummyState.battery_voltage, target, 0.18f, 0.35f);
  nextVoltage += noiseLike(0.01f);
  nextVoltage = clampf(nextVoltage, *ranges[18].minValue, *ranges[18].maxValue);

  lastBatteryEpoch = epoch;
  dummyState.battery_voltage = nextVoltage;
  return nextVoltage;
}

float mapBatteryPercent(float voltage) {
  float pct = (voltage - 11.4f) / (13.9f - 11.4f) * 100.0f;
  return clampf(pct, 0.0f, 100.0f);
}

float dayLightFactor(int hour, int minute) {
  float h = hour + minute / 60.0f;
  if (h < 5.5f || h > 18.5f)
    return 0.0f;
  if (h <= 12.0f)
    return (h - 5.5f) / (12.0f - 5.5f);
  return (18.5f - h) / (18.5f - 12.0f);
}

SensorData generateDummyData(bool onlineMode) {
  time_t epoch = getCurrentEpoch(onlineMode && ntpSynced);
  struct tm tmNow;
  localtime_r(&epoch, &tmNow);

  int hour = tmNow.tm_hour;
  int minute = tmNow.tm_min;
  int doy = tmNow.tm_yday + 1;

  float latBias = sinf(deg2rad(lat_sumedang * 1.9f)) * 2.0f;
  float lonBias = cosf(deg2rad(lng_sumedang * 0.7f)) * 1.2f;
  float geoBias = latBias + lonBias;
  float seasonal = seasonalCycle(doy);
  float diurnal = diurnalCycle(hour, minute);
  float daylight = dayLightFactor(hour, minute);

  float extTemp = apiContext.temp_c;
  float extHum = apiContext.humidity_pct;
  float extPress = apiContext.pressure_hpa;
  float extCloud = apiContext.cloud_cover_pct;
  float extWind = apiContext.wind_speed_kmh;
  float extSoilTemp = apiContext.soil_temp_c;
  float extSoilMoist = apiContext.soil_moisture_pct;
  float extCO2 = apiContext.co2_ppm;
  float extNO2 = apiContext.no2_ppb;
  float extCH4 = apiContext.ch4_ppm;

  float tempTarget = extTemp + geoBias * 0.7f + seasonal * 1.8f +
                     diurnal * 1.8f - (alt_sumedang * 0.0065f);
  float humTarget = extHum - diurnal * 6.0f - seasonal * 2.5f + geoBias * 0.8f;
  float pressTarget = extPress + geoBias * 0.9f - seasonal * 1.1f;
  float cloudTarget =
      extCloud + humTarget * 0.12f - tempTarget * 0.15f + noiseLike(3.0f);
  float windTarget = maxf(0.0f, extWind + fabsf(diurnal) * 2.0f +
                                    fabsf(seasonal) * 1.2f + noiseLike(1.2f));

  float soilTempTarget = extSoilTemp + geoBias * 0.2f - seasonal * 0.8f;
  float soilMoistTarget = extSoilMoist + (humTarget - 70.0f) * 0.25f +
                          cloudTarget * 0.08f - windTarget * 0.12f;

  float co2Target = extCO2 + (humTarget - 70.0f) * 0.35f +
                    (cloudTarget - 50.0f) * 0.08f - windTarget * 0.15f;
  float tvocTarget = 55.0f + (100.0f - humTarget) * 1.8f +
                     maxf(0.0f, tempTarget - 26.0f) * 6.0f +
                     maxf(0.0f, cloudTarget - 60.0f) * 0.8f;

  float windN = norm01(windTarget, 0.0f, 60.0f);
  float humN = centeredNorm(humTarget, 40.0f, 90.0f);
  float soilMoistN = centeredNorm(soilMoistTarget, 20.0f, 80.0f);
  float tempN = centeredNorm(tempTarget, 20.0f, 35.0f);

  float ch4Factor = 1.0f + 0.020f * humN + 0.030f * soilMoistN -
                    0.050f * windN + 0.010f * seasonal;
  ch4Factor = clampf(ch4Factor, 0.80f, 1.20f);
  float ch4Target = extCH4 * ch4Factor;
  ch4Target += noiseLike(maxf(0.01f, extCH4 * 0.01f));

  float no2Factor = 1.0f + 0.050f * (1.0f - windN) + 0.020f * tempN -
                    0.010f * humN + 0.010f * diurnal;
  no2Factor = clampf(no2Factor, 0.75f, 1.35f);
  float no2Target = extNO2 * no2Factor;
  no2Target += noiseLike(maxf(0.3f, extNO2 * 0.05f));

  float n2oBase = 333.0f;
  float n2oFactor = 1.0f + 0.010f * humN + 0.030f * soilMoistN -
                    0.020f * windN + 0.010f * seasonal;
  n2oFactor = clampf(n2oFactor, 0.90f, 1.10f);
  float n2oTarget = n2oBase * n2oFactor + noiseLike(0.5f);

  float lightTarget =
      daylight * 100000.0f * (1.0f - clampf(cloudTarget / 100.0f, 0.0f, 0.95f));
  lightTarget += noiseLike(500.0f);
  if (lightTarget < 0.0f)
    lightTarget = 0.0f;

  float soilEcTarget = 0.55f + (soilMoistTarget / 100.0f) * 1.75f +
                       (tempTarget - 25.0f) * 0.02f + noiseLike(0.08f);
  float soilPhTarget = 6.4f + (60.0f - soilMoistTarget) * 0.008f -
                       maxf(0.0f, tempTarget - 30.0f) * 0.01f +
                       noiseLike(0.05f);

  float soilNTarget = 175.0f + (soilMoistTarget - 45.0f) * 0.9f +
                      (soilEcTarget - 1.2f) * 18.0f +
                      (soilTempTarget - 25.0f) * 1.8f;
  float soilPTarget = 40.0f + (soilPhTarget - 6.5f) * 6.0f + noiseLike(0.7f);
  float soilKTarget = 230.0f + (soilMoistTarget - 45.0f) * 1.3f +
                      (soilEcTarget - 1.2f) * 28.0f + noiseLike(1.2f);

  float batteryTarget = applySolarBatteryModel(epoch, daylight, cloudTarget);

  dummyState.temp_c =
      boundedRandomWalk(dummyState.temp_c, tempTarget, *ranges[0].minValue,
                        *ranges[0].maxValue, 1.2f, 0.35f, 0.12f);
  dummyState.humidity_pct =
      boundedRandomWalk(dummyState.humidity_pct, humTarget, *ranges[1].minValue,
                        *ranges[1].maxValue, 3.0f, 0.30f, 0.10f);
  dummyState.pressure_hpa = boundedRandomWalk(
      dummyState.pressure_hpa, pressTarget, *ranges[2].minValue,
      *ranges[2].maxValue, 2.0f, 0.30f, 0.04f);
  dummyState.cloud_cover_pct = boundedRandomWalk(
      dummyState.cloud_cover_pct, cloudTarget, *ranges[3].minValue,
      *ranges[3].maxValue, 6.0f, 0.25f, 0.45f);
  dummyState.wind_speed_kmh = boundedRandomWalk(
      dummyState.wind_speed_kmh, windTarget, *ranges[4].minValue,
      *ranges[4].maxValue, 4.0f, 0.30f, 0.30f);
  dummyState.light_lux =
      boundedRandomWalk(dummyState.light_lux, lightTarget, *ranges[5].minValue,
                        *ranges[5].maxValue, 12000.0f, 0.25f, 800.0f);

  dummyState.co2_ppm =
      boundedRandomWalk(dummyState.co2_ppm, co2Target, *ranges[6].minValue,
                        *ranges[6].maxValue, 35.0f, 0.35f, 4.0f);
  dummyState.tvoc_ppb =
      boundedRandomWalk(dummyState.tvoc_ppb, tvocTarget, *ranges[7].minValue,
                        *ranges[7].maxValue, 18.0f, 0.30f, 3.0f);
  dummyState.ch4_ppm =
      boundedRandomWalk(dummyState.ch4_ppm, ch4Target, *ranges[8].minValue,
                        *ranges[8].maxValue, 40.0f, 0.28f, 6.0f);
  dummyState.no2_ppb =
      boundedRandomWalk(dummyState.no2_ppb, no2Target, *ranges[9].minValue,
                        *ranges[9].maxValue, 12.0f, 0.28f, 1.8f);
  dummyState.n2o_ppb =
      boundedRandomWalk(dummyState.n2o_ppb, n2oTarget, *ranges[10].minValue,
                        *ranges[10].maxValue, 3.0f, 0.22f, 0.5f);

  dummyState.soil_moisture_pct = boundedRandomWalk(
      dummyState.soil_moisture_pct, soilMoistTarget, *ranges[11].minValue,
      *ranges[11].maxValue, 4.0f, 0.30f, 0.18f);
  dummyState.soil_temp_c = boundedRandomWalk(
      dummyState.soil_temp_c, soilTempTarget, *ranges[12].minValue,
      *ranges[12].maxValue, 0.9f, 0.32f, 0.08f);
  dummyState.soil_ec_ms_cm = boundedRandomWalk(
      dummyState.soil_ec_ms_cm, soilEcTarget, *ranges[13].minValue,
      *ranges[13].maxValue, 0.18f, 0.34f, 0.03f);
  dummyState.soil_ph =
      boundedRandomWalk(dummyState.soil_ph, soilPhTarget, *ranges[14].minValue,
                        *ranges[14].maxValue, 0.14f, 0.30f, 0.02f);
  dummyState.soil_n_mg_kg = boundedRandomWalk(
      dummyState.soil_n_mg_kg, soilNTarget, *ranges[15].minValue,
      *ranges[15].maxValue, 5.0f, 0.28f, 0.8f);
  dummyState.soil_p_mg_kg = boundedRandomWalk(
      dummyState.soil_p_mg_kg, soilPTarget, *ranges[16].minValue,
      *ranges[16].maxValue, 2.2f, 0.28f, 0.4f);
  dummyState.soil_k_mg_kg = boundedRandomWalk(
      dummyState.soil_k_mg_kg, soilKTarget, *ranges[17].minValue,
      *ranges[17].maxValue, 6.0f, 0.28f, 1.0f);
  dummyState.battery_voltage = boundedRandomWalk(
      dummyState.battery_voltage, batteryTarget, *ranges[18].minValue,
      *ranges[18].maxValue, 0.08f, 0.35f, 0.01f);

  SensorData d;
  d.message_id = makeMessageId();
  d.device_id = device_id_val;
  d.timestamp = timestampForMode(onlineMode && ntpSynced);

  d.latitude = lat_sumedang;
  d.longitude = lng_sumedang;
  d.altitude_m = alt_sumedang;

  d.co2_ppm = dummyState.co2_ppm;
  d.tvoc_ppb = dummyState.tvoc_ppb;
  d.ch4_ppm = dummyState.ch4_ppm;
  d.no2_ppb = dummyState.no2_ppb;
  d.n2o_ppb = dummyState.n2o_ppb;

  d.air_temperature_c = dummyState.temp_c;
  d.air_humidity_percent = dummyState.humidity_pct;
  d.air_pressure_hpa = dummyState.pressure_hpa;
  d.cloud_cover_percent = dummyState.cloud_cover_pct;
  d.wind_speed_kmh = dummyState.wind_speed_kmh;
  d.light_lux = dummyState.light_lux;

  d.soil_moisture_percent = dummyState.soil_moisture_pct;
  d.soil_temperature_c = dummyState.soil_temp_c;
  d.soil_ec_ms_cm = dummyState.soil_ec_ms_cm;
  d.soil_ph = dummyState.soil_ph;
  d.soil_n_mg_kg = (int)lroundf(dummyState.soil_n_mg_kg);
  d.soil_p_mg_kg = (int)lroundf(dummyState.soil_p_mg_kg);
  d.soil_k_mg_kg = (int)lroundf(dummyState.soil_k_mg_kg);

  d.battery_voltage = dummyState.battery_voltage;
  d.battery_percent =
      (int)lroundf(mapBatteryPercent(dummyState.battery_voltage));

  d.network_type = onlineMode ? "WiFi" : "Offline";
  d.rssi_dbm = onlineMode ? WiFi.RSSI() : 0;
  d.node_status = internetReachable ? "online" : "offline";
  d.sensor_status = onlineMode ? "dummy_api_weather_airquality_portal_loc"
                               : "dummy_offline_portal_loc";
  d.firmware_version = "2.0.0-dummy";
  return d;
}

void debugPrintSensorData(const SensorData &d) {
  Serial.println(F("Snapshot:Start"));
  Serial.println("message_id:" + d.message_id);
  Serial.println("device_id:" + d.device_id);
  Serial.println("timestamp:" + d.timestamp);
  Serial.println("latitude:" + String(d.latitude, 6));
  Serial.println("longitude:" + String(d.longitude, 6));
  Serial.println("altitude_m:" + String(d.altitude_m, 2));
  Serial.println("co2_ppm:" + String(d.co2_ppm, 1));
  Serial.println("tvoc_ppb:" + String(d.tvoc_ppb, 1));
  Serial.println("ch4_ppm:" + String(d.ch4_ppm, 1));
  Serial.println("no2_ppb:" + String(d.no2_ppb, 1));
  Serial.println("n2o_ppb:" + String(d.n2o_ppb, 1));
  Serial.println("air_temperature_c:" + String(d.air_temperature_c, 2));
  Serial.println("air_humidity_percent:" + String(d.air_humidity_percent, 1));
  Serial.println("air_pressure_hpa:" + String(d.air_pressure_hpa, 1));
  Serial.println("cloud_cover_percent:" + String(d.cloud_cover_percent, 1));
  Serial.println("wind_speed_kmh:" + String(d.wind_speed_kmh, 1));
  Serial.println("light_lux:" + String(d.light_lux, 1));
  Serial.println("soil_moisture_percent:" + String(d.soil_moisture_percent, 1));
  Serial.println("soil_temperature_c:" + String(d.soil_temperature_c, 2));
  Serial.println("soil_ec_ms_cm:" + String(d.soil_ec_ms_cm, 2));
  Serial.println("soil_ph:" + String(d.soil_ph, 2));
  Serial.println("soil_n_mg_kg:" + String(d.soil_n_mg_kg));
  Serial.println("soil_p_mg_kg:" + String(d.soil_p_mg_kg));
  Serial.println("soil_k_mg_kg:" + String(d.soil_k_mg_kg));
  Serial.println("battery_voltage:" + String(d.battery_voltage, 2));
  Serial.println("battery_percent:" + String(d.battery_percent));
  Serial.println("network_type:" + d.network_type);
  Serial.println("node_status:" + d.node_status);
  Serial.println("ip_addr:" + WiFi.localIP().toString());
  Serial.println(F("Snapshot:End"));
  Serial.flush();
}

String buildJsonPayload(const SensorData &d) {
  StaticJsonDocument<2048> doc;
  doc["message_id"] = d.message_id;
  doc["device_id"] = d.device_id;
  doc["timestamp"] = d.timestamp;

  JsonObject location = doc.createNestedObject("location");
  location["latitude"] = d.latitude;
  location["longitude"] = d.longitude;
  location["altitude_m"] = d.altitude_m;

  JsonObject carbon = doc.createNestedObject("carbon_data");
  carbon["co2_ppm"] = d.co2_ppm;
  carbon["tvoc_ppb"] = d.tvoc_ppb;
  carbon["ch4_ppm"] = d.ch4_ppm;
  carbon["no2_ppb"] = d.no2_ppb;
  carbon["n2o_ppb"] = d.n2o_ppb;

  JsonObject env = doc.createNestedObject("environment");
  env["air_temperature_c"] = d.air_temperature_c;
  env["air_humidity_percent"] = d.air_humidity_percent;
  env["air_pressure_hpa"] = d.air_pressure_hpa;
  // env["cloud_cover_percent"] = d.cloud_cover_percent;
  env["wind_speed_kmh"] = d.wind_speed_kmh;
  env["light_lux"] = d.light_lux;

  JsonObject soil = doc.createNestedObject("soil_7in1");
  soil["soil_moisture_percent"] = d.soil_moisture_percent;
  soil["soil_temperature_c"] = d.soil_temperature_c;
  soil["soil_ec_ms_cm"] = d.soil_ec_ms_cm;
  soil["soil_ph"] = d.soil_ph;
  soil["soil_n_mg_kg"] = d.soil_n_mg_kg;
  soil["soil_p_mg_kg"] = d.soil_p_mg_kg;
  soil["soil_k_mg_kg"] = d.soil_k_mg_kg;

  JsonObject power = doc.createNestedObject("power");
  power["battery_voltage"] = d.battery_voltage;
  power["battery_percent"] = d.battery_percent;

  JsonObject comm = doc.createNestedObject("communication");
  comm["network_type"] = d.network_type;
  comm["rssi_dbm"] = d.rssi_dbm;

  JsonObject status = doc.createNestedObject("status");
  status["node_status"] = d.node_status;
  // status["sensor_status"] = d.sensor_status;
  // status["firmware_version"] = d.firmware_version;
  if (WiFi.status() == WL_CONNECTED) {
    status["ip"] = WiFi.localIP().toString();
  } else {
    status["ip"] = "0.0.0.0";
  }

  String out;
  serializeJsonPretty(doc, out);
  return out;
}

bool sendPayloadToServer(const String &payload) {
  if (isOfflineMode || WiFi.status() != WL_CONNECTED)
    return false;

  bool mqttOk = mqttDeliveredInCycle;

  if (!mqttDeliveredInCycle) {
    if (ensureMqttConnected()) {
      String topic = buildMqttTopic();
      Serial.print("Mengirim payload via MQTT ke topic: ");
      Serial.println(topic);

      mqttOk = mqttClient.publish(topic.c_str(), payload.c_str());

      if (mqttOk) {
        Serial.println("Berhasil! Payload sukses dipublish via MQTT.");
        mqttDeliveredInCycle = true;
        mqttClient.loop();
      } else {
        Serial.println("Gagal publish MQTT.");
      }
    }
  }

  yield();
  return mqttDeliveredInCycle;
}

void initialSync() {

  refreshExternalContext(false);
  initialSyncDone = true;
}



void applyCurrentPortalValues() {
  device_id_val = String(p_device_id->getValue());
  lat_sumedang = atof(p_lat->getValue());
  lng_sumedang = atof(p_lng->getValue());
  alt_sumedang = atof(p_alt->getValue());

  if (p_mqtt_topic)
    mqttTopicPortal = String(p_mqtt_topic->getValue());
  if (p_mqtt_broker)
    mqttBrokerPortal = String(p_mqtt_broker->getValue());
  if (p_mqtt_port) {
    int portVal = atoi(p_mqtt_port->getValue());
    mqttPortPortal =
        (portVal > 0 && portVal <= 65535) ? (uint16_t)portVal : 8883;
  }
  if (p_mqtt_user)
    mqttUserPortal = String(p_mqtt_user->getValue());
  if (p_mqtt_pass)
    mqttPassPortal = String(p_mqtt_pass->getValue());


  applySendIntervalFromPortal();
  sanitizeAllRanges();
  configureMqttClient();
}

void setupPortalParameters() {
  p_device_id =
      new WiFiManagerParameter("devid", "Device ID", device_id_val.c_str(), 32);
  p_lat = new WiFiManagerParameter("lat", "Latitude",
                                   String(lat_sumedang, 6).c_str(), 15);
  p_lng = new WiFiManagerParameter("lng", "Longitude",
                                   String(lng_sumedang, 6).c_str(), 15);
  p_alt = new WiFiManagerParameter("alt", "Altitude",
                                   String(alt_sumedang, 2).c_str(), 10);
  p_mqtt_topic = new WiFiManagerParameter("mqtt_topic", "MQTT Topic",
                                          mqttTopicPortal.c_str(), 128);
  p_mqtt_broker = new WiFiManagerParameter("mqtt_broker", "MQTT Broker",
                                           mqttBrokerPortal.c_str(), 64);
  p_mqtt_port = new WiFiManagerParameter("mqtt_port", "MQTT Port",
                                         String(mqttPortPortal).c_str(), 6);
  p_mqtt_user = new WiFiManagerParameter("mqtt_user", "MQTT Username",
                                         mqttUserPortal.c_str(), 64);
  p_mqtt_pass = new WiFiManagerParameter("mqtt_pass", "MQTT Password",
                                         mqttPassPortal.c_str(), 64);

  wm.addParameter(p_device_id);
  wm.addParameter(p_lat);
  wm.addParameter(p_lng);
  wm.addParameter(p_alt);
  wm.addParameter(p_mqtt_topic);
  wm.addParameter(p_mqtt_broker);
  wm.addParameter(p_mqtt_port);
  wm.addParameter(p_mqtt_user);
  wm.addParameter(p_mqtt_pass);

  wm.setSaveParamsCallback(saveParamCallback);
  wm.setConfigPortalTimeout(0);
  wm.setConnectTimeout(15);
  wm.setConfigPortalBlocking(false);

  // Fix bug tampilan WiFiManager "with IP 1" 
  static const char* script = "<script>window.onload=function(){document.body.innerHTML=document.body.innerHTML.replace('with IP 1','with IP ' + window.location.hostname);}</script>";
  wm.setCustomHeadElement(script);
}

void setup() {
  Serial.begin(115200);
  delay(300);
  randomSeed(analogRead(0));
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);
  Serial.println("\n--- AGRISENSE DUMMY GENERATOR START (ESP8266) ---");
  Serial.println("[INFO] All physical sensors removed. Data now fully "
                 "synthetic + API-anchored.");

  setupPortalParameters();
  configureMqttClient();
  applySendIntervalFromPortal();
  nextScheduledSendAt = millis();

  Serial.println("Connecting to WiFi or Starting Portal: Agrisense-CC1");
  if (wm.autoConnect("Agrisense-CC1", "12345678")) {
    isOfflineMode = false;
    Serial.println("WiFi Connected Successfully!");
  } else {
    isOfflineMode = true;
    Serial.println("WiFi not connected. Portal running in background...");
  }

  wm.startWebPortal();

  // Setup mDNS dengan format http://<device_id>.local
  String dnsName = device_id_val;
  dnsName.toLowerCase();
  dnsName.replace(" ", "-");
  dnsName.replace("_", "-");
  if (MDNS.begin(dnsName.c_str())) {
    Serial.printf("[mDNS] Responder dimulai. Buka: http://%s.local\n", dnsName.c_str());
    MDNS.addService("http", "tcp", 80);
  } else {
    Serial.println("[mDNS] Gagal memulai responder!");
  }

  applyCurrentPortalValues();

  if (!isOfflineMode) {
    syncTimeWithNTP();
    initialSync();
  } else {
    refreshExternalContext(true);
  }
}

void updateOfflineTimeIfNeeded() {
  if (isOfflineMode) {
    updateVirtualClock();
  }
}

void loop() {
  wm.process();
  MDNS.update();

  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd == "config") {
      Serial.println("\n[!] Re-activating Config Portal by request...");
      wm.startConfigPortal("Agrisense-CC1", "12345678");
    }
  }



  if (WiFi.status() == WL_CONNECTED) {
    if (!internetReachableKnown || millis() - lastInternetProbe >= 60000UL) {
      lastInternetProbe = millis();
      bool probeOk = probeInternetConnectivity();
      if (probeOk != internetReachable) {
        internetReachable = probeOk;
        internetReachableKnown = true;
        if (internetReachable) {
          Serial.println("[NET] Internet kembali tersedia.");
          syncExternalClockIfNeeded(true);
        } else {
          Serial.println(
              "[NET] WiFi tersambung, tetapi internet belum tersedia.");
        }
      } else {
        internetReachable = probeOk;
        internetReachableKnown = true;
      }
    }
  } else {
    internetReachable = false;
    internetReachableKnown = false;
  }

  if (isOfflineMode && WiFi.status() == WL_CONNECTED) {
    isOfflineMode = false;
    Serial.println(
        "\n[WiFi] Connected via portal -> switching to online mode.");
    syncTimeWithNTP();
    refreshExternalContext(false);
    initialSyncDone = true;
    nextScheduledSendAt = millis();
  }

  if (!isOfflineMode && WiFi.status() == WL_CONNECTED && internetReachable &&
      millis() - lastNtpSync >= ntpInterval) {
    lastNtpSync = millis();
    syncTimeWithNTP();
  }

  if (!isOfflineMode && internetReachable &&
      millis() - lastApiFetch >= apiInterval) {
    lastApiFetch = millis();
    refreshExternalContext(false);
  }

  processQueuedMqttSend();

  if (millis() - lastSensorMillis >= sensorInterval) {
    lastSensorMillis = millis();

    if (isOfflineMode)
      updateOfflineTimeIfNeeded();

    SensorData data = generateDummyData(!isOfflineMode);

    debugPrintSensorData(data);

    if (isOfflineMode) {
      Serial.println("\n[OFFLINE PAYLOAD]");
      Serial.println(buildJsonPayload(data));
    } else if (!sendCycleActive &&
               (long)(millis() - nextScheduledSendAt) >= 0) {
      armSendCycle(buildJsonPayload(data));
      processQueuedMqttSend();
    } else if (!sendCycleActive) {
      unsigned long remainMs = (nextScheduledSendAt > millis())
                                   ? (nextScheduledSendAt - millis())
                                   : 0;
      uint32_t menitTunggu = (uint32_t)(remainMs / 60000UL);
      Serial.printf(
          ">>>> Menunggu sekitar %u menit sebelum pengiriman berikutnya...\n",
          (unsigned int)menitTunggu);
    }
  }
}

