-- 基础表
CREATE TABLE IF NOT EXISTS dealer_tiers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    discount_rate DECIMAL(5,2) DEFAULT 1.00,
    credit_limit DECIMAL(12,2) DEFAULT 0,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    dealer_tier_id INT REFERENCES dealer_tiers(id),
    company_name VARCHAR(200),
    phone VARCHAR(20),
    email VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','frozen')),
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warehouses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255),
    contact_phone VARCHAR(20),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    parent_id INT REFERENCES categories(id),
    name VARCHAR(100) NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    category_id INT REFERENCES categories(id),
    name VARCHAR(200) NOT NULL,
    sku VARCHAR(50) NOT NULL UNIQUE,
    spec VARCHAR(255),
    unit VARCHAR(20) DEFAULT '件',
    min_order_qty INT DEFAULT 1,
    image_url VARCHAR(500),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id) NOT NULL,
    warehouse_id INT REFERENCES warehouses(id) NOT NULL,
    quantity INT DEFAULT 0,
    reserved_qty INT DEFAULT 0,
    safe_stock INT DEFAULT 10,
    last_sync_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS product_prices (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id) NOT NULL,
    list_price DECIMAL(12,2) NOT NULL,
    cost_price DECIMAL(12,2),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id)
);

CREATE TABLE IF NOT EXISTS dealer_prices (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id) NOT NULL,
    user_id INT REFERENCES users(id) NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, user_id)
);

CREATE TABLE IF NOT EXISTS tiered_pricing (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id) NOT NULL,
    dealer_tier_id INT REFERENCES dealer_tiers(id),
    min_qty INT NOT NULL,
    max_qty INT,
    price DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 业务表
CREATE TABLE IF NOT EXISTS cart_items (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) NOT NULL,
    product_id INT REFERENCES products(id) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS favorites (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) NOT NULL,
    product_id INT REFERENCES products(id) NOT NULL,
    price_threshold DECIMAL(12,2),
    notify_on_stock BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS favorite_notifications (
    id SERIAL PRIMARY KEY,
    favorite_id INT REFERENCES favorites(id) NOT NULL,
    notify_type VARCHAR(20) CHECK (notify_type IN ('stock_back','price_drop')),
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_no VARCHAR(30) NOT NULL UNIQUE,
    user_id INT REFERENCES users(id) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending','confirmed','processing','shipped','completed','cancelled','rejected')),
    total_amount DECIMAL(12,2) NOT NULL,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    net_amount DECIMAL(12,2) NOT NULL,
    warehouse_id INT REFERENCES warehouses(id),
    remark TEXT,
    rejection_reason TEXT,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) NOT NULL,
    product_id INT REFERENCES products(id) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    quantity INT NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    delivered_qty INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS order_status_log (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) NOT NULL,
    status VARCHAR(20) NOT NULL,
    operator VARCHAR(100),
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_history (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) NOT NULL,
    order_id INT REFERENCES orders(id) NOT NULL,
    total_items INT,
    total_amount DECIMAL(12,2),
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reconciliation (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) NOT NULL,
    period VARCHAR(7) NOT NULL,
    total_orders INT DEFAULT 0,
    total_amount DECIMAL(12,2) DEFAULT 0,
    total_paid DECIMAL(12,2) DEFAULT 0,
    outstanding_amount DECIMAL(12,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending','confirmed','disputed','settled')),
    dispute_reason TEXT,
    confirmed_at TIMESTAMP,
    settled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, period)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON inventory(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_no ON orders(order_no);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_order_status_log_order ON order_status_log(order_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_user ON reconciliation(user_id);

-- 初始化数据
INSERT INTO warehouses (name, address, is_default) VALUES
    ('华东仓', '上海市浦东新区XX路100号', TRUE),
    ('华南仓', '广州市白云区XX路50号', FALSE),
    ('华北仓', '北京市朝阳区XX路80号', FALSE)
ON CONFLICT DO NOTHING;

INSERT INTO categories (name, parent_id) VALUES
    ('电子元器件', NULL),
    ('结构件', NULL),
    ('辅料耗材', NULL)
ON CONFLICT DO NOTHING;

INSERT INTO dealer_tiers (name, discount_rate, credit_limit, sort_order) VALUES
    ('金牌', 0.80, 1000000, 1),
    ('银牌', 0.85, 500000, 2),
    ('铜牌', 0.90, 200000, 3),
    ('普通', 1.00, 50000, 4)
ON CONFLICT DO NOTHING;

-- 先创建经销商
INSERT INTO dealers (id, name, contact_name, contact_phone, region, dealer_tier_id, credit_limit, status) VALUES
    (1, '华强北电子有限公司', '张经理', '13800138001', '华南', 1, 1000000, 'active'),
    (2, '深圳科创贸易商行', '李总监', '13800138002', '华南', 2, 500000, 'active'),
    (3, '广州电子批发市场', '王老板', '13800138003', '华南', 3, 200000, 'active')
ON CONFLICT DO NOTHING;

-- 再创建经销商用户（dealer_id 关联到 dealers 表）
INSERT INTO users (id, username, password_hash, full_name, dealer_id, dealer_tier_id, company_name, phone) VALUES
    (1, 'dealer001', '$2b$12$NHnq.lgTA/ueoGR.WqbAKumH3IFtJm.CsHh90OHicSynWenBE1Y6C', '张经理', 1, 1, '华强北电子有限公司', '13800138001'),
    (2, 'dealer002', '$2b$12$NHnq.lgTA/ueoGR.WqbAKumH3IFtJm.CsHh90OHicSynWenBE1Y6C', '李总监', 2, 2, '深圳科创贸易商行', '13800138002'),
    (3, 'dealer003', '$2b$12$NHnq.lgTA/ueoGR.WqbAKumH3IFtJm.CsHh90OHicSynWenBE1Y6C', '王老板', 3, 3, '广州电子批发市场', '13800138003')
ON CONFLICT DO NOTHING;

INSERT INTO products (category_id, name, sku, spec, unit, min_order_qty, image_url) VALUES
    (1, 'STM32F103C8T6 单片机', 'IC-STM32-001', 'ARM Cortex-M3, 72MHz, 64KB Flash', '个', 10, '/images/ic_stm32.jpg'),
    (1, 'LM358 双运放', 'IC-LM358-001', 'SOIC-8封装，通用运算放大器', '个', 50, '/images/ic_lm358.jpg'),
    (1, 'AMS1117-3.3 稳压芯片', 'IC-AMS1117-001', '3.3V LDO，1A输出', '个', 100, '/images/ic_ams1117.jpg'),
    (2, 'Type-C 母座 16P', 'CON-TYPEC-001', 'SMD贴片，16Pin，带定位柱', '个', 100, '/images/con_typec.jpg'),
    (2, '2.54mm 排针 1x40P', 'HDR-2.54-001', '单排针，直脚，1x40P', '条', 10, '/images/hdr_254.jpg'),
    (3, '焊锡丝 63/37 0.8mm', 'SOL-6337-001', '无铅焊锡丝，100g/卷', '卷', 5, '/images/sol_6337.jpg'),
    (3, 'IPA 异丙醇 500ml', 'CHE-IPA-001', '电子级IPA，清洁用', '瓶', 10, '/images/che_ipa.jpg')
ON CONFLICT DO NOTHING;

INSERT INTO product_prices (product_id, list_price, cost_price) VALUES
    (1, 12.50, 8.00),
    (2, 0.35, 0.20),
    (3, 0.45, 0.25),
    (4, 1.80, 1.10),
    (5, 0.80, 0.40),
    (6, 15.00, 10.00),
    (7, 8.50, 5.50)
ON CONFLICT DO NOTHING;

INSERT INTO inventory (product_id, warehouse_id, quantity, safe_stock)
SELECT p.id, w.id, 1000, 100
FROM products p
CROSS JOIN warehouses w
WHERE w.is_default = TRUE
ON CONFLICT DO NOTHING;

SELECT setval('dealer_tiers_id_seq', (SELECT MAX(id) FROM dealer_tiers));
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));
SELECT setval('warehouses_id_seq', (SELECT MAX(id) FROM warehouses));
