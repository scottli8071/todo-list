// Service Worker for Pomodoro Timer Global Notifications
const CACHE_NAME = 'pomodoro-sw-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
    console.log('[SW] Service Worker installed');
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
    console.log('[SW] Service Worker activated');
});

// 番茄工作法状态
let pomodoroState = {
    enabled: false,
    mode: 'idle', // 'working', 'resting', 'idle'
    workDuration: 25,
    breakDuration: 5,
    startTime: null,
    workEndTime: null,
    breakEndTime: null
};

let timerInterval = null;

// 监听来自页面的消息
self.addEventListener('message', (event) => {
    const { type, data } = event.data;

    switch (type) {
        case 'START_POMODORO':
            startPomodoro(data);
            break;
        case 'STOP_POMODORO':
            stopPomodoro();
            break;
        case 'UPDATE_STATE':
            pomodoroState = { ...pomodoroState, ...data };
            break;
        case 'GET_STATE':
            if (event.ports[0]) {
                event.ports[0].postMessage({ state: pomodoroState });
            }
            break;
    }
});

// 开始番茄工作法
function startPomodoro(config) {
    pomodoroState = {
        enabled: true,
        mode: 'working',
        workDuration: config.workDuration || 25,
        breakDuration: config.breakDuration || 5,
        startTime: Date.now(),
        workEndTime: Date.now() + (config.workDuration || 25) * 60 * 1000,
        breakEndTime: null
    };

    console.log('[SW] Pomodoro started - work duration:', pomodoroState.workDuration, 'minutes');

    // 清除之前的定时器
    if (timerInterval) {
        clearInterval(timerInterval);
    }

    // 每秒检查一次
    timerInterval = setInterval(checkPomodoroStatus, 1000);

    // 立即检查一次
    checkPomodoroStatus();
}

// 停止番茄工作法
function stopPomodoro() {
    pomodoroState.enabled = false;
    pomodoroState.mode = 'idle';

    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    console.log('[SW] Pomodoro stopped');
}

// 检查番茄时钟状态
function checkPomodoroStatus() {
    if (!pomodoroState.enabled) return;

    const now = Date.now();

    if (pomodoroState.mode === 'working' && pomodoroState.workEndTime) {
        if (now >= pomodoroState.workEndTime) {
            // 工作时间结束，发送通知
            sendNotification('工作时间结束！', '是时候休息一下了~ 🐼 休息 ' + pomodoroState.breakDuration + ' 分钟');

            // 切换到休息模式
            pomodoroState.mode = 'resting';
            pomodoroState.breakEndTime = Date.now() + pomodoroState.breakDuration * 60 * 1000;

            // 通知页面更新
            broadcastToClients({ type: 'POMODORO_STATE_CHANGED', state: pomodoroState });
        }
    } else if (pomodoroState.mode === 'resting' && pomodoroState.breakEndTime) {
        if (now >= pomodoroState.breakEndTime) {
            // 休息结束，发送通知
            sendNotification('休息结束！', '开始新的工作周期吧！💪');

            // 切换到工作模式
            pomodoroState.mode = 'working';
            pomodoroState.startTime = Date.now();
            pomodoroState.workEndTime = Date.now() + pomodoroState.workDuration * 60 * 1000;

            // 通知页面更新
            broadcastToClients({ type: 'POMODORO_STATE_CHANGED', state: pomodoroState });
        }
    }
}

// 发送浏览器通知
async function sendNotification(title, body) {
    if (!('Notification' in self)) {
        console.log('[SW] Notifications not supported');
        return;
    }

    let permission = Notification.permission;

    if (permission === 'default') {
        permission = await Notification.requestPermission();
    }

    if (permission === 'granted') {
        try {
            const notification = new Notification(title, {
                body: body,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🐼</text></svg>',
                tag: 'pomodoro-global',
                requireInteraction: true,
                vibrate: [200, 100, 200],
                data: {
                    timestamp: Date.now()
                }
            });

            notification.onclick = function() {
                self.clients.matchAll({ type: 'window', includeUncontrolled: true })
                    .then(clients => {
                        if (clients.length > 0) {
                            clients[0].focus();
                        } else {
                            self.clients.openWindow('/');
                        }
                    });
                notification.close();
            };

            console.log('[SW] Notification sent:', title);
        } catch (e) {
            console.error('[SW] Notification error:', e);
        }
    }
}

// 广播消息给所有客户端
function broadcastToClients(message) {
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(clients => {
            clients.forEach(client => {
                client.postMessage(message);
            });
        });
}

// 定期广播状态给页面（保持同步）
setInterval(() => {
    if (pomodoroState.enabled) {
        broadcastToClients({ type: 'POMODORO_TICK', state: pomodoroState });
    }
}, 1000);

console.log('[SW] Pomodoro Service Worker loaded');