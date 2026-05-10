import { useState, useEffect, useCallback } from 'react'
import { Table, Tag, Select, Typography, Spin, Card, Button, Popconfirm, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useCartStore } from '../store/cart'

const { Text } = Typography
const { Option } = Select

interface OrderItem {
  id: string
  order_no: string
  status: string
  net_amount: number
  total_items: number
  created_at: string
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '待审核', color: 'gold' },
  confirmed: { label: '已确认', color: 'cyan' },
  processing: { label: '处理中', color: 'blue' },
  shipped: { label: '已发货', color: 'geekblue' },
  completed: { label: '已完成', color: 'green' },
  cancelled: { label: '已取消', color: 'default' },
  rejected: { label: '已拒绝', color: 'red' },
}

const BREAKPOINT = 768

export default function Orders() {
  const navigate = useNavigate()
  const { setCart } = useCartStore()
  const [isMobile, setIsMobile] = useState(false)
  const [loading, setLoading] = useState(false)
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const checkMobile = useCallback(() => {
    setIsMobile(window.innerWidth < BREAKPOINT)
  }, [])

  useEffect(() => {
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [checkMobile])

  useEffect(() => {
    setLoading(true)
    const params: Record<string, any> = { page, page_size: 20 }
    if (status !== 'all') params.status = status

    api.get('/orders', { params })
      .then(r => {
        setOrders(r.data.items)
        setTotalPages(r.data.total_pages)
      })
      .catch(() => { /*  */ })
      .finally(() => setLoading(false))
  }, [page, status])

  const cancelOrder = async (order: OrderItem) => {
    try {
      await api.post(`/orders/${order.id}/cancel`)
      message.success('订单已取消，商品已退回购物车')
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'cancelled' } : o))
      const cartRes = await api.get('/cart')
      setCart(cartRes.data.items, cartRes.data.total_amount)
    } catch (err: any) {
      message.error(err.response?.data?.detail || '取消失败')
    }
  }

  const renderAction = (_: any, record: OrderItem) => {
    if (record.status === 'pending') {
      return (
        <Popconfirm title="确定取消该订单？取消后商品将退回购物车" onConfirm={() => cancelOrder(record)}>
          <Button type="link" danger>取消订单</Button>
        </Popconfirm>
      )
    }
    return <Button type="link" onClick={() => navigate(`/orders/${record.id}`)}>查看详情</Button>
  }

  const columns = [
    {
      title: '订单号',
      render: (_: any, record: OrderItem) => (
        <a onClick={() => navigate(`/orders/${record.id}`)}>{record.order_no}</a>
      ),
    },
    {
      title: '下单时间',
      render: (_: any, record: OrderItem) => new Date(record.created_at).toLocaleString('zh-CN'),
    },
    {
      title: '商品数',
      render: (_: any, record: OrderItem) => record.total_items,
    },
    {
      title: '订单金额',
      render: (_: any, record: OrderItem) => <Text strong style={{ color: '#B12704' }}>¥{record.net_amount.toFixed(2)}</Text>,
    },
    {
      title: '状态',
      render: (_: any, record: OrderItem) => {
        const s = STATUS_MAP[record.status] || { label: record.status, color: 'default' }
        return <Tag color={s.color}>{s.label}</Tag>
      },
    },
    {
      title: '操作',
      render: renderAction,
    },
  ]

  // 移动端布局
  if (isMobile) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#fff', padding: '12px 16px', borderBottom: '1px solid #eee' }}>
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>📋 我的订单</div>
        </div>

        <div style={{ background: '#fff', padding: '8px 16px' }}>
          <Select
            value={status}
            onChange={v => { setStatus(v); setPage(1) }}
            style={{ width: '100%' }}
          >
            <Option value="all">全部</Option>
            {Object.entries(STATUS_MAP).map(([k, v]) => (
              <Option key={k} value={k}>{v.label}</Option>
            ))}
          </Select>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
          ) : orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>暂无订单</div>
          ) : (
            <div style={{ padding: 8 }}>
              {orders.map(order => {
                const s = STATUS_MAP[order.status] || { label: order.status, color: 'default' }
                return (
                  <Card
                    key={order.id}
                    size="small"
                    hoverable
                    onClick={() => navigate(`/orders/${order.id}`)}
                    style={{ marginBottom: 8 }}
                    bodyStyle={{ padding: 12 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{order.order_no}</span>
                      <Tag color={s.color}>{s.label}</Tag>
                    </div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                      {new Date(order.created_at).toLocaleString('zh-CN')}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                      <span style={{ fontSize: 12, color: '#666' }}>共 {order.total_items} 件商品</span>
                      <span style={{ fontSize: 16, fontWeight: 'bold', color: '#B12704' }}>
                        ¥{order.net_amount.toFixed(2)}
                      </span>
                    </div>
                    {order.status === 'pending' && (
                      <div style={{ marginTop: 8, textAlign: 'right' }}>
                        <Popconfirm title="确定取消？商品将退回购物车" onConfirm={() => cancelOrder(order)}>
                          <Button type="text" danger size="small">取消订单</Button>
                        </Popconfirm>
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, padding: '12px 0', background: '#fff', borderTop: '1px solid #eee' }}>
            <Button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</Button>
            <span style={{ lineHeight: '32px' }}>{page} / {totalPages}</span>
            <Button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>下一页</Button>
          </div>
        )}
      </div>
    )
  }

  // PC端布局
  return (
    <div>
      <Text strong style={{ fontSize: 18 }}>📋 我的订单</Text>

      <Card style={{ marginTop: 12 }}>
        <div style={{ marginBottom: 16 }}>
          <Text>状态筛选：</Text>
          <Select value={status} onChange={v => { setStatus(v); setPage(1) }} style={{ width: 120, marginLeft: 8 }}>
            <Option value="all">全部</Option>
            {Object.entries(STATUS_MAP).map(([k, v]) => (
              <Option key={k} value={k}>{v.label}</Option>
            ))}
          </Select>
        </div>

        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={orders}
            rowKey="id"
            pagination={totalPages > 1 ? {
              current: page,
              pageSize: 20,
              onChange: p => setPage(p),
            } : false}
          />
        </Spin>
      </Card>
    </div>
  )
}