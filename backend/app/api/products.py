# app/api/products.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload, joinedload
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.product import Product, Category, Inventory, ProductPrice, DealerPrice, TieredPricing, Warehouse
from app.models.order import Favorite

router = APIRouter()


# --- 响应模型 ---
class CategoryTree(BaseModel):
    id: int
    name: str
    children: list = []

    class Config:
        from_attributes = True


class InventoryStatus(BaseModel):
    available: int
    status: str  # in_stock / low_stock / out_of_stock
    safe_stock: int


class ProductCardItem(BaseModel):
    id: int
    name: str
    sku: str
    spec: Optional[str]
    unit: str
    min_order_qty: int
    image_url: Optional[str]
    category_id: Optional[int]
    # 价格相关
    list_price: Optional[float]  # 标价
    your_price: Optional[float]  # 经销商专属价（最终价）
    # 库存
    inventory: Optional[InventoryStatus]
    # 是否收藏
    is_favorited: bool = False

    class Config:
        from_attributes = True


class ProductListResponse(BaseModel):
    items: list[ProductCardItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class ProductDetail(ProductCardItem):
    description: Optional[str]
    category_name: Optional[str]
    is_favorited: bool = False


@router.get("/categories", response_model=list[CategoryTree])
async def get_categories(db: AsyncSession = Depends(get_db)):
    """获取分类树"""
    result = await db.execute(select(Category).order_by(Category.sort_order))
    categories = result.scalars().all()

    # 构建树形结构
    all_cats = {c.id: {"id": c.id, "name": c.name, "children": [], "parent_id": c.parent_id} for c in categories}
    roots = []
    for c in categories:
        cat = all_cats[c.id]
        if c.parent_id and c.parent_id in all_cats:
            all_cats[c.parent_id]["children"].append(cat)
        else:
            roots.append(cat)
    return roots


@router.get("", response_model=ProductListResponse)
async def get_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    keyword: str = Query(None),
    category_id: int = Query(None),
    min_price: float = Query(None),
    max_price: float = Query(None),
    stock_status: str = Query(None),  # in_stock / low_stock / out_of_stock / all
    sort_by: str = Query("default"),  # default / price_asc / price_desc / name
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """商品列表（亚马逊风格，支持搜索/筛选/排序）"""

    # 构建基础查询
    query = select(Product).options(joinedload(Product.category)).where(Product.is_active == True)

    # 关键词搜索（商品名称 + SKU + 规格）
    if keyword:
        keyword_filter = f"%{keyword}%"
        query = query.where(
            (Product.name.ilike(keyword_filter))
            | (Product.sku.ilike(keyword_filter))
            | (Product.spec.ilike(keyword_filter))
        )

    # 分类筛选
    if category_id:
        query = query.where(Product.category_id == category_id)

    # 价格区间（基于标价过滤）
    if min_price is not None:
        query = query.join(ProductPrice).where(ProductPrice.list_price >= min_price)
    if max_price is not None:
        query = query.join(ProductPrice).where(ProductPrice.list_price <= max_price)

    # 计数
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # 排序
    if sort_by == "price_asc":
        query = query.join(ProductPrice).order_by(ProductPrice.list_price.asc())
    elif sort_by == "price_desc":
        query = query.join(ProductPrice).order_by(ProductPrice.list_price.desc())
    elif sort_by == "name":
        query = query.order_by(Product.name.asc())
    else:
        query = query.order_by(Product.id.desc())

    # 分页
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    products = result.scalars().all()

    # 获取价格和库存
    product_ids = [p.id for p in products]

    # 批量查询价格
    price_query = select(ProductPrice).where(ProductPrice.product_id.in_(product_ids))
    prices_result = await db.execute(price_query)
    prices = {p.product_id: p for p in prices_result.scalars().all()}

    # 批量查询专属价
    dealer_price_query = select(DealerPrice).where(
        DealerPrice.user_id == current_user.id,
        DealerPrice.product_id.in_(product_ids),
    )
    dealer_price_result = await db.execute(dealer_price_query)
    dealer_prices = {p.product_id: p for p in dealer_price_result.scalars().all()}

    # 批量查询库存（默认仓库）
    # 获取第一个默认仓库
    warehouse_result = await db.execute(select(Warehouse.id).where(Warehouse.is_default == True).limit(1))
    default_warehouse_id = warehouse_result.scalar_one_or_none()

    if default_warehouse_id:
        inv_query = select(Inventory).where(
            Inventory.product_id.in_(product_ids),
            Inventory.warehouse_id == default_warehouse_id
        )
        inv_result = await db.execute(inv_query)
        inventories = {i.product_id: i for i in inv_result.scalars().all()}
    else:
        inventories = {}

    # 批量查询收藏状态
    fav_query = select(Favorite.product_id).where(
        Favorite.user_id == current_user.id,
        Favorite.product_id.in_(product_ids),
    )
    fav_result = await db.execute(fav_query)
    favorited_ids = set(fav_result.scalars().all())

    # 组装响应
    items = []
    for p in products:
        price = prices.get(p.id)
        inv = inventories.get(p.id)
        dealer_p = dealer_prices.get(p.id)

        # 计算最终价格
        list_price = float(price.list_price) if price else None
        your_price = float(dealer_p.price) if dealer_p else list_price

        # 库存状态
        if inv:
            avail = inv.quantity - inv.reserved_qty
            if avail <= 0:
                inv_status = "out_of_stock"
            elif avail <= inv.safe_stock:
                inv_status = "low_stock"
            else:
                inv_status = "in_stock"
            inventory_info = InventoryStatus(
                available=max(0, avail),
                status=inv_status,
                safe_stock=inv.safe_stock,
            )
        else:
            inventory_info = InventoryStatus(available=0, status="out_of_stock", safe_stock=0)

        # 过滤库存状态
        if stock_status and stock_status != "all" and inventory_info.status != stock_status:
            continue

        items.append(ProductCardItem(
            id=p.id,
            name=p.name,
            sku=p.sku,
            spec=p.spec,
            unit=p.unit,
            min_order_qty=p.min_order_qty,
            image_url=p.image_url,
            category_id=p.category_id,
            list_price=list_price,
            your_price=your_price,
            inventory=inventory_info,
            is_favorited=p.id in favorited_ids,
        ))

    total_pages = (total + page_size - 1) // page_size

    return ProductListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{product_id}", response_model=ProductDetail)
async def get_product_detail(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """商品详情"""
    result = await db.execute(
        select(Product).options(joinedload(Product.category)).where(Product.id == product_id, Product.is_active == True)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="商品不存在")

    # 价格
    price_query = await db.execute(select(ProductPrice).where(ProductPrice.product_id == p.id))
    price = price_query.scalar_one_or_none()

    # 专属价
    dealer_price_query = await db.execute(
        select(DealerPrice).where(
            DealerPrice.product_id == p.id, DealerPrice.user_id == current_user.id
        )
    )
    dealer_p = dealer_price_query.scalar_one_or_none()

    list_price = float(price.list_price) if price else None
    your_price = float(dealer_p.price) if dealer_p else list_price

    # 库存
    inv_result = await db.execute(
        select(Inventory).where(
            Inventory.product_id == p.id,
        )
    )
    inv = inv_result.scalars().first()
    if inv:
        avail = inv.quantity - inv.reserved_qty
        inv_status = "out_of_stock" if avail <= 0 else ("low_stock" if avail <= inv.safe_stock else "in_stock")
        inventory_info = InventoryStatus(available=max(0, avail), status=inv_status, safe_stock=inv.safe_stock)
    else:
        inventory_info = InventoryStatus(available=0, status="out_of_stock", safe_stock=0)

    # 收藏状态
    fav_result = await db.execute(
        select(Favorite).where(
            Favorite.product_id == p.id, Favorite.user_id == current_user.id
        )
    )
    is_fav = fav_result.scalar_one_or_none() is not None

    return ProductDetail(
        id=p.id,
        name=p.name,
        sku=p.sku,
        spec=p.spec,
        unit=p.unit,
        min_order_qty=p.min_order_qty,
        image_url=p.image_url,
        category_id=p.category_id,
        list_price=list_price,
        your_price=your_price,
        inventory=inventory_info,
        is_favorited=is_fav,
        description=p.description,
        category_name=p.category.name if p.category else None,
    )
