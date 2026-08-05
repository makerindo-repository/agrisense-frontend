/*
  ============================================================
  AgriSense V1.0 - Complete ESP32 Firmware
  ============================================================
  Author        : Tim IoT AgriSense - V1.0 - 2026
  Firmware Name : AgriSense V1.0
  Version       : 1.0.0
  Board         : ESP32 Dev Module
  Description   : Firmware lengkap untuk IoT node AgriSense
                  dengan sensor:
                  - SCD30 (CO2)
                  - SGP30 (TVOC)
                  - BME280 (air temp, humidity, pressure)
                  - BH1750 (light lux)
                  - Soil 7-in-1 RS485 Modbus
                  - Battery ADC
                  - WiFiManager
                  - HTTP POST JSON
                  - Preferences local storage
                  - Debug serial lengkap

  ------------------------------------------------------------
  LIBRARY YANG DIPERLUKAN
  ------------------------------------------------------------
  1. WiFiManager              by tzapu
  2. ArduinoJson             by Benoit Blanchon
  3. SparkFun SCD30 Arduino Library
  4. Adafruit SGP30 Library
  5. Adafruit BME280 Library
  6. BH1750
  7. ModbusMaster
  8. Preferences              (built-in ESP32)
  9. WiFi.h / HTTPClient.h    (built-in ESP32)
  10. Wire.h                  (built-in)

  ------------------------------------------------------------
  CATATAN PENTING
  ------------------------------------------------------------
  1. Ganti SERVER_URL dengan endpoint asli.
  2. Jika sensor soil 7-in-1 Anda memiliki register map berbeda,
     ubah bagian register Modbus.
  3. Battery voltage diasumsikan masuk ke ADC melalui voltage divider.
  4. Lokasi menggunakan fixed/static coordinates.
  5. WiFiManager akan membuat AP "AgriSense-Setup" jika WiFi belum ada.

  ============================================================
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiManager.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Preferences.h>

// Sensor Libraries
#include <SparkFun_SCD30_Arduino_Library.h>
#include <Adafruit_SGP30.h>
#include <Adafruit_BME280.h>
#include <BH1750.h>
#include <ModbusMaster.h>

// ============================================================
// 1. FIRMWARE PROPERTIES
// ============================================================
#define FW_NAME         "AgriSense V1.0"
#define FW_VERSION      "1.0.0"
#define FW_AUTHOR       "Dr. Agus Mulyana / OpenAI Assistant"
#define FW_BOARD        "ESP32 Dev Module"
#define FW_DESCRIPTION  "Carbon Capture + Smart Agriculture Monitoring Node"

// Device identity
#define DEVICE_ID       "AGRISENSE-CC-001"

// ============================================================
// 2. USER CONFIGURATION
// ============================================================

// -----------------------------------------------------------------
// Endpoint dummy - ganti dengan endpoint sebenarnya nanti
// Contoh:
// #define SERVER_URL "http://192.168.1.10:8000/api/iot/upload"
// #define SERVER_URL "https://domainanda.com/api/iot/upload"
// -----------------------------------------------------------------
#define SERVER_URL      "http://example.com/api/iot/upload"

// Optional token jika nanti API memakai Authorization Bearer
#define API_TOKEN       "REPLACE_WITH_REAL_TOKEN_IF_NEEDED"

// Interval kirim data
const unsigned long SEND_INTERVAL_MS = 30000UL;

// Serial baudrate
#define SERIAL_BAUDRATE 115200

// Debug enable
#define DEBUG_ENABLED   true

// ============================================================
// 3. PIN MAPPING
//    Asumsi pin umum ESP32 DevKit
// ============================================================

// I2C bus untuk SCD30, SGP30, BME280, BH1750
#define I2C_SDA_PIN     21
#define I2C_SCL_PIN     22

// RS485 MAX485 / TTL-RS485 module
#define RS485_RX_PIN    16
#define RS485_TX_PIN    17
#define RS485_DE_RE_PIN 4   // gabungan DE + RE, HIGH=TX, LOW=RX

// Battery ADC
#define BATTERY_ADC_PIN 34  // ADC1 recommended pin

// LED status (opsional)
#define LED_STATUS_PIN  2

// ============================================================
// 4. SENSOR / COMMUNICATION CONSTANTS
// ============================================================

// SCD30
#define SCD30_I2C_ADDR  0x61

// SGP30
#define SGP30_I2C_ADDR  0x58

// BME280 - umumnya 0x76 atau 0x77
#define BME280_ADDR_1   0x76
#define BME280_ADDR_2   0x77

// BH1750 default address
#define BH1750_ADDR     0x23

// Soil 7-in-1 Modbus
#define SOIL_MODBUS_ID  1
#define SOIL_BAUDRATE   4800  // Banyak sensor soil RS485 memakai 4800 / 9600
                              // Jika tidak cocok, ubah ke 9600
#define SOIL_SERIAL_CONFIG SERIAL_8N1

// Voltage divider battery
// Asumsi R1 = 100k, R2 = 100k => divider factor = 2.0
// Vbat_max 4.2V akan menjadi 2.1V ke ADC, aman untuk ESP32
#define BATTERY_DIVIDER_RATIO 2.0f

// Kalibrasi tambahan ADC battery
#define BATTERY_CALIBRATION_FACTOR 1.00f

// Fixed location (karena tidak ada modul GPS disebutkan)
#define FIXED_LATITUDE   -6.914744
#define FIXED_LONGITUDE   107.609810
#define FIXED_ALTITUDE_M  768.5

// ============================================================
// 5. GLOBAL OBJECTS
// ============================================================
Preferences preferences;

SCD30 scd30;
Adafruit_SGP30 sgp30;
Adafruit_BME280 bme;
BH1750 lightMeter;
ModbusMaster soilNode;
HardwareSerial RS485Serial(2);

// ============================================================
// 6. GLOBAL STATE VARIABLES
// ============================================================
unsigned long lastSendMillis = 0;
unsigned long bootCount = 0;
bool wifiReady = false;
bool scd30Ready = false;
bool sgp30Ready = false;
bool bme280Ready = false;
bool bh1750Ready = false;
bool soilReady = false;

// ============================================================
// 7. DATA STRUCTURE
// ============================================================
struct SensorData {
  // Header
  String message_id;
  String device_id;
  String timestamp;

  // Location
  float latitude;
  float longitude;
  float altitude_m;

  // Carbon data
  float co2_ppm;
  float tvoc_ppb;

  // Environment
  float air_temperature_c;
  float air_humidity_percent;
  float air_pressure_hpa;
  float light_lux;

  // Soil 7-in-1
  float soil_moisture_percent;
  float soil_temperature_c;
  float soil_ec_ms_cm;
  float soil_ph;
  int soil_n_mg_kg;
  int soil_p_mg_kg;
  int soil_k_mg_kg;

  // Power
  float battery_voltage;
  int battery_percent;

  // Communication
  String network_type;
  int rssi_dbm;

  // Status
  String node_status;
  String sensor_status;
  String firmware_version;
};

// ============================================================
// 8. DEBUG FUNCTIONS
// ============================================================
void dbg(const String &msg) {
  if (DEBUG_ENABLED) {
    Serial.print("[DEBUG] ");
    Serial.println(msg);
  }
}

void info(const String &msg) {
  Serial.print("[INFO] ");
  Serial.println(msg);
}

void warn(const String &msg) {
  Serial.print("[WARN] ");
  Serial.println(msg);
}

void err(const String &msg) {
  Serial.print("[ERROR] ");
  Serial.println(msg);
}

// ============================================================
// 9. UTILITIES
// ============================================================

// ------------------------------------------------------------
// Menghasilkan timestamp sederhana tanpa NTP.
// Jika ingin timestamp real UTC, nanti bisa ditambah NTP.
// Saat ini memakai millis-based fallback agar firmware stabil.
// ------------------------------------------------------------
String getTimestampFallback() {
  unsigned long sec = millis() / 1000UL;
  char buf[32];
  snprintf(buf, sizeof(buf), "1970-01-01T00:%02lu:%02luZ", (sec / 60UL) % 60UL, sec % 60UL);
  return String(buf);
}

// ------------------------------------------------------------
// Membuat message_id dinamis
// ------------------------------------------------------------
String makeMessageId() {
  unsigned long n = millis();
  char buf[40];
  snprintf(buf, sizeof(buf), "MSG-%s-%010lu", DEVICE_ID, n);
  return String(buf);
}

// ------------------------------------------------------------
// Battery percent estimation sederhana untuk Li-ion 1 cell
// ------------------------------------------------------------
int batteryPercentFromVoltage(float v) {
  if (v <= 3.20f) return 0;
  if (v >= 4.20f) return 100;
  return (int)(((v - 3.20f) / (4.20f - 3.20f)) * 100.0f);
}

// ------------------------------------------------------------
// Blink LED status
// ------------------------------------------------------------
void blinkStatus(int times, int onMs = 100, int offMs = 100) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_STATUS_PIN, HIGH);
    delay(onMs);
    digitalWrite(LED_STATUS_PIN, LOW);
    delay(offMs);
  }
}

// ============================================================
// 10. I2C SCAN
// ============================================================
void scanI2CDevices() {
  info("Scanning I2C devices...");
  byte count = 0;

  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.print("[I2C] Found device at 0x");
      if (addr < 16) Serial.print("0");
      Serial.println(addr, HEX);
      count++;
    }
  }

  if (count == 0) {
    warn("No I2C device found.");
  } else {
    info("I2C scan completed.");
  }
}

// ============================================================
// 11. RS485 CONTROL
// ============================================================

// ------------------------------------------------------------
// Mengatur transceiver RS485 ke mode transmit
// ------------------------------------------------------------
void preTransmission() {
  digitalWrite(RS485_DE_RE_PIN, HIGH);
}

// ------------------------------------------------------------
// Mengatur transceiver RS485 ke mode receive
// ------------------------------------------------------------
void postTransmission() {
  digitalWrite(RS485_DE_RE_PIN, LOW);
}

// ============================================================
// 12. WIFI MANAGER
// ============================================================
void connectWiFi() {
  info("Starting WiFiManager...");

  WiFiManager wm;
  wm.setConfigPortalTimeout(180);

  // Jika ingin reset WiFi config:
  // wm.resetSettings();

  bool result = wm.autoConnect("AgriSense-Setup");

  if (!result) {
    err("Failed to connect WiFi via WiFiManager.");
    wifiReady = false;
    return;
  }

  wifiReady = true;
  info("WiFi connected.");
  dbg("SSID: " + WiFi.SSID());
  dbg("IP  : " + WiFi.localIP().toString());
  dbg("RSSI: " + String(WiFi.RSSI()) + " dBm");
}

// ============================================================
// 13. STORAGE / PREFERENCES
// ============================================================

// ------------------------------------------------------------
// Menyimpan payload terakhir ke NVS Preferences
// ------------------------------------------------------------
void saveLastPayload(const String &payload) {
  preferences.putString("last_payload", payload);
  preferences.putULong("last_sent_ms", millis());
}

// ------------------------------------------------------------
// Membaca payload terakhir dari NVS
// ------------------------------------------------------------
String readLastPayload() {
  return preferences.getString("last_payload", "");
}

// ============================================================
// 14. SENSOR INITIALIZATION
// ============================================================

// ------------------------------------------------------------
// Inisialisasi I2C sensors
// Catatan SCD30 butuh clock rendah karena clock stretching.
// ------------------------------------------------------------
void initI2CSensors() {
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);

  // SCD30 merekomendasikan I2C lebih lambat; 50k aman
  Wire.setClock(50000);

  scanI2CDevices();

  // ---------------------- SCD30 ----------------------
  info("Initializing SCD30...");
  if (scd30.begin(Wire, false)) {
    scd30Ready = true;
    scd30.setMeasurementInterval(2); // 2 detik
    info("SCD30 ready.");
  } else {
    scd30Ready = false;
    warn("SCD30 not detected.");
  }

  // ---------------------- SGP30 ----------------------
  info("Initializing SGP30...");
  if (sgp30.begin()) {
    sgp30Ready = true;
    info("SGP30 ready.");
  } else {
    sgp30Ready = false;
    warn("SGP30 not detected.");
  }

  // ---------------------- BME280 ----------------------
  info("Initializing BME280...");
  if (bme.begin(BME280_ADDR_1)) {
    bme280Ready = true;
    info("BME280 ready at 0x76.");
  } else if (bme.begin(BME280_ADDR_2)) {
    bme280Ready = true;
    info("BME280 ready at 0x77.");
  } else {
    bme280Ready = false;
    warn("BME280 not detected.");
  }

  // ---------------------- BH1750 ----------------------
  info("Initializing BH1750...");
  if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, BH1750_ADDR, &Wire)) {
    bh1750Ready = true;
    info("BH1750 ready.");
  } else {
    bh1750Ready = false;
    warn("BH1750 not detected.");
  }
}

// ------------------------------------------------------------
// Inisialisasi RS485 soil sensor
// ------------------------------------------------------------
void initSoilSensor() {
  pinMode(RS485_DE_RE_PIN, OUTPUT);
  digitalWrite(RS485_DE_RE_PIN, LOW); // default RX

  RS485Serial.begin(SOIL_BAUDRATE, SOIL_SERIAL_CONFIG, RS485_RX_PIN, RS485_TX_PIN);

  soilNode.begin(SOIL_MODBUS_ID, RS485Serial);
  soilNode.preTransmission(preTransmission);
  soilNode.postTransmission(postTransmission);

  // Test read satu register untuk cek sensor
  uint8_t result = soilNode.readHoldingRegisters(0x0000, 1);
  if (result == soilNode.ku8MBSuccess) {
    soilReady = true;
    info("Soil 7-in-1 RS485 sensor ready.");
  } else {
    soilReady = false;
    warn("Soil RS485 sensor not detected or register map mismatch.");
  }
}

// ------------------------------------------------------------
// Inisialisasi ADC battery
// ------------------------------------------------------------
void initBatteryADC() {
  analogReadResolution(12);
  analogSetPinAttenuation(BATTERY_ADC_PIN, ADC_11db);
  info("Battery ADC initialized.");
}

// ============================================================
// 15. SENSOR READ FUNCTIONS
// ============================================================

// ------------------------------------------------------------
// Membaca CO2 dari SCD30
// Jika tidak ada data baru, kembalikan NAN
// ------------------------------------------------------------
float readCO2ppm() {
  if (!scd30Ready) return NAN;

  if (scd30.dataAvailable()) {
    float co2 = scd30.getCO2();
    if (isnan(co2) || co2 <= 0) return NAN;
    return co2;
  }
  return NAN;
}

// ------------------------------------------------------------
// Membaca TVOC dari SGP30
// SGP30 juga memberi CO2eq, namun payload Anda meminta TVOC.
// Humidity compensation ditambahkan bila BME280 tersedia.
// ------------------------------------------------------------
float readTVOCppb() {
  if (!sgp30Ready) return NAN;

  if (bme280Ready) {
    float t = bme.readTemperature();
    float h = bme.readHumidity();

    // Convert absolute humidity approx (mg/m3 -> g/m3 style helper)
    // Menggunakan pendekatan umum dari dokumentasi library Sensirion/Adafruit
    float absoluteHumidity = 216.7f * ((h / 100.0f) * 6.112f * exp((17.62f * t) / (243.12f + t)) / (273.15f + t));
    uint32_t ahScaled = (uint32_t)(1000.0f * absoluteHumidity); // mg/m^3 scaling helper
    sgp30.setHumidity(ahScaled);
  }

  if (sgp30.IAQmeasure()) {
    return (float)sgp30.TVOC;
  }

  return NAN;
}

// ------------------------------------------------------------
// Membaca suhu udara dari BME280
// ------------------------------------------------------------
float readAirTemperatureC() {
  if (!bme280Ready) return NAN;
  return bme.readTemperature();
}

// ------------------------------------------------------------
// Membaca kelembapan udara dari BME280
// ------------------------------------------------------------
float readAirHumidityPercent() {
  if (!bme280Ready) return NAN;
  return bme.readHumidity();
}

// ------------------------------------------------------------
// Membaca tekanan udara dari BME280
// Pa -> hPa
// ------------------------------------------------------------
float readAirPressureHpa() {
  if (!bme280Ready) return NAN;
  return bme.readPressure() / 100.0f;
}

// ------------------------------------------------------------
// Membaca lux dari BH1750
// ------------------------------------------------------------
float readLightLux() {
  if (!bh1750Ready) return NAN;
  float lux = lightMeter.readLightLevel();
  if (lux < 0) return NAN;
  return lux;
}

// ------------------------------------------------------------
// Membaca battery voltage memakai ADC calibrated millivolts
// analogReadMilliVolts memberi tegangan pada pin ADC, bukan Vbat asli
// Karena memakai voltage divider, hasil dikalikan divider ratio
// ------------------------------------------------------------
float readBatteryVoltage() {
  uint32_t mv = analogReadMilliVolts(BATTERY_ADC_PIN);
  float pinVoltage = mv / 1000.0f;
  float batteryVoltage = pinVoltage * BATTERY_DIVIDER_RATIO * BATTERY_CALIBRATION_FACTOR;
  return batteryVoltage;
}

// ------------------------------------------------------------
// Membaca soil 7-in-1 via Modbus
//
// ASUMSI REGISTER MAP UMUM:
// reg 0 = moisture (x10, %)
// reg 1 = temperature (x10, C)
// reg 2 = EC (uS/cm atau x10)
// reg 3 = pH (x10)
// reg 4 = N (mg/kg)
// reg 5 = P (mg/kg)
// reg 6 = K (mg/kg)
//
// Banyak vendor berbeda. Jika hasil tidak masuk akal,
// ubah register map / scaling di sini.
// ------------------------------------------------------------
bool readSoil7in1(
  float &moisture,
  float &temperature,
  float &ec_ms_cm,
  float &ph,
  int &nVal,
  int &pVal,
  int &kVal
) {
  if (!soilReady) return false;

  uint8_t result = soilNode.readHoldingRegisters(0x0000, 7);
  if (result != soilNode.ku8MBSuccess) {
    warn("Modbus readHoldingRegisters failed.");
    return false;
  }

  uint16_t reg0 = soilNode.getResponseBuffer(0);
  uint16_t reg1 = soilNode.getResponseBuffer(1);
  uint16_t reg2 = soilNode.getResponseBuffer(2);
  uint16_t reg3 = soilNode.getResponseBuffer(3);
  uint16_t reg4 = soilNode.getResponseBuffer(4);
  uint16_t reg5 = soilNode.getResponseBuffer(5);
  uint16_t reg6 = soilNode.getResponseBuffer(6);

  // Scaling umum
  moisture = reg0 / 10.0f;
  temperature = reg1 / 10.0f;
  float ec_us_cm = (float)reg2;
  ec_ms_cm = ec_us_cm / 1000.0f; // convert uS/cm -> mS/cm
  ph = reg3 / 10.0f;
  nVal = (int)reg4;
  pVal = (int)reg5;
  kVal = (int)reg6;

  return true;
}

// ============================================================
// 16. SENSOR DATA PROCESSING
// ============================================================

// ------------------------------------------------------------
// Menentukan status sensor secara sederhana
// ------------------------------------------------------------
String calculateSensorStatus(const SensorData &d) {
  bool anyMissing =
    isnan(d.co2_ppm) ||
    isnan(d.tvoc_ppb) ||
    isnan(d.air_temperature_c) ||
    isnan(d.air_humidity_percent) ||
    isnan(d.air_pressure_hpa) ||
    isnan(d.light_lux) ||
    isnan(d.soil_moisture_percent) ||
    isnan(d.soil_temperature_c) ||
    isnan(d.soil_ec_ms_cm) ||
    isnan(d.soil_ph);

  if (anyMissing) return "degraded";
  return "normal";
}

// ------------------------------------------------------------
// Membaca seluruh sensor dan mengisi struct SensorData
// ------------------------------------------------------------
SensorData readAllSensors() {
  SensorData data;

  // Header
  data.message_id = makeMessageId();
  data.device_id = DEVICE_ID;
  data.timestamp = getTimestampFallback();

  // Fixed location
  data.latitude = FIXED_LATITUDE;
  data.longitude = FIXED_LONGITUDE;
  data.altitude_m = FIXED_ALTITUDE_M;

  // Carbon
  data.co2_ppm = readCO2ppm();
  data.tvoc_ppb = readTVOCppb();

  // Environment
  data.air_temperature_c = readAirTemperatureC();
  data.air_humidity_percent = readAirHumidityPercent();
  data.air_pressure_hpa = readAirPressureHpa();
  data.light_lux = readLightLux();

  // Soil
  float sm = NAN, st = NAN, sec = NAN, sph = NAN;
  int sn = -1, sp = -1, sk = -1;
  if (readSoil7in1(sm, st, sec, sph, sn, sp, sk)) {
    data.soil_moisture_percent = sm;
    data.soil_temperature_c = st;
    data.soil_ec_ms_cm = sec;
    data.soil_ph = sph;
    data.soil_n_mg_kg = sn;
    data.soil_p_mg_kg = sp;
    data.soil_k_mg_kg = sk;
  } else {
    data.soil_moisture_percent = NAN;
    data.soil_temperature_c = NAN;
    data.soil_ec_ms_cm = NAN;
    data.soil_ph = NAN;
    data.soil_n_mg_kg = -1;
    data.soil_p_mg_kg = -1;
    data.soil_k_mg_kg = -1;
  }

  // Power
  data.battery_voltage = readBatteryVoltage();
  data.battery_percent = batteryPercentFromVoltage(data.battery_voltage);

  // Communication
  data.network_type = "WiFi";
  data.rssi_dbm = (WiFi.status() == WL_CONNECTED) ? WiFi.RSSI() : -999;

  // Status
  data.node_status = (WiFi.status() == WL_CONNECTED) ? "online" : "offline";
  data.sensor_status = calculateSensorStatus(data);
  data.firmware_version = FW_VERSION;

  return data;
}

// ============================================================
// 17. DEBUG PRINT SENSOR DATA
// ============================================================
void debugPrintSensorData(const SensorData &d) {
  Serial.println();
  Serial.println("======================================================");
  Serial.println("AGRISENSE SENSOR SNAPSHOT");
  Serial.println("======================================================");
  Serial.println("message_id            : " + d.message_id);
  Serial.println("device_id             : " + d.device_id);
  Serial.println("timestamp             : " + d.timestamp);

  Serial.println("-- location --");
  Serial.println("latitude              : " + String(d.latitude, 6));
  Serial.println("longitude             : " + String(d.longitude, 6));
  Serial.println("altitude_m            : " + String(d.altitude_m, 2));

  Serial.println("-- carbon_data --");
  Serial.println("co2_ppm               : " + String(d.co2_ppm, 2));
  Serial.println("tvoc_ppb              : " + String(d.tvoc_ppb, 2));

  Serial.println("-- environment --");
  Serial.println("air_temperature_c     : " + String(d.air_temperature_c, 2));
  Serial.println("air_humidity_percent  : " + String(d.air_humidity_percent, 2));
  Serial.println("air_pressure_hpa      : " + String(d.air_pressure_hpa, 2));
  Serial.println("light_lux             : " + String(d.light_lux, 2));

  Serial.println("-- soil_7in1 --");
  Serial.println("soil_moisture_percent : " + String(d.soil_moisture_percent, 2));
  Serial.println("soil_temperature_c    : " + String(d.soil_temperature_c, 2));
  Serial.println("soil_ec_ms_cm         : " + String(d.soil_ec_ms_cm, 3));
  Serial.println("soil_ph               : " + String(d.soil_ph, 2));
  Serial.println("soil_n_mg_kg          : " + String(d.soil_n_mg_kg));
  Serial.println("soil_p_mg_kg          : " + String(d.soil_p_mg_kg));
  Serial.println("soil_k_mg_kg          : " + String(d.soil_k_mg_kg));

  Serial.println("-- power --");
  Serial.println("battery_voltage       : " + String(d.battery_voltage, 3));
  Serial.println("battery_percent       : " + String(d.battery_percent));

  Serial.println("-- communication --");
  Serial.println("network_type          : " + d.network_type);
  Serial.println("rssi_dbm              : " + String(d.rssi_dbm));

  Serial.println("-- status --");
  Serial.println("node_status           : " + d.node_status);
  Serial.println("sensor_status         : " + d.sensor_status);
  Serial.println("firmware_version      : " + d.firmware_version);
  Serial.println("======================================================");
  Serial.println();
}

// ============================================================
// 18. JSON PAYLOAD BUILDER
// ============================================================
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
  carbon["co2_ppm"] = isnan(d.co2_ppm) ? 0 : d.co2_ppm;
  carbon["tvoc_ppb"] = isnan(d.tvoc_ppb) ? 0 : d.tvoc_ppb;

  JsonObject env = doc.createNestedObject("environment");
  env["air_temperature_c"] = isnan(d.air_temperature_c) ? 0 : d.air_temperature_c;
  env["air_humidity_percent"] = isnan(d.air_humidity_percent) ? 0 : d.air_humidity_percent;
  env["air_pressure_hpa"] = isnan(d.air_pressure_hpa) ? 0 : d.air_pressure_hpa;
  env["light_lux"] = isnan(d.light_lux) ? 0 : d.light_lux;

  JsonObject soil = doc.createNestedObject("soil_7in1");
  soil["soil_moisture_percent"] = isnan(d.soil_moisture_percent) ? 0 : d.soil_moisture_percent;
  soil["soil_temperature_c"] = isnan(d.soil_temperature_c) ? 0 : d.soil_temperature_c;
  soil["soil_ec_ms_cm"] = isnan(d.soil_ec_ms_cm) ? 0 : d.soil_ec_ms_cm;
  soil["soil_ph"] = isnan(d.soil_ph) ? 0 : d.soil_ph;
  soil["soil_n_mg_kg"] = d.soil_n_mg_kg < 0 ? 0 : d.soil_n_mg_kg;
  soil["soil_p_mg_kg"] = d.soil_p_mg_kg < 0 ? 0 : d.soil_p_mg_kg;
  soil["soil_k_mg_kg"] = d.soil_k_mg_kg < 0 ? 0 : d.soil_k_mg_kg;

  JsonObject power = doc.createNestedObject("power");
  power["battery_voltage"] = d.battery_voltage;
  power["battery_percent"] = d.battery_percent;

  JsonObject comm = doc.createNestedObject("communication");
  comm["network_type"] = d.network_type;
  comm["rssi_dbm"] = d.rssi_dbm;

  JsonObject status = doc.createNestedObject("status");
  status["node_status"] = d.node_status;
  status["sensor_status"] = d.sensor_status;
  status["firmware_version"] = d.firmware_version;

  String out;
  serializeJsonPretty(doc, out);
  return out;
}

// ============================================================
// 19. HTTP POST TO ENDPOINT
// ============================================================
bool sendPayloadToServer(const String &payload) {
  if (WiFi.status() != WL_CONNECTED) {
    err("WiFi not connected. Cannot send payload.");
    return false;
  }

  HTTPClient http;
  http.setTimeout(10000);

  info("Opening HTTP connection...");
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  // Jika nanti API butuh Bearer Token, aktifkan baris berikut:
  // http.addHeader("Authorization", "Bearer " + String(API_TOKEN));

  info("Sending JSON payload...");
  int httpCode = http.POST(payload);

  if (httpCode > 0) {
    String response = http.getString();
    info("HTTP Code: " + String(httpCode));
    dbg("Server Response:");
    Serial.println(response);
    http.end();
    return true;
  } else {
    err("HTTP POST failed. Error code: " + String(httpCode));
    http.end();
    return false;
  }
}

// ============================================================
// 20. SENSOR HEALTH SUMMARY
// ============================================================
void printSensorHealth() {
  Serial.println();
  Serial.println("=============== SENSOR HEALTH ===============");
  Serial.println("WiFi      : " + String(wifiReady ? "READY" : "NOT READY"));
  Serial.println("SCD30     : " + String(scd30Ready ? "READY" : "NOT READY"));
  Serial.println("SGP30     : " + String(sgp30Ready ? "READY" : "NOT READY"));
  Serial.println("BME280    : " + String(bme280Ready ? "READY" : "NOT READY"));
  Serial.println("BH1750    : " + String(bh1750Ready ? "READY" : "NOT READY"));
  Serial.println("SOIL RS485: " + String(soilReady ? "READY" : "NOT READY"));
  Serial.println("=============================================");
  Serial.println();
}

// ============================================================
// 21. SETUP
// ============================================================
void setup() {
  Serial.begin(SERIAL_BAUDRATE);
  delay(1000);

  pinMode(LED_STATUS_PIN, OUTPUT);
  digitalWrite(LED_STATUS_PIN, LOW);

  Serial.println();
  Serial.println("======================================================");
  Serial.println("BOOTING " FW_NAME);
  Serial.println("Version     : " FW_VERSION);
  Serial.println("Author      : " FW_AUTHOR);
  Serial.println("Board       : " FW_BOARD);
  Serial.println("Description : " FW_DESCRIPTION);
  Serial.println("Device ID   : " DEVICE_ID);
  Serial.println("Server URL  : " SERVER_URL);
  Serial.println("======================================================");

  // Preferences
  preferences.begin("agrisense", false);
  bootCount = preferences.getULong("boot_count", 0);
  bootCount++;
  preferences.putULong("boot_count", bootCount);

  info("Boot count: " + String(bootCount));

  // WiFi
  connectWiFi();

  // Sensor init
  initI2CSensors();
  initSoilSensor();
  initBatteryADC();

  printSensorHealth();

  // Tampilkan payload terakhir jika ada
  String lastPayload = readLastPayload();
  if (lastPayload.length() > 0) {
    info("Last saved payload found in NVS.");
  } else {
    info("No previous payload in NVS.");
  }

  blinkStatus(2, 150, 150);
}

// ============================================================
// 22. LOOP
// ============================================================
void loop() {
  // Pastikan WiFi tersambung
  if (WiFi.status() != WL_CONNECTED) {
    warn("WiFi disconnected. Reconnecting...");
    connectWiFi();
  }

  // Jalankan SGP30 conditioning/measurement berkala
  // SGP30 idealnya dibaca rutin agar baseline stabil
  if (sgp30Ready) {
    sgp30.IAQmeasure();
  }

  unsigned long now = millis();
  if (now - lastSendMillis >= SEND_INTERVAL_MS) {
    lastSendMillis = now;

    info("Reading all sensors...");
    SensorData data = readAllSensors();

    debugPrintSensorData(data);

    info("Building JSON payload...");
    String payload = buildJsonPayload(data);

    dbg("JSON payload:");
    Serial.println(payload);

    // Simpan payload lokal
    saveLastPayload(payload);

    // Kirim ke server
    bool ok = sendPayloadToServer(payload);
    if (ok) {
      info("Payload sent successfully.");
      blinkStatus(1, 200, 100);
    } else {
      err("Payload send failed.");
      blinkStatus(3, 80, 80);
    }

    Serial.println("------------------------------------------------------");
  }

  delay(200);
}
