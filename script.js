import * as THREE from './node_modules/three/build/three.module.js';
import { GLTFLoader } from './node_modules/three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from './node_modules/three/examples/jsm/controls/OrbitControls.js';

class MPU6050Visualizer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.model = null;
        this.controls = null;
        this.websocket = null;
        

        this.isConnected = false;
        this.modelLoaded = false;
        this.currentModel = null;
        

        this.frameCount = 0;
        this.lastFrameTime = Date.now();
        this.updateCount = 0;
        this.lastUpdateTime = Date.now();
        

        this.sensorData = {
            gyroX: 0,
            gyroY: 0,
            gyroZ: 0,
            temperature: 0,
            timestamp: 0
        };
        

        this.smoothRotation = true;
        this.rotationSpeed = 0.1;
        this.targetRotation = { x: 0, y: 0, z: 0 };
        this.currentRotation = { x: 0, y: 0, z: 0 };
        
        this.init();
    }
    
    init() {
        this.initThreeJS();
        this.createDefaultModel();
        this.setupEventListeners();
        this.setupScaleControl();
        this.animate();
        console.log('MPU6050 Visualizer initialized');
    }
    
    initThreeJS() {

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);
        

        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.camera.position.set(5, 5, 5);
        
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true,
            precision: 'highp'
        });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.container.appendChild(this.renderer.domElement);
        

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 50;
        

        this.setupLighting();
        

        this.addGridHelper();
    }
    
    setupLighting() {

        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        this.scene.add(directionalLight);
        

        const fillLight = new THREE.DirectionalLight(0x4466ff, 0.3);
        fillLight.position.set(-5, 0, -5);
        this.scene.add(fillLight);
        

        const rimLight = new THREE.DirectionalLight(0xff6644, 0.2);
        rimLight.position.set(0, 5, -10);
        this.scene.add(rimLight);
    }
    
    addGridHelper() {
        const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
        gridHelper.position.y = -2;
        this.scene.add(gridHelper);
        

        const axesHelper = new THREE.AxesHelper(3);
        axesHelper.position.set(0, -1.8, 0);
        this.scene.add(axesHelper);
    }
    
    createDefaultModel() {

        const geometry = new THREE.BoxGeometry(2, 2, 2);
        const material = new THREE.MeshLambertMaterial({ 
            color: 0x61dafb,
            transparent: true,
            opacity: 0.8 
        });
        
        this.model = new THREE.Mesh(geometry, material);
        this.model.castShadow = true;
        this.model.receiveShadow = true;
        this.scene.add(this.model);
        

        const wireframeGeometry = new THREE.EdgesGeometry(geometry);
        const wireframeMaterial = new THREE.LineBasicMaterial({ 
            color: 0xffffff, 
            opacity: 0.3, 
            transparent: true 
        });
        const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
        this.model.add(wireframe);
        
        this.modelLoaded = true;
        this.updateModelInfo('Default Cube');
        console.log('Default model created');
    }
    
    loadGLTFModel(file) {
        this.showLoading(true);
        console.log('Loading GLTF model:', file.name);
        
        const loader = new GLTFLoader();
        const url = URL.createObjectURL(file);
        
        loader.load(
            url,
            (gltf) => {
                console.log('GLTF model loaded successfully');
                this.replaceModel(gltf.scene);
                this.currentModel = file.name;
                this.updateModelInfo(`${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
                this.centerModel();
                this.showLoading(false);
                URL.revokeObjectURL(url);
            },
            (progress) => {
                const percent = (progress.loaded / progress.total) * 100;
                console.log('Loading progress:', percent.toFixed(2) + '%');
            },
            (error) => {
                console.error('Error loading GLTF model:', error);
                this.updateModelInfo('Error loading model');
                this.showLoading(false);
                URL.revokeObjectURL(url);
            }
        );
    }
    
    replaceModel(newModel) {

        if (this.model) {
            this.scene.remove(this.model);
            this.disposeModel(this.model);
        }
        

        this.model = newModel;
        this.scene.add(this.model);

        this.model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                if (child.material) {
                    child.material.needsUpdate = true;
                }
            }
        });
        
        this.modelLoaded = true;
    }
    
    disposeModel(model) {
        model.traverse((child) => {
            if (child.isMesh) {
                if (child.geometry) {
                    child.geometry.dispose();
                }
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => material.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
        });
    }
    
    updateModelRotation() {
        if (!this.model || !this.isConnected) return;

        this.targetRotation.x = THREE.MathUtils.degToRad(this.sensorData.gyroX);
        this.targetRotation.y = THREE.MathUtils.degToRad(this.sensorData.gyroY);
        this.targetRotation.z = THREE.MathUtils.degToRad(this.sensorData.gyroZ);
        
        if (this.smoothRotation) {

            this.currentRotation.x = THREE.MathUtils.lerp(
                this.currentRotation.x, this.targetRotation.x, this.rotationSpeed
            );
            this.currentRotation.y = THREE.MathUtils.lerp(
                this.currentRotation.y, this.targetRotation.y, this.rotationSpeed
            );
            this.currentRotation.z = THREE.MathUtils.lerp(
                this.currentRotation.z, this.targetRotation.z, this.rotationSpeed
            );
            
            this.model.rotation.set(
                this.currentRotation.x,
                this.currentRotation.y,
                this.currentRotation.z
            );
        } else {

            this.model.rotation.set(
                this.targetRotation.x,
                this.targetRotation.y,
                this.targetRotation.z
            );
        }
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.controls.update();
        this.updateModelRotation();
        this.renderer.render(this.scene, this.camera);
        

        this.frameCount++;
        const now = Date.now();
        if (now - this.lastFrameTime >= 1000) {
            this.updateFPS(this.frameCount);
            this.frameCount = 0;
            this.lastFrameTime = now;
        }
    }
    

    connectWebSocket(ip, port = 81) {
        const url = `ws://${ip}:${port}`;
        console.log('Connecting to WebSocket:', url);
        
        try {
            this.websocket = new WebSocket(url);
            
            this.websocket.onopen = () => {
                this.isConnected = true;
                this.updateConnectionStatus('Connected', true);
                console.log('WebSocket connected');
                

                this.sendCommand('status');
            };
            
            this.websocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.processSensorData(data);
                } catch (error) {
                    console.error('Error parsing WebSocket data:', error);
                }
            };
            
            this.websocket.onclose = () => {
                this.isConnected = false;
                this.updateConnectionStatus('Disconnected', false);
                console.log('WebSocket disconnected');
            };
            
            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus('Connection Error', false);
            };
            
        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            this.updateConnectionStatus('Connection Failed', false);
        }
    }
    
    disconnectWebSocket() {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
            this.isConnected = false;
        }
    }
    
    sendCommand(command) {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(command);
            console.log('Sent command:', command);
        } else {
            console.warn('WebSocket not connected');
        }
    }
    
    processSensorData(data) {
        this.sensorData.gyroX = data.gyroX || 0;
        this.sensorData.gyroY = data.gyroY || 0;
        this.sensorData.gyroZ = data.gyroZ || 0;
        this.sensorData.temperature = data.temperature || 0;
        this.sensorData.timestamp = data.timestamp || Date.now();
        
        this.updateSensorDisplay();
        this.updateStatistics();
    }
    

    resetRotation() {
        if (this.model) {
            this.model.rotation.set(0, 0, 0);
            this.currentRotation = { x: 0, y: 0, z: 0 };
        }
        
        this.sendCommand('reset');
    }
    
    centerModel() {
        if (!this.model) return;
        
        const box = new THREE.Box3().setFromObject(this.model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        

        this.model.position.sub(center);
        

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        const cameraZ = Math.abs(maxDim / 2 * Math.tan(fov * 2)) * 1.5;
        
        this.camera.position.set(cameraZ, cameraZ, cameraZ);
        this.camera.lookAt(new THREE.Vector3(0, 0, 0));
        this.controls.update();
    }
    
    toggleWireframe() {
        if (!this.model) return;
        
        this.model.traverse((child) => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => {
                        material.wireframe = !material.wireframe;
                    });
                } else {
                    child.material.wireframe = !child.material.wireframe;
                }
            }
        });
    }
    
    setSmoothRotation(enabled) {
        this.smoothRotation = enabled;
    }
    
    setRotationSpeed(speed) {
        this.rotationSpeed = Math.max(0.01, Math.min(1.0, speed));
    }
    

    onWindowResize() {
        if (!this.camera || !this.renderer) return;
        
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
    
    setupEventListeners() {
        window.addEventListener('resize', () => this.onWindowResize());
        
        document.addEventListener('keydown', (event) => {
            switch(event.key.toLowerCase()) {
                case 'r':
                    this.resetRotation();
                    break;
                case 'c':
                    this.centerModel();
                    break;
                case 'w':
                    this.toggleWireframe();
                    break;
            }
        });
    }
    
    updateConnectionStatus(status, connected) {
        const statusElement = document.getElementById('connection-status');
        const statusDot = document.getElementById('status-dot');
        
        if (statusElement) statusElement.textContent = status;
        if (statusDot) {
            if (connected) {
                statusDot.classList.add('connected');
            } else {
                statusDot.classList.remove('connected');
            }
        }
    }
    
    updateSensorDisplay() {
        const elements = {
            'gyro-x': this.sensorData.gyroX.toFixed(2) + '°',
            'gyro-y': this.sensorData.gyroY.toFixed(2) + '°',
            'gyro-z': this.sensorData.gyroZ.toFixed(2) + '°',
            'temperature': this.sensorData.temperature.toFixed(1) + '°C'
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    }
    
    updateStatistics() {
        this.updateCount++;
        const now = Date.now();
        
        if (now - this.lastUpdateTime >= 1000) {
            const rateElement = document.getElementById('update-rate');
            if (rateElement) rateElement.textContent = this.updateCount;
            
            this.updateCount = 0;
            this.lastUpdateTime = now;
        }
    }
    
    updateFPS(fps) {
        const fpsElement = document.getElementById('fps-counter');
        if (fpsElement) fpsElement.textContent = `FPS: ${fps}`;
    }
    
    updateModelInfo(info) {
        const infoElement = document.getElementById('model-info');
        if (infoElement) infoElement.textContent = info;
    }
    
    showLoading(show) {
        const loadingElement = document.getElementById('loading-overlay');
        if (loadingElement) {
            loadingElement.classList.toggle('hidden', !show);
        }
    }
    
    getStats() {
        return {
            connected: this.isConnected,
            modelLoaded: this.modelLoaded,
            currentModel: this.currentModel,
            sensorData: { ...this.sensorData },
            frameRate: this.frameCount
        };
    }

    setupScaleControl() {
        const scaleSlider = document.getElementById('scale-slider');
        const scaleValue = document.getElementById('scale-value');

        if (!scaleSlider || !scaleValue) return;

        this.setModelScale(parseFloat(scaleSlider.value));

        scaleSlider.addEventListener('input', () => {
            const scale = parseFloat(scaleSlider.value);
            this.setModelScale(scale);
            scaleValue.textContent = scale.toFixed(2);
        });
    }

    setModelScale(scale) {
        if (this.model) {
            this.model.scale.set(scale, scale, scale);
        }
    }
}


class MPU6050App {
    constructor() {
        this.visualizer = null;
        this.connectionStartTime = null;
        this.connectionTimer = null;
        
        this.init();
    }
    
    init() {

        this.visualizer = new MPU6050Visualizer('threejs-container');
        

        this.setupUIEventListeners();
        
        this.showLoading(false);
        
        console.log('MPU6050 App initialized');
    }
    
    setupUIEventListeners() {

        document.getElementById('connect-btn').addEventListener('click', () => {
            const ip = document.getElementById('esp32-ip').value;
            this.connectToESP32(ip);
        });
        
        document.getElementById('disconnect-btn').addEventListener('click', () => {
            this.disconnectFromESP32();
        });
        
        document.getElementById('reset-rotation').addEventListener('click', () => {
            this.visualizer.resetRotation();
        });
        
        document.getElementById('center-model').addEventListener('click', () => {
            this.visualizer.centerModel();
        });
        
        document.getElementById('toggle-wireframe').addEventListener('click', () => {
            this.visualizer.toggleWireframe();
        });
        
        document.getElementById('model-file').addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                this.visualizer.loadGLTFModel(file);
            }
        });
    }
    
    connectToESP32(ip) {
        console.log('Connecting to ESP32 at:', ip);
        

        document.getElementById('connect-btn').disabled = true;
        document.getElementById('disconnect-btn').disabled = false;
        
        this.connectionStartTime = Date.now();
        this.startConnectionTimer();
        
        this.visualizer.connectWebSocket(ip);
    }
    
    disconnectFromESP32() {
        console.log('Disconnecting from ESP32');
        
        document.getElementById('connect-btn').disabled = false;
        document.getElementById('disconnect-btn').disabled = true;
        
        this.stopConnectionTimer();
        

        this.visualizer.disconnectWebSocket();
    }
    
    startConnectionTimer() {
        this.connectionTimer = setInterval(() => {
            if (this.connectionStartTime) {
                const elapsed = Math.floor((Date.now() - this.connectionStartTime) / 1000);
                const timeElement = document.getElementById('connection-time');
                if (timeElement) {
                    timeElement.textContent = elapsed + 's';
                }
            }
        }, 1000);
    }
    
    stopConnectionTimer() {
        if (this.connectionTimer) {
            clearInterval(this.connectionTimer);
            this.connectionTimer = null;
        }
        this.connectionStartTime = null;
        
        const timeElement = document.getElementById('connection-time');
        if (timeElement) {
            timeElement.textContent = '0s';
        }
    }
    
    showLoading(show) {
        const loadingElement = document.getElementById('loading-overlay');
        if (loadingElement) {
            loadingElement.classList.toggle('hidden', !show);
        }
    }
    

    getVisualizer() {
        return this.visualizer;
    }
    
    getStats() {
        return this.visualizer ? this.visualizer.getStats() : null;
    }
}

export default MPU6050App;