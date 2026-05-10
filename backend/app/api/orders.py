# app/api/orders.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.product import Product, ProductPrice, DealerPrice, Inventory, Warehouse
from app.models.order import Order, OrderItem, OrderStatusLog, CartItem, PurchaseHistory

router = APIRouter()


class OrderItemCreate(BaseModel):
    cart_item_id: int
    product_id: int
    quantity: int


class CreateOrderRequest(BaseModel):
    items: list[OrderItemCreate]
    remark: Optional[str] = None


class OrderItemResponse(BaseModel):
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


class OrderResponse(BaseModel):
    id: int
    order_no: str
    status: str
    total_amount: float
    discount_amount: float
    net_amount: float
    warehouse_name: Optional[str]
    remark: Optional[str]
    rejection_reason: Optional[str]
    items: list[OrderItemResponse]
    status_timeline: list[OrderStatusStep]
    created_at: datetime

    class Config:
        from_attributes = True


class OrderListItem(BaseModel):
    id: int
    order_no: str
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


STATUS_LABELS = {
    "pending": "待审核",
    "confirmed": "已确认",
    "processing": "处理中",
    "shipped": "已发货",
    "completed": "已完成",
    "cancelled": "已取消",
    "rejected": "已拒绝",
}


async def get_dealer_price(db: AsyncSession, user_id: int, product_id: int) -> float:
    dealer_price_result = await db.execute(
        select(DealerPrice).where(DealerPrice.product_id == product_id, DealerPrice.user_id == user_id)
    )
    dealer_price = dealer_price_result.scalar_one_or_none()
    if dealer_price:
        return float(dealer_price.price)
    price_result = await db.execute(select(ProductPrice).where(ProductPrice.product_id == product_id))
    price = price_result.scalar_one_or_none()
    return float(price.list_price) if price else 0.0


def generate_order_no() -> str:
    now = datetime.now()
    return f"DD{now.strftime('%Y%m%d')}{now.strftime('%H%M%S')}"


@router.post("", response_model=OrderResponse)
async def create_order(
    req: CreateOrderRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """提交订单"""
    if not req.items:
        raise HTTPException(status_code=400, detail="订单商品不能为空")

    # 获取默认仓库
    warehouse_result = await db.execute(
        select(Warehouse.id).where(Warehouse.is_default == True).limit(1)
    )
    warehouse_id = warehouse_result.scalar()

    total_amount = 0.0
    order_items = []

    for item in req.items:
        product_result = await db.execute(
            select(Product).where(Product.id == item.product_id, Product.is_active == True)
        )
        product = product_result.scalar_one_or_none()
        if not product:
            raise HTTPException(status_code=404, detail=f"商品 {item.product_id} 不存在")
        if item.quantity < product.min_order_qty:
            raise HTTPException(status_code=400, detail=f"{product.name} 最小起订量 {product.min_order_qty}")

        unit_price = await get_dealer_price(db, current_user.id, item.product_id)
        subtotal = unit_price * item.quantity
        total_amount += subtotal
        order_items.append({
            "product_id": item.product_id,
            "unit_price": unit_price,
            "quantity": item.quantity,
            "subtotal": round(subtotal, 2),
        })

    net_amount = round(total_amount, 2)

    # 生成订单号（简单实现，实际用雪花算法）
    order_no = generate_order_no()
    while True:
        existing = await db.execute(select(Order).where(Order.order_no == order_no))
        if not existing.scalar_one_or_none():
            break
        order_no = generate_order_no()

    # 创建订单
    order = Order(
        order_no=order_no,
        user_id=current_user.id,
        total_amount=round(total_amount, 2),
        discount_amount=0,
        net_amount=net_amount,
        warehouse_id=warehouse_id,
        remark=req.remark,
        status="pending",
    )
    db.add(order)
    await db.flush()

    # 创建订单明细
    for item_data in order_items:
        order_item = OrderItem(order_id=order.id, **item_data)
        db.add(order_item)

    # 记录状态日志
    status_log = OrderStatusLog(order_id=order.id, status="pending", note="订单已提交")
    db.add(status_log)

    # 清理已提交的购物车商品
    cart_item_ids = [item.cart_item_id for item in req.items]
    await db.execute(
        delete(CartItem).where(
            CartItem.user_id == current_user.id,
            CartItem.id.in_(cart_item_ids)
        )
    )
    await db.commit()
    await db.refresh(order)

    # 查询完整订单
    return await get_order_detail(order.id, current_user, db)


async def get_order_detail(order_id: int, user: User, db: AsyncSession) -> OrderResponse:
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items).selectinload(OrderItem.product))
        .options(selectinload(Order.warehouse))
        .options(selectinload(Order.status_logs))
        .where(Order.id == order_id, Order.user_id == user.id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")

    items = [
        OrderItemResponse(
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

    return OrderResponse(
        id=order.id,
        order_no=order.order_no,
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


@router.get("", response_model=OrderListResponse)
async def list_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """订单列表"""
    query = select(Order).where(Order.user_id == current_user.id)
    if status:
        query = query.where(Order.status == status)
    query = query.order_by(Order.created_at.desc())

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query.options(selectinload(Order.items)))
    orders = result.scalars().all()

    items = [
        OrderListItem(
            id=o.id,
            order_no=o.order_no,
            status=o.status,
            net_amount=float(o.net_amount),
            total_items=len(o.items),
            created_at=o.created_at,
        )
        for o in orders
    ]

    total_pages = (total + page_size - 1) // page_size
    return OrderListResponse(items=items, total=total, page=page, page_size=page_size, total_pages=total_pages)


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """订单详情"""
    return await get_order_detail(order_id, current_user, db)


@router.post("/{order_id}/cancel")
async def cancel_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """取消订单，商品退回购物车"""
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id == order_id, Order.user_id == current_user.id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")

    if order.status not in ("pending", "confirmed"):
        raise HTTPException(status_code=400, detail="该订单状态无法取消")

    # 退回购物车
    for item in order.items:
        existing = await db.execute(
            select(CartItem).where(
                CartItem.user_id == current_user.id, CartItem.product_id == item.product_id
            )
        )
        existing_cart = existing.scalar_one_or_none()
        if existing_cart:
            existing_cart.quantity += item.quantity
        else:
            cart_item = CartItem(user_id=current_user.id, product_id=item.product_id, quantity=item.quantity)
            db.add(cart_item)

    # 更新订单状态
    order.status = "cancelled"
    status_log = OrderStatusLog(order_id=order.id, status="cancelled", note="经销商取消订单")
    db.add(status_log)

    await db.commit()
    return {"ok": True}
