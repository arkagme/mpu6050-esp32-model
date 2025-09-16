#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <MPU6050.h>


const char* ssid = "tripto";
const char* password = "8fxn7kfr";


WebSocketsServer webSocket = WebSocketsServer(81);


MPU6050 mpu;

float gyroXOffset = 0;
float gyroYOffset = 0;
float gyroZOffset = 0;

float gyroAngleX = 0;
float gyroAngleY = 0;
float gyroAngleZ = 0;


unsigned long lastTime = 0;
unsigned long lastSensorRead = 0;
unsigned long lastTempRead = 0;
const unsigned long sensorInterval = 10;  
const unsigned long tempInterval = 1000;  

float temperature = 0;

StaticJsonDocument<200> jsonDoc;
char jsonString[200];

void setup() {
  Serial.begin(115200);

  Wire.begin();

  initializeMPU6050();

  connectToWiFi();


  webSocket.begin();
  webSocket.onEvent(webSocketEvent);

  Serial.println("ESP32 MPU6050 WebSocket Server Ready!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  webSocket.loop();

  unsigned long currentTime = millis();

  if (currentTime - lastSensorRead >= sensorInterval) {
    readMPU6050Data();
    sendSensorData();
    lastSensorRead = currentTime;
  }

  if (currentTime - lastTempRead >= tempInterval) {
    readTemperature();
    lastTempRead = currentTime;
  }
}

void initializeMPU6050() {
  Serial.println("Initializing MPU6050...");

  mpu.initialize();

  if (mpu.testConnection()) {
    Serial.println("MPU6050 connection successful");
  } else {
    Serial.println("MPU6050 connection failed");
    while (1)
      ; 
  }


  mpu.setFullScaleGyroRange(MPU6050_GYRO_FS_250);

  
  mpu.setFullScaleAccelRange(MPU6050_ACCEL_FS_2);


  calibrateGyroscope();

  lastTime = millis();
}

void calibrateGyroscope() {
  Serial.println("Calibrating gyroscope... Keep sensor still!");

  float sumX = 0, sumY = 0, sumZ = 0;
  int samples = 1000;

  for (int i = 0; i < samples; i++) {
    int16_t gx, gy, gz;
    mpu.getRotation(&gx, &gy, &gz);

    sumX += gx;
    sumY += gy;
    sumZ += gz;

    delay(3);
  }

  gyroXOffset = sumX / samples;
  gyroYOffset = sumY / samples;
  gyroZOffset = sumZ / samples;

  Serial.println("Calibration complete!");
  Serial.printf("Offsets - X: %.2f, Y: %.2f, Z: %.2f\n",
                gyroXOffset, gyroYOffset, gyroZOffset);
}

void connectToWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("WiFi connected successfully!");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

void readMPU6050Data() {

  int16_t gx, gy, gz;
  mpu.getRotation(&gx, &gy, &gz);


  float gyroX = gx - gyroXOffset;
  float gyroY = gy - gyroYOffset;
  float gyroZ = gz - gyroZOffset;


  float gyroXRate = gyroX / 131.0;
  float gyroYRate = gyroY / 131.0;
  float gyroZRate = gyroZ / 131.0;


  unsigned long currentTime = millis();
  float deltaTime = (currentTime - lastTime) / 1000.0;
  lastTime = currentTime;


  gyroAngleX += gyroXRate * deltaTime;
  gyroAngleY += gyroYRate * deltaTime;
  gyroAngleZ += gyroZRate * deltaTime;


  if (gyroAngleX > 180)
    gyroAngleX -= 360;
  if (gyroAngleX < -180)
    gyroAngleX += 360;
  if (gyroAngleY > 180)
    gyroAngleY -= 360;
  if (gyroAngleY < -180)
    gyroAngleY += 360;
  if (gyroAngleZ > 180)
    gyroAngleZ -= 360;
  if (gyroAngleZ < -180)
    gyroAngleZ += 360;
}

void readTemperature() {
  int16_t tempRaw = mpu.getTemperature();
  temperature = tempRaw / 340.0 + 36.53;
}

void sendSensorData() {

  jsonDoc.clear();


  jsonDoc["gyroX"] = round(gyroAngleX * 100) / 100.0;  // 2 decimal places
  jsonDoc["gyroY"] = round(gyroAngleY * 100) / 100.0;
  jsonDoc["gyroZ"] = round(gyroAngleZ * 100) / 100.0;
  jsonDoc["temperature"] = round(temperature * 10) / 10.0;  // 1 decimal place
  jsonDoc["timestamp"] = millis();


  serializeJson(jsonDoc, jsonString);


  webSocket.broadcastTXT(jsonString);

  if (Serial.available() > 0 && Serial.read() == 'd') {
    Serial.println(jsonString);
  }
}

void webSocketEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.printf("WebSocket client #%u disconnected\n", num);
      break;

    case WStype_CONNECTED: {
      IPAddress ip = webSocket.remoteIP(num);
      Serial.printf("WebSocket client #%u connected from %d.%d.%d.%d\n",
                    num, ip[0], ip[1], ip[2], ip[3]);

      sendSensorData();
      break;
    }

    case WStype_TEXT: {
      Serial.printf("Received from client #%u: %s\n", num, payload);


      String command = String((char*)payload);
      handleWebSocketCommand(command, num);
      break;
    }

    case WStype_BIN:
      Serial.printf("Received binary data from client #%u\n", num);
      break;

    case WStype_ERROR:
      Serial.printf("WebSocket error on client #%u\n", num);
      break;

    default:
      break;
  }
}

void handleWebSocketCommand(String command, uint8_t clientNum) {
  if (command == "reset") {

    gyroAngleX = 0;
    gyroAngleY = 0;
    gyroAngleZ = 0;

    webSocket.sendTXT(clientNum, "{\"status\":\"reset_complete\"}");
    Serial.println("Gyro angles reset to zero");

  } else if (command == "calibrate") {

    webSocket.sendTXT(clientNum, "{\"status\":\"calibrating\"}");
    calibrateGyroscope();
    webSocket.sendTXT(clientNum, "{\"status\":\"calibration_complete\"}");

  } else if (command == "status") {

    jsonDoc.clear();
    jsonDoc["status"] = "online";
    jsonDoc["uptime"] = millis();
    jsonDoc["free_heap"] = ESP.getFreeHeap();
    jsonDoc["wifi_rssi"] = WiFi.RSSI();
    jsonDoc["connected_clients"] = webSocket.connectedClients();

    serializeJson(jsonDoc, jsonString);
    webSocket.sendTXT(clientNum, jsonString);

  } else {

    webSocket.sendTXT(clientNum, "{\"error\":\"unknown_command\"}");
  }
}


void printWiFiStatus() {
  Serial.println("\n=== WiFi Status ===");
  Serial.print("SSID: ");
  Serial.println(WiFi.SSID());
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
  Serial.print("Signal Strength (RSSI): ");
  Serial.print(WiFi.RSSI());
  Serial.println(" dBm");
  Serial.print("Free Heap: ");
  Serial.println(ESP.getFreeHeap());
  Serial.println("==================\n");
}
