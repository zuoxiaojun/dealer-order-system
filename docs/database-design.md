-- ============================================================
-- 经销商订货系统 - PostgreSQL 数据库 DDL
-- 库名建议：dealer_order
-- 执行方式：psql -U postgres -d dealer_order -f dealer_order_ddl.sql
-- ============================================================

-- --- 1. 基础表（先建这些）---------------------------

-- 经销商等级表
CREATE TABLE IF NOT EXISTS dealer_tiers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,        -- 如：金牌、银牌、铜牌、普通
    discount_rate DECIMAL(5,2) DEFAULT 1.00, -- 折扣率，如 0.90 表示 9 折
    credit_limit DECIMAL(12,2) DEFAULT 0,    -- 信用额度
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)

-- 用户表（经销商账号）
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    dealer_tier_id INT REFERENCES dealer_tiers(id),
    company_name VARCHAR(200),               -- 经销商公司名
    phone VARCHAR(20),
    email VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','frozen')),
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)

-- 仓库表
CREATE TABLE IF NOT EXISTS warehouses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255),
    contact_phone VARCHAR(20),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)

-- 商品分类表
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    parent_id INT REFERENCES categories(id),  -- 支持多级分类
    name VARCHAR(100) NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)

-- 商品表（SPU）
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    category_id INT REFERENCES categories(id),
    name VARCHAR(200) NOT NULL,
    sku VARCHAR(50) NOT NULL UNIQUE,
    spec VARCHAR(255),                       -- 规格描述
    unit VARCHAR(20) DEFAULT '件',           -- 计量单位
    min_order_qty INT DEFAULT 1,             -- 最小起订量
    image_url VARCHAR(500),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)

-- 库存表（每个商品 × 每个仓库）
CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id) NOT NULL,
    warehouse_id INT REFERENCES warehouses(id) NOT NULL,
    quantity INT DEFAULT 0,                   -- 可用库存
    reserved_qty INT DEFAULT 0,              -- 预留库存（下单未发货）
    safe_stock INT DEFAULT 10,               -- 安全库存警戒线
    last_sync_at TIMESTAMP,                  -- 最后一次 ERP 同步时间
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, warehouse_id)
)

-- 基准价（商品的标准售价）
CREATE TABLE IF NOT EXISTS product_prices (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id) NOT NULL,
    list_price DECIMAL(12,2) NOT NULL,       -- 标价
    cost_price DECIMAL(12,2),                -- 成本价（参考）
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id)
)

-- 经销商专属价（覆盖基准价）
CREATE TABLE IF NOT EXISTS dealer_prices (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id) NOT NULL,
    user_id INT REFERENCES users(id) NOT NULL, -- 经销商用户
    price DECIMAL(12,2) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, user_id)
)

-- 阶梯价格（按数量区间定价）
CREATE TABLE IF NOT EXISTS tiered_pricing (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id) NOT NULL,
    dealer_tier_id INT REFERENCES dealer_tiers(id), -- NULL 表示通用阶梯价
    min_qty INT NOT NULL,                           -- 起始数量（含）
    max_qty INT,                                    -- 截止数量（含），NULL 表示无上限
    price DECIMAL(12,2) NOT NULL,                   -- 该区间单价
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)

-- --- 2. 业务表 ------------------------------------

-- 购物车
CREATE TABLE IF NOT EXISTS cart_items (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) NOT NULL,
    product_id INT REFERENCES products(id) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id)
)

-- 收藏
CREATE TABLE IF NOT EXISTS favorites (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) NOT NULL,
    product_id INT REFERENCES products(id) NOT NULL,
    price_threshold DECIMAL(12,2),           -- 价格提醒阈值（NULL 表示不提醒）
    notify_on_stock BOOLEAN DEFAULT TRUE,   -- 到货通知
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id)
)

-- 收藏通知记录
CREATE TABLE IF NOT EXISTS favorite_notifications (
    id SERIAL PRIMARY KEY,
    favorite_id INT REFERENCES favorites(id) NOT NULL,
    notify_type VARCHAR(20) CHECK (notify_type IN ('stock_back','price_drop')),
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)

-- 订单主表
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_no VARCHAR(30) NOT NULL UNIQUE,   -- 订单号，如：DD20260508001
    user_id INT REFERENCES users(id) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending','confirmed','processing','shipped','completed','cancelled','rejected')),
    total_amount DECIMAL(12,2) NOT NULL,     -- 订单总金额
    discount_amount DECIMAL(12,2) DEFAULT 0, -- 优惠金额
    net_amount DECIMAL(12,2) NOT NULL,      -- 实付金额 = total - discount
    warehouse_id INT REFERENCES warehouses(id),
    remark TEXT,
    rejection_reason TEXT,                    -- 拒绝原因
    delivered_at TIMESTAMP,                  -- 收货时间
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)

-- 订单明细
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) NOT NULL,
    product_id INT REFERENCES products(id) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,      -- 下单时的单价
    quantity INT NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,         -- = unit_price * quantity
    delivered_qty INT DEFAULT 0              -- 已发货数量（部分发货场景）
)

-- 订单状态时间线
CREATE TABLE IF NOT EXISTS order_status_log (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) NOT NULL,
    status VARCHAR(20) NOT NULL,
    operator VARCHAR(100),                   -- 操作人（企业侧内勤用户名）
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)

-- 历史采购记录（用于快速复购，每次已完成的订单快照）
CREATE TABLE IF NOT EXISTS purchase_history (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) NOT NULL,
    order_id INT REFERENCES orders(id) NOT NULL,
    total_items INT,                         -- 订单商品种类数
    total_amount DECIMAL(12,2),
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)

-- 对账单
CREATE TABLE IF NOT EXISTS reconciliation (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) NOT NULL,
    period VARCHAR(7) NOT NULL,              -- 格式：YYYY-MM，代表月份
    total_orders INT DEFAULT 0,
    total_amount DECIMAL(12,2) DEFAULT 0,
    total_paid DECIMAL(12,2) DEFAULT 0,
    outstanding_amount DECIMAL(12,2) DEFAULT 0, -- 未付款
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending','confirmed','disputed','settled')),
    dispute_reason TEXT,
    confirmed_at TIMESTAMP,
    settled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, period)
)

-- --- 3. 索引 ------------------------------------

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku)
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active) WHERE is_active = TRUE
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id)
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON inventory(warehouse_id)
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)
CREATE INDEX IF NOT EXISTS idx_orders_no ON orders(order_no)
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at)
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)
CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id)
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id)
CREATE INDEX IF NOT EXISTS idx_order_status_log_order ON order_status_log(order_id)
CREATE INDEX IF NOT EXISTS idx_reconciliation_user ON reconciliation(user_id)

-- --- 4. 初始化数据（示例）------------------------

-- 插入仓库
INSERT INTO warehouses (name, address, is_default) VALUES
    ('华东仓', '上海市浦东新区XX路100号', TRUE),
    ('华南仓', '广州市白云区XX路50号', FALSE),
    ('华北仓', '北京市朝阳区XX路80号', FALSE)

ON CONFLICT DO NOTHING

-- 插入商品分类
INSERT INTO categories (name, parent_id) VALUES
    ('电子元器件', NULL),
    ('结构件', NULL),
    ('辅料耗材', NULL)

ON CONFLICT DO NOTHING

-- 插入等级
INSERT INTO dealer_tiers (name, discount_rate, credit_limit, sort_order) VALUES
    ('金牌', 0.80, 1000000, 1),
    ('银牌', 0.85, 500000, 2),
    ('铜牌', 0.90, 200000, 3),
    ('普通', 1.00, 50000, 4)

ON CONFLICT DO NOTHING

-- 示例用户（密码：123456，hash 为 bcrypt）
INSERT INTO users (username, password_hash, full_name, dealer_tier_id, company_name, phone) VALUES
    ('dealer001', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FRnFJ4v0lWfK4e',
     '张经理', 1, '华强北电子有限公司', '13800138001'),
    ('dealer002', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FRnFJ4v0lWfK4e',
     '李总监', 2, '深圳科创贸易商行', '13800138002')

ON CONFLICT DO NOTHING

-- 插入示例商品
INSERT INTO products (category_id, name, sku, spec, unit, min_order_qty, image_url) VALUES
    (1, 'STM32F103C8T6 单片机', 'IC-STM32-001', 'ARM Cortex-M3, 72MHz, 64KB Flash', '个', 10, '/images/ic_stm32.jpg'),
    (1, 'LM358 双运放', 'IC-LM358-001', 'SOIC-8封装，通用运算放大器', '个', 50, '/images/ic_lm358.jpg'),
    (1, 'AMS1117-3.3 稳压芯片', 'IC-AMS1117-001', '3.3V LDO，1A输出', '个', 100, '/images/ic_ams1117.jpg'),
    (2, 'Type-C 母座 16P', 'CON-TYPEC-001', 'SMD贴片，16Pin，带定位柱', '个', 100, '/images/con_typec.jpg'),
    (2, '2.54mm 排针 1x40P', 'HDR-2.54-001', '单排针，直脚，1x40P', '条', 10, '/images/hdr_254.jpg'),
    (3, '焊锡丝 63/37 0.8mm', 'SOL-6337-001', '无铅焊锡丝，100g/卷', '卷', 5, '/images/sol_6337.jpg'),
    (3, 'IPA 异丙醇 500ml', 'CHE-IPA-001', '电子级IPA，清洁用', '瓶', 10, '/images/che_ipa.jpg')

ON CONFLICT DO NOTHING

-- 插入基准价
INSERT INTO product_prices (product_id, list_price, cost_price) VALUES
    (1, 12.50, 8.00),
    (2, 0.35, 0.20),
    (3, 0.45, 0.25),
    (4, 1.80, 1.10),
    (5, 0.80, 0.40),
    (6, 15.00, 10.00),
    (7, 8.50, 5.50)

ON CONFLICT DO NOTHING

-- 插入库存（默认仓库）
INSERT INTO inventory (product_id, warehouse_id, quantity, safe_stock)
SELECT p.id, w.id,
    CASE p.sku
        WHEN 'IC-STM32-001' THEN 500
        WHEN 'IC-LM358-001' THEN 10000
        WHEN 'IC-AMS1117-001' THEN 8000
        WHEN 'CON-TYPEC-001' THEN 3000
        WHEN 'HDR-2.54-001' THEN 5000
        WHEN 'SOL-6337-001' THEN 200
        WHEN 'CHE-IPA-001' THEN 500
    END,
    CASE p.sku
        WHEN 'IC-STM32-001' THEN 50
        WHEN 'IC-LM358-001' THEN 1000
        WHEN 'IC-AMS1117-001' THEN 800
        WHEN 'CON-TYPEC-001' THEN 300
        WHEN 'HDR-2.54-001' THEN 500
        WHEN 'SOL-6337-001' THEN 20
        WHEN 'CHE-IPA-001' THEN 50
    END
FROM products p
CROSS JOIN warehouses w
WHERE w.is_default = TRUE
ON CONFLICT DO NOTHING

-- 插入阶梯价格示例（金牌价、银牌价）
INSERT INTO tiered_pricing (product_id, dealer_tier_id, min_qty, max_qty, price)
SELECT p.id, dt.id,
    v.min_qty, v.max_qty,
    pp.list_price * dt.discount_rate * v.tier_discount
FROM products p
CROSS JOIN dealer_tiers dt
CROSS JOIN (VALUES
    (1, 10, NULL, 0.95),   -- 10个以上，额外95折
    (11, 100, NULL, 0.90), -- 100个以上，额外9折
    (101, NULL, NULL, 0.85) -- 通用阶梯：100个以上，额外85折
) v(min_qty, max_qty, tier_discount)
JOIN product_prices pp ON pp.product_id = p.id
WHERE dt.name IN ('金牌','银牌')
ON CONFLICT DO NOTHING

-- 更新 sequence 起始值（避免 ID 冲突）
SELECT setval('dealer_tiers_id_seq', (SELECT MAX(id) FROM dealer_tiers));
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));
SELECT setval('warehouses_id_seq', (SELECT MAX(id) FROM warehouses));

COMMENT ON TABLE dealer_tiers IS '经销商等级表';
COMMENT ON TABLE users IS '用户表（经销商账号）';
COMMENT ON TABLE products IS '商品表（SPU）';
COMMENT ON TABLE inventory IS '库存表';
COMMENT ON TABLE product_prices IS '商品基准价';
COMMENT ON TABLE dealer_prices IS '经销商专属价（覆盖基准价）';
COMMENT ON TABLE tiered_pricing IS '阶梯价格';
COMMENT ON TABLE orders IS '订单主表';
COMMENT ON TABLE order_items IS '订单明细';
COMMENT ON TABLE order_status_log IS '订单状态时间线';
COMMENT ON TABLE cart_items IS '购物车';
COMMENT ON TABLE favorites IS '收藏';
COMMENT ON TABLE purchase_history IS '历史采购记录';
COMMENT ON TABLE reconciliation IS '对账单';
