# app/api/admin.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.core.database import get_db
from app.core.security import verify_password, create_access_token, get_current_admin
from app.models.user import Admin, User
from app.core.security import get_password_hash

router = APIRouter()


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class AdminLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin: dict


class AdminUserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    role: str

    class Config:
        from_attributes = True


class ResetPasswordRequest(BaseModel):
    user_id: int
    new_password: str


@router.post("/login", response_model=AdminLoginResponse)
async def admin_login(req: AdminLoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Admin).where(Admin.username == req.username))
    admin = result.scalar_one_or_none()

    if not admin or not verify_password(req.password, admin.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    if admin.status != "active":
        raise HTTPException(status_code=403, detail="账号已被停用")

    admin.last_login_at = datetime.utcnow()
    await db.commit()

    token = create_access_token({"sub": f"admin_{admin.id}", "type": "admin"})

    return AdminLoginResponse(
        access_token=token,
        admin={
            "id": admin.id,
            "username": admin.username,
            "full_name": admin.full_name,
            "role": admin.role,
        },
    )


@router.get("/me", response_model=AdminUserResponse)
async def get_admin_me(current_admin: Admin = Depends(get_current_admin)):
    return AdminUserResponse(
        id=current_admin.id,
        username=current_admin.username,
        full_name=current_admin.full_name,
        role=current_admin.role,
    )


@router.post("/reset-password")
async def reset_user_password(
    req: ResetPasswordRequest,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    if current_admin.role not in ["super_admin", "order_manager"]:
        raise HTTPException(status_code=403, detail="权限不足")

    result = await db.execute(select(User).where(User.id == req.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    user.password_hash = get_password_hash(req.new_password)
    user.updated_at = datetime.utcnow()
    await db.commit()

    return {"ok": True, "message": "密码重置成功"}


@router.get("/users", response_model=list[AdminUserResponse])
async def list_all_users(
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return [
        AdminUserResponse(
            id=u.id,
            username=u.username,
            full_name=u.full_name,
            role=u.role,
        )
        for u in users
    ]