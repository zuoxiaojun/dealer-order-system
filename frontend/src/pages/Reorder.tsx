import { useState, useEffect, useCallback } from 'react'
import { Table, Card, Checkbox, Button, Typography, message, Spin, Row, Col } from 'antd'
import { ShoppingCartOutlined } from '@ant-design/icons'
import api from '../api/client'
import { useCartStore } from '../store/cart'

const { Text } = Typography

interface HistoryItem {
  product_id: number
  product_name: string
  sku: string
  quantity: number
  unit_price: number
}

const BREAKPOINT = 768

export default function Reorder() {
  const { setCart } = useCartStore()

  const [isMobile, setIsMobile] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<HistoryItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [submitting, setSubmitting] = useState(false)

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
    api.get<HistoryItem[]>('/reorders/history')
      .then(r => {
        setItems(r.data)
        setSelectedIds(new Set(r.data.map(i => i.product_id)))
      })
      .catch(() => message.error('加载历史订单失败'))
      .finally(() => setLoading(false))
  }, [])

  const toggleItem = (productId: number) => {
    const next = new Set(selectedIds)
    if (next.has(productId)) next.delete(productId)
    else next.add(productId)
    setSelectedIds(next)
  }

  const toggleAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(items.map(i => i.product_id)))
    else setSelectedIds(new Set())
  }

  const addToCart = async () => {
    if (selectedIds.size === 0) {
      message.warning('请选择要复购的商品')
      return
    }
    setSubmitting(true)
    try {
      const selectedItems = items.filter(i => selectedIds.has(i.product_id))
      for (const item of selectedItems) {
        await api.post('/cart/items', { product_id: item.product_id, quantity: item.quantity })
      }
      message.success('已全部加入购物车')
      const cartRes = await api.get('/cart')
      setCart(cartRes.data.items, cartRes.data.total_amount)
    } catch (err: any) {
      message.error(err.response?.data?.detail || '加入购物车失败')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedTotal = items
    .filter(i => selectedIds.has(i.product_id))
    .reduce((sum, i) => sum + i.unit_price * i.quantity, 0)

  const columns = [
    {
      title: <Checkbox onChange={e => toggleAll(e.target.checked)} checked={items.length > 0 && selectedIds.size === items.length} />,
      width: 50,
      render: (_: any, r: HistoryItem) => (
        <Checkbox checked={selectedIds.has(r.product_id)} onChange={() => toggleItem(r.product_id)} />
      ),
    },
    {
      title: '商品',
      render: (_: any, r: HistoryItem) => (
        <div>
          <Text>{r.product_name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{r.sku}</Text>
        </div>
      ),
    },
    {
      title: '历史数量',
      width: 100,
      render: (_: any, r: HistoryItem) => `${r.quantity}`,
    },
    {
      title: '单价',
      width: 100,
      render: (_: any, r: HistoryItem) => `¥${r.unit_price.toFixed(2)}`,
    },
    {
      title: '小计',
      width: 100,
      render: (_: any, r: HistoryItem) => (
        <Text strong style={{ color: '#B12704' }}>¥${(r.unit_price * r.quantity).toFixed(2)}</Text>
      ),
    },
  ]

  // 移动端布局
  if (isMobile) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#fff', padding: '12px 16px', borderBottom: '1px solid #eee' }}>
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>🔄 快速复购</div>
          <Text type="secondary" style={{ fontSize: 12 }}>基于历史采购记录，快速将常用商品加入购物车</Text>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>暂无历史订单数据</div>
          ) : (
            <div style={{ padding: 8 }}>
              {items.map(item => (
                <Card key={item.product_id} size="small" style={{ marginBottom: 8 }} bodyStyle={{ padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Checkbox checked={selectedIds.has(item.product_id)} onChange={() => toggleItem(item.product_id)} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{item.product_name}</div>
                      <div style={{ fontSize: 12, color: '#999' }}>{item.sku}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                        <span style={{ fontSize: 12, color: '#666' }}>数量：{item.quantity} × ¥{item.unit_price.toFixed(2)}</span>
                        <span style={{ fontSize: 14, fontWeight: 'bold', color: '#B12704' }}>¥{(item.unit_price * item.quantity).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div style={{ background: '#fff', borderTop: '1px solid #eee', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, color: '#999' }}>已选 {selectedIds.size} 个商品</div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#B12704' }}>¥{selectedTotal.toFixed(2)}</div>
            </div>
            <Button type="primary" size="large" icon={<ShoppingCartOutlined />} loading={submitting} disabled={selectedIds.size === 0} onClick={addToCart}>
              一键加入购物车
            </Button>
          </div>
        )}
      </div>
    )
  }

  // PC端布局
  return (
    <div>
      <Text strong style={{ fontSize: 18 }}>🔄 快速复购</Text>
      <Text type="secondary" style={{ marginLeft: 8 }}>基于历史采购记录，快速将常用商品加入购物车</Text>

      <Card style={{ marginTop: 12 }}>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>暂无历史订单数据</div>
        ) : (
          <>
            <Spin spinning={loading}>
              <Table columns={columns} dataSource={items} rowKey="product_id" pagination={false} />
            </Spin>

            <Row justify="end" style={{ marginTop: 24, padding: '16px 0', borderTop: '1px solid #f0f0f0' }}>
              <Col>
                <Text type="secondary">已选 {selectedIds.size} 个商品</Text>
                <Text style={{ marginLeft: 16 }}>预估金额：</Text>
                <Text strong style={{ fontSize: 20, color: '#B12704' }}>¥{selectedTotal.toFixed(2)}</Text>
                <Button type="primary" size="large" icon={<ShoppingCartOutlined />} loading={submitting} disabled={selectedIds.size === 0} onClick={addToCart} style={{ marginLeft: 16 }}>
                  一键加入购物车
                </Button>
              </Col>
            </Row>
          </>
        )}
      </Card>
    </div>
  )
}