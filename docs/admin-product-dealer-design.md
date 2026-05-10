# 管理端 - 商品管理与经销商管理设计

## 一、商品管理

### 1.1 商品状态定义

| 状态 | 标识 | 说明 |
|------|------|------|
| 上架 (active) | 绿色 | 商品对经销商可见，可正常下单 |
| 下架 (inactive) | 灰色 | 商品对经销商不可见，但未被删除 |
| 停用 (disabled) | 橙色 | 商品不可操作，保留数据用于历史追溯 |
| 已删除 (deleted) | 红色 | 已从系统移除，仅保留主键关联 |

**状态流转：**
```
新建 → 上架 → 下架 ↔ 停用 → 删除
              ↑__________________|
```

### 1.2 商品新建

**页面入口：** 商品管理页 → "新建商品" 按钮

**表单字段：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 商品名称 | 文本 | 是 | 最大 200 字符 |
| SKU编码 | 文本 | 是 | 唯一标识，支持扫描 |
| 分类 | 下拉选择 | 是 | 树形分类（支持多级） |
| 规格型号 | 文本 | 否 | 最大 255 字符 |
| 单位 | 文本 | 是 | 如：个、瓶、箱 |
| 最小起订量 | 数字 | 是 | 默认 1 |
| 标价 | 数字 | 是 | 默认价格 |
| 商品图片 | 图片上传 | 否 | 支持拖拽上传，建议尺寸 300x300 |
| 商品描述 | 多行文本 | 否 | 支持富文本 |

**业务规则：**
- SKU 编码唯一，重复时报错
- 图片上传到 OSS，存储 URL
- 新建商品默认状态为"停用"，需手动上架

### 1.3 商品下架

**操作入口：** 商品列表 → 操作列 → "下架" 按钮

**业务规则：**
- 下架后商品从经销商端商品列表移除
- 已加入购物车的商品需提示经销商处理
- 下架后可重新上架

**API 设计：**
```
PUT /api/admin/products/{id}/status
Body: { "status": "inactive" }
```

### 1.4 商品停用

**操作入口：** 商品列表 → 操作列 → "停用" 按钮

**业务规则：**
- 停用后商品不可销售、不可编辑
- 停用时校验：如有未完成订单（pending/confirmed/processing）引用该商品，不允许停用
- 停用后可启用（重新上架需走下架流程）

**停用校验逻辑：**
```python
# 校验未完成订单
unfinished_orders = db.execute(
    select(Order).where(
        Order.status.in_(["pending", "confirmed", "processing"]),
        Order.items.any(product_id=product_id)
    )
)
if unfinished_orders.count > 0:
    raise HTTPException(400, "存在未完成订单引用该商品，无法停用")
```

**API 设计：**
```
PUT /api/admin/products/{id}/status
Body: { "status": "disabled" }
```

### 1.5 商品删除

**操作入口：** 商品列表 → 操作列 → "删除" 按钮

**业务规则：**

1. **删除前必须停用**
   - 商品状态为"停用"才允许删除
   - 若商品为"上架"或"下架"状态，需先停用再删除

2. **删除前校验历史数据引用**
   - 校验已完成订单（completed/cancelled/rejected）是否引用该商品
   - 若存在历史订单引用，记录商品ID但允许删除（软删除）
   - 购物车中的该商品自动移除

3. **软删除机制**
   - 商品不物理删除，设置 `deleted_at` 时间戳
   - 商品列表默认不显示已删除商品（需筛选"已删除"可见）

**删除校验逻辑：**
```python
# 校验历史订单引用
historical_orders = db.execute(
    select(Order).where(
        Order.status.in_(["completed", "cancelled", "rejected"]),
        Order.items.any(product_id=product_id)
    )
).count()

# 如有历史引用，记录但不阻止删除
if historical_orders > 0:
    log_warning(f"商品 {id} 被 {historical_orders} 笔历史订单引用")
```

**API 设计：**
```
DELETE /api/admin/products/{id}
```

### 1.6 商品列表功能

| 功能 | 说明 |
|------|------|
| 搜索 | 支持商品名称/SKU/规格搜索 |
| 筛选 | 按分类、状态（上架/下架/停用）筛选 |
| 排序 | 按创建时间、上架状态、库存量排序 |
| 批量操作 | 批量上架/下架/停用（最多 50 条/次） |
| 导出 | 导出商品数据 Excel |

---

## 二、经销商管理

### 2.1 经销商状态定义

| 状态 | 标识 | 说明 |
|------|------|------|
| 正常 (active) | 绿色 | 可正常登录、订货 |
| 停用 (disabled) | 橙色 | 不可登录、不可订货，保留数据 |
| 已删除 (deleted) | 灰色 | 仅保留主键，不可恢复 |

**状态流转：**
```
新增 → 正常 ↔ 停用 → 删除
              ↑__________|
```

### 2.2 经销商新增

**页面入口：** 经销商管理页 → "新增经销商" 按钮

**表单字段：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 公司名称 | 文本 | 是 | 最大 200 字符 |
| 联系人 | 文本 | 是 | 最大 100 字符 |
| 联系电话 | 文本 | 是 | 手机号格式校验 |
| 地址 | 文本 | 否 | 最大 500 字符 |
| 归属区域 | 下拉选择 | 是 | 华东/华南/华北/西南/西北 |
| 经销商等级 | 下拉选择 | 是 | 金牌/银牌/铜牌/普通 |
| 信用额度 | 数字 | 否 | 默认无上限 |

**业务规则：**
- 新增时自动创建默认账号（手机号为用户名，初始密码为"123456"）
- 新增后状态为"正常"

**API 设计：**
```
POST /api/admin/dealers
Body: {
  "name": "xxx",
  "contact_name": "xxx",
  "contact_phone": "xxx",
  "address": "xxx",
  "region": "east",
  "tier": "gold",
  "credit_limit": 100000
}
```

### 2.3 经销商停用

**操作入口：** 经销商列表 → 操作列 → "停用" 按钮

**业务规则：**
- 停用后经销商账号不可登录
- 停用时校验：如有未完成订单（pending/confirmed/processing）关联该经销商，不允许停用
- 停用后该经销商用户全部强制登出
- 停用后可重新启用

**停用校验逻辑：**
```python
# 校验未完成订单
unfinished_orders = db.execute(
    select(Order).where(
        Order.status.in_(["pending", "confirmed", "processing"]),
        Order.dealer_id == dealer_id
    )
).count()

if unfinished_orders > 0:
    raise HTTPException(400, "该经销商存在未完成订单，无法停用")
```

**API 设计：**
```
PUT /api/admin/dealers/{id}/status
Body: { "status": "disabled" }
```

### 2.4 经销商删除

**操作入口：** 经销商列表 → 操作列 → "删除" 按钮

**业务规则：**

1. **删除前必须停用**
   - 经销商状态为"停用"才允许删除
   - 若为"正常"状态，需先停用再删除

2. **删除前校验历史数据引用**
   - 校验历史订单（completed/cancelled/rejected）是否关联该经销商
   - 若存在历史订单引用，不允许删除（保护历史数据）
   - 提示：该经销商存在历史订单记录，仅可停用不可删除

3. **账号联动删除**
   - 删除经销商时，其下所有用户账号一并删除（软删除）

**删除校验逻辑：**
```python
# 校验历史订单引用
historical_orders = db.execute(
    select(Order).where(
        Order.status.in_(["completed", "cancelled", "rejected"]),
        Order.dealer_id == dealer_id
    )
).count()

if historical_orders > 0:
    raise HTTPException(400, "该经销商存在历史订单，不可删除，仅可停用")
```

**API 设计：**
```
DELETE /api/admin/dealers/{id}
```

### 2.5 经销商列表功能

| 功能 | 说明 |
|------|------|
| 搜索 | 支持公司名称/联系人/手机号搜索 |
| 筛选 | 按区域、等级、状态筛选 |
| 排序 | 按创建时间、订单量、金额排序 |
| 账号管理 | 查看/重置经销商用户密码 |
| 导出 | 导出经销商数据 Excel |

---

## 三、API 设计

### 3.1 商品管理 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/products` | 商品列表（支持搜索/筛选/分页） |
| GET | `/api/admin/products/{id}` | 商品详情 |
| POST | `/api/admin/products` | 新建商品 |
| PUT | `/api/admin/products/{id}` | 编辑商品 |
| PUT | `/api/admin/products/{id}/status` | 更新状态（上架/下架/停用） |
| DELETE | `/api/admin/products/{id}` | 删除商品（需已停用） |
| POST | `/api/admin/products/batch/status` | 批量更新状态 |

**商品列表响应：**
```json
{
  "items": [
    {
      "id": 1,
      "name": "IPA 异丙醇 500ml",
      "sku": "CHE-IPA-001",
      "category": "化学试剂",
      "spec": "500ml/瓶",
      "unit": "瓶",
      "list_price": 8.50,
      "inventory": { "available": 500, "status": "in_stock" },
      "status": "active",
      "created_at": "2026-05-08T10:00:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "page_size": 20,
  "total_pages": 5
}
```

**新建商品请求：**
```json
{
  "name": "IPA 异丙醇 500ml",
  "sku": "CHE-IPA-001",
  "category_id": 1,
  "spec": "500ml/瓶",
  "unit": "瓶",
  "min_order_qty": 1,
  "list_price": 8.50,
  "image_url": "https://xxx.com/image.jpg",
  "description": "高纯度异丙醇，用于清洗和消毒"
}
```

### 3.2 经销商管理 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/dealers` | 经销商列表（支持搜索/筛选/分页） |
| GET | `/api/admin/dealers/{id}` | 经销商详情（含用户列表） |
| POST | `/api/admin/dealers` | 新增经销商 |
| PUT | `/api/admin/dealers/{id}` | 编辑经销商 |
| PUT | `/api/admin/dealers/{id}/status` | 更新状态（停用/启用） |
| DELETE | `/api/admin/dealers/{id}` | 删除经销商（需已停用且无历史订单） |
| GET | `/api/admin/dealers/{id}/users` | 经销商用户列表 |
| PUT | `/api/admin/dealers/{id}/reset-password` | 重置用户密码 |

**经销商列表响应：**
```json
{
  "items": [
    {
      "id": 1,
      "name": "上海某某贸易有限公司",
      "contact_name": "张三",
      "contact_phone": "13800138000",
      "region": "华东",
      "tier": "金牌",
      "user_count": 3,
      "order_count": 50,
      "total_amount": 125000.00,
      "status": "active",
      "created_at": "2026-05-08T10:00:00Z"
    }
  ],
  "total": 20,
  "page": 1,
  "page_size": 20,
  "total_pages": 1
}
```

---

## 四、数据库变更

### 4.1 商品表变更 (products)

新增字段：
```sql
ALTER TABLE products ADD COLUMN status VARCHAR(20) DEFAULT 'disabled';
ALTER TABLE products ADD COLUMN deleted_at TIMESTAMP NULL;
ALTER TABLE products ADD COLUMN description TEXT;
```

### 4.2 经销商表变更 (dealers)

新增字段：
```sql
ALTER TABLE dealers ADD COLUMN status VARCHAR(20) DEFAULT 'active';
ALTER TABLE dealers ADD COLUMN deleted_at TIMESTAMP NULL;
ALTER TABLE dealers ADD COLUMN credit_limit DECIMAL(12,2) DEFAULT NULL;
```

---

## 五、错误处理

| 错误场景 | HTTP 状态码 | 错误信息 |
|----------|-------------|----------|
| 商品 SKU 重复 | 400 | "SKU编码已存在" |
| 商品未停用尝试删除 | 400 | "请先停用商品再删除" |
| 商品存在未完成订单引用 | 400 | "存在未完成订单引用该商品，无法停用" |
| 经销商存在未完成订单引用 | 400 | "该经销商存在未完成订单，无法停用" |
| 经销商存在历史订单引用 | 400 | "该经销商存在历史订单，不可删除，仅可停用" |
| 经销商未停用尝试删除 | 400 | "请先停用经销商再删除" |