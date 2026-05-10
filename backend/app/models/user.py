# app/models/user.py
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, DECIMAL, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class DealerTier(Base):
    __tablename__ = "dealer_tiers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    discount_rate = Column(DECIMAL(5,2), default=1.00)
    credit_limit = Column(DECIMAL(12,2), default=0)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())

    users = relationship("User", back_populates="dealer_tier")
    dealers = relationship("Dealer", back_populates="dealer_tier")


class Dealer(Base):
    __tablename__ = "dealers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    contact_name = Column(String(100))
    contact_phone = Column(String(20))
    contact_email = Column(String(100))
    address = Column(String(500))
    region = Column(String(50))
    dealer_tier_id = Column(Integer, ForeignKey("dealer_tiers.id"))
    credit_limit = Column(DECIMAL(12,2), default=0)
    status = Column(String(20), default="active")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    dealer_tier = relationship("DealerTier", back_populates="dealers")
    users = relationship("User", back_populates="dealer")
    orders = relationship("Order", back_populates="dealer")


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    dealer_id = Column(Integer, ForeignKey("dealers.id"))
    dealer_tier_id = Column(Integer, ForeignKey("dealer_tiers.id"))
    company_name = Column(String(200))
    phone = Column(String(20))
    email = Column(String(100))
    role = Column(String(20), default="dealer_user")
    status = Column(String(20), default="active")
    last_login_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    dealer = relationship("Dealer", back_populates="users")
    dealer_tier = relationship("DealerTier", back_populates="users")
    cart_items = relationship("CartItem", back_populates="user", cascade="all, delete-orphan")
    favorites = relationship("Favorite", back_populates="user", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="user")
    purchase_history = relationship("PurchaseHistory", back_populates="user")
    reconciliation = relationship("Reconciliation", back_populates="user")


class Admin(Base):
    __tablename__ = "admins"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), default="order_manager")
    status = Column(String(20), default="active")
    last_login_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())