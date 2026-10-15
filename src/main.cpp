#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <DNSServer.h>
#include <ESPAsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <WebSocketsServer.h>

#include <Servo.h>
#include <LittleFS.h>
#include <ArduinoJson.h>

// ========== Hardware pins ==========
#define SERVO1_PIN 2    // 360-degree servo 1 (check boot pin constraints)
#define SERVO2_PIN 3    // 360-degree servo 2
#define SERVO3_PIN 10   // 180-degree servo
#define MOTOR_IN1 6     // TT motor
#define MOTOR_IN2 7
#define LED_D4_PIN 12   // D4 status LED, active high
#define LED_D5_PIN 13   // D5 status LED, active high

// Continuous-servo pulse calibration. Adjust the stop points if a servo creeps while idle.
const int CONTINUOUS_SERVO_MIN_US = 1000;
const int CONTINUOUS_SERVO_MAX_US = 2000;
const int SERVO1_STOP_US = 1500;
const int SERVO2_STOP_US = 1500;
const int MOTOR_PWM_RAMP_STEP = 10;
const int MOTOR_PWM_RAMP_DELAY_MS = 8;
const unsigned long MOTION_WATCHDOG_TIMEOUT_MS = 1500;
const unsigned long MAX_TIMED_RUN_MS = 5000;

// ========== AP configuration ==========
const byte DNS_PORT = 53;
const IPAddress AP_IP(192, 168, 4, 1);
const IPAddress AP_GATEWAY(192, 168, 4, 1);
const IPAddress AP_SUBNET(255, 255, 255, 0);
String apSSID;
String configuredWiFiMode = "sta";
String activeWiFiMode = "STA";
String connectedSSID;
String savedStaSSID;
bool configurationPortal = false;
bool restartRequested = false;
unsigned long restartAt = 0;

// Optional fallback network used when no WiFi credentials are stored.
const char *DEFAULT_STA_SSID = "";
const char *DEFAULT_STA_PASSWORD = "";

// ========== Servo instances ==========
Servo servo1;
Servo servo2;
Servo servo3;

// ========== Server instances ==========
AsyncWebServer server(80);
WebSocketsServer webSocket(81);
DNSServer dnsServer;

// ========== Actuator state ==========
struct MotorState {
  int speed;
  unsigned long startTime;
  unsigned long duration;
  bool running;
  bool autoStop;
};

MotorState servo1State = {90, 0, 0, false, false};
MotorState servo2State = {90, 0, 0, false, false};
MotorState motorState = {0, 0, 0, false, false};

// ========== Heartbeat state ==========
unsigned long lastHeartbeat = 0;

// ========== Command inactivity timeout ==========
const unsigned long COMMAND_IDLE_TIMEOUT_MS = 5UL * 60UL * 1000UL;
const unsigned long MAX_CONTINUOUS_RUN_MS = 10UL * 1000UL;
unsigned long lastCommandTime = 0;
unsigned long lastMotionKeepalive = 0;

// ========== Non-blocking motor ramp ==========
int motorCurrentPwm = 0;
int motorTargetPwm = 0;
int motorActivePin = MOTOR_IN1;
unsigned long lastMotorRampStep = 0;

// ========== WiFi status polling ==========
unsigned long lastWiFiCheck = 0;

// ========== LED blink state ==========
unsigned long lastLedBlink = 0;
bool ledState = false;
bool ledModeInitialized = false;
bool previousNetworkReady = false;

// ========== Function declarations ==========
void setupWiFi();
void setupAccessPoint(bool isConfigurationPortal = false);
bool connectToLocalWiFi(const String &ssid, const String &password);
void setupWebServer();
void setupWebSocket();
void redirectToControlPage(AsyncWebServerRequest *request);
void handleWebSocketMessage(uint8_t num, uint8_t* payload, size_t length);
void webSocketEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t length);
void printResetReason();
void checkServo1AutoStop();
void checkServo2AutoStop();
void checkMotorAutoStop();
void updateMotorRamp();
void checkMotionWatchdog();
void sendHeartbeatIfNeeded();
void sendHeartbeat();
int getAverageClientRssi();
int speedToContinuousServoPulse(int speed);
void initMotorOutputs();
void startServo1(int speed, int duration, bool autoStop);
void stopServo1();
void startServo2(int speed, int duration, bool autoStop);
void stopServo2();
void startMotor(int speed, int duration, bool autoStop, bool forward);
void stopMotor();
void stopAllMotors(const char *reason);
void broadcastMotorStopped(const char *motor, const char *reason);
void sendCommandError(uint8_t num, const char *error);
void setServo3Angle(int angle);
void updateNetworkLEDs(bool networkReady);
void checkInactivitySleep();
void enterDeepSleep();
void scheduleRestart();

// ========== Simple config persistence using LittleFS ==========
bool loadWifiConfig(String &mode, String &ssid, String &password) {
  if (!LittleFS.exists("/config.json")) return false;
  File f = LittleFS.open("/config.json", "r");
  if (!f) return false;
  DynamicJsonDocument doc(512);
  DeserializationError err = deserializeJson(doc, f);
  f.close();
  if (err) return false;
  mode = String((const char*)(doc["mode"] | "sta"));
  ssid = String((const char*)(doc["ssid"] | ""));
  password = String((const char*)(doc["password"] | ""));
  return true;
}

bool saveWifiConfig(const String &mode, const String &ssid, const String &password) {
  DynamicJsonDocument doc(512);
  doc["mode"] = mode;
  doc["ssid"] = ssid;
  doc["password"] = password;
  File f = LittleFS.open("/config.json", "w");
  if (!f) return false;
  serializeJson(doc, f);
  f.close();
  return true;
}

void clearWifiConfig() {
  if (LittleFS.exists("/config.json")) LittleFS.remove("/config.json");
}

// ========== Setup ==========
void setup() {
  initMotorOutputs();

  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n========================================");
  Serial.println("ESP8266 Motor Control System Starting");
  printResetReason();
  Serial.println("========================================");
  
  // Initialize both active-high status LEDs.
  pinMode(LED_D4_PIN, OUTPUT);
  pinMode(LED_D5_PIN, OUTPUT);
  digitalWrite(LED_D4_PIN, HIGH);
  digitalWrite(LED_D5_PIN, HIGH);
  Serial.println("[OK] D4 and D5 LEDs initialized");
  delay(1000);
  digitalWrite(LED_D4_PIN, LOW);
  digitalWrite(LED_D5_PIN, LOW);
  
  // Mount the web UI filesystem.
  if (!LittleFS.begin()) {
    Serial.println("[ERROR] Failed to mount LittleFS");
    return;
  }
  Serial.println("[OK] LittleFS mounted");
  
  // Initialize the servos.
  servo1.attach(SERVO1_PIN);
  servo2.attach(SERVO2_PIN);
  servo3.attach(SERVO3_PIN);
  
  servo1.writeMicroseconds(SERVO1_STOP_US);  // Stop
  servo2.writeMicroseconds(SERVO2_STOP_US);  // Stop
  servo3.write(90);  // Center
  
  Serial.println("[OK] Servos initialized");
  
  // Restore the configured WiFi mode or open the setup portal when STA cannot connect.
  setupWiFi();
  
  // Start the HTTP server.
  setupWebServer();
  
  // Start the WebSocket server.
  setupWebSocket();

  lastCommandTime = millis();
  
  Serial.println("========================================");
  Serial.println("[OK] System startup complete");
  Serial.println("[INFO] Robot arm control console is ready.");
  Serial.println("[INFO] Open this URL on your computer to control the robot arm:");
  Serial.print("[URL] http://");
  Serial.println(activeWiFiMode == "STA" ? WiFi.localIP() : WiFi.softAPIP());
  Serial.println("========================================\n");
}

// ========== Main loop ==========
void loop() {
  // Process captive-portal DNS requests in AP mode.
  if (activeWiFiMode == "AP") dnsServer.processNextRequest();

  // Process WebSocket events.
  webSocket.loop();
  
  // Enforce actuator run limits.
  updateMotorRamp();
  checkServo1AutoStop();
  checkServo2AutoStop();
  checkMotorAutoStop();
  checkMotionWatchdog();
  
  // Broadcast heartbeat data.
  sendHeartbeatIfNeeded();
  
  // D4 blinks slowly when online; D4 and D5 alternate when offline.
  bool networkReady = activeWiFiMode == "STA"
      ? WiFi.status() == WL_CONNECTED
      : WiFi.softAPgetStationNum() > 0;
  updateNetworkLEDs(networkReady);
  
  // Log WiFi status every five seconds.
  if (millis() - lastWiFiCheck >= 5000) {
    if (activeWiFiMode == "STA") {
      Serial.printf("WiFi: %s, RSSI: %d dBm\n", WiFi.status() == WL_CONNECTED ? "connected" : "disconnected", WiFi.RSSI());
    } else {
      Serial.printf("Access point clients: %d\n", WiFi.softAPgetStationNum());
    }
    lastWiFiCheck = millis();
  }

  if (restartRequested && millis() >= restartAt) ESP.restart();

  // Enter deep sleep after command inactivity.
  checkInactivitySleep();
}

// ========== Reset reason ==========
void printResetReason() {
  Serial.print("Last reset reason: ");
  Serial.println(ESP.getResetInfo());
}

void setupWiFi() {
  String savedSSID = "";
  String savedPassword = "";
  String mode = "sta";

  if (!loadWifiConfig(mode, savedSSID, savedPassword)) {
    mode = "sta";
  }
  configuredWiFiMode = mode;
  savedStaSSID = savedSSID;

  if (configuredWiFiMode == "ap") {
    setupAccessPoint(false);
    return;
  }

  if (savedSSID.length() > 0 && connectToLocalWiFi(savedSSID, savedPassword)) return;

  if (savedSSID.length() == 0 && strlen(DEFAULT_STA_SSID) > 0) {
    savedStaSSID = DEFAULT_STA_SSID;
    if (connectToLocalWiFi(DEFAULT_STA_SSID, DEFAULT_STA_PASSWORD)) return;
  }

  if (savedStaSSID.length() == 0) {
    Serial.println("[WARN] No WiFi SSID configured; starting the configuration access point");
  } else {
    Serial.print("[ERROR] WiFi connection failed; starting the configuration access point. Target SSID: ");
    Serial.println(savedStaSSID);
  }
  setupAccessPoint(true);
}

bool connectToLocalWiFi(const String &ssid, const String &password) {
  Serial.println("\n--- WiFi Station Mode ---");
  Serial.print("Connecting to: ");
  Serial.println(ssid);
  WiFi.mode(WIFI_STA);
  WiFi.setSleepMode(WIFI_NONE_SLEEP);
  WiFi.begin(ssid.c_str(), password.c_str());

  unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < 15000) {
    updateNetworkLEDs(false);
    delay(250);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {
    WiFi.disconnect(true);
    return false;
  }

  activeWiFiMode = "STA";
  configurationPortal = false;
  connectedSSID = ssid;
  Serial.print("[OK] Connected to WiFi, IP: ");
  Serial.println(WiFi.localIP());
  return true;
}

// ========== AP and captive portal ==========
void setupAccessPoint(bool isConfigurationPortal) {
  Serial.println("\n--- WiFi Access Point Mode ---");

  uint32_t chipId = ESP.getChipId();
  apSSID = "ESP8266-RobotArm-" + String(chipId, HEX);
  apSSID.toUpperCase();

  WiFi.mode(WIFI_AP);
  WiFi.setSleepMode(WIFI_NONE_SLEEP);

  if (!WiFi.softAPConfig(AP_IP, AP_GATEWAY, AP_SUBNET)) {
    Serial.println("[ERROR] Failed to configure the access point address; restarting...");
    delay(1000);
    ESP.restart();
  }

  if (!WiFi.softAP(apSSID.c_str())) {
    Serial.println("[ERROR] Failed to start the access point; restarting...");
    delay(1000);
    ESP.restart();
  }

  dnsServer.start(DNS_PORT, "*", AP_IP);
  activeWiFiMode = "AP";
  configurationPortal = isConfigurationPortal;
  connectedSSID = apSSID;

  Serial.println("[OK] Open access point started (no password)");
  Serial.print("[OK] Access point SSID: ");
  Serial.println(apSSID);
  Serial.print("[OK] Control page: http://");
  Serial.println(WiFi.softAPIP());
  Serial.println("[OK] DNS captive portal started");
}

void redirectToControlPage(AsyncWebServerRequest *request) {
  IPAddress ip = activeWiFiMode == "STA" ? WiFi.localIP() : AP_IP;
  String url = "http://" + ip.toString() + "/";
  request->redirect(url);
}

void scheduleRestart() {
  stopAllMotors("restart_requested");
  servo3.write(90);
  restartRequested = true;
  restartAt = millis() + 1200;
}

// ========== Network status LEDs ==========
void updateNetworkLEDs(bool networkReady) {
  unsigned long now = millis();
  const unsigned long interval = networkReady ? 2000UL : 500UL;

  // Apply the new indication immediately when the network state changes.
  if (!ledModeInitialized || networkReady != previousNetworkReady) {
    ledModeInitialized = true;
    previousNetworkReady = networkReady;
    ledState = true;
    lastLedBlink = now;
  } else if (now - lastLedBlink >= interval) {
    ledState = !ledState;
    lastLedBlink = now;
  } else {
    return;
  }

  if (networkReady) {
    digitalWrite(LED_D4_PIN, ledState ? HIGH : LOW);
    digitalWrite(LED_D5_PIN, LOW);
  } else {
    digitalWrite(LED_D4_PIN, ledState ? HIGH : LOW);
    digitalWrite(LED_D5_PIN, ledState ? LOW : HIGH);
  }
}

// ========== HTTP server ==========
void setupWebServer() {
  // Serve the web UI assets.
  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
    request->send(LittleFS, "/index.html", "text/html");
  });
  
  server.on("/style.css", HTTP_GET, [](AsyncWebServerRequest *request){
    request->send(LittleFS, "/style.css", "text/css");
  });
  
  server.on("/script.js", HTTP_GET, [](AsyncWebServerRequest *request){
    request->send(LittleFS, "/script.js", "application/javascript");
  });

  // Handle common captive-portal detection endpoints.
  server.on("/generate_204", HTTP_GET, redirectToControlPage);
  server.on("/gen_204", HTTP_GET, redirectToControlPage);
  server.on("/connecttest.txt", HTTP_GET, redirectToControlPage);
  server.on("/ncsi.txt", HTTP_GET, redirectToControlPage);
  server.on("/redirect", HTTP_GET, redirectToControlPage);
  server.on("/hotspot-detect.html", HTTP_GET, [](AsyncWebServerRequest *request){
    request->send(LittleFS, "/index.html", "text/html");
  });
  server.on("/library/test/success.html", HTTP_GET, [](AsyncWebServerRequest *request){
    request->send(LittleFS, "/index.html", "text/html");
  });

  // Start a synchronous WiFi scan and return its results.
  server.on("/wifi-scan", HTTP_GET, [](AsyncWebServerRequest *request){
    int networkCount = WiFi.scanNetworks();
    if (networkCount <= 0) {
      request->send(200, "application/json", "{\"scanning\":false,\"networks\":[]}" );
      return;
    }

    DynamicJsonDocument doc(4096);
    doc["scanning"] = false;
    JsonArray networks = doc.createNestedArray("networks");
    String includedSSIDs[20];
    int includedCount = 0;

    for (int i = 0; i < networkCount && includedCount < 20; i++) {
      String ssid = WiFi.SSID(i);
      if (ssid.length() == 0) continue;

      bool duplicate = false;
      for (int j = 0; j < includedCount; j++) {
        if (includedSSIDs[j] == ssid) {
          duplicate = true;
          break;
        }
      }
      if (duplicate) continue;

      includedSSIDs[includedCount++] = ssid;
      JsonObject network = networks.createNestedObject();
      network["ssid"] = ssid;
      network["rssi"] = WiFi.RSSI(i);
      network["secure"] = WiFi.encryptionType(i) != ENC_TYPE_NONE;
    }

    String response;
    serializeJson(doc, response);
    WiFi.scanDelete();
    request->send(200, "application/json", response);
  });
  
  // Return current WiFi information without exposing the password.
  server.on("/wifi-info", HTTP_GET, [](AsyncWebServerRequest *request){
    StaticJsonDocument<512> doc;

    doc["mode"] = activeWiFiMode;
    doc["configuredMode"] = configuredWiFiMode;
    doc["configurationPortal"] = configurationPortal;
    doc["connected"] = activeWiFiMode == "AP" || WiFi.status() == WL_CONNECTED;
    doc["ssid"] = connectedSSID;
    doc["savedSSID"] = savedStaSSID;
    doc["ip"] = (activeWiFiMode == "STA" ? WiFi.localIP() : WiFi.softAPIP()).toString();
    if (activeWiFiMode == "AP") doc["clients"] = WiFi.softAPgetStationNum();
    int rssi = activeWiFiMode == "STA" ? WiFi.RSSI() : getAverageClientRssi();
    if (rssi != 0) doc["rssi"] = rssi;
    
    String response;
    serializeJson(doc, response);
    request->send(200, "application/json", response);
  });

  // Store WiFi settings and restart after the response is sent.
  server.on("/wifi-config", HTTP_POST, [](AsyncWebServerRequest *request){
    if (!request->hasParam("mode", true)) {
      request->send(400, "application/json", "{\"ok\":false,\"error\":\"missing mode\"}");
      return;
    }

    String mode = request->getParam("mode", true)->value();
    mode.toLowerCase();
    if (mode != "ap" && mode != "sta") {
      request->send(400, "application/json", "{\"ok\":false,\"error\":\"invalid mode\"}");
      return;
    }

    String ssid;
    String password;
    if (mode == "sta") {
      if (!request->hasParam("ssid", true)) {
        request->send(400, "application/json", "{\"ok\":false,\"error\":\"missing ssid\"}");
        return;
      }
      ssid = request->getParam("ssid", true)->value();
      ssid.trim();
      password = request->hasParam("password", true)
          ? request->getParam("password", true)->value()
          : "";
      if (ssid.length() == 0 || ssid.length() > 32 || password.length() > 63) {
        request->send(400, "application/json", "{\"ok\":false,\"error\":\"invalid credentials\"}");
        return;
      }
    }

    if (!saveWifiConfig(mode, ssid, password)) {
      request->send(500, "application/json", "{\"ok\":false,\"error\":\"save_failed\"}");
      return;
    }

    request->send(200, "application/json", "{\"ok\":true,\"restarting\":true}");
    scheduleRestart();
  });

  // Clear stored WiFi settings and open the setup portal after restart.
  server.on("/wifi-reset", HTTP_POST, [](AsyncWebServerRequest *request){
    clearWifiConfig();
    request->send(200, "application/json", "{\"ok\":true,\"restarting\":true}");
    scheduleRestart();
  });

  server.onNotFound(redirectToControlPage);
  
  // Start the HTTP server.
  server.begin();
  Serial.println("[OK] Web server started on port 80");
}

// ========== WebSocket server ==========
void setupWebSocket() {
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
  Serial.println("[OK] WebSocket server started on port 81");
}

// ========== WebSocket event handling ==========
void webSocketEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.printf("[%u] Client disconnected\n", num);
      stopAllMotors("websocket_disconnected");
      break;
      
    case WStype_CONNECTED:
      {
        IPAddress ip = webSocket.remoteIP(num);
        Serial.printf("[%u] Client connected: %s\n", num, ip.toString().c_str());
      }
      break;
      
    case WStype_TEXT:
      handleWebSocketMessage(num, payload, length);
      break;
  }
}

// ========== WebSocket message handling ==========
void handleWebSocketMessage(uint8_t num, uint8_t* payload, size_t length) {
  // Parse the JSON command.
  StaticJsonDocument<384> doc;
  DeserializationError error = deserializeJson(doc, payload, length);
  
  if (error) {
    Serial.println("[ERROR] Failed to parse JSON");
    sendCommandError(num, "invalid_json");
    return;
  }

  if (!doc["type"].is<const char*>()) {
    sendCommandError(num, "missing_type");
    return;
  }

  String type = doc["type"].as<String>();
  String motor = doc["motor"].is<const char*>() ? doc["motor"].as<String>() : "";
  bool validMotor = motor == "servo1" || motor == "servo2" || motor == "motor";

  // Dispatch validated actuator commands.
  if (type == "run_duration") {
    if (!validMotor || !doc["speed"].is<int>() || !doc["duration"].is<int>()) {
      sendCommandError(num, "invalid_run_command");
      return;
    }

    int speed = doc["speed"].as<int>();
    int duration = doc["duration"].as<int>();
    bool validSpeed = motor == "motor" ? speed >= 0 && speed <= 255 : speed >= 0 && speed <= 180;
    if (!validSpeed || duration < 1 || duration > (int)MAX_TIMED_RUN_MS ||
        (motor == "motor" && !doc["forward"].is<bool>())) {
      sendCommandError(num, "out_of_range");
      return;
    }

    lastMotionKeepalive = millis();
    
    if (motor == "servo1") {
      startServo1(speed, duration, true);
      Serial.printf("Servo 1: speed %d, run time %d ms\n", speed, duration);
    } 
    else if (motor == "servo2") {
      startServo2(speed, duration, true);
      Serial.printf("Servo 2: speed %d, run time %d ms\n", speed, duration);
    }
    else if (motor == "motor") {
      bool forward = doc["forward"].as<bool>();
      startMotor(speed, duration, true, forward);
      Serial.printf("Motor: speed %d, run time %d ms, %s\n", speed, duration, forward ? "forward" : "reverse");
    }
  }
  else if (type == "start_continuous") {
    if (!validMotor || !doc["speed"].is<int>()) {
      sendCommandError(num, "invalid_run_command");
      return;
    }

    int speed = doc["speed"].as<int>();
    bool validSpeed = motor == "motor" ? speed >= 0 && speed <= 255 : speed >= 0 && speed <= 180;
    if (!validSpeed || (motor == "motor" && !doc["forward"].is<bool>())) {
      sendCommandError(num, "out_of_range");
      return;
    }

    lastMotionKeepalive = millis();
    
    if (motor == "servo1") {
      startServo1(speed, MAX_CONTINUOUS_RUN_MS, true);
      Serial.printf("Servo 1: continuous run, speed %d, maximum %lu ms\n", speed, MAX_CONTINUOUS_RUN_MS);
    }
    else if (motor == "servo2") {
      startServo2(speed, MAX_CONTINUOUS_RUN_MS, true);
      Serial.printf("Servo 2: continuous run, speed %d, maximum %lu ms\n", speed, MAX_CONTINUOUS_RUN_MS);
    }
    else if (motor == "motor") {
      bool forward = doc["forward"].as<bool>();
      startMotor(speed, MAX_CONTINUOUS_RUN_MS, true, forward);
      Serial.printf("Motor: continuous run, speed %d, %s, maximum %lu ms\n", speed, forward ? "forward" : "reverse", MAX_CONTINUOUS_RUN_MS);
    }
  }
  else if (type == "stop") {
    if (!validMotor) {
      sendCommandError(num, "invalid_motor");
      return;
    }

    if (motor == "servo1") {
      stopServo1();
      Serial.println("Servo 1 stopped");
    }
    else if (motor == "servo2") {
      stopServo2();
      Serial.println("Servo 2 stopped");
    }
    else if (motor == "motor") {
      stopMotor();
      Serial.println("Motor stopped");
    }
  }
  else if (type == "servo180") {
    if (!doc["angle"].is<int>()) {
      sendCommandError(num, "invalid_angle");
      return;
    }
    int angle = doc["angle"].as<int>();
    if (angle < 0 || angle > 180) {
      sendCommandError(num, "out_of_range");
      return;
    }
    setServo3Angle(angle);
    Serial.printf("180-degree servo angle: %d degrees\n", angle);
  }
  else if (type == "emergency_stop") {
    stopAllMotors("emergency_stop");
  }
  else if (type == "control_keepalive") {
    lastMotionKeepalive = millis();
  }
  else {
    sendCommandError(num, "unknown_type");
    return;
  }

  lastCommandTime = millis();
}

// ========== Servo 1 run-limit check ==========
void checkServo1AutoStop() {
  if (servo1State.running && servo1State.autoStop) {
    if (millis() - servo1State.startTime >= servo1State.duration) {
      stopServo1();
      Serial.println("Servo 1 stopped automatically");
      broadcastMotorStopped("servo1", "run_limit");
    }
  }
}

// ========== Servo 2 run-limit check ==========
void checkServo2AutoStop() {
  if (servo2State.running && servo2State.autoStop) {
    if (millis() - servo2State.startTime >= servo2State.duration) {
      stopServo2();
      Serial.println("Servo 2 stopped automatically");
      broadcastMotorStopped("servo2", "run_limit");
    }
  }
}

// ========== TT motor run-limit check ==========
void checkMotorAutoStop() {
  if (motorState.running && motorState.autoStop) {
    if (millis() - motorState.startTime >= motorState.duration) {
      stopMotor();
      Serial.println("Motor stopped automatically");
      broadcastMotorStopped("motor", "run_limit");
    }
  }
}

void checkMotionWatchdog() {
  bool motionActive = servo1State.running || servo2State.running || motorState.running;
  if (motionActive && millis() - lastMotionKeepalive >= MOTION_WATCHDOG_TIMEOUT_MS) {
    stopAllMotors("command_watchdog");
  }
}

// ========== Heartbeat broadcasting ==========
void sendHeartbeatIfNeeded() {
  if (millis() - lastHeartbeat >= 1000) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }
}

void sendHeartbeat() {
  if (webSocket.connectedClients() == 0) return;
  
  StaticJsonDocument<384> doc;
  doc["type"] = "heartbeat";
  doc["mode"] = activeWiFiMode;
  doc["configuredMode"] = configuredWiFiMode;
  doc["configurationPortal"] = configurationPortal;
  doc["timestamp"] = millis();
  doc["uptime"] = millis() / 1000;
  doc["ssid"] = connectedSSID;
  doc["ip"] = (activeWiFiMode == "STA" ? WiFi.localIP() : WiFi.softAPIP()).toString();
  if (activeWiFiMode == "AP") doc["clients"] = WiFi.softAPgetStationNum();
  int rssi = activeWiFiMode == "STA" ? WiFi.RSSI() : getAverageClientRssi();
  if (rssi != 0) doc["rssi"] = rssi;
  
  String json;
  serializeJson(doc, json);
  webSocket.broadcastTXT(json);
}

// Return the average RSSI of connected AP clients, or zero when unavailable.
int getAverageClientRssi() {
  // Not available on ESP8266 via public API; return 0 as fallback.
  return 0;
}

// ========== Servo 1 control ==========
int speedToContinuousServoPulse(int speed) {
  speed = constrain(speed, 0, 180);
  return map(speed, 0, 180, CONTINUOUS_SERVO_MIN_US, CONTINUOUS_SERVO_MAX_US);
}

void startServo1(int speed, int duration, bool autoStop) {
  servo1.writeMicroseconds(speedToContinuousServoPulse(speed));
  servo1State.speed = speed;
  servo1State.startTime = millis();
  servo1State.duration = duration;
  servo1State.running = true;
  servo1State.autoStop = autoStop;
}

void stopServo1() {
  servo1.writeMicroseconds(SERVO1_STOP_US);
  servo1State.running = false;
}

// ========== Servo 2 control ==========
void startServo2(int speed, int duration, bool autoStop) {
  servo2.writeMicroseconds(speedToContinuousServoPulse(speed));
  servo2State.speed = speed;
  servo2State.startTime = millis();
  servo2State.duration = duration;
  servo2State.running = true;
  servo2State.autoStop = autoStop;
}

void stopServo2() {
  servo2.writeMicroseconds(SERVO2_STOP_US);
  servo2State.running = false;
}

// ========== TT motor control ==========
void initMotorOutputs() {
  pinMode(MOTOR_IN1, OUTPUT);
  pinMode(MOTOR_IN2, OUTPUT);
  digitalWrite(MOTOR_IN1, LOW);
  digitalWrite(MOTOR_IN2, LOW);
}

void startMotor(int speed, int duration, bool autoStop, bool forward) {
  speed = constrain(speed, 0, 255);
  motorActivePin = forward ? MOTOR_IN1 : MOTOR_IN2;
  int inactivePin = forward ? MOTOR_IN2 : MOTOR_IN1;

  analogWrite(MOTOR_IN1, 0);
  analogWrite(MOTOR_IN2, 0);
  digitalWrite(inactivePin, LOW);
  motorCurrentPwm = 0;
  motorTargetPwm = speed;
  lastMotorRampStep = millis();
  
  motorState.speed = speed;
  motorState.startTime = millis();
  motorState.duration = duration;
  motorState.running = true;
  motorState.autoStop = autoStop;
}

void updateMotorRamp() {
  if (!motorState.running || motorCurrentPwm >= motorTargetPwm ||
      millis() - lastMotorRampStep < MOTOR_PWM_RAMP_DELAY_MS) {
    return;
  }

  motorCurrentPwm = min(motorCurrentPwm + MOTOR_PWM_RAMP_STEP, motorTargetPwm);
  analogWrite(motorActivePin, motorCurrentPwm);
  lastMotorRampStep = millis();
}

void stopMotor() {
  analogWrite(MOTOR_IN1, 0);
  analogWrite(MOTOR_IN2, 0);
  digitalWrite(MOTOR_IN1, LOW);
  digitalWrite(MOTOR_IN2, LOW);
  motorCurrentPwm = 0;
  motorTargetPwm = 0;
  motorState.running = false;
}

void stopAllMotors(const char *reason) {
  stopServo1();
  stopServo2();
  stopMotor();
  Serial.printf("All motors stopped: %s\n", reason);

  StaticJsonDocument<160> doc;
  doc["type"] = "safety_stop";
  doc["reason"] = reason;
  String json;
  serializeJson(doc, json);
  webSocket.broadcastTXT(json);
}

void broadcastMotorStopped(const char *motor, const char *reason) {
  StaticJsonDocument<160> doc;
  doc["type"] = "motor_stopped";
  doc["motor"] = motor;
  doc["reason"] = reason;
  String json;
  serializeJson(doc, json);
  webSocket.broadcastTXT(json);
}

void sendCommandError(uint8_t num, const char *error) {
  StaticJsonDocument<128> doc;
  doc["type"] = "command_error";
  doc["error"] = error;
  String json;
  serializeJson(doc, json);
  webSocket.sendTXT(num, json);
}

// ========== 180-degree servo control ==========
void setServo3Angle(int angle) {
  servo3.write(angle);
}

// ========== Inactivity sleep ==========
void checkInactivitySleep() {
  if (millis() - lastCommandTime >= COMMAND_IDLE_TIMEOUT_MS) {
    Serial.println("No commands received for 5 minutes; entering deep sleep");
    enterDeepSleep();
  }
}

void enterDeepSleep() {
  // Stop every actuator and center the positional servo.
  stopServo1();
  stopServo2();
  stopMotor();
  servo3.write(90);

  // Shut down network services.
  webSocket.close();
  server.end();
  dnsServer.stop();
  WiFi.softAPdisconnect(true);
  WiFi.mode(WIFI_OFF);

  digitalWrite(LED_D4_PIN, LOW);
  digitalWrite(LED_D5_PIN, LOW);
  delay(100);

  // Enter deep sleep. An external reset or wake source is required.
  ESP.deepSleep(0);
}

