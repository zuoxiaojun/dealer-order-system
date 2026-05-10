# app/models/product.py
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, DECIMAL, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    parent_id = Column(Integer, ForeignKey("categories.id"))
    name = Column(String(100), nullable=False)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())

    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"))
    name = Column(String(200), nullable=False)
    sku = Column(String(50), unique=True, nullable=False, index=True)
    spec = Column(String(255))
    unit = Column(String(20), default="件")
    min_order_qty = Column(Integer, default=1)
    image_url = Column(String(500))
    description = Column(Text)
    status = Column(String(20), default="disabled")  # active/inactive/disabled/deleted
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    category = relationship("Category", back_populates="products")
    inventory = relationship("Inventory", back_populates="product", cascade="all, delete-orphan")
    price = relationship("ProductPrice", back_populates="product", uselist=False, cascade="all, delete-orphan")
    dealer_prices = relationship("DealerPrice", back_populates="product")
    cart_items = relationship("CartItem", back_populates="product")
    favorites = relationship("Favorite", back_populates="product")
    order_items = relationship("OrderItem", back_populates="product")
    tiered_pricing = relationship("TieredPricing", back_populates="product")


class Warehouse(Base):
    __tablename__ = "warehouses"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    address = Column(String(255))
    contact_phone = Column(String(20))
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())

    inventory = relationship("Inventory", back_populates="warehouse")
    orders = relationship("Order", back_populates="warehouse")


class Inventory(Base):
    __tablename__ = "inventory"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    quantity = Column(Integer, default=0)
    reserved_qty = Column(Integer, default=0)
    safe_stock = Column(Integer, default=10)
    last_sync_at = Column(DateTime)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    product = relationship("Product", back_populates="inventory")
    warehouse = relationship("Warehouse", back_populates="inventory")


class ProductPrice(Base):
    __tablename__ = "product_prices"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), unique=True, nullable=False)
    list_price = Column(DECIMAL(12,2), nullable=False)
    cost_price = Column(DECIMAL(12,2))
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    product = relationship("Product", back_populates="price")
    # Note: dealer_prices relationship is on Product, not ProductPrice
    # (dealer_prices table FK points to products, not product_prices)


class DealerPrice(Base):
    __tablename__ = "dealer_prices"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    price = Column(DECIMAL(12,2), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    product = relationship("Product", back_populates="dealer_prices")
    user = relationship("User")


class TieredPricing(Base):
    __tablename__ = "tiered_pricing"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    dealer_tier_id = Column(Integer, ForeignKey("dealer_tiers.id"))
    min_qty = Column(Integer, nullable=False)
    max_qty = Column(Integer)
    price = Column(DECIMAL(12,2), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    product = relationship("Product", back_populates="tiered_pricing")
    dealer_tier = relationship("DealerTier")
