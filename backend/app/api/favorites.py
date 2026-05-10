# app/api/favorites.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.product import Product, ProductPrice, DealerPrice, Inventory
from app.models.order import Favorite, FavoriteNotification

router = APIRouter()


class FavoriteItem(BaseModel):
    id: int
    product_id: int
    product_name: str
    sku: str
    spec: Optional[str]
    unit: str
    image_url: Optional[str]
    your_price: Optional[float]
    stock_status: str
    available_qty: int
    price_threshold: Optional[float]
    created_at: str

    class Config:
        from_attributes = True


class FavoriteListResponse(BaseModel):
    items: list[FavoriteItem]
    total: int


class AddFavoriteRequest(BaseModel):
    product_id: int
    price_threshold: Optional[float] = None
    notify_on_stock: bool = True


async def get_price_and_stock(db: AsyncSession, user_id: int, product_id: int):
    # 价格
    dp_result = await db.execute(
        select(DealerPrice).where(DealerPrice.product_id == product_id, DealerPrice.user_id == user_id)
    )
    dp = dp_result.scalar_one_or_none()
    if dp:
        price = float(dp.price)
    else:
        pp_result = await db.execute(select(ProductPrice).where(ProductPrice.product_id == product_id))
        pp = pp_result.scalar_one_or_none()
        price = float(pp.list_price) if pp else None

    # 库存
    inv_result = await db.execute(select(Inventory).where(Inventory.product_id == product_id))
    inv = inv_result.scalars().first()
    if inv:
        avail = inv.quantity - inv.reserved_qty
        if avail <= 0:
            status = "out_of_stock"
        elif avail <= inv.safe_stock:
            status = "low_stock"
        else:
            status = "in_stock"
    else:
        avail = 0
        status = "out_of_stock"

    return price, avail, status


@router.get("", response_model=FavoriteListResponse)
async def list_favorites(
    stock_filter: str = Query(None),  # in_stock / low_stock / out_of_stock / all
    sort_by: str = Query("recent"),  # recent / price_asc / price_desc
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """我的收藏列表"""
    query = select(Favorite).where(Favorite.user_id == current_user.id)
    if sort_by == "recent":
        query = query.order_by(Favorite.created_at.desc())

    result = await db.execute(query.options(selectinload(Favorite.product)))
    favorites = result.scalars().all()

    items = []
    for fav in favorites:
        p = fav.product
        price, avail, status = await get_price_and_stock(db, current_user.id, p.id)

        if stock_filter and stock_filter != "all" and status != stock_filter:
            continue

        items.append(FavoriteItem(
            id=fav.id,
            product_id=p.id,
            product_name=p.name,
            sku=p.sku,
            spec=p.spec,
            unit=p.unit,
            image_url=p.image_url,
            your_price=price,
            stock_status=status,
            available_qty=max(0, avail),
            price_threshold=float(fav.price_threshold) if fav.price_threshold else None,
            created_at=fav.created_at.isoformat() if fav.created_at else None,
        ))

    return FavoriteListResponse(items=items, total=len(items))


@router.post("", response_model=FavoriteItem)
async def add_favorite(
    req: AddFavoriteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """添加收藏"""
    product_result = await db.execute(
        select(Product).where(Product.id == req.product_id, Product.is_active == True)
    )
    product = product_result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")

    # 检查是否已收藏
    existing = await db.execute(
        select(Favorite).where(
            Favorite.user_id == current_user.id, Favorite.product_id == req.product_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="已收藏该商品")

    fav = Favorite(
        user_id=current_user.id,
        product_id=req.product_id,
        price_threshold=req.price_threshold,
        notify_on_stock=req.notify_on_stock,
    )
    db.add(fav)
    await db.commit()
    await db.refresh(fav)

    price, avail, status = await get_price_and_stock(db, current_user.id, req.product_id)

    return FavoriteItem(
        id=fav.id,
        product_id=product.id,
        product_name=product.name,
        sku=product.sku,
        spec=product.spec,
        unit=product.unit,
        image_url=product.image_url,
        your_price=price,
        stock_status=status,
        available_qty=max(0, avail),
        price_threshold=float(fav.price_threshold) if fav.price_threshold else None,
        created_at=fav.created_at.isoformat() if fav.created_at else None,
    )


@router.delete("/{product_id}")
async def remove_favorite(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """取消收藏"""
    result = await db.execute(
        select(Favorite).where(
            Favorite.user_id == current_user.id, Favorite.product_id == product_id
        )
    )
    fav = result.scalar_one_or_none()
    if not fav:
        raise HTTPException(status_code=404, detail="未收藏该商品")

    await db.delete(fav)
    await db.commit()
    return {"ok": True}
