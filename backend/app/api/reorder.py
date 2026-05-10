# app/api/reorder.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.order import Order, OrderItem, PurchaseHistory

router = APIRouter()


class HistoryOrderItem(BaseModel):
    product_id: int
    product_name: str
    sku: str
    quantity: int
    unit_price: float


class HistoryOrder(BaseModel):
    id: int
    order_id: int
    order_no: str
    completed_at: Optional[str]
    total_items: int
    total_amount: float
    items: list[HistoryOrderItem]

    class Config:
        from_attributes = True


class HistoryListResponse(BaseModel):
    items: list[HistoryOrderItem]  # 简化的历史订单列表


@router.get("/history", response_model=list[HistoryOrderItem])
async def list_history_orders(
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """历史订单列表（用于快速复购），返回最近N个已完成订单"""
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items).selectinload(OrderItem.product))
        .where(
            Order.user_id == current_user.id,
            Order.status == "completed",
        )
        .order_by(Order.delivered_at.desc())
        .limit(limit)
    )
    orders = result.scalars().all()

    history_items = []
    for order in orders:
        for item in order.items:
            history_items.append(HistoryOrderItem(
                product_id=item.product_id,
                product_name=item.product.name,
                sku=item.product.sku,
                quantity=item.quantity,
                unit_price=float(item.unit_price),
            ))

    return history_items


@router.post("/reorder")
async def reorder_from_history(
    order_ids: list[int],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """一键复购：传入历史订单ID列表，返回可加入购物车的商品列表（实际加入购物车由前端调用购物车接口）"""
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items).selectinload(OrderItem.product))
        .where(
            Order.id.in_(order_ids),
            Order.user_id == current_user.id,
        )
    )
    orders = result.scalars().all()
    if not orders:
        raise HTTPException(status_code=404, detail="未找到相关历史订单")

    # 合并所有订单的商品（同商品合并数量）
    product_map = {}
    for order in orders:
        for item in order.items:
            key = item.product_id
            if key in product_map:
                product_map[key]["quantity"] += item.quantity
            else:
                product_map[key] = {
                    "product_id": item.product_id,
                    "product_name": item.product.name,
                    "sku": item.product.sku,
                    "unit": item.product.unit,
                    "quantity": item.quantity,
                    "unit_price": float(item.unit_price),
                }

    return {"items": list(product_map.values()), "source_orders": [o.order_no for o in orders]}
