#include <Arduino.h>
#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ESP32Servo.h>

const char* AP_SSID = "ServoAP";
const char* AP_PWD  = "12345678";
const int SERVO_PINS[4] = { 2, 3, 4, 5 };

AsyncWebServer server(80);
Servo servos[4];

const char INDEX_HTML[] PROGMEM = R"rawliteral(
<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>4-Servo Control</title>
<style>
  body { font-family: sans-serif; padding: 1rem; }
  .row { margin: 1rem 0; }
  label { display:block; margin-bottom: .3rem; }
</style>
</head>
<body>
  <h2>4-Servo 控制</h2>
  <div id="controls"></div>
  <script>
    const controls = document.getElementById('controls');
    for (let i = 1; i <= 4; i++) {
      const row = document.createElement('div');
      row.className = 'row';
      const label = document.createElement('label');
      label.textContent = 'Servo ' + i + '：';
      const range = document.createElement('input');
      range.type = 'range';
      range.min = 0;
      range.max = 180;
      range.value = 90;
      range.style.width = '100%';
      const value = document.createElement('div');
      value.textContent = '90°';
      range.oninput = () => value.textContent = range.value + '°';
      range.onchange = () => {
        fetch(`/set?servo=${i}&angle=${range.value}`)
          .then(r => r.json())
          .then(j => console.log(j))
          .catch(e => console.error(e));
      };
      row.appendChild(label);
      row.appendChild(range);
      row.appendChild(value);
      controls.appendChild(row);
    }
  </script>
</body>
</html>
)rawliteral";

void handleRoot(AsyncWebServerRequest *request) {
  request->send_P(200, "text/html", INDEX_HTML);
}

void handleSet(AsyncWebServerRequest *request) {
  if (!request->hasParam("servo") || !request->hasParam("angle")) {
    request->send(400, "application/json", "{\"ok\":false,\"error\":\"missing params\"}");
    return;
  }

  int idx = request->getParam("servo")->value().toInt() - 1;
  int angle = request->getParam("angle")->value().toInt();

  if (idx < 0 || idx >= 4 || angle < 0 || angle > 180) {
    request->send(400, "application/json", "{\"ok\":false,\"error\":\"out_of_range\"}");
    return;
  }

  servos[idx].write(angle);
  String resp = String("{\"ok\":true,\"servo\":") + (idx + 1) + ",\"angle\":" + angle + "}";
  request->send(200, "application/json", resp);
}

void setup() {
  Serial.begin(115200);
  delay(100);

  for (int i = 0; i < 4; i++) {
    servos[i].attach(SERVO_PINS[i]);
    servos[i].write(90);
  }

  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PWD);
  Serial.printf("AP: %s\nIP: %s\n", AP_SSID, WiFi.softAPIP().toString().c_str());

  server.on("/", HTTP_GET, handleRoot);
  server.on("/set", HTTP_GET, handleSet);
  server.begin();
  Serial.println("HTTP server started");
}

void loop() {
  // all work is handled by callbacks
}
