# MPU6050 3D Model Visualizer

Real-time 3D model rotation based on ESP32 MPU6050 gyroscope data using locally installed Three.js.

## Features

- **Real-time 3D Visualization**: Rotate 3D models in real-time based on MPU6050 sensor data
- **Custom Model Support**: Load your own .glTF/.glb 3D models
- **WebSocket Communication**: Live connection to ESP32 over WiFi
- **Modern UI**: Beautiful, responsive interface with real-time statistics
- **Local Three.js**: Uses npm-installed Three.js instead of CDN for better performance and reliability

## Setup Instructions

### Prerequisites

- Node.js 
- npm 
- ESP32 with MPU6050 sensor 

### Installation

1. **Clone or download the project files**
   ```bash
   # If using git
   git clone <repository-url>
   cd esp-mpu-model
   
   ```
2. -  Go to command prompt ( terminal )

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Start the development server**   
   ```bash
   npx vite

   ```

5. **Open your browser**
   - The application will be available at `http://localhost:5173`



### Usage

1. **Connect to ESP32**:
   - Enter your ESP32's IP address in the connection panel
   - Click "Connect to ESP32"
   - Status indicator will turn green when connected

2. **Load 3D Models**:
   - Click "Choose File" in the 3D Model panel
   - Select a .glTF or .glb file from your computer
   - The model will replace the default cube

3. **Control the View**:
   - Use mouse to orbit, zoom, and pan around the model
   - Use control buttons to reset rotation, center model, or toggle wireframe
   - Keyboard shortcuts: R (reset), C (center), W (wireframe)

4. **Monitor Data**:
   - Real-time gyroscope data is displayed in the sidebar
   - Statistics show connection time and update rate
   - FPS counter shows rendering performance


