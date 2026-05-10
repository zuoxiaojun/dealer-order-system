# app/api/admin_products.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.core.database import get_db
from app.core.security import get_current_admin
from app.models.user import Admin
from app.models.product import Product, ProductPrice, Inventory, Warehouse, Category, DealerPrice

router = APIRouter()


class CategoryResponse(BaseModel):
    id: int
    name: str
    parent_id: Optional[int]

    class Config:
        from_attributes = True


class InventoryResponse(BaseModel):
    warehouse_id: int
    warehouse_name: str
    quantity: int
    reserved_qty: int
    safe_stock: int

    class Config:
        from_attributes = True


class ProductResponse(BaseModel):
    id: int
    name: str
    sku: str
    spec: Optional[str]
    unit: str
    min_order_qty: int
    category_id: Optional[int]
    category_name: Optional[str]
    image_url: Optional[str]
    description: Optional[str]
    is_active: bool
    list_price: float
    inventory: list[InventoryResponse]
    created_at: datetime

    class Config:
        from_attributes = True


class ProductListItem(BaseModel):
    id: int
    name: str
    sku: str
    spec: Optional[str]
    unit: str
    category_name: Optional[str]
    list_price: float
    is_active: bool
    total_stock: int

    class Config:
        from_attributes = True


class ProductListResponse(BaseModel):
    items: list[ProductListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class CreateProductRequest(BaseModel):
    name: str
    sku: str
    spec: Optional[str] = None
    unit: str = "件"
    min_order_qty: int = 1
    category_id: Optional[int] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    list_price: float


class UpdateProductRequest(BaseModel):
    name: Optional[str] = None
    spec: Optional[str] = None
    unit: Optional[str] = None
    min_order_qty: Optional[int] = None
    category_id: Optional[int] = None
    image_url: Optional[str] = None
    description: Optional[str] = None


class UpdatePriceRequest(BaseModel):
    list_price: float


class UpdateInventoryRequest(BaseModel):
    warehouse_id: int
    quantity: int


@router.get("/categories", response_model=list[CategoryResponse])
async def admin_list_categories(
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Category).order_by(Category.sort_order, Category.name))
    categories = result.scalars().all()
    return [CategoryResponse(id=c.id, name=c.name, parent_id=c.parent_id) for c in categories]


@router.get("/products", response_model=ProductListResponse)
async def admin_list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(Product).options(
        selectinload(Product.category),
        selectinload(Product.inventory),
        selectinload(Product.price),
    )

    if search:
        query = query.where(
            (Product.name.ilike(f"%{search}%")) | (Product.sku.ilike(f"%{search}%"))
        )
    if category_id:
        query = query.where(Product.category_id == category_id)
    if is_active is not None:
        query = query.where(Product.is_active == is_active)

    query = query.order_by(Product.created_at.desc())

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    products = result.scalars().all()

    items = []
    for p in products:
        total_stock = sum(inv.quantity for inv in p.inventory)
        items.append(ProductListItem(
            id=p.id,
            name=p.name,
            sku=p.sku,
            spec=p.spec,
            unit=p.unit,
            category_name=p.category.name if p.category else None,
            list_price=float(p.price.list_price) if p.price else 0.0,
            is_active=p.is_active,
            total_stock=total_stock,
        ))

    total_pages = (total + page_size - 1) // page_size
    return ProductListResponse(items=items, total=total, page=page, page_size=page_size, total_pages=total_pages)


@router.get("/products/{product_id}", response_model=ProductResponse)
async def admin_get_product(
    product_id: int,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Product)
        .options(
            selectinload(Product.category),
            selectinload(Product.inventory).selectinload(Inventory.warehouse),
            selectinload(Product.price),
        )
        .where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")

    inventory = [
        InventoryResponse(
            warehouse_id=inv.warehouse_id,
            warehouse_name=inv.warehouse.name if inv.warehouse else "未知",
            quantity=inv.quantity,
            reserved_qty=inv.reserved_qty,
            safe_stock=inv.safe_stock,
        )
        for inv in product.inventory
    ]

    return ProductResponse(
        id=product.id,
        name=product.name,
        sku=product.sku,
        spec=product.spec,
        unit=product.unit,
        min_order_qty=product.min_order_qty,
        category_id=product.category_id,
        category_name=product.category.name if product.category else None,
        image_url=product.image_url,
        description=product.description,
        is_active=product.is_active,
        list_price=float(product.price.list_price) if product.price else 0.0,
        inventory=inventory,
        created_at=product.created_at,
    )


@router.post("/products")
async def admin_create_product(
    req: CreateProductRequest,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(Product).where(Product.sku == req.sku))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="SKU已存在")

    product = Product(
        name=req.name,
        sku=req.sku,
        spec=req.spec,
        unit=req.unit,
        min_order_qty=req.min_order_qty,
        category_id=req.category_id,
        image_url=req.image_url,
        description=req.description,
        is_active=True,
    )
    db.add(product)
    await db.flush()

    price = ProductPrice(product_id=product.id, list_price=req.list_price)
    db.add(price)

    warehouses = await db.execute(select(Warehouse))
    for wh in warehouses.scalars().all():
        inv = Inventory(product_id=product.id, warehouse_id=wh.id, quantity=0)
        db.add(inv)

    await db.commit()
    await db.refresh(product)

    return {"id": product.id, "sku": product.sku}


@router.put("/products/{product_id}")
async def admin_update_product(
    product_id: int,
    req: UpdateProductRequest,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")

    if req.name is not None:
        product.name = req.name
    if req.spec is not None:
        product.spec = req.spec
    if req.unit is not None:
        product.unit = req.unit
    if req.min_order_qty is not None:
        product.min_order_qty = req.min_order_qty
    if req.category_id is not None:
        product.category_id = req.category_id
    if req.image_url is not None:
        product.image_url = req.image_url
    if req.description is not None:
        product.description = req.description

    product.updated_at = datetime.utcnow()
    await db.commit()

    return {"ok": True}


@router.put("/products/{product_id}/price")
async def admin_update_price(
    product_id: int,
    req: UpdatePriceRequest,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ProductPrice).where(ProductPrice.product_id == product_id))
    price = result.scalar_one_or_none()

    if price:
        price.list_price = req.list_price
        price.updated_at = datetime.utcnow()
    else:
        price = ProductPrice(product_id=product_id, list_price=req.list_price)
        db.add(price)

    await db.commit()
    return {"ok": True}


@router.put("/products/{product_id}/inventory")
async def admin_update_inventory(
    product_id: int,
    req: UpdateInventoryRequest,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Inventory).where(
            Inventory.product_id == product_id,
            Inventory.warehouse_id == req.warehouse_id,
        )
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="库存记录不存在")

    inv.quantity = req.quantity
    inv.updated_at = datetime.utcnow()
    await db.commit()

    return {"ok": True}


@router.post("/products/{product_id}/toggle-active")
async def admin_toggle_product_active(
    product_id: int,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")

    product.is_active = not product.is_active
    product.updated_at = datetime.utcnow()
    await db.commit()

    return {"ok": True, "is_active": product.is_active}


@router.post("/products/batch-toggle-active")
async def admin_batch_toggle_active(
    product_ids: list[int],
    is_active: bool,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Product).where(Product.id.in_(product_ids)))
    products = result.scalars().all()

    for p in products:
        p.is_active = is_active
        p.updated_at = datetime.utcnow()

    await db.commit()

    return {"ok": True, "updated": len(products)}