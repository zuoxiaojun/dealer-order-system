# app/api/cart.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.product import Product, ProductPrice, DealerPrice
from app.models.order import CartItem

router = APIRouter()


class AddCartRequest(BaseModel):
    product_id: int
    quantity: int


class UpdateCartRequest(BaseModel):
    quantity: int


class CartItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    sku: str
    unit: str
    image_url: Optional[str]
    quantity: int
    unit_price: float  # 经销商专属价
    subtotal: float

    class Config:
        from_attributes = True


class CartResponse(BaseModel):
    items: list[CartItemResponse]
    total_amount: float
    item_count: int


async def get_dealer_price(db: AsyncSession, user_id: int, product_id: int) -> float:
    """获取经销商专属价（优先专属价，否则用标价）"""
    dealer_price_result = await db.execute(
        select(DealerPrice).where(DealerPrice.product_id == product_id, DealerPrice.user_id == user_id)
    )
    dealer_price = dealer_price_result.scalar_one_or_none()
    if dealer_price:
        return float(dealer_price.price)

    price_result = await db.execute(select(ProductPrice).where(ProductPrice.product_id == product_id))
    price = price_result.scalar_one_or_none()
    return float(price.list_price) if price else 0.0


@router.get("", response_model=CartResponse)
async def get_cart(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取购物车"""
    result = await db.execute(
        select(CartItem)
        .options(selectinload(CartItem.product))
        .where(CartItem.user_id == current_user.id)
    )
    items = result.scalars().all()

    cart_items = []
    total = 0.0
    for item in items:
        unit_price = await get_dealer_price(db, current_user.id, item.product_id)
        subtotal = unit_price * item.quantity
        total += subtotal
        cart_items.append(CartItemResponse(
            id=item.id,
            product_id=item.product_id,
            product_name=item.product.name,
            sku=item.product.sku,
            unit=item.product.unit,
            image_url=item.product.image_url,
            quantity=item.quantity,
            unit_price=unit_price,
            subtotal=subtotal,
        ))

    return CartResponse(items=cart_items, total_amount=round(total, 2), item_count=len(cart_items))


@router.post("/items", response_model=CartItemResponse)
async def add_to_cart(
    req: AddCartRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """添加商品到购物车"""
    # 检查商品是否存在
    product_result = await db.execute(select(Product).where(Product.id == req.product_id, Product.is_active == True))
    product = product_result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")

    if req.quantity < product.min_order_qty:
        raise HTTPException(status_code=400, detail=f"最小起订量 {product.min_order_qty}")

    # 检查购物车是否已有
    existing = await db.execute(
        select(CartItem).where(
            CartItem.user_id == current_user.id, CartItem.product_id == req.product_id
        )
    )
    existing_item = existing.scalar_one_or_none()

    if existing_item:
        existing_item.quantity += req.quantity
        await db.commit()
        item = existing_item
    else:
        item = CartItem(user_id=current_user.id, product_id=req.product_id, quantity=req.quantity)
        db.add(item)
        await db.commit()
        await db.refresh(item)

    unit_price = await get_dealer_price(db, current_user.id, req.product_id)
    return CartItemResponse(
        id=item.id,
        product_id=item.product_id,
        product_name=product.name,
        sku=product.sku,
        unit=product.unit,
        image_url=product.image_url,
        quantity=item.quantity,
        unit_price=unit_price,
        subtotal=round(unit_price * item.quantity, 2),
    )


@router.put("/items/{item_id}", response_model=CartItemResponse)
async def update_cart_item(
    item_id: int,
    req: UpdateCartRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新购物车商品数量"""
    result = await db.execute(
        select(CartItem)
        .options(selectinload(CartItem.product))
        .where(CartItem.id == item_id, CartItem.user_id == current_user.id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="购物车项不存在")

    if req.quantity < item.product.min_order_qty:
        raise HTTPException(status_code=400, detail=f"最小起订量 {item.product.min_order_qty}")

    item.quantity = req.quantity
    await db.commit()
    await db.refresh(item)

    unit_price = await get_dealer_price(db, current_user.id, item.product_id)
    return CartItemResponse(
        id=item.id,
        product_id=item.product_id,
        product_name=item.product.name,
        sku=item.product.sku,
        unit=item.product.unit,
        image_url=item.product.image_url,
        quantity=item.quantity,
        unit_price=unit_price,
        subtotal=round(unit_price * item.quantity, 2),
    )


@router.delete("/items/{item_id}")
async def remove_cart_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除购物车商品"""
    result = await db.execute(
        select(CartItem).where(CartItem.id == item_id, CartItem.user_id == current_user.id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="购物车项不存在")

    await db.delete(item)
    await db.commit()
    return {"ok": True}


@router.delete("")
async def clear_cart(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """清空购物车"""
    await db.execute(
        select(CartItem).where(CartItem.user_id == current_user.id)
    )
    result = await db.execute(
        select(CartItem).where(CartItem.user_id == current_user.id)
    )
    items = result.scalars().all()
    for item in items:
        await db.delete(item)
    await db.commit()
    return {"ok": True}
