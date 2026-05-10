# app/models/order.py
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, DECIMAL, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(30), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    dealer_id = Column(Integer, ForeignKey("dealers.id"))
    status = Column(String(20), default="pending")
    total_amount = Column(DECIMAL(12,2), nullable=False)
    discount_amount = Column(DECIMAL(12,2), default=0)
    net_amount = Column(DECIMAL(12,2), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"))
    remark = Column(Text)
    rejection_reason = Column(Text)
    delivered_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now(), index=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="orders")
    dealer = relationship("Dealer", back_populates="orders")
    warehouse = relationship("Warehouse", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    status_logs = relationship("OrderStatusLog", back_populates="order", cascade="all, delete-orphan")
    purchase_history = relationship("PurchaseHistory", back_populates="order")


class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    unit_price = Column(DECIMAL(12,2), nullable=False)
    quantity = Column(Integer, nullable=False)
    subtotal = Column(DECIMAL(12,2), nullable=False)
    delivered_qty = Column(Integer, default=0)

    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")


class OrderStatusLog(Base):
    __tablename__ = "order_status_log"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    status = Column(String(20), nullable=False)
    operator = Column(String(100))
    note = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    order = relationship("Order", back_populates="status_logs")


class CartItem(Base):
    __tablename__ = "cart_items"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    added_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="cart_items")
    product = relationship("Product", back_populates="cart_items")


class Favorite(Base):
    __tablename__ = "favorites"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    price_threshold = Column(DECIMAL(12,2))
    notify_on_stock = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="favorites")
    product = relationship("Product", back_populates="favorites")
    notifications = relationship("FavoriteNotification", back_populates="favorite", cascade="all, delete-orphan")


class FavoriteNotification(Base):
    __tablename__ = "favorite_notifications"
    id = Column(Integer, primary_key=True, index=True)
    favorite_id = Column(Integer, ForeignKey("favorites.id"), nullable=False)
    notify_type = Column(String(20))  # stock_back, price_drop
    message = Column(Text)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())

    favorite = relationship("Favorite", back_populates="notifications")


class PurchaseHistory(Base):
    __tablename__ = "purchase_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    total_items = Column(Integer)
    total_amount = Column(DECIMAL(12,2))
    completed_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="purchase_history")
    order = relationship("Order", back_populates="purchase_history")


class Reconciliation(Base):
    __tablename__ = "reconciliation"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    period = Column(String(7), nullable=False)  # YYYY-MM
    total_orders = Column(Integer, default=0)
    total_amount = Column(DECIMAL(12,2), default=0)
    total_paid = Column(DECIMAL(12,2), default=0)
    outstanding_amount = Column(DECIMAL(12,2), default=0)
    status = Column(String(20), default="pending")
    dispute_reason = Column(Text)
    confirmed_at = Column(DateTime)
    settled_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="reconciliation")
