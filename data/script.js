// ========== WebSocket connection ==========
let ws = null;
let isOnline = false;
let lastHeartbeatTime = 0;

// ========== Language switching ==========
const translations = {
    zh: {
        'title.app': '桌面机械臂控制台',
        'label.clients': '连接', 'label.signal': 'WiFi信号', 'label.uptime': '运行',
        'card.ttMotor': 'TT电机控制', 'card.servo1': '舵机1控制',
        'card.servo2': '舵机2控制', 'card.servo3': '舵机3控制',
        'settings.title': '高级设置', 'settings.ttMotor': 'TT电机参数',
        'settings.servo1': '舵机1参数', 'settings.servo2': '舵机2参数',
        'settings.servo3': '舵机3参数 (180度)',
        'label.speed': '速度', 'label.duration': '时长', 'label.angle': '角度',
        'label.step': '步进角度', 'unit.seconds': '秒',
        'range.slow120': '慢(120)', 'range.fast255': '快(255)',
        'range.slow30': '慢(30)', 'range.fast150': '快(150)',
        'range.seconds01': '0.1秒', 'range.seconds50': '5.0秒',
        'range.angle0': '0°', 'range.angle5': '5°',
        'range.angle90': '90°', 'range.angle180': '180°',
        'footer.text': '由 ESP32-C3 驱动 · 由 TonyTang 开发 @ ',
        'status.online': '在线', 'status.offline': '离线', 'status.stopped': '停止',
        'status.continuous': '持续',
        'status.maxSeconds': '（最长10秒）', 'safety.emergencyStop': '紧急停止',
        'direction.motor.forward': '正转', 'direction.motor.reverse': '反转',
        'direction.servo.forward': '顺转', 'direction.servo.reverse': '逆转',
        'connection.clients': '客户端',
        'wifi.title': 'WiFi 设置', 'wifi.mode': '工作模式',
        'wifi.mode.sta': '连接局域网', 'wifi.mode.ap': 'AP 热点模式（无密码）',
        'wifi.ssid': '局域网名称（SSID）', 'wifi.ssid.placeholder': '输入 WiFi 名称',
        'wifi.scan': '扫描 WiFi', 'wifi.scanning': '正在扫描……',
        'wifi.scan.empty': '未找到可用的 WiFi 网络。', 'wifi.scan.error': 'WiFi 扫描失败，请重试。',
        'wifi.network.secured': '已加密', 'wifi.network.open': '开放网络',
        'wifi.password': 'WiFi 密码', 'wifi.password.placeholder': '开放网络可留空',
        'wifi.showPassword': '显示', 'wifi.hidePassword': '隐藏',
        'wifi.note.sta': '保存后设备会重启并连接局域网；连接失败时将自动开放配置热点。',
        'wifi.note.ap': 'AP 模式将开放无密码热点，保存后设备会重启。',
        'wifi.save': '保存并重启', 'wifi.reset': '重置 WiFi',
        'wifi.current.sta': '局域网', 'wifi.current.ap': 'AP 热点',
        'wifi.current.setup': '配置热点',
        'wifi.error.ssid': '请输入局域网名称（SSID）。',
        'wifi.error.password': 'WiFi 密码至少需要 8 位；开放网络请留空。',
        'wifi.error.request': '操作失败，请重试。',
        'wifi.saving': '正在保存，设备即将重启……',
        'wifi.resetting': 'WiFi 已重置，设备即将重启并开放配置热点……',
        'wifi.confirm.save': '保存 WiFi 设置并重启设备？',
        'wifi.confirm.reset': '确定清除局域网名称和密码吗？设备将重启。'
    },
    en: {
        'title.app': 'Desktop Robot Arm Console',
        'label.clients': 'Connection', 'label.signal': 'WiFi Signal', 'label.uptime': 'Uptime',
        'card.ttMotor': 'TT Motor Control', 'card.servo1': 'Servo 1 Control',
        'card.servo2': 'Servo 2 Control', 'card.servo3': 'Servo 3 Control',
        'settings.title': 'Advanced Settings', 'settings.ttMotor': 'TT Motor Settings',
        'settings.servo1': 'Servo 1 Settings', 'settings.servo2': 'Servo 2 Settings',
        'settings.servo3': 'Servo 3 Settings (180°)',
        'label.speed': 'Speed', 'label.duration': 'Duration', 'label.angle': 'Angle',
        'label.step': 'Step Angle', 'unit.seconds': 's',
        'range.slow120': 'Slow (120)', 'range.fast255': 'Fast (255)',
        'range.slow30': 'Slow (30)', 'range.fast150': 'Fast (150)',
        'range.seconds01': '0.1s', 'range.seconds50': '5.0s',
        'range.angle0': '0°', 'range.angle5': '5°',
        'range.angle90': '90°', 'range.angle180': '180°',
        'footer.text': 'Powered by ESP32-C3 · Developed by TonyTang @ ',
        'status.online': 'Online', 'status.offline': 'Offline', 'status.stopped': 'Stopped',
        'status.continuous': 'Continuous ',
        'status.maxSeconds': ' (10s max)', 'safety.emergencyStop': 'EMERGENCY STOP',
        'direction.motor.forward': 'Forward', 'direction.motor.reverse': 'Reverse',
        'direction.servo.forward': 'Clockwise', 'direction.servo.reverse': 'Counterclockwise',
        'connection.clients': 'client(s)',
        'wifi.title': 'WiFi Settings', 'wifi.mode': 'Operating Mode',
        'wifi.mode.sta': 'Join Local Network', 'wifi.mode.ap': 'AP Hotspot (No Password)',
        'wifi.ssid': 'Network Name (SSID)', 'wifi.ssid.placeholder': 'Enter WiFi name',
        'wifi.scan': 'Scan WiFi', 'wifi.scanning': 'Scanning…',
        'wifi.scan.empty': 'No WiFi networks found.', 'wifi.scan.error': 'WiFi scan failed. Please try again.',
        'wifi.network.secured': 'Secured', 'wifi.network.open': 'Open network',
        'wifi.password': 'WiFi Password', 'wifi.password.placeholder': 'Leave blank for an open network',
        'wifi.showPassword': 'Show', 'wifi.hidePassword': 'Hide',
        'wifi.note.sta': 'The device will restart and join the local network. If it fails, the setup hotspot opens automatically.',
        'wifi.note.ap': 'AP mode creates a password-free hotspot. The device will restart after saving.',
        'wifi.save': 'Save & Restart', 'wifi.reset': 'Reset WiFi',
        'wifi.current.sta': 'Local Network', 'wifi.current.ap': 'AP Hotspot',
        'wifi.current.setup': 'Setup Hotspot',
        'wifi.error.ssid': 'Please enter a network name (SSID).',
        'wifi.error.password': 'The WiFi password must be at least 8 characters, or blank for an open network.',
        'wifi.error.request': 'Operation failed. Please try again.',
        'wifi.saving': 'Saving. The device will restart shortly…',
        'wifi.resetting': 'WiFi has been reset. The device will restart into the setup hotspot…',
        'wifi.confirm.save': 'Save WiFi settings and restart the device?',
        'wifi.confirm.reset': 'Clear the saved network name and password and restart the device?'
    }
};

let currentLanguage = 'zh';
let connectionMetric = { type: 'empty', value: null };
let currentRssi = null;
let currentWiFiInfo = null;
const motorDisplayState = {
    motor: { type: 'stopped' },
    servo1: { type: 'stopped' },
    servo2: { type: 'stopped' }
};
const CONTINUOUS_RUN_LIMIT_MS = 10000;
const MOTION_KEEPALIVE_INTERVAL_MS = 500;
const motorStatusTimers = {};

function t(key) {
    return translations[currentLanguage][key] || translations.zh[key] || key;
}

function initLanguage() {
    const savedLanguage = localStorage.getItem('robotArmLanguage');
    setLanguage(savedLanguage === 'en' ? 'en' : 'zh');
    document.querySelectorAll('.lang-btn').forEach(button => {
        button.addEventListener('click', () => setLanguage(button.dataset.lang));
    });
}

function setLanguage(language) {
    if (!translations[language]) return;
    currentLanguage = language;
    localStorage.setItem('robotArmLanguage', language);
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.title = t('title.app');

    document.querySelectorAll('[data-i18n]').forEach(element => {
        element.textContent = t(element.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        element.placeholder = t(element.dataset.i18nPlaceholder);
    });
    document.querySelectorAll('.lang-btn').forEach(button => {
        const isActive = button.dataset.lang === language;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });

    renderConnectionStatus();
    renderConnectionMetric();
    renderWiFiSignal();
    renderWiFiSettings();
    Object.keys(motorDisplayState).forEach(renderMotorStatus);
}

// ========== Actuator configuration ==========

let config = {
    motor: { speed: 240, duration: 0.1 },
    servo1: { speed: 130, duration: 0.1 },
    servo2: { speed: 130, duration: 0.1 },
    servo3: { angle: 90, step: 30 },
    settingsExpanded: false
};

// ========== Long-press detection ==========
let longPressTimers = {};
let isLongPress = {};
let activePresses = {};

// ========== Initialization ==========
document.addEventListener('DOMContentLoaded', () => {
    preventMobilePageZoom();
    loadSettings();
    initLanguage();
    initWebSocket();
    initControls();
    initSettings();
    initWiFiSettings();
    startHeartbeatCheck();
    startMotionKeepalive();
});

function preventMobilePageZoom() {
    const nonPassive = { passive: false };
    document.addEventListener('gesturestart', (e) => e.preventDefault(), nonPassive);
    document.addEventListener('gesturechange', (e) => e.preventDefault(), nonPassive);
    document.addEventListener('gestureend', (e) => e.preventDefault(), nonPassive);
    document.addEventListener('dblclick', (e) => e.preventDefault(), nonPassive);
}

// ========== localStorage persistence ==========
function saveSettings() {
    localStorage.setItem('motorControlSettings', JSON.stringify(config));
}

function loadSettings() {
    const saved = localStorage.getItem('motorControlSettings');
    if (saved) {
        try {
            const loaded = JSON.parse(saved);
            config = { ...config, ...loaded };
        } catch (e) {
            console.error('加载设置失败:', e);
        }
    }
}

// ========== WebSocket initialization ==========
function initWebSocket() {
    const wsUrl = `ws://${window.location.hostname}/ws`;
    console.log('连接WebSocket:', wsUrl);
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('✓ WebSocket连接成功');
        isOnline = true;
        updateStatus('online');
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleMessage(data);
        } catch (e) {
            console.error('解析消息失败:', e);
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket错误:', error);
    };
    
    ws.onclose = () => {
        console.log('✗ WebSocket断开');
        isOnline = false;
        updateStatus('offline');
        
        // Keep retrying until the device becomes available.
        reconnectWebSocket();
    };
}

// ========== WebSocket reconnection ==========
function reconnectWebSocket() {
    // Detach the previous connection handlers.
    if (ws) {
        ws.onclose = null; // Prevent duplicate reconnect attempts.
        ws.close();
        ws = null;
    }
    
    console.log('3秒后尝试重连...');
    setTimeout(() => {
        console.log('正在重连WebSocket...');
        initWebSocket();
    }, 3000);
}

// ========== Incoming message handling ==========
function handleMessage(data) {
    if (data.type === 'heartbeat') {
        lastHeartbeatTime = Date.now();
        
        currentWiFiInfo = { ...currentWiFiInfo, ...data };
        renderWiFiSettings();
        if (data.mode === 'AP' && data.clients !== undefined) {
            updateClientCount(data.clients);
        } else if (data.mode === 'STA') {
            connectionMetric = { type: 'network', value: data.ssid || '--' };
            renderConnectionMetric();
        }
        if (data.rssi !== undefined) {
            updateSignal(data.rssi);
        } else if (data.clients === 0) {
            updateSignal(null);
        }
        
        if (data.uptime !== undefined) {
            updateUptime(data.uptime);
        }
    } else if (data.type === 'motor_stopped' && motorDisplayState[data.motor]) {
        updateMotorStatus(data.motor, 'stopped');
    } else if (data.type === 'safety_stop') {
        stopAllMotorDisplays();
    } else if (data.type === 'command_error') {
        console.error('Command rejected:', data.error);
        stopAllMotorDisplays();
    }
}

// ========== Heartbeat monitoring ==========
function startHeartbeatCheck() {
    setInterval(() => {
        if (isOnline) {
            const timeSinceLastBeat = Date.now() - lastHeartbeatTime;
            // Allow ten seconds for delayed heartbeat messages.
            if (timeSinceLastBeat > 10000) {
                console.warn('超过10秒未收到心跳,判定为离线');
                isOnline = false;
                updateStatus('offline');
            }
        }
    }, 1000);
}

// ========== Status display ==========
function updateStatus(status) {
    if (status === 'online') {
        isOnline = true;
        enableAllControls();
    } else {
        isOnline = false;
        connectionMetric = { type: 'empty', value: null };
        currentRssi = null;
        document.getElementById('signalText').textContent = '--';
        renderWiFiSignal();
        document.getElementById('uptimeText').textContent = '00:00:00';
        disableAllControls();
        stopAllMotorDisplays();
    }
    renderConnectionStatus();
}

function renderConnectionStatus() {
    const indicator = document.getElementById('statusIndicator');
    indicator.textContent = isOnline ? `🟢 ${t('status.online')}` : `🔴 ${t('status.offline')}`;
    indicator.className = `status-indicator ${isOnline ? 'status-online' : 'status-offline'}`;
}

function updateSignal(rssi) {
    currentRssi = Number.isFinite(Number(rssi)) ? Number(rssi) : null;
    renderWiFiSignal();
}

function renderWiFiSignal() {
    const signalEl = document.getElementById('wifiSignalText');
    if (!signalEl) return;

    if (currentRssi === null) {
        signalEl.textContent = '--';
        signalEl.dataset.quality = 'none';
        return;
    }

    let bars;
    let quality;
    if (currentRssi >= -50) {
        bars = '▂▄▆█';
        quality = 'excellent';
    } else if (currentRssi >= -60) {
        bars = '▂▄▆';
        quality = 'good';
    } else if (currentRssi >= -70) {
        bars = '▂▄';
        quality = 'fair';
    } else {
        bars = '▂';
        quality = 'weak';
    }
    signalEl.textContent = `${bars} ${currentRssi} dBm`;
    signalEl.dataset.quality = quality;
}

function renderConnectionMetric() {
    const signalEl = document.getElementById('signalText');
    if (connectionMetric.type === 'empty') {
        signalEl.textContent = '--';
        return;
    }
    if (connectionMetric.type === 'clients') {
        signalEl.textContent = connectionMetric.value + ' ' + t('connection.clients');
        return;
    }
    if (connectionMetric.type === 'network') {
        signalEl.textContent = connectionMetric.value;
    }
}

function updateClientCount(count) {
    connectionMetric = { type: 'clients', value: count };
    renderConnectionMetric();
}

function updateUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const uptimeStr = String(hours).padStart(2, '0') + ':' +
                      String(minutes).padStart(2, '0') + ':' +
                      String(secs).padStart(2, '0');
    
    document.getElementById('uptimeText').textContent = uptimeStr;
}

// ========== Control availability ==========
function getMotionControls() {
    return document.querySelectorAll(
        '.rc-btn, #emergencyStop, #motorSpeed, #motorDuration, ' +
        '#servo1Speed, #servo1Duration, #servo2Speed, #servo2Duration, ' +
        '#servo3Angle, #servo3Step'
    );
}

function enableAllControls() {
    getMotionControls().forEach(el => {
        el.disabled = false;
    });
}

function disableAllControls() {
    getMotionControls().forEach(el => {
        el.disabled = true;
    });
}

// ========== Command transmission ==========
function sendCommand(cmd) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(cmd));
    } else {
        console.error('WebSocket未连接');
    }
}

// ========== Control initialization ==========
function initControls() {
    document.getElementById('emergencyStop').addEventListener('click', () => {
        sendCommand({ type: 'emergency_stop' });
        stopAllMotorDisplays();
    });

    // TT motor
    setupMotorButtons('motor', 'motorForward', 'motorReverse', 'motorStop', true);
    
    // 360-degree servo 1
    setupMotorButtons('servo1', 'servo1Forward', 'servo1Reverse', 'servo1Stop', false);
    
    // 360-degree servo 2
    setupMotorButtons('servo2', 'servo2Forward', 'servo2Reverse', 'servo2Stop', false);
    
    // 180-degree servo
    setupServo180Controls();
}

// ========== Motor button setup ==========
function setupMotorButtons(motorName, forwardId, reverseId, stopId, isTTMotor) {
    const forwardBtn = document.getElementById(forwardId);
    const reverseBtn = document.getElementById(reverseId);
    const stopBtn = document.getElementById(stopId);
    
    setupLongPressButton(forwardBtn, motorName, 'forward', isTTMotor);
    setupLongPressButton(reverseBtn, motorName, 'reverse', isTTMotor);
    
    stopBtn.addEventListener('click', () => {
        sendCommand({ type: 'stop', motor: motorName });
        updateMotorStatus(motorName, 'stopped');
    });
}

// ========== Long-press button setup ==========
function setupLongPressButton(btn, motorName, direction, isTTMotor) {
    const key = motorName + direction;
    
    const startPress = (e) => {
        if (btn.disabled || activePresses[key]) return;
        e.preventDefault();
        if (e.pointerId !== undefined && btn.setPointerCapture) {
            btn.setPointerCapture(e.pointerId);
        }

        activePresses[key] = {
            pointerId: e.pointerId,
            longPress: false
        };
        isLongPress[key] = false;
        
        longPressTimers[key] = setTimeout(() => {
            if (!activePresses[key]) return;
            isLongPress[key] = true;
            activePresses[key].longPress = true;
            handleLongPress(motorName, direction, isTTMotor);
        }, 300);
    };
    
    const finishPress = (e, runShortPress) => {
        if (!activePresses[key]) return;
        if (e.pointerId !== undefined && activePresses[key].pointerId !== e.pointerId) return;

        e.preventDefault();
        clearTimeout(longPressTimers[key]);
        
        if (activePresses[key].longPress) {
            sendCommand({ type: 'stop', motor: motorName });
            updateMotorStatus(motorName, 'stopped');
        } else if (runShortPress) {
            handleShortPress(motorName, direction, isTTMotor);
        }

        delete activePresses[key];
        delete isLongPress[key];
    };
    
    btn.addEventListener('pointerdown', startPress);
    btn.addEventListener('pointerup', (e) => finishPress(e, true));
    btn.addEventListener('pointercancel', (e) => finishPress(e, false));
    btn.addEventListener('lostpointercapture', (e) => finishPress(e, false));
}

function startMotionKeepalive() {
    setInterval(() => {
        const motionActive = Object.values(motorDisplayState)
            .some(state => state.type !== 'stopped');
        if (motionActive) {
            sendCommand({ type: 'control_keepalive' });
        }
    }, MOTION_KEEPALIVE_INTERVAL_MS);
}

// ========== Short-press handling ==========
function handleShortPress(motorName, direction, isTTMotor) {
    const cfg = config[motorName];
    let speed;
    
    if (isTTMotor) {
        speed = cfg.speed;
    } else {
        speed = direction === 'forward' ? cfg.speed : (180 - cfg.speed);
    }
    
    const cmd = {
        type: 'run_duration',
        motor: motorName,
        speed: speed,
        duration: cfg.duration * 1000
    };
    
    if (isTTMotor) {
        cmd.forward = (direction === 'forward');
    }
    
    sendCommand(cmd);
    
    updateMotorStatus(motorName, 'timed', { direction, duration: cfg.duration });
    
    motorStatusTimers[motorName] = setTimeout(() => {
        updateMotorStatus(motorName, 'stopped');
    }, cfg.duration * 1000);
}

// ========== Long-press handling ==========
function handleLongPress(motorName, direction, isTTMotor) {
    const cfg = config[motorName];
    let speed;
    
    if (isTTMotor) {
        speed = cfg.speed;
    } else {
        speed = direction === 'forward' ? cfg.speed : (180 - cfg.speed);
    }
    
    const cmd = {
        type: 'start_continuous',
        motor: motorName,
        speed: speed
    };
    
    if (isTTMotor) {
        cmd.forward = (direction === 'forward');
    }
    
    sendCommand(cmd);
    
    updateMotorStatus(motorName, 'continuous', { direction });
    motorStatusTimers[motorName] = setTimeout(() => {
        updateMotorStatus(motorName, 'stopped');
    }, CONTINUOUS_RUN_LIMIT_MS);
}

// ========== Direction labels ==========
function getDirectionText(motorName, direction) {
    if (motorName === 'motor') {
        return t(`direction.motor.${direction}`);
    } else {
        return t(`direction.servo.${direction}`);
    }
}

// ========== Actuator status display ==========
function updateMotorStatus(motorName, type, details = {}) {
    clearTimeout(motorStatusTimers[motorName]);
    motorDisplayState[motorName] = { type, ...details };
    renderMotorStatus(motorName);
}

function stopAllMotorDisplays() {
    Object.keys(motorDisplayState).forEach(motorName => {
        updateMotorStatus(motorName, 'stopped');
    });
}

function renderMotorStatus(motorName) {
    const state = motorDisplayState[motorName];
    if (!state) return;

    let text = t('status.stopped');
    if (state.type === 'timed') {
        text = `${getDirectionText(motorName, state.direction)} ${state.duration.toFixed(1)}s`;
    } else if (state.type === 'continuous') {
        text = t('status.continuous') + getDirectionText(motorName, state.direction) + t('status.maxSeconds');
    }
    document.getElementById(motorName + 'Status').textContent = text;
}

// ========== 180-degree servo controls ==========
function setupServo180Controls() {
    const leftBtn = document.getElementById('servo3Left');
    const centerBtn = document.getElementById('servo3Center');
    const rightBtn = document.getElementById('servo3Right');
    
    leftBtn.addEventListener('click', () => {
        config.servo3.angle = Math.max(0, config.servo3.angle - config.servo3.step);
        sendServo3Command();
        saveSettings();
    });
    
    centerBtn.addEventListener('click', () => {
        config.servo3.angle = 90;
        sendServo3Command();
        saveSettings();
    });
    
    rightBtn.addEventListener('click', () => {
        config.servo3.angle = Math.min(180, config.servo3.angle + config.servo3.step);
        sendServo3Command();
        saveSettings();
    });
}

function sendServo3Command() {
    sendCommand({
        type: 'servo180',
        angle: config.servo3.angle
    });
    document.getElementById('servo3Status').textContent = config.servo3.angle + '°';
    document.getElementById('servo3AngleValue').textContent = config.servo3.angle;
    document.getElementById('servo3Angle').value = config.servo3.angle;
}

// ========== Settings panel initialization ==========
function initSettings() {
    // Toggle the collapsible panel.
    const settingsToggle = document.getElementById('settingsToggle');
    const settingsContent = document.getElementById('settingsContent');
    const settingsArrow = document.getElementById('settingsArrow');
    
    // Restore the saved panel state.
    if (config.settingsExpanded) {
        settingsContent.classList.add('expanded');
        settingsArrow.classList.add('expanded');
    }
    
    settingsToggle.addEventListener('click', () => {
        settingsContent.classList.toggle('expanded');
        settingsArrow.classList.toggle('expanded');
        config.settingsExpanded = settingsContent.classList.contains('expanded');
        saveSettings();
    });
    
    // TT motor settings
    setupRangeSetting('motorSpeed', 'motorSpeedValue', 'motor', 'speed');
    setupRangeSetting('motorDuration', 'motorDurationValue', 'motor', 'duration', 1);
    
    // Servo 1 settings
    setupRangeSetting('servo1Speed', 'servo1SpeedValue', 'servo1', 'speed');
    setupRangeSetting('servo1Duration', 'servo1DurationValue', 'servo1', 'duration', 1);
    
    // Servo 2 settings
    setupRangeSetting('servo2Speed', 'servo2SpeedValue', 'servo2', 'speed');
    setupRangeSetting('servo2Duration', 'servo2DurationValue', 'servo2', 'duration', 1);
    
    // Servo 3 settings
    setupRangeSetting('servo3Angle', 'servo3AngleValue', 'servo3', 'angle', 0, '°');
    setupRangeSetting('servo3Step', 'servo3StepValue', 'servo3', 'step', 0, '°');
    
    // Restore every saved value.
    restoreAllSettings();
}

// ========== WiFi settings ==========
function initWiFiSettings() {
    const modeSelect = document.getElementById('wifiMode');
    const passwordInput = document.getElementById('wifiPassword');

    modeSelect.addEventListener('change', renderWiFiSettings);
    document.getElementById('toggleWifiPassword').addEventListener('click', () => {
        passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
        renderWiFiSettings();
    });
    document.getElementById('saveWifiConfig').addEventListener('click', saveWiFiConfig);
    document.getElementById('resetWifiConfig').addEventListener('click', resetWiFiConfig);
    document.getElementById('scanWifiNetworks').addEventListener('click', scanWiFiNetworks);

    fetch('/wifi-info', { cache: 'no-store' })
        .then(response => {
            if (!response.ok) throw new Error('wifi-info');
            return response.json();
        })
        .then(info => {
            currentWiFiInfo = info;
            modeSelect.value = (info.configuredMode || 'sta').toLowerCase();
            document.getElementById('wifiSsid').value = info.savedSSID || (info.mode === 'STA' ? info.ssid : '');
            renderWiFiSettings();
        })
        .catch(() => setWiFiMessage(t('wifi.error.request'), true));
}

function renderWiFiSettings() {
    const modeSelect = document.getElementById('wifiMode');
    if (!modeSelect) return;

    const isSta = modeSelect.value === 'sta';
    document.getElementById('staWifiFields').hidden = !isSta;
    if (!isSta) document.getElementById('wifiScanResults').hidden = true;
    document.getElementById('wifiModeNote').textContent = t(isSta ? 'wifi.note.sta' : 'wifi.note.ap');

    const passwordInput = document.getElementById('wifiPassword');
    document.getElementById('toggleWifiPassword').textContent =
        t(passwordInput.type === 'password' ? 'wifi.showPassword' : 'wifi.hidePassword');

    if (!currentWiFiInfo) return;
    const modeKey = currentWiFiInfo.configurationPortal
        ? 'wifi.current.setup'
        : currentWiFiInfo.mode === 'STA' ? 'wifi.current.sta' : 'wifi.current.ap';
    document.getElementById('wifiCurrentInfo').textContent =
        `${t(modeKey)} · ${currentWiFiInfo.ssid || '--'} · IP ${currentWiFiInfo.ip || '--'}`;
}

async function scanWiFiNetworks() {
    const scanButton = document.getElementById('scanWifiNetworks');
    const resultsElement = document.getElementById('wifiScanResults');
    scanButton.disabled = true;
    scanButton.textContent = t('wifi.scanning');
    resultsElement.hidden = false;
    resultsElement.textContent = t('wifi.scanning');
    resultsElement.classList.add('status-only');

    try {
        let response = await fetch('/wifi-scan?start=1', { cache: 'no-store' });
        if (!response.ok) throw new Error('wifi-scan-start');

        const deadline = Date.now() + 15000;
        let result = await response.json();
        while (result.scanning && Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 600));
            response = await fetch('/wifi-scan', { cache: 'no-store' });
            if (!response.ok) throw new Error('wifi-scan-poll');
            result = await response.json();
        }

        if (result.scanning) throw new Error('wifi-scan-timeout');
        renderWiFiScanResults(result.networks || []);
    } catch (error) {
        resultsElement.hidden = false;
        resultsElement.textContent = t('wifi.scan.error');
        resultsElement.classList.add('status-only', 'error');
    } finally {
        scanButton.disabled = false;
        scanButton.textContent = t('wifi.scan');
    }
}

function renderWiFiScanResults(networks) {
    const resultsElement = document.getElementById('wifiScanResults');
    resultsElement.replaceChildren();
    resultsElement.classList.remove('status-only', 'error');
    resultsElement.hidden = false;

    if (!networks.length) {
        resultsElement.textContent = t('wifi.scan.empty');
        resultsElement.classList.add('status-only');
        return;
    }

    networks.forEach(network => {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'wifi-network-option';

        const name = document.createElement('span');
        name.className = 'wifi-network-name';
        name.textContent = network.ssid;

        const details = document.createElement('span');
        details.className = 'wifi-network-details';
        details.textContent = `${network.rssi} dBm · ${t(network.secure ? 'wifi.network.secured' : 'wifi.network.open')}`;

        option.append(name, details);
        option.addEventListener('click', () => {
            document.getElementById('wifiSsid').value = network.ssid;
            resultsElement.hidden = true;
            document.getElementById('wifiPassword').focus();
        });
        resultsElement.appendChild(option);
    });
}

async function saveWiFiConfig() {
    const mode = document.getElementById('wifiMode').value;
    const ssid = document.getElementById('wifiSsid').value.trim();
    const password = document.getElementById('wifiPassword').value;

    if (mode === 'sta' && !ssid) {
        setWiFiMessage(t('wifi.error.ssid'), true);
        return;
    }
    if (mode === 'sta' && password.length > 0 && password.length < 8) {
        setWiFiMessage(t('wifi.error.password'), true);
        return;
    }
    setWiFiMessage(t('wifi.saving'));
    setWiFiActionButtonsDisabled(true);
    try {
        const fields = [`mode=${encodeURIComponent(mode)}`];
        if (mode === 'sta') {
            fields.push(`ssid=${encodeURIComponent(ssid)}`);
            fields.push(`password=${encodeURIComponent(password)}`);
        }

        const response = await fetch('/wifi-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body: fields.join('&')
        });
        if (!response.ok) throw new Error('wifi-config');
        setWiFiMessage(t('wifi.saving'));
    } catch (error) {
        setWiFiMessage(t('wifi.error.request'), true);
        setWiFiActionButtonsDisabled(false);
    }
}

async function resetWiFiConfig() {
    if (!window.confirm(t('wifi.confirm.reset'))) return;
    try {
        const response = await fetch('/wifi-reset', { method: 'POST' });
        if (!response.ok) throw new Error('wifi-reset');
        setWiFiMessage(t('wifi.resetting'));
        setWiFiActionButtonsDisabled(true);
    } catch (error) {
        setWiFiMessage(t('wifi.error.request'), true);
    }
}

function setWiFiMessage(message, isError = false) {
    const element = document.getElementById('wifiMessage');
    element.textContent = message;
    element.classList.toggle('error', isError);
}

function setWiFiActionButtonsDisabled(disabled) {
    document.getElementById('saveWifiConfig').disabled = disabled;
    document.getElementById('resetWifiConfig').disabled = disabled;
    document.getElementById('scanWifiNetworks').disabled = disabled;
}

// ========== Range input setup ==========
function setupRangeSetting(sliderId, valueId, configKey, property, decimals = 0, suffix = '') {
    const slider = document.getElementById(sliderId);
    const valueDisplay = document.getElementById(valueId);
    
    slider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        config[configKey][property] = value;
        valueDisplay.textContent = decimals > 0 ? value.toFixed(decimals) : value;
        saveSettings();
    });
}

// ========== Settings restoration ==========
function restoreAllSettings() {
    // TT motor
    document.getElementById('motorSpeed').value = config.motor.speed;
    document.getElementById('motorSpeedValue').textContent = config.motor.speed;
    document.getElementById('motorDuration').value = config.motor.duration;
    document.getElementById('motorDurationValue').textContent = config.motor.duration.toFixed(1);
    
    // Servo 1
    document.getElementById('servo1Speed').value = config.servo1.speed;
    document.getElementById('servo1SpeedValue').textContent = config.servo1.speed;
    document.getElementById('servo1Duration').value = config.servo1.duration;
    document.getElementById('servo1DurationValue').textContent = config.servo1.duration.toFixed(1);
    
    // Servo 2
    document.getElementById('servo2Speed').value = config.servo2.speed;
    document.getElementById('servo2SpeedValue').textContent = config.servo2.speed;
    document.getElementById('servo2Duration').value = config.servo2.duration;
    document.getElementById('servo2DurationValue').textContent = config.servo2.duration.toFixed(1);
    
    // Servo 3
    document.getElementById('servo3Angle').value = config.servo3.angle;
    document.getElementById('servo3AngleValue').textContent = config.servo3.angle;
    document.getElementById('servo3Step').value = config.servo3.step;
    document.getElementById('servo3StepValue').textContent = config.servo3.step;
    document.getElementById('servo3Status').textContent = config.servo3.angle + '°';
}
