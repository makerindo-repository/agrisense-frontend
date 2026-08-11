/*
  ============================================================
  AgriSense V1.0 - MQTT Firmware (ESP32-S3/FreeRTOS Optimized)
  ============================================================
*/

#include <WiFi.h>
#include <WiFiManager.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Preferences.h>
#include <PubSubClient.h> 
#include <Adafruit_ADS1X15.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <DHT.h>
#include <time.h>
#include <Arduino.h>

// ============================================================
// 1. FIRMWARE PROPERTIES
// ============================================================
#define FW_NAME "AgriSense V1.0 MQTT"
#define FW_VERSION "1.2.0"
#define FW_AUTHOR "Embedded Team"
#define FW_BOARD "ESP32 Dev Module"
#define FW_DESCRIPTION "Carbon Capture + Smart Agriculture Monitoring Node"
#define DEVICE_ID "AGRISENSE-CC-001"

// ============================================================
// 2. USER CONFIGURATION (MQTT & NTP)
// ============================================================
#define MQTT_BROKER "broker.emqx.io"
#define MQTT_PORT 1883
#define MQTT_TOPIC "agrisense/iot/readings"

const char* NTP_SERVER_1 = "pool.ntp.org";
const char* NTP_SERVER_2 = "time.nist.gov";
const long GMT_OFFSET_SEC = 7 * 3600; // WIB (UTC +7)
const int DAYLIGHT_OFFSET_SEC = 0;
bool rtcSynced = false;

// ============================================================
// TIMER & KONFIGURASI
// ============================================================
const unsigned long SEND_INTERVAL_MS = 5000UL; // Kirim data tiap 5 detik
#define SERIAL_BAUDRATE 115200
#define DEBUG_ENABLED true

#define BATAS_ATAS_AKI 12.8f
#define BATAS_BAWAH_AKI 11.0f

// ============================================================
// 3. PIN MAPPING
// ============================================================
#define I2C_SDA_PIN 8
#define I2C_SCL_PIN 9
#define ADS_ADDRESS 0x48

#define MIN_VALID_ADC 260
#define MAX_VALID_ADC 26600

#define MQ4ADCPin 2
#define MQ135ADCPin 1
#define MEMSNO2ADCPin 0

#define BATTERY_ADC_PIN 5
#define LED_STATUS_PIN 2

// ============================================================
// 4. SENSOR / COMMUNICATION CONSTANTS
// ============================================================
#define BATTERY_DIVIDER_RATIO 5.166f
#define BATTERY_CALIBRATION_FACTOR 0.9899f
#define OVERSAMPLING_COUNT 16

// GPS
static const int RXPin = 1;
static const int TXPin = 15;
static const uint32_t GPSBaud = 9600;
static const uint32_t anoBaud = 4800;
float currentLat = 0.0, currentLon = 0.0, currentAlt = 0.0;
SemaphoreHandle_t gpsMutex = NULL;

// DHT 22
#define DHTPIN 4
#define DHTTYPE DHT22

// ANEMOMETER (RS485 MODBUS)
#define ANEMO_TX_PIN 17
#define ANEMO_RX_PIN 18
const byte anemoRequestFrame[] = { 0x01, 0x03, 0x00, 0x00, 0x00, 0x01, 0x84, 0x0A };

SemaphoreHandle_t anemoMutex = NULL;
float currentWindSpeed = NAN; 

// SENSOR GAS (MQ135 CO2 PARAMETERS HASIL KALIBRASI)
const float RL_co2 = 10.0;       // kOhm
const float R0_co2 = 127.831;    // kOhm
const float A_co2  = 110.7432567;
const float B_co2  = -2.856935538;

const float RL_ch4 = 10.0;     
const float R0_ch4 = 8.492;    
const float CURVE_A_ch4 = 1012.2; 
const float CURVE_B_ch4 = -2.786;

const float VCC_SENSOR = 5.0; 
const float RL_no2 = 4.7;     
const float R0_no2 = 3.172; 
const float CURVE_A_no2 = 0.55;  
const float CURVE_B_no2 = -0.82; 

// ============================================================
// 5. GLOBAL OBJECTS
// ============================================================
Preferences preferences;
DHT dht(DHTPIN, DHTTYPE);
HardwareSerial RS485(1);
HardwareSerial gpsSerial(2);
TinyGPSPlus gps;
Adafruit_ADS1115 ads;

WiFiClient espClient;
PubSubClient mqttClient(espClient);

// ============================================================
// 6. GLOBAL STATE VARIABLES
// ============================================================
unsigned long lastSendMillis = 0;
unsigned long bootCount = 0;
bool wifiReady = false;

// ============================================================
// 7. DATA STRUCTURE
// ============================================================
struct SensorData {
  String message_id;
  String device_id;
  String timestamp;
  float latitude;
  float longitude;
  float altitude_m;
  float co2_ppm;
  float ch4_ppm;
  float no2_ppb;
  float air_temperature_c;
  float air_humidity_percent;
  float wind_speed_kmh;
  float battery_voltage;
  int battery_percent;
  String network_type;
  int rssi_dbm;
  String node_status;
  String sensor_status;
  String firmware_version;
};

// Forward declaration
void connectWiFi();
void connectMQTT();
void syncNTPTime();
float readAnemometerRaw();
SensorData readAllSensors();
String buildJsonPayload(const SensorData &d);
void saveLastPayload(const String &payload);

// ============================================================
// UTILITIES & DEBUG
// ============================================================
void dbg(const String &msg) { if (DEBUG_ENABLED) Serial.println("[DEBUG] " + msg); }
void info(const String &msg) { Serial.println("[INFO] " + msg); }
void warn(const String &msg) { Serial.println("[WARN] " + msg); }
void err(const String &msg) { Serial.println("[ERROR] " + msg); }

String getFormattedTimestamp() {
  struct tm timeinfo;
  if (rtcSynced && getLocalTime(&timeinfo, 10)) {
    char buf[32];
    strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S+07:00", &timeinfo);
    return String(buf);
  }
  unsigned long sec = millis() / 1000UL;
  char buf[32];
  snprintf(buf, sizeof(buf), "1970-01-01T00:%02lu:%02luZ", (sec / 60UL) % 60UL, sec % 60UL);
  return String(buf);
}

String makeMessageId() {
  unsigned long n = millis();
  char buf[40];
  snprintf(buf, sizeof(buf), "MSG-%s-%010lu", DEVICE_ID, n);
  return String(buf);
}

int batteryPercentFromVoltage(float v) {
  if (v <= BATAS_BAWAH_AKI) return 0;
  if (v >= BATAS_ATAS_AKI) return 100;
  return (int)(((v - BATAS_BAWAH_AKI) / (BATAS_ATAS_AKI - BATAS_BAWAH_AKI)) * 100.0f);
}

void blinkStatus(int times, int onMs = 100, int offMs = 100) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_STATUS_PIN, HIGH);
    vTaskDelay(pdMS_TO_TICKS(onMs));
    digitalWrite(LED_STATUS_PIN, LOW);
    vTaskDelay(pdMS_TO_TICKS(offMs));
  }
}

// ============================================================
// RTC & NTP SYNCHRONIZATION
// ============================================================
void syncNTPTime() {
  if (WiFi.status() == WL_CONNECTED) {
    info("Mengonfigurasi NTP untuk Sinkronisasi RTC...");
    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER_1, NTP_SERVER_2);
    
    struct tm timeinfo;
    int retry = 0;
    while (!getLocalTime(&timeinfo) && retry < 15) {
      vTaskDelay(pdMS_TO_TICKS(500));
      retry++;
    }
    
    if (retry < 15) {
      rtcSynced = true;
      char timeStr[64];
      strftime(timeStr, sizeof(timeStr), "%A, %B %d %Y %H:%M:%S", &timeinfo);
      info("RTC Berhasil Disinkronkan dengan NTP! Waktu Sekarang: " + String(timeStr));
    } else {
      warn("Gagal mendapatkan waktu dari NTP Server.");
    }
  }
}

float readAnemometerRaw() {
  while (RS485.available()) RS485.read(); // Flush sisa data lama

  RS485.write(anemoRequestFrame, sizeof(anemoRequestFrame));
  RS485.flush();

  unsigned long startWait = millis();
  while (RS485.available() < 7 && (millis() - startWait < 300)) {
    vTaskDelay(pdMS_TO_TICKS(10)); 
  }

  if (RS485.available() >= 7) {
    byte response[7];
    RS485.readBytes(response, 7);
    
    uint16_t rawSpeed = (response[3] << 8) | response[4];
    return rawSpeed / 10.0f; // Mengembalikan m/s
  }

  return NAN; 
}

// ============================================================
// FREERTOS TASKS
// ============================================================
void vTaskGPS(void *pvParameters) {
  for (;;) {
    while (gpsSerial.available() > 0) {
      if (gps.encode(gpsSerial.read())) {
        if (xSemaphoreTake(gpsMutex, pdMS_TO_TICKS(50)) == pdTRUE) {
          if (gps.location.isValid()) {
            currentLat = gps.location.lat();
            currentLon = gps.location.lng();
          }
          if (gps.altitude.isValid()) {
            currentAlt = gps.altitude.meters();
          }
          xSemaphoreGive(gpsMutex);
        }
      }
    }
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

void vTaskAnemometer(void *pvParameters) {
  for (;;) {
    float tempWindSpeedMS = readAnemometerRaw(); 

    if (xSemaphoreTake(anemoMutex, pdMS_TO_TICKS(50)) == pdTRUE) {
      currentWindSpeed = isnan(tempWindSpeedMS) ? NAN : (tempWindSpeedMS * 3.6f);
      xSemaphoreGive(anemoMutex);
    }

    vTaskDelay(pdMS_TO_TICKS(1000)); 
  }
}

// ============================================================
// CONNECTIVITY
// ============================================================
void connectWiFi() {
  info("Starting WiFiManager...");
  WiFiManager wm;
  wm.setConfigPortalTimeout(180);
  bool result = wm.autoConnect("AgriSense-Setup");

  if (!result) {
    err("Failed to connect WiFi.");
    wifiReady = false;
    return;
  }
  wifiReady = true;
  info("WiFi connected. IP: " + WiFi.localIP().toString());
  syncNTPTime();
}

void connectMQTT() {
  while (!mqttClient.connected()) {
    info("Attempting MQTT connection to " + String(MQTT_BROKER) + ":" + String(MQTT_PORT) + "...");
    if (mqttClient.connect(DEVICE_ID)) {
      info("MQTT connected.");
    } else {
      err("MQTT connect failed, rc=" + String(mqttClient.state()));
      info("Retrying in 5 seconds...");
      vTaskDelay(pdMS_TO_TICKS(5000));
    }
  }
}

// ============================================================
// STORAGE & SENSOR INIT
// ============================================================
void saveLastPayload(const String &payload) {
  preferences.putString("last_payload", payload);
  preferences.putULong("last_sent_ms", millis());
}

void initI2CSensors() {
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Wire.setClock(100000);
  ads.setGain(GAIN_TWOTHIRDS); 
  if (!ads.begin(ADS_ADDRESS, &Wire)) err("ADS1115 Init failed.");
}

void initBatteryADC() {
  analogReadResolution(12);
  analogSetPinAttenuation(BATTERY_ADC_PIN, ADC_11db);
}

// ============================================================
// SENSOR READINGS (OPTIMIZED & NON-BLOCKING)
// ============================================================
float readCO2ppm() {
  float adcSum = 0;
  const int SAMPLES = 50;

  for (int i = 0; i < SAMPLES; i++) {
    adcSum += ads.readADC_SingleEnded(MQ135ADCPin);
    vTaskDelay(pdMS_TO_TICKS(10));
  }

  float adcAvg = adcSum / (float)SAMPLES;

  if (adcAvg <= 0) return NAN;

  // Hitung Rs berdasarkan formula khusus skrip MQ135
  float Rs = ((65536.0f * RL_co2) / adcAvg) - RL_co2;

  // Hitung Rasio
  float ratio = Rs / R0_co2;

  // Hitung CO2 dalam ppm
  float ppm = A_co2 * pow(ratio, B_co2);

  return ppm;
}

float readCH4ppm() {
  float totalVolts = 0;
  const int SAMPLES = 10;

  for (int i = 0; i < SAMPLES; i++) {
    int16_t rawAdc = ads.readADC_SingleEnded(MQ4ADCPin);
    if (rawAdc < MIN_VALID_ADC || rawAdc > MAX_VALID_ADC) return NAN;
    totalVolts += ads.computeVolts(rawAdc);
  }

  float avgVoltage = totalVolts / SAMPLES;
  if (avgVoltage <= 0.05f) avgVoltage = 0.05f;

  float Rs = ((VCC_SENSOR * RL_ch4) / avgVoltage) - RL_ch4;
  float ratio = Rs / R0_ch4;
  return CURVE_A_ch4 * pow(ratio, CURVE_B_ch4);
}

float readNO2ppm() {
  float totalVolts = 0;
  const int SAMPLES = 10;

  for (int i = 0; i < SAMPLES; i++) {
    int16_t rawAdc = ads.readADC_SingleEnded(MEMSNO2ADCPin);
    if (rawAdc < MIN_VALID_ADC || rawAdc > MAX_VALID_ADC) return NAN;
    totalVolts += ads.computeVolts(rawAdc);
  }

  float avgVoltage = totalVolts / SAMPLES;
  if (avgVoltage <= 0.05f) avgVoltage = 0.05f;
  if (avgVoltage >= VCC_SENSOR) avgVoltage = VCC_SENSOR - 0.001f;

  float Rs = ((VCC_SENSOR * RL_no2) / avgVoltage) - RL_no2;
  float ratio = Rs / R0_no2;
  return CURVE_A_no2 * pow(ratio, CURVE_B_no2);
}

float readAirTemperatureC() {
  float suhu = dht.readTemperature();
  return isnan(suhu) ? NAN : suhu;
}

float readAirHumidityPercent() {
  float kelembapan = dht.readHumidity();
  return isnan(kelembapan) ? NAN : kelembapan;
}

float readBatteryVoltage() {
  uint32_t sumMilliVolts = 0;
  for (uint8_t i = 0; i < OVERSAMPLING_COUNT; i++) {
    sumMilliVolts += analogReadMilliVolts(BATTERY_ADC_PIN);
  }
  float avgMilliVolts = (float)sumMilliVolts / OVERSAMPLING_COUNT;
  return (avgMilliVolts / 1000.0f) * BATTERY_DIVIDER_RATIO * BATTERY_CALIBRATION_FACTOR;
}

String calculateSensorStatus(const SensorData &d) {
  return (isnan(d.co2_ppm) || isnan(d.ch4_ppm) || isnan(d.no2_ppb) || 
          isnan(d.wind_speed_kmh) || isnan(d.air_temperature_c) || isnan(d.air_humidity_percent))
          ? "degraded"
          : "normal";
}

SensorData readAllSensors() {
  SensorData data;
  data.message_id = makeMessageId();
  data.device_id = DEVICE_ID;
  data.timestamp = getFormattedTimestamp();

  if (xSemaphoreTake(gpsMutex, pdMS_TO_TICKS(50)) == pdTRUE) {
    data.latitude = currentLat;
    data.longitude = currentLon;
    data.altitude_m = currentAlt;
    xSemaphoreGive(gpsMutex);
  } else {
    data.latitude = 0.0;
    data.longitude = 0.0;
    data.altitude_m = 0.0;
  }

  data.co2_ppm = readCO2ppm();
  data.ch4_ppm = readCH4ppm();
  data.no2_ppb = readNO2ppm();

  if (xSemaphoreTake(anemoMutex, pdMS_TO_TICKS(50)) == pdTRUE) {
    data.wind_speed_kmh = currentWindSpeed;
    xSemaphoreGive(anemoMutex);
  } else {
    data.wind_speed_kmh = NAN;
  }

  data.air_temperature_c = readAirTemperatureC();
  data.air_humidity_percent = readAirHumidityPercent();
  data.battery_voltage = readBatteryVoltage();
  data.battery_percent = batteryPercentFromVoltage(data.battery_voltage);
  data.network_type = "WiFi";
  data.rssi_dbm = (WiFi.status() == WL_CONNECTED) ? WiFi.RSSI() : -999;
  data.node_status = (WiFi.status() == WL_CONNECTED && mqttClient.connected()) ? "online" : "offline";
  data.sensor_status = calculateSensorStatus(data);
  data.firmware_version = FW_VERSION;

  return data;
}

// ============================================================
// JSON PAYLOAD BUILDER
// ============================================================
String buildJsonPayload(const SensorData &d) {
  StaticJsonDocument<1024> doc;

  doc["message_id"] = d.message_id;
  doc["device_id"]  = d.device_id;
  doc["timestamp"]  = d.timestamp;

  JsonObject location = doc.createNestedObject("location");
  location["latitude"]   = d.latitude;
  location["longitude"]  = d.longitude;
  location["altitude_m"] = d.altitude_m;

  JsonObject carbon = doc.createNestedObject("carbon_data");
  carbon["co2_ppm"] = isnan(d.co2_ppm) ? 0.0f : d.co2_ppm;
  carbon["ch4_ppm"] = isnan(d.ch4_ppm) ? 0.0f : d.ch4_ppm;
  carbon["no2_ppb"] = isnan(d.no2_ppb) ? 0.0f : d.no2_ppb;

  JsonObject env = doc.createNestedObject("environment");
  env["wind_speed_kmh"]       = isnan(d.wind_speed_kmh) ? 0.0f : d.wind_speed_kmh;
  env["air_temperature_c"]    = isnan(d.air_temperature_c) ? 0.0f : d.air_temperature_c;
  env["air_humidity_percent"] = isnan(d.air_humidity_percent) ? 0.0f : d.air_humidity_percent;

  JsonObject power = doc.createNestedObject("power");
  power["battery_voltage"] = d.battery_voltage;
  power["battery_percent"] = d.battery_percent;

  JsonObject comm = doc.createNestedObject("communication");
  comm["network_type"] = d.network_type;
  comm["rssi_dbm"]      = d.rssi_dbm;

  JsonObject status = doc.createNestedObject("status");
  status["node_status"]      = d.node_status;
  status["sensor_status"]    = d.sensor_status;
  status["firmware_version"] = d.firmware_version;

  String out;
  serializeJson(doc, out);
  return out;
}

// ============================================================
// SETUP
// ============================================================
void setup() {
  Serial.begin(SERIAL_BAUDRATE);

  pinMode(LED_STATUS_PIN, OUTPUT);
  digitalWrite(LED_STATUS_PIN, LOW);

  // Buat Mutex FreeRTOS
  gpsMutex = xSemaphoreCreateMutex();
  anemoMutex = xSemaphoreCreateMutex();

  // Inisialisasi Serial Hardware
  gpsSerial.begin(GPSBaud, SERIAL_8N1, RXPin, TXPin);
  RS485.begin(anoBaud, SERIAL_8N1, ANEMO_RX_PIN, ANEMO_TX_PIN);

  // Jalankan Background Tasks
  xTaskCreatePinnedToCore(vTaskAnemometer, "Task_Anemo", 4096, NULL, 2, NULL, 0);
  xTaskCreatePinnedToCore(vTaskGPS, "Task_GPS", 2048, NULL, 1, NULL, 0);

  preferences.begin("agrisense", false);
  bootCount = preferences.getULong("boot_count", 0);
  preferences.putULong("boot_count", ++bootCount);

  info("Parameters MQ-135 CO2 yang terpasang (Fixed):");
  info("R0: " + String(R0_co2, 3) + " kOhm, A: " + String(A_co2, 4) + ", B: " + String(B_co2, 4));

  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setBufferSize(2048);

  dht.begin();
  initI2CSensors();
  initBatteryADC();

  connectWiFi(); // Hubungkan WiFi di awal

  blinkStatus(2, 150, 150);
}

// ============================================================
// MAIN LOOP
// ============================================================
void loop() {
  // 1. Jaga Koneksi WiFi & MQTT
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  if (WiFi.status() == WL_CONNECTED) {
    if (!mqttClient.connected()) {
      connectMQTT();
    }
    mqttClient.loop();
  }

  // 2. Transmisi Data Interval
  unsigned long now = millis();
  if (now - lastSendMillis >= SEND_INTERVAL_MS) {
    lastSendMillis = now;

    SensorData currentData = readAllSensors();
    String payload = buildJsonPayload(currentData);
    
    saveLastPayload(payload);

    Serial.println("\n[MQTT PUBLISH] Payload:");
    Serial.println(payload);

    if (mqttClient.connected()) {
      if (mqttClient.publish(MQTT_TOPIC, payload.c_str())) {
        info("Payload sent successfully.");
        blinkStatus(1, 200, 100);
      } else {
        err("Payload send failed.");
        blinkStatus(3, 80, 80);
      }
    }
  }

  vTaskDelay(pdMS_TO_TICKS(10));
}