const express = require('express');
const cors = require('cors');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const EXCEL_FILE = path.join(__dirname, 'todos.xlsx');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');

app.use(cors());
app.use(express.json());

// 默认设置
const defaultSettings = {
    categories: ['工作', '生活', '学习', '其他'],
    reminderHours: 24 // 默认24小时前提醒
};

// 加载设置
function loadSettings() {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
        }
    } catch (e) {
        console.error('加载设置失败:', e);
    }
    return { ...defaultSettings };
}

// 保存设置
function saveSettings(settings) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

// 初始化Excel文件
function initExcel() {
    const colWidths = [
        { wch: 5 },   // ID
        { wch: 30 },  // 任务内容
        { wch: 40 },  // 任务明细
        { wch: 8 },   // 完成状态
        { wch: 20 },  // 创建时间
        { wch: 8 },   // 优先级
        { wch: 10 },  // 分类
        { wch: 12 },  // 截止日期
        { wch: 8 },   // 截止时间
        { wch: 20 },  // 完成时间
        { wch: 10 },  // 重复类型
        { wch: 15 },  // 重复值
        { wch: 15 },  // 提醒时间
        { wch: 8 },   // 提醒天数
        { wch: 8 }    // 提醒小时
    ];

    const headers = ['ID', '任务内容', '任务明细', '完成状态', '创建时间', '优先级', '分类', '截止日期', '截止时间', '完成时间', '重复类型', '重复值', '提醒时间', '提醒天数', '提醒小时'];

    if (!fs.existsSync(EXCEL_FILE)) {
        const ws = xlsx.utils.aoa_to_sheet([headers]);
        ws['!cols'] = colWidths;
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, '待办任务');
        xlsx.writeFile(wb, EXCEL_FILE);
    } else {
        // 强制重建Excel文件：确保所有列都存在且列宽正确
        try {
            const workbook = xlsx.readFile(EXCEL_FILE);
            const sheet = workbook.Sheets['待办任务'];
            const data = xlsx.utils.sheet_to_json(sheet);

            // 读取现有数据并确保所有字段都有值
            const allData = data.map(todo => ({
                ID: todo.ID,
                任务内容: todo['任务内容'] || '',
                任务明细: todo['任务明细'] || '',
                完成状态: todo['完成状态'] || '否',
                创建时间: todo['创建时间'] || '',
                优先级: todo['优先级'] || '中',
                分类: todo['分类'] || '其他',
                截止日期: todo['截止日期'] || '',
                截止时间: todo['截止时间'] || '',
                完成时间: todo['完成时间'] || '',
                重复类型: todo['重复类型'] || '',
                重复值: todo['重复值'] || '',
                提醒时间: todo['提醒时间'] || '',
                提醒天数: todo['提醒天数'] || 0,
                提醒小时: todo['提醒小时'] || 0
            }));

            const ws = xlsx.utils.json_to_sheet(allData);
            ws['!cols'] = colWidths;
            workbook.Sheets['待办任务'] = ws;
            xlsx.writeFile(workbook, EXCEL_FILE);
            console.log('Excel文件已重建：所有列和列宽已更新');
        } catch (e) {
            console.error('更新Excel文件失败:', e);
        }
    }

    // 初始化设置文件
    if (!fs.existsSync(SETTINGS_FILE)) {
        saveSettings(defaultSettings);
    }
}

// 读取任务（支持日期范围过滤）
app.get('/api/todos', (req, res) => {
    try {
        const workbook = xlsx.readFile(EXCEL_FILE);
        const sheet = workbook.Sheets['待办任务'];
        let data = xlsx.utils.sheet_to_json(sheet);

        // 日期范围过滤
        const { dateFrom, dateTo } = req.query;
        if (dateFrom || dateTo) {
            data = data.filter(todo => {
                if (!todo['截止日期']) return false;
                const taskDate = new Date(todo['截止日期']);
                if (dateFrom && taskDate < new Date(dateFrom)) return false;
                if (dateTo && taskDate > new Date(dateTo)) return false;
                return true;
            });
        }

        res.json(data);
    } catch (error) {
        res.json([]);
    }
});

// 添加任务
app.post('/api/todos', (req, res) => {
    try {
        const { content, detail = '', priority = '中', category = '其他', dueDate, dueTime, repeatType = '', repeatValue = '', reminderTime = '', reminderDaysValue = 0, reminderHoursValue = 0 } = req.body;
        console.log('POST received - detail:', JSON.stringify(detail));
        const workbook = xlsx.readFile(EXCEL_FILE);
        const sheet = workbook.Sheets['待办任务'];
        const data = xlsx.utils.sheet_to_json(sheet);

        const newId = data.length > 0 ? Math.max(...data.map(t => t.ID)) + 1 : 1;
        const newTodo = {
            ID: newId,
            任务内容: content,
            任务明细: detail,
            完成状态: '否',
            创建时间: new Date().toLocaleString('zh-CN'),
            优先级: priority,
            分类: category,
            截止日期: dueDate || '',
            截止时间: dueTime || '',
            完成时间: '',
            重复类型: repeatType || '',
            重复值: repeatValue || '',
            提醒时间: reminderTime || '',
            提醒天数: reminderDaysValue || 0,
            提醒小时: reminderHoursValue || 0
        };

        data.push(newTodo);
        // 指定列顺序，确保任务明细列正确
        const headers = ['ID', '任务内容', '任务明细', '完成状态', '创建时间', '优先级', '分类', '截止日期', '截止时间', '完成时间', '重复类型', '重复值', '提醒时间', '提醒天数', '提醒小时'];
        const ws = xlsx.utils.json_to_sheet(data, { header: headers });
        workbook.Sheets['待办任务'] = ws;
        xlsx.writeFile(workbook, EXCEL_FILE);

        res.json(newTodo);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 更新任务
app.put('/api/todos/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { content, detail, completed, priority, category, dueDate, dueTime, repeatType, repeatValue, reminderTime, reminderDaysValue, reminderHoursValue } = req.body;

        const workbook = xlsx.readFile(EXCEL_FILE);
        const sheet = workbook.Sheets['待办任务'];
        const data = xlsx.utils.sheet_to_json(sheet);

        const index = data.findIndex(t => t.ID === parseInt(id));
        if (index !== -1) {
            if (content !== undefined) data[index].任务内容 = content;
            if (detail !== undefined) data[index].任务明细 = detail;
            if (priority !== undefined) data[index].优先级 = priority;
            if (category !== undefined) data[index].分类 = category;
            if (dueDate !== undefined) data[index].截止日期 = dueDate;
            if (dueTime !== undefined) data[index].截止时间 = dueTime;
            if (repeatType !== undefined) data[index].重复类型 = repeatType;
            if (repeatValue !== undefined) data[index].重复值 = repeatValue;
            if (reminderTime !== undefined) data[index].提醒时间 = reminderTime;
            if (reminderDaysValue !== undefined) data[index].提醒天数 = reminderDaysValue;
            if (reminderHoursValue !== undefined) data[index].提醒小时 = reminderHoursValue;

            let isNewTask = null;
            if (completed !== undefined) {
                const wasCompleted = data[index].完成状态 === '是';
                data[index].完成状态 = completed ? '是' : '否';
                data[index].完成时间 = completed ? new Date().toLocaleString('zh-CN') : '';

                // 如果是完成操作且之前未完成，检查是否是周期性任务
                if (completed && !wasCompleted && data[index].重复类型 && data[index].重复值) {
                    isNewTask = createNextRepeatTask(data[index]);
                }
            }

            const headers = ['ID', '任务内容', '任务明细', '完成状态', '创建时间', '优先级', '分类', '截止日期', '截止时间', '完成时间', '重复类型', '重复值', '提醒时间', '提醒天数', '提醒小时'];
            const ws = xlsx.utils.json_to_sheet(data, { header: headers });
            workbook.Sheets['待办任务'] = ws;
            xlsx.writeFile(workbook, EXCEL_FILE);

            res.json({ task: data[index], nextTask: isNewTask });
        } else {
            res.status(404).json({ error: '任务不存在' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 删除任务
app.delete('/api/todos/:id', (req, res) => {
    try {
        const { id } = req.params;

        const workbook = xlsx.readFile(EXCEL_FILE);
        const sheet = workbook.Sheets['待办任务'];
        const data = xlsx.utils.sheet_to_json(sheet);

        const index = data.findIndex(t => t.ID === parseInt(id));
        if (index !== -1) {
            data.splice(index, 1);

            const ws = xlsx.utils.json_to_sheet(data);
            workbook.Sheets['待办任务'] = ws;
            xlsx.writeFile(workbook, EXCEL_FILE);

            res.json({ success: true });
        } else {
            res.status(404).json({ error: '任务不存在' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 完成周期性任务时创建下一个任务
function createNextRepeatTask(completedTask) {
    try {
        const repeatType = completedTask['重复类型'];
        const repeatValue = completedTask['重复值'];

        if (!repeatType || !repeatValue) return null;

        let newDueDate = '';
        const currentDueDate = completedTask['截止日期'];

        if (repeatType === 'daily') {
            // 每天 - 下一天
            const date = new Date(currentDueDate);
            date.setDate(date.getDate() + 1);
            newDueDate = date.toISOString().split('T')[0];
        } else if (repeatType === 'weekly') {
            // 每周 - 下周同一天
            const date = new Date(currentDueDate);
            date.setDate(date.getDate() + 7);
            newDueDate = date.toISOString().split('T')[0];
        } else if (repeatType === 'monthly') {
            // 每月 - 下月同日
            const date = new Date(currentDueDate);
            date.setMonth(date.getMonth() + 1);
            newDueDate = date.toISOString().split('T')[0];
        } else if (repeatType === 'yearly') {
            // 每年 - 明年同日
            const date = new Date(currentDueDate);
            date.setFullYear(date.getFullYear() + 1);
            newDueDate = date.toISOString().split('T')[0];
        } else if (repeatType === 'weekday') {
            // 每周特定几天 - repeatValue 格式: "0,3,6" 表示周日、周三、周六
            const weekdays = repeatValue.split(',').map(w => parseInt(w));
            const date = new Date(currentDueDate);
            do {
                date.setDate(date.getDate() + 1);
            } while (!weekdays.includes(date.getDay()));
            newDueDate = date.toISOString().split('T')[0];
        }

        if (!newDueDate) return null;

        const workbook = xlsx.readFile(EXCEL_FILE);
        const sheet = workbook.Sheets['待办任务'];
        const data = xlsx.utils.sheet_to_json(sheet);

        const newId = Math.max(...data.map(t => t.ID)) + 1;
        const newTodo = {
            ID: newId,
            任务内容: completedTask['任务内容'],
            完成状态: '否',
            创建时间: new Date().toLocaleString('zh-CN'),
            优先级: completedTask['优先级'],
            分类: completedTask['分类'],
            截止日期: newDueDate,
            截止时间: completedTask['截止时间'] || '',
            完成时间: '',
            重复类型: repeatType,
            重复值: repeatValue,
            提醒时间: completedTask['提醒时间'] || '',
            提醒天数: completedTask['提醒天数'] || 0,
            提醒小时: completedTask['提醒小时'] || 0
        };

        data.push(newTodo);
        const ws = xlsx.utils.json_to_sheet(data);
        workbook.Sheets['待办任务'] = ws;
        xlsx.writeFile(workbook, EXCEL_FILE);

        return newTodo;
    } catch (error) {
        console.error('创建下一个周期性任务失败:', error);
        return null;
    }
}

// 获取设置
app.get('/api/settings', (req, res) => {
    res.json(loadSettings());
});

// 更新设置
app.put('/api/settings', (req, res) => {
    try {
        const { categories, reminderHours } = req.body;
        const settings = loadSettings();

        if (categories !== undefined) settings.categories = categories;
        if (reminderHours !== undefined) settings.reminderHours = reminderHours;

        saveSettings(settings);
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取番茄时钟设置
app.get('/api/settings/pomodoro', (req, res) => {
    try {
        const settings = loadSettings();
        res.json({
            pomodoroEnabled: settings.pomodoroEnabled || false,
            workDuration: settings.workDuration || 45,
            breakDuration: settings.breakDuration || 5
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 更新番茄时钟设置
app.put('/api/settings/pomodoro', (req, res) => {
    try {
        const { pomodoroEnabled, workDuration, breakDuration } = req.body;
        const settings = loadSettings();

        if (pomodoroEnabled !== undefined) settings.pomodoroEnabled = pomodoroEnabled;
        if (workDuration !== undefined) settings.workDuration = workDuration;
        if (breakDuration !== undefined) settings.breakDuration = breakDuration;

        saveSettings(settings);
        res.json({
            pomodoroEnabled: settings.pomodoroEnabled,
            workDuration: settings.workDuration,
            breakDuration: settings.breakDuration
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 添加分类
app.post('/api/categories', (req, res) => {
    try {
        const { name } = req.body;
        const settings = loadSettings();

        if (!name || settings.categories.includes(name)) {
            return res.status(400).json({ error: '分类已存在或名称无效' });
        }

        settings.categories.push(name);
        saveSettings(settings);

        res.json({ success: true, categories: settings.categories });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 更新分类
app.put('/api/categories/:oldName', (req, res) => {
    try {
        const { oldName } = req.params;
        const { name } = req.body;
        const settings = loadSettings();

        const index = settings.categories.indexOf(oldName);
        if (index === -1) {
            return res.status(404).json({ error: '分类不存在' });
        }

        if (!name || settings.categories.includes(name)) {
            return res.status(400).json({ error: '分类已存在或名称无效' });
        }

        // 更新分类名称
        settings.categories[index] = name;
        saveSettings(settings);

        // 更新所有使用该分类的任务
        const workbook = xlsx.readFile(EXCEL_FILE);
        const sheet = workbook.Sheets['待办任务'];
        const data = xlsx.utils.sheet_to_json(sheet);

        data.forEach(todo => {
            if (todo['分类'] === oldName) {
                todo['分类'] = name;
            }
        });

        const ws = xlsx.utils.json_to_sheet(data);
        workbook.Sheets['待办任务'] = ws;
        xlsx.writeFile(workbook, EXCEL_FILE);

        res.json({ success: true, categories: settings.categories });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 删除分类
app.delete('/api/categories/:name', (req, res) => {
    try {
        const { name } = req.params;
        const settings = loadSettings();

        const index = settings.categories.indexOf(name);
        if (index === -1) {
            return res.status(404).json({ error: '分类不存在' });
        }

        // 不能删除默认分类
        if (['工作', '生活', '学习', '其他'].includes(name)) {
            return res.status(400).json({ error: '不能删除默认分类' });
        }

        // 删除分类前，先更新所有使用该分类的任务为"其他"
        const workbook = xlsx.readFile(EXCEL_FILE);
        const sheet = workbook.Sheets['待办任务'];
        const data = xlsx.utils.sheet_to_json(sheet);

        data.forEach(todo => {
            if (todo['分类'] === name) {
                todo['分类'] = '其他';
            }
        });

        const ws = xlsx.utils.json_to_sheet(data);
        workbook.Sheets['待办任务'] = ws;
        xlsx.writeFile(workbook, EXCEL_FILE);

        // 然后删除分类
        settings.categories.splice(index, 1);
        saveSettings(settings);

        res.json({ success: true, categories: settings.categories });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

initExcel();

// 静态文件服务（放在API路由之后）
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
    console.log(`待办任务应用已启动: http://localhost:${PORT}`);
});