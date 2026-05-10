# 经销商订货系统 (Dealer Order System)

## 项目概述

B2B 经销商订货平台，支持 PC 和移动端自适应布局。

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | React 18 + TypeScript + Vite | antd 5 + antd-mobile，响应式布局 |
| 后端 | Python 3.10 + FastAPI | SQLAlchemy 2.0 + asyncpg |
| 数据库 | PostgreSQL | 库名：`dealer_order` |
| 认证 | JWT | python-jose + passlib |
| 状态管理 | Zustand | 前端全局状态 |

## 项目结构

```
dealer-order-system/
├── backend/                 # 后端 API
│   ├── app/
│   │   ├── api/            # 路由（auth, products, cart, orders, favorites, reorder, reconciliation, admin）
│   │   ├── models/         # SQLAlchemy 模型
│   │   ├── core/           # 配置（config, database, security）
│   │   └── main.py         # FastAPI 入口
│   ├── requirements.txt
│   └── README.md
│
├── frontend/               # 前端（响应式 PC/H5）
│   ├── src/
│   │   ├── api/           # Axios 客户端
│   │   ├── components/
│   │   │   └── ResponsiveLayout.tsx  # PC/Mobile 自适应布局
│   │   ├── pages/         # 页面组件（商品、购物车、订单、收藏、复购、对账）
│   │   ├── store/         # Zustand 状态（auth, cart）
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── docs/
│   ├── database-design.md
│   └── init.sql            # 数据库初始化
│
├── dealer-order-prd.md      # 产品需求文档
└── technical-design.md      # 技术设计文档
```

## 快速启动

### 后端

```bash
cd backend
pip install -r requirements.txt

# 创建数据库
psql -U postgres -c "CREATE DATABASE dealer_order;"
psql -U postgres -d dealer_order -f ../docs/init.sql

# 配置 .env
echo "DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/dealer_order" > .env
echo "SECRET_KEY=your-secret-key" >> .env

# 启动
uvicorn app.main:app --reload --port 8000
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

### 访问

- 前端：http://localhost:5173
- 后端 API：http://localhost:8000/docs

## 响应式布局

- **断点：** 768px
- **PC 端（≥768px）：** antd 组件，标准后台布局
- **移动端（<768px）：** antd-mobile 组件，移动端专用布局
- **实现：** `ResponsiveLayout` 组件统一处理，通过 `window.innerWidth` 检测设备类型

## 示例账号

| 用户名 | 密码 | 等级 |
|--------|------|------|
| dealer001 | 123456 | 金牌 |
| dealer002 | 123456 | 银牌 |
| dealer003 | 123456 | 铜牌 |

## 变更日志

| Version | Date | Change |
|---------|------|--------|
| v1.0 | 2026-05-08 | 初始版本 |
| v1.1 | 2026-05-08 | 新增管理端功能 |
| v1.2 | 2026-05-10 | H5 响应式布局，PC/Mobile 自适应 |