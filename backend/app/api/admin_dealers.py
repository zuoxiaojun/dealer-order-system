# app/api/admin_dealers.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.core.database import get_db
from app.core.security import get_current_admin, get_password_hash
from app.models.user import Admin, Dealer, User, DealerTier

router = APIRouter()


class DealerTierResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class DealerUserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    status: str
    last_login_at: Optional[datetime]

    class Config:
        from_attributes = True


class DealerResponse(BaseModel):
    id: int
    name: str
    contact_name: Optional[str]
    contact_phone: Optional[str]
    contact_email: Optional[str]
    address: Optional[str]
    region: Optional[str]
    dealer_tier_id: Optional[int]
    dealer_tier_name: Optional[str]
    credit_limit: float
    status: str
    user_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class DealerListItem(BaseModel):
    id: int
    name: str
    contact_name: Optional[str]
    region: Optional[str]
    dealer_tier_name: Optional[str]
    status: str
    user_count: int

    class Config:
        from_attributes = True


class DealerListResponse(BaseModel):
    items: list[DealerListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class CreateDealerRequest(BaseModel):
    name: str
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    address: Optional[str] = None
    region: Optional[str] = None
    dealer_tier_id: Optional[int] = None
    credit_limit: float = 0


class UpdateDealerRequest(BaseModel):
    name: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    address: Optional[str] = None
    region: Optional[str] = None
    dealer_tier_id: Optional[int] = None
    credit_limit: Optional[float] = None
    status: Optional[str] = None


class CreateDealerUserRequest(BaseModel):
    dealer_id: int
    username: str
    password: str
    full_name: str
    role: str = "dealer_user"


class ResetPasswordRequest(BaseModel):
    new_password: str


@router.get("/dealer-tiers", response_model=list[DealerTierResponse])
async def admin_list_dealer_tiers(
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(DealerTier).order_by(DealerTier.sort_order))
    tiers = result.scalars().all()
    return [DealerTierResponse(id=t.id, name=t.name) for t in tiers]


@router.get("/dealers", response_model=DealerListResponse)
async def admin_list_dealers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    region: Optional[str] = None,
    status: Optional[str] = None,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(Dealer).options(
        selectinload(Dealer.dealer_tier),
        selectinload(Dealer.users),
    )

    if search:
        query = query.where(Dealer.name.ilike(f"%{search}%"))
    if region:
        query = query.where(Dealer.region == region)
    if status:
        query = query.where(Dealer.status == status)

    query = query.order_by(Dealer.created_at.desc())

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    dealers = result.scalars().all()

    items = [
        DealerListItem(
            id=d.id,
            name=d.name,
            contact_name=d.contact_name,
            region=d.region,
            dealer_tier_name=d.dealer_tier.name if d.dealer_tier else None,
            status=d.status,
            user_count=len(d.users),
        )
        for d in dealers
    ]

    total_pages = (total + page_size - 1) // page_size
    return DealerListResponse(items=items, total=total, page=page, page_size=page_size, total_pages=total_pages)


@router.get("/dealers/{dealer_id}", response_model=DealerResponse)
async def admin_get_dealer(
    dealer_id: int,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Dealer)
        .options(
            selectinload(Dealer.dealer_tier),
            selectinload(Dealer.users),
        )
        .where(Dealer.id == dealer_id)
    )
    dealer = result.scalar_one_or_none()
    if not dealer:
        raise HTTPException(status_code=404, detail="经销商不存在")

    return DealerResponse(
        id=dealer.id,
        name=dealer.name,
        contact_name=dealer.contact_name,
        contact_phone=dealer.contact_phone,
        contact_email=dealer.contact_email,
        address=dealer.address,
        region=dealer.region,
        dealer_tier_id=dealer.dealer_tier_id,
        dealer_tier_name=dealer.dealer_tier.name if dealer.dealer_tier else None,
        credit_limit=float(dealer.credit_limit or 0),
        status=dealer.status,
        user_count=len(dealer.users),
        created_at=dealer.created_at,
    )


@router.post("/dealers")
async def admin_create_dealer(
    req: CreateDealerRequest,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    dealer = Dealer(
        name=req.name,
        contact_name=req.contact_name,
        contact_phone=req.contact_phone,
        contact_email=req.contact_email,
        address=req.address,
        region=req.region,
        dealer_tier_id=req.dealer_tier_id,
        credit_limit=req.credit_limit,
        status="active",
    )
    db.add(dealer)
    await db.commit()
    await db.refresh(dealer)

    return {"id": dealer.id, "name": dealer.name}


@router.put("/dealers/{dealer_id}")
async def admin_update_dealer(
    dealer_id: int,
    req: UpdateDealerRequest,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Dealer).where(Dealer.id == dealer_id))
    dealer = result.scalar_one_or_none()
    if not dealer:
        raise HTTPException(status_code=404, detail="经销商不存在")

    if req.name is not None:
        dealer.name = req.name
    if req.contact_name is not None:
        dealer.contact_name = req.contact_name
    if req.contact_phone is not None:
        dealer.contact_phone = req.contact_phone
    if req.contact_email is not None:
        dealer.contact_email = req.contact_email
    if req.address is not None:
        dealer.address = req.address
    if req.region is not None:
        dealer.region = req.region
    if req.dealer_tier_id is not None:
        dealer.dealer_tier_id = req.dealer_tier_id
    if req.credit_limit is not None:
        dealer.credit_limit = req.credit_limit
    if req.status is not None:
        dealer.status = req.status

    dealer.updated_at = datetime.utcnow()
    await db.commit()

    return {"ok": True}


@router.get("/dealers/{dealer_id}/users", response_model=list[DealerUserResponse])
async def admin_list_dealer_users(
    dealer_id: int,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.dealer_id == dealer_id).order_by(User.created_at.desc())
    )
    users = result.scalars().all()
    return [
        DealerUserResponse(
            id=u.id,
            username=u.username,
            full_name=u.full_name,
            role=u.role,
            status=u.status,
            last_login_at=u.last_login_at,
        )
        for u in users
    ]


@router.post("/dealers/{dealer_id}/users")
async def admin_create_dealer_user(
    dealer_id: int,
    req: CreateDealerUserRequest,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    dealer_result = await db.execute(select(Dealer).where(Dealer.id == dealer_id))
    if not dealer_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="经销商不存在")

    existing = await db.execute(select(User).where(User.username == req.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="用户名已存在")

    user = User(
        username=req.username,
        password_hash=get_password_hash(req.password),
        full_name=req.full_name,
        dealer_id=dealer_id,
        role=req.role,
        status="active",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return {"id": user.id, "username": user.username}


@router.put("/users/{user_id}/status")
async def admin_update_user_status(
    user_id: int,
    status: str,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    user.status = status
    user.updated_at = datetime.utcnow()
    await db.commit()

    return {"ok": True}


@router.put("/users/{user_id}/reset-password")
async def admin_reset_user_password(
    user_id: int,
    req: ResetPasswordRequest,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    user.password_hash = get_password_hash(req.new_password)
    user.updated_at = datetime.utcnow()
    await db.commit()

    return {"ok": True, "message": "密码重置成功"}