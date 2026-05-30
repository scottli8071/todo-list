# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Chinese todo/task management application that syncs with an Excel file. The app provides a modern UI with task list and calendar views, supports recurring tasks, priorities, categories, and reminders.

## Tech Stack

- **Backend**: Express.js (`server.js`)
- **Frontend**: Vanilla HTML/CSS/JS (`public/index.html`)
- **Data Storage**: Excel file (`todos.xlsx`) via `xlsx` library
- **Testing**: Playwright

## Commands

```bash
# Start the server
npm start
# or
node server.js
```

Server runs at http://localhost:3000

## Architecture

### Data Flow
1. Frontend (`public/index.html`) makes API calls to Express backend
2. Backend reads/writes to `todos.xlsx` using the `xlsx` library
3. Settings are stored in `settings.json`

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/todos` | Get all tasks (supports `dateFrom`, `dateTo` query params) |
| POST | `/api/todos` | Create a new task |
| PUT | `/api/todos/:id` | Update a task |
| DELETE | `/api/todos/:id` | Delete a task |
| GET | `/api/settings` | Get app settings |
| PUT | `/api/settings` | Update settings |
| POST | `/api/categories` | Add a new category |
| PUT | `/api/categories/:oldName` | Update a category (also updates all tasks using it) |
| DELETE | `/api/categories/:name` | Delete a category (tasks reassigned to "其他") |

### Excel Data Structure

Columns: `ID`, `任务内容`, `任务明细`, `完成状态`, `创建时间`, `优先级`, `分类`, `截止日期`, `截止时间`, `完成时间`, `重复类型`, `重复值`, `提醒时间`, `提醒天数`, `提醒小时`

### Key Features

- **Recurring tasks**: When completing a recurring task (daily/weekly/monthly/yearly), the system automatically creates the next occurrence
- **Reminders**: Browser notifications fire based on `提醒天数` and `提醒小时` settings
- **Calendar view**: Shows tasks on a monthly calendar, expanding recurring tasks to all occurrences
- **Default categories**: 工作, 生活, 学习, 其他 (cannot delete default categories)

### File Structure

```
.
├── server.js          # Express backend (all API endpoints)
├── public/
│   └── index.html     # Frontend (embedded CSS and JS)
├── todos.xlsx         # Task data storage
├── settings.json      # App settings
├── task_struct.json   # Sample task structure reference
└── package.json
```