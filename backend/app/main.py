# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.api import auth, products, cart, orders, favorites, reorder, reconciliation
from app.api import admin, admin_orders, admin_products, admin_dealers


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时执行（如连接池预热）
    yield
    # 关闭时执行（如资源清理）


app = FastAPI(
    title="经销商订货系统 API",
    version="1.0.0",
    description="DMS - Dealer Management System",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],  # 前端地址
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
app.include_router(products.router, prefix="/api/products", tags=["商品"])
app.include_router(cart.router, prefix="/api/cart", tags=["购物车"])
app.include_router(orders.router, prefix="/api/orders", tags=["订单"])
app.include_router(favorites.router, prefix="/api/favorites", tags=["收藏"])
app.include_router(reorder.router, prefix="/api/reorders", tags=["快速复购"])
app.include_router(reconciliation.router, prefix="/api/reconciliation", tags=["对账"])

# 管理端路由
app.include_router(admin.router, prefix="/api/admin/auth", tags=["管理端认证"])
app.include_router(admin_orders.router, prefix="/api/admin", tags=["管理端订单"])
app.include_router(admin_products.router, prefix="/api/admin", tags=["管理端商品"])
app.include_router(admin_dealers.router, prefix="/api/admin", tags=["管理端经销商"])


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "dealer-order-api"}
