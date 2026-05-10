# app/api/auth.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from pydantic import BaseModel
from datetime import datetime
from app.core.database import get_db
from app.core.security import verify_password, create_access_token, get_current_user
from app.models.user import User, DealerTier, Dealer

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    company_name: Optional[str]
    dealer_tier: Optional[str]

    class Config:
        from_attributes = True


@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.username == req.username)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    if user.status != "active":
        raise HTTPException(status_code=403, detail="账号已被停用")

    # 检查经销商状态
    if user.dealer_id:
        dealer_result = await db.execute(
            select(Dealer).where(Dealer.id == user.dealer_id)
        )
        dealer = dealer_result.scalar_one_or_none()
        if not dealer:
            raise HTTPException(status_code=403, detail="经销商不存在，请联系管理员")
        if dealer.status != "active":
            raise HTTPException(status_code=403, detail="经销商已停用，请联系管理员")

    # 获取经销商等级名称
    dealer_tier_name = None
    if user.dealer_tier_id:
        tier_result = await db.execute(
            select(DealerTier.name).where(DealerTier.id == user.dealer_tier_id)
        )
        dealer_tier_name = tier_result.scalar_one_or_none()

    # 更新最后登录时间
    user.last_login_at = datetime.utcnow()
    await db.commit()

    token = create_access_token({"sub": str(user.id)})

    return LoginResponse(
        access_token=token,
        user={
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "company_name": user.company_name,
            "dealer_tier": dealer_tier_name,
        },
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    dealer_tier_name = None
    if current_user.dealer_tier_id:
        tier_result = await db.execute(
            select(DealerTier.name).where(DealerTier.id == current_user.dealer_tier_id)
        )
        dealer_tier_name = tier_result.scalar_one_or_none()

    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        full_name=current_user.full_name,
        company_name=current_user.company_name,
        dealer_tier=dealer_tier_name,
    )