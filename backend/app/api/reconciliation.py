# app/api/reconciliation.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.order import Order, Reconciliation

router = APIRouter()


class OrderSummary(BaseModel):
    order_no: str
    order_date: str
    net_amount: float
    status: str


class ReconciliationDetail(BaseModel):
    order_no: str
    order_date: str
    net_amount: float
    paid_amount: float
    outstanding: float
    status: str


class MonthlyReconciliationResponse(BaseModel):
    period: str
    total_orders: int
    total_amount: float
    total_paid: float
    outstanding: float
    status: str
    dispute_reason: Optional[str]
    details: list[ReconciliationDetail]


@router.get("/monthly", response_model=list[MonthlyReconciliationResponse])
async def get_monthly_reconciliation(
    limit: int = Query(12, ge=1, le=24),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取月度对账汇总列表（最近N个月）"""
    result = await db.execute(
        select(Reconciliation)
        .where(Reconciliation.user_id == current_user.id)
        .order_by(Reconciliation.period.desc())
        .limit(limit)
    )
    records = result.scalars().all()

    items = []
    for r in records:
        items.append(MonthlyReconciliationResponse(
            period=r.period,
            total_orders=r.total_orders,
            total_amount=float(r.total_amount),
            total_paid=float(r.total_paid),
            outstanding=float(r.outstanding_amount),
            status=r.status,
            dispute_reason=r.dispute_reason,
            details=[],
        ))
    return items


@router.get("/monthly/{period}", response_model=MonthlyReconciliationResponse)
async def get_monthly_detail(
    period: str,  # YYYY-MM
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取指定月份的对账明细"""
    # 先获取对账记录
    recon_result = await db.execute(
        select(Reconciliation).where(
            Reconciliation.user_id == current_user.id,
            Reconciliation.period == period,
        )
    )
    recon = recon_result.scalar_one_or_none()

    if recon:
        total_orders = recon.total_orders
        total_amount = float(recon.total_amount)
        total_paid = float(recon.total_paid)
        outstanding = float(recon.outstanding_amount)
        status = recon.status
        dispute_reason = recon.dispute_reason
    else:
        # 如果没有对账记录，实时计算
        year, month = period.split("-")
        start_date = f"{year}-{month}-01"
        if month == "12":
            end_date = f"{int(year)+1}-01-01"
        else:
            end_date = f"{year}-{int(month)+1:02d}-01"

        orders_result = await db.execute(
            select(Order).where(
                Order.user_id == current_user.id,
                Order.status.in_(["completed", "shipped", "processing", "confirmed"]),
                Order.created_at >= start_date,
                Order.created_at < end_date,
            )
        )
        orders = orders_result.scalars().all()
        total_orders = len(orders)
        total_amount = sum(float(o.net_amount) for o in orders)
        total_paid = 0.0
        outstanding = total_amount
        status = "pending"
        dispute_reason = None

    # 获取订单明细
    year, month = period.split("-")
    start_date = f"{year}-{month}-01"
    if month == "12":
        end_date = f"{int(year)+1}-01-01"
    else:
        end_date = f"{year}-{int(month)+1:02d}-01"

    orders_result = await db.execute(
        select(Order)
        .where(
            Order.user_id == current_user.id,
            Order.created_at >= start_date,
            Order.created_at < end_date,
        )
        .order_by(Order.created_at.asc())
    )
    orders = orders_result.scalars().all()

    details = [
        ReconciliationDetail(
            order_no=o.order_no,
            order_date=o.created_at.strftime("%Y-%m-%d"),
            net_amount=float(o.net_amount),
            paid_amount=0.0,
            outstanding=float(o.net_amount),
            status=o.status,
        )
        for o in orders
    ]

    return MonthlyReconciliationResponse(
        period=period,
        total_orders=total_orders,
        total_amount=total_amount,
        total_paid=total_paid,
        outstanding=outstanding,
        status=status,
        dispute_reason=dispute_reason,
        details=details,
    )


@router.post("/dispute/{period}")
async def submit_dispute(
    period: str,
    reason: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """提交对账异议"""
    result = await db.execute(
        select(Reconciliation).where(
            Reconciliation.user_id == current_user.id,
            Reconciliation.period == period,
        )
    )
    recon = result.scalar_one_or_none()
    if not recon:
        raise HTTPException(status_code=404, detail="对账记录不存在")

    recon.dispute_reason = reason
    recon.status = "disputed"
    await db.commit()

    return {"ok": True, "message": "异议已提交"}
