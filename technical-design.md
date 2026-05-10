# 经销商订货系统 - 技术方案

## 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| 前端 | React 18 + Ant Design 5 + antd-mobile + Vite | 瑶光完成，B 端首选，支持 H5 响应式布局 |
| 后端 | Python 3.10 + FastAPI | 公子完成，轻量高性能 |
| 数据库 | PostgreSQL | 建议库名：`dealer_order` |
| ORM | SQLAlchemy 2.0 + asyncpg | 异步驱动 |
| 认证 | JWT（python-jose + passlib） | 前后端分离无状态认证 |
| 状态管理 | Zustand（前端） | 轻量级状态管理 |

---

## 项目结构

```
dealer-order-system/
├── backend/                    # 后端（公子）
│   ├── app/
│   │   ├── api/               # API 路由
│   │   │   ├── auth.py        ✅
│   │   │   ├── products.py    ✅
│   │   │   ├── cart.py         ✅
│   │   │   ├── orders.py       ✅
│   │   │   ├── favorites.py    ✅
│   │   │   ├── reorder.py      ✅
│   │   │   ├── reconciliation.py ✅
│   │   │   ├── admin.py        ✅
│   │   │   ├── admin_orders.py  ✅
│   │   │   ├── admin_products.py ✅
│   │   │   └── admin_dealers.py ✅
│   │   ├── models/            # SQLAlchemy 模型
│   │   │   ├── user.py         ✅
│   │   │   ├── product.py      ✅
│   │   │   └── order.py         ✅
│   │   ├── core/              # 核心配置
│   │   │   ├── config.py       ✅
│   │   │   ├── database.py     ✅
│   │   │   └── security.py     ✅
│   │   ├── schemas/           # Pydantic 模型（未独立拆分）
│   │   └── main.py             ✅
│   ├── tests/                 # （未实现）
│   ├── init.sql               # 数据库初始化脚本
│   ├── requirements.txt
│   └── README.md
│
├── frontend/                  # 前端（瑶光）
│   ├── src/
│   │   ├── api/               # Axios 请求封装
│   │   │   ├── client.ts      ✅ 经销商端 API 客户端
│   │   │   └── adminClient.ts ✅ 企业端 API 客户端
│   │   ├── pages/
│   │   │   ├── Login.tsx      ✅
│   │   │   ├── ProductList.tsx ✅ 亚马逊风格商品列表
│   │   │   ├── ProductDetail.tsx ✅
│   │   │   ├── Cart.tsx        ✅
│   │   │   ├── Orders.tsx      ✅
│   │   │   ├── OrderDetail.tsx ✅
│   │   │   ├── Favorites.tsx   ✅
│   │   │   ├── Reorder.tsx     ✅
│   │   │   └── Reconciliation.tsx ✅
│   │   ├── pages/admin/
│   │   │   ├── Login.tsx      ✅
│   │   │   ├── Dashboard.tsx  ✅
│   │   │   ├── Orders.tsx      ✅
│   │   │   ├── Products.tsx    ✅
│   │   │   └── Dealers.tsx     ✅
│   │   ├── components/
│   │   │   ├── ResponsiveLayout.tsx ✅ 响应式布局（PC/Mobile 自适应）
│   │   │   ├── AppLayout.tsx   ✅ 经销商端布局
│   │   │   └── AdminLayout.tsx ✅ 企业端布局
│   │   ├── store/              # Zustand 状态管理
│   │   │   ├── auth.ts         ✅ 经销商认证状态
│   │   │   ├── adminAuth.ts    ✅ 企业认证状态
│   │   │   └── cart.ts         ✅ 购物车状态
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
└── docs/
    ├── database-design.md
    └── init.sql                # 完整 DDL 脚本
```

---

## 数据库设计

**当前状态：** PostgreSQL，库名 `dealer_order`

### ER 概要

```
用户 (users) ← 经销商等级 (dealer_tiers) → 价格策略 (price_rules)
    ↓
收藏 (favorites)    购物车 (cart_items)    历史订单 (order_history)
    ↓                    ↓                      ↓
商品 (products) ← 商品分类 (categories)    订单明细 (order_items)
    ↓
库存 (inventory) ← 仓库 (warehouses)
    ↓
价格 (product_prices) ← 阶梯价 (tiered_pricing)
```

### 初始化脚本

DDL 脚本位于 `docs/init.sql`，包含完整建表语句和初始数据。

---

## API 接口规划

### 认证模块 ✅
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录，返回 JWT |
| POST | `/api/auth/register` | 注册 |
| GET | `/api/auth/me` | 获取当前用户信息 |

### 商品模块 ✅
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/products` | 商品列表（分页+搜索+筛选） |
| GET | `/api/products/{id}` | 商品详情（含专属价、库存） |
| GET | `/api/categories` | 全部分类树 |
| GET | `/api/products/favorites` | 收藏商品列表 |

### 购物车 & 订单 ✅
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/cart` | 获取购物车 |
| POST | `/api/cart/items` | 添加商品到购物车 |
| PUT | `/api/cart/items/{id}` | 更新数量 |
| DELETE | `/api/cart/items/{id}` | 删除商品 |
| POST | `/api/orders` | 提交订单 |
| GET | `/api/orders` | 订单列表 |
| GET | `/api/orders/{id}` | 订单详情（含状态时间线） |

### 收藏 & 复购 ✅
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/favorites` | 我的收藏列表 |
| POST | `/api/favorites` | 添加收藏 |
| DELETE | `/api/favorites/{product_id}` | 取消收藏 |
| GET | `/api/reorders/history` | 历史订单（快速复购用） |
| POST | `/api/reorders` | 一键复购 |

### 对账 ✅
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/reconciliation/monthly` | 月度对账汇总 |
| GET | `/api/reconciliation/detail` | 对账明细 |

### 企业侧（内部接口）✅
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/login` | 企业端登录 |
| GET | `/api/admin/orders` | 全部订单 |
| PUT | `/api/admin/orders/{id}/status` | 更新订单状态 |
| GET | `/api/admin/products` | 商品管理列表 |
| PUT | `/api/admin/products/{id}` | 更新商品 |
| GET | `/api/admin/dealers` | 经销商列表 |

---

## 开发分工 & 状态

| 任务 | 负责人 | 状态 |
|------|--------|------|
| 数据库 DDL 设计 | 公子 | ✅ 完成 |
| 后端项目脚手架搭建 | 公子 | ✅ 完成 |
| 后端 API 实现（认证） | 公子 | ✅ 完成 |
| 后端 API 实现（商品/库存/价格） | 公子 | ✅ 完成 |
| 后端 API 实现（购物车/订单） | 公子 | ✅ 完成 |
| 后端 API 实现（收藏/复购/对账） | 公子 | ✅ 完成 |
| 前端项目初始化 + 脚手架 | 瑶光 | ✅ 完成 |
| 前端页面：登录 | 瑶光 | ✅ 完成 |
| 前端页面：商品列表（亚马逊风格） | 瑶光 | ✅ 完成 |
| 前端页面：商品详情 | 瑶光 | ✅ 完成 |
| 前端页面：购物车 | 瑶光 | ✅ 完成 |
| 前端页面：订单跟踪 | 瑶光 | ✅ 完成 |
| 前端页面：我的收藏 | 瑶光 | ✅ 完成 |
| 前端页面：快速复购 | 瑶光 | ✅ 完成（响应式） |
| 前端页面：对账 | 瑶光 | ✅ 完成（响应式） |
| 前端页面：H5 自适应 | 瑶光 | ✅ 完成 |
| 企业端页面：登录/仪表盘/订单/商品/经销商 | 瑶光 | ✅ 完成 |
| ERP 接口对接 | 公子 | ⏳ 未开始 |
| 联调测试 | 公子 + 瑶光 | ⏳ 未开始 |

---

## 启动方式

### 后端

```bash
cd backend
python3.10 -m venv venv310
source venv310/bin/activate
pip install -r requirements.txt

# 确保 PostgreSQL 数据库 dealer_order 已创建
# 执行 docs/init.sql 初始化数据

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

### 环境变量

后端需要配置 `.env` 文件：

```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/dealer_order
SECRET_KEY=your-secret-key-change-in-production
```

### 示例账号

| 用户名 | 密码 | 等级 |
|--------|------|------|
| dealer001 | 123456 | 金牌 |
| dealer002 | 123456 | 银牌 |
| dealer003 | 123456 | 铜牌 |

---

## 待完成事项

1. **ERP 接口对接** - 企业端与 ERP 系统数据同步
2. **集成测试** - 前后端联调验证
3. **生产环境部署** - PostgreSQL + Gunicorn + Nginx
4. **Services 层重构** - 业务逻辑从 API 层拆分到独立 services
5. **单元测试** - 后端 pytest 测试覆盖
