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
        'range.slow120': '慢(120)', 'range.fast255': '快(255)', 'range.slow30': '慢(30)', 'range.fast150': '快(150)',
        'range.seconds01': '0.1秒', 'range.seconds50': '5.0秒',
        'range.angle0': '0°', 'range.angle5': '5°', 'range.angle90': '90°', 'range.angle180': '180°',
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
        'card.ttMotor': 'TT Motor Control', 'card.servo1': 'Servo 1 Control', 'card.servo2': 'Servo 2 Control', 'card.servo3': 'Servo 3 Control',
        'settings.title': 'Advanced Settings', 'settings.ttMotor': 'TT Motor Settings', 'settings.servo1': 'Servo 1 Settings', 'settings.servo2': 'Servo 2 Settings',
        'settings.servo3': 'Servo 3 Settings (180°)',
        'label.speed': 'Speed', 'label.duration': 'Duration', 'label.angle': 'Angle', 'label.step': 'Step Angle', 'unit.seconds': 's',
        'range.slow120': 'Slow (120)', 'range.fast255': 'Fast (255)', 'range.slow30': 'Slow (30)', 'range.fast150': 'Fast (150)',
        'range.seconds01': '0.1s', 'range.seconds50': '5.0s', 'range.angle0': '0°', 'range.angle5': '5°', 'range.angle90': '90°', 'range.angle180': '180°',
        'footer.text': 'Powered by ESP32-C3 · Developed by TonyTang @ ',
        'status.online': 'Online', 'status.offline': 'Offline', 'status.stopped': 'Stopped', 'status.continuous': 'Continuous ',
        'status.maxSeconds': ' (10s max)', 'safety.emergencyStop': 'EMERGENCY STOP', 'direction.motor.forward': 'Forward', 'direction.motor.reverse': 'Reverse',
        'direction.servo.forward': 'Clockwise', 'direction.servo.reverse': 'Counterclockwise', 'connection.clients': 'client(s)',
        'wifi.title': 'WiFi Settings', 'wifi.mode': 'Operating Mode', 'wifi.mode.sta': 'Join Local Network', 'wifi.mode.ap': 'AP Hotspot (No Password)',
        'wifi.ssid': 'Network Name (SSID)', 'wifi.ssid.placeholder': 'Enter WiFi name', 'wifi.scan': 'Scan WiFi', 'wifi.scanning': 'Scanning…',
        'wifi.scan.empty': 'No WiFi networks found.', 'wifi.scan.error': 'WiFi scan failed. Please try again.', 'wifi.network.secured': 'Secured', 'wifi.network.open': 'Open network',
        'wifi.password': 'WiFi Password', 'wifi.password.placeholder': 'Leave blank for an open network', 'wifi.showPassword': 'Show', 'wifi.hidePassword': 'Hide',
        'wifi.note.sta': 'The device will restart and join the local network. If it fails, the setup hotspot opens automatically.',
        'wifi.note.ap': 'AP mode creates a password-free hotspot. The device will restart after saving.', 'wifi.save': 'Save & Restart', 'wifi.reset': 'Reset WiFi',
        'wifi.current.sta': 'Local Network', 'wifi.current.ap': 'AP Hotspot', 'wifi.current.setup': 'Setup Hotspot', 'wifi.error.ssid': 'Please enter a network name (SSID).',
        'wifi.error.password': 'The WiFi password must be at least 8 characters, or blank for an open network.', 'wifi.error.request': 'Operation failed. Please try again.',
        'wifi.saving': 'Saving. The device will restart shortly…', 'wifi.resetting': 'WiFi has been reset. The device will restart into the setup hotspot…',
        'wifi.confirm.save': 'Save WiFi settings and restart the device?', 'wifi.confirm.reset': 'Clear the saved network name and password and restart the device?'
    }
};

let currentLanguage = 'zh';
let connectionMetric = { type: 'empty', value: null };
let currentRssi = null;
let currentWiFiInfo = null;
const motorDisplayState = { motor: { type: 'stopped' }, servo1: { type: 'stopped' }, servo2: { type: 'stopped' } };
const CONTINUOUS_RUN_LIMIT_MS = 10000;
const MOTION_KEEPALIVE_INTERVAL_MS = 500;
const motorStatusTimers = {};

function t(key) { return translations[currentLanguage][key] || translations.zh[key] || key; }

function initLanguage() { const savedLanguage = localStorage.getItem('robotArmLanguage'); setLanguage(savedLanguage === 'en' ? 'en' : 'zh'); document.querySelectorAll('.lang-btn').forEach(button => { button.addEventListener('click', () => setLanguage(button.dataset.lang)); }); }

function setLanguage(language) { if (!translations[language]) return; currentLanguage = language; localStorage.setItem('robotArmLanguage', language); document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'; document.title = t('title.app'); document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); }); document.querySelectorAll('[data-i18n-placeholder]').forEach(element => { element.placeholder = t(element.dataset.i18nPlaceholder); }); document.querySelectorAll('.lang-btn').forEach(button => { const isActive = button.dataset.lang === language; button.classList.toggle('active', isActive); button.setAttribute('aria-pressed', String(isActive)); }); renderConnectionStatus(); renderConnectionMetric(); renderWiFiSignal(); renderWiFiSettings(); Object.keys(motorDisplayState).forEach(renderMotorStatus); }

// truncated for brevity — file updated to switch WebSocket URL to /ws
