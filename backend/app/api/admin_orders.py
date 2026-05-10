# app/api/admin_orders.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import Optional
from app.core.database import get_db
from app.core.security import get_current_admin
from app.models.user import Admin, User, Dealer
from app.models.product import Product, Warehouse
from app.models.order import Order, OrderItem, OrderStatusLog

router = APIRouter()


class OrderItemAdminResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    sku: str
    unit_price: float
    quantity: int
    subtotal: float

    class Config:
        from_attributes = True


class OrderStatusStep(BaseModel):
    status: str
    label: str
    time: Optional[datetime]
    note: Optional[str]


class OrderAdminResponse(BaseModel):
    id: int
    order_no: str
    user_id: int
    dealer_id: int
    dealer_name: str
    user_name: str
    status: str
    total_amount: float
    discount_amount: float
    net_amount: float
    warehouse_name: Optional[str]
    remark: Optional[str]
    rejection_reason: Optional[str]
    items: list[OrderItemAdminResponse]
    status_timeline: list[OrderStatusStep]
    created_at: datetime

    class Config:
        from_attributes = True


class OrderListItem(BaseModel):
    id: int
    order_no: str
    dealer_name: str
    user_name: str
    status: str
    net_amount: float
    total_items: int
    created_at: datetime

    class Config:
        from_attributes = True


class OrderListResponse(BaseModel):
    items: list[OrderListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class UpdateOrderStatusRequest(BaseModel):
    status: str
    note: Optional[str] = None


class OrderReviewRequest(BaseModel):
    action: str  # confirm, reject
    note: Optional[str] = None


STATUS_LABELS = {
    "pending": "待审核",
    "confirmed": "已确认",
    "processing": "处理中",
    "shipped": "已发货",
    "completed": "已完成",
    "cancelled": "已取消",
    "rejected": "已拒绝",
}


@router.get("/orders", response_model=OrderListResponse)
async def admin_list_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    dealer_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(Order).options(
        selectinload(Order.user).selectinload(User.dealer),
        selectinload(Order.items),
    )

    if status:
        query = query.where(Order.status == status)
    if dealer_id:
        query = query.where(Order.dealer_id == dealer_id)
    if start_date:
        query = query.where(Order.created_at >= start_date)
    if end_date:
        query = query.where(Order.created_at <= end_date)
    if search:
        query = query.where(
            or_(
                Order.order_no.ilike(f"%{search}%"),
                Order.user.has(User.full_name.ilike(f"%{search}%")),
            )
        )

    query = query.order_by(Order.created_at.desc())

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    orders = result.scalars().all()

    items = [
        OrderListItem(
            id=o.id,
            order_no=o.order_no,
            dealer_name=o.user.dealer.name if o.user and o.user.dealer else "未知",
            user_name=o.user.full_name if o.user else "未知",
            status=o.status,
            net_amount=float(o.net_amount),
            total_items=len(o.items),
            created_at=o.created_at,
        )
        for o in orders
    ]

    total_pages = (total + page_size - 1) // page_size
    return OrderListResponse(items=items, total=total, page=page, page_size=page_size, total_pages=total_pages)


@router.get("/orders/{order_id}", response_model=OrderAdminResponse)
async def admin_get_order(
    order_id: int,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.user).selectinload(User.dealer),
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.warehouse),
            selectinload(Order.status_logs),
        )
        .where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")

    items = [
        OrderItemAdminResponse(
            id=item.id,
            product_id=item.product_id,
            product_name=item.product.name,
            sku=item.product.sku,
            unit_price=float(item.unit_price),
            quantity=item.quantity,
            subtotal=float(item.subtotal),
        )
        for item in order.items
    ]

    timeline = [
        OrderStatusStep(
            status=log.status,
            label=STATUS_LABELS.get(log.status, log.status),
            time=log.created_at,
            note=log.note,
        )
        for log in sorted(order.status_logs, key=lambda x: x.created_at)
    ]

    return OrderAdminResponse(
        id=order.id,
        order_no=order.order_no,
        user_id=order.user_id,
        dealer_id=order.dealer_id or 0,
        dealer_name=order.user.dealer.name if order.user and order.user.dealer else "未知",
        user_name=order.user.full_name if order.user else "未知",
        status=order.status,
        total_amount=float(order.total_amount),
        discount_amount=float(order.discount_amount),
        net_amount=float(order.net_amount),
        warehouse_name=order.warehouse.name if order.warehouse else None,
        remark=order.remark,
        rejection_reason=order.rejection_reason,
        items=items,
        status_timeline=timeline,
        created_at=order.created_at,
    )


@router.post("/orders/{order_id}/review")
async def admin_review_order(
    order_id: int,
    req: OrderReviewRequest,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")

    if order.status != "pending":
        raise HTTPException(status_code=400, detail="只能审核待处理的订单")

    if req.action == "confirm":
        order.status = "confirmed"
        note = "审核通过"
    elif req.action == "reject":
        order.status = "rejected"
        note = req.note or "订单被拒绝"
        order.rejection_reason = note
    else:
        raise HTTPException(status_code=400, detail="无效的操作")

    status_log = OrderStatusLog(
        order_id=order.id,
        status=order.status,
        operator=current_admin.full_name,
        note=note,
    )
    db.add(status_log)
    await db.commit()

    return {"ok": True, "status": order.status}


@router.post("/orders/{order_id}/status")
async def admin_update_order_status(
    order_id: int,
    req: UpdateOrderStatusRequest,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")

    order.status = req.status
    status_log = OrderStatusLog(
        order_id=order.id,
        status=req.status,
        operator=current_admin.full_name,
        note=req.note,
    )
    db.add(status_log)
    await db.commit()

    return {"ok": True}


@router.get("/stats")
async def admin_get_stats(
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    today = datetime.now().date()
    start_of_day = datetime.combine(today, datetime.min.time())
    start_of_month = datetime.combine(today.replace(day=1), datetime.min.time())

    pending_result = await db.execute(
        select(func.count(Order.id)).where(Order.status == "pending")
    )
    pending_count = pending_result.scalar() or 0

    today_result = await db.execute(
        select(func.count(Order.id), func.sum(Order.net_amount))
        .where(Order.created_at >= start_of_day)
    )
    today_data = today_result.one()
    today_orders = today_data[0] or 0
    today_amount = float(today_data[1] or 0)

    month_result = await db.execute(
        select(func.count(Order.id), func.sum(Order.net_amount))
        .where(Order.created_at >= start_of_month)
    )
    month_data = month_result.one()
    month_orders = month_data[0] or 0
    month_amount = float(month_data[1] or 0)

    return {
        "pending_orders": pending_count,
        "today_orders": today_orders,
        "today_amount": round(today_amount, 2),
        "month_orders": month_orders,
        "month_amount": round(month_amount, 2),
    }