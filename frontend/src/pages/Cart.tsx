import { useState, useEffect, useCallback } from 'react'
import { Table, InputNumber, Button, Space, Typography, Popconfirm, message, Card, Row, Col, Checkbox } from 'antd'
import { DeleteOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useCartStore } from '../store/cart'

const { Text } = Typography

interface CartItem {
  id: number
  product_id: number
  product_name: string
  sku: string
  unit: string
  image_url: string | null
  quantity: number
  unit_price: number
  subtotal: number
}

const BREAKPOINT = 768

export default function Cart() {
  const navigate = useNavigate()
  const { setCart } = useCartStore()

  const [isMobile, setIsMobile] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<CartItem[]>([])
  const [totalAmount, setTotalAmount] = useState(0)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [submitting, setSubmitting] = useState(false)

  const checkMobile = useCallback(() => {
    setIsMobile(window.innerWidth < BREAKPOINT)
  }, [])

  useEffect(() => {
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [checkMobile])

  const fetchCart = async () => {
    setLoading(true)
    try {
      const res = await api.get('/cart')
      setItems(res.data.items)
      setCart(res.data.items, res.data.total_amount)
    } catch {
      message.error('加载购物车失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCart() }, [])

  const updateQuantity = async (item: CartItem, qty: number) => {
    try {
      await api.put(`/cart/items/${item.id}`, { quantity: qty })
      await fetchCart()
    } catch (err: any) {
      message.error(err.response?.data?.detail || '更新失败')
    }
  }

  const removeItem = async (item: CartItem) => {
    try {
      await api.delete(`/cart/items/${item.id}`)
      message.success('已删除')
      await fetchCart()
      setSelectedIds(prev => prev.filter(id => id !== item.id))
    } catch {
      message.error('删除失败')
    }
  }

  const submitOrder = async () => {
    if (selectedIds.length === 0) {
      message.warning('请先选择要结算的商品')
      return
    }
    setSubmitting(true)
    try {
      const selectedItems = items.filter(i => selectedIds.includes(i.id))
      await api.post('/orders', {
        items: selectedItems.map(i => ({ cart_item_id: i.id, product_id: i.product_id, quantity: i.quantity })),
      })
      message.success('订单提交成功！')
      setSelectedIds([])
      await fetchCart()
      navigate('/orders')
    } catch (err: any) {
      message.error(err.response?.data?.detail || '提交订单失败')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedTotal = items
    .filter(i => selectedIds.includes(i.id))
    .reduce((sum, i) => sum + i.subtotal, 0)

  const rowSelection = {
    selectedRowKeys: selectedIds,
    onChange: (keys: React.Key[]) => setSelectedIds(keys as number[]),
  }

  const columns = [
    {
      title: '商品',
      render: (_: any, record: CartItem) => (
        <Space>
          <div style={{ width: 60, height: 60, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {record.image_url ? (
              <img src={record.image_url} alt={record.product_name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <Text type="secondary">无图</Text>
            )}
          </div>
          <div>
            <Text strong>{record.product_name}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{record.sku}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>¥{record.unit_price.toFixed(2)} / {record.unit}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: '数量',
      width: 120,
      render: (_: any, record: CartItem) => (
        <InputNumber
          min={1}
          value={record.quantity}
          onChange={v => v && updateQuantity(record, v as number)}
        />
      ),
    },
    {
      title: '小计',
      width: 100,
      render: (_: any, record: CartItem) => (
        <Text strong style={{ color: '#B12704' }}>¥{record.subtotal.toFixed(2)}</Text>
      ),
    },
    {
      title: '操作',
      width: 80,
      render: (_: any, record: CartItem) => (
        <Popconfirm title="确定删除？" onConfirm={() => removeItem(record)}>
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  // 移动端布局
  if (isMobile) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#fff', padding: '12px 16px', borderBottom: '1px solid #eee' }}>
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>🛒 购物车</div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}>加载中...</div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ color: '#999', marginBottom: 16 }}>购物车是空的</div>
              <Button type="primary" onClick={() => navigate('/products')}>去选购</Button>
            </div>
          ) : (
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              {items.map(item => (
                <Card key={item.id} size="small" bodyStyle={{ padding: 12 }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <Checkbox
                      checked={selectedIds.includes(item.id)}
                      onChange={() => {
                        setSelectedIds(prev =>
                          prev.includes(item.id)
                            ? prev.filter(id => id !== item.id)
                            : [...prev, item.id]
                        )
                      }}
                    />
                    <div style={{ width: 60, height: 60, background: '#f5f5f5', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.product_name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      ) : (
                        <Text type="secondary">无图</Text>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{item.product_name}</div>
                      <div style={{ fontSize: 11, color: '#999' }}>{item.sku}</div>
                      <div style={{ fontSize: 13, color: '#B12704' }}>¥{item.unit_price.toFixed(2)} / {item.unit}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                        <InputNumber
                          min={1}
                          value={item.quantity}
                          onChange={v => v && updateQuantity(item, v as number)}
                          size="small"
                          style={{ width: 80 }}
                        />
                        <Text strong style={{ color: '#B12704' }}>¥{item.subtotal.toFixed(2)}</Text>
                      </div>
                    </div>
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeItem(item)}
                    />
                  </div>
                </Card>
              ))}
            </Space>
          )}
        </div>

        {items.length > 0 && (
          <div style={{
            background: '#fff',
            borderTop: '1px solid #eee',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: 12, color: '#999' }}>已选 {selectedIds.length} 个商品</div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#B12704' }}>¥{selectedTotal.toFixed(2)}</div>
            </div>
            <Button
              type="primary"
              size="large"
              icon={<ShoppingCartOutlined />}
              loading={submitting}
              disabled={selectedIds.length === 0}
              onClick={submitOrder}
            >
              提交订单
            </Button>
          </div>
        )}
      </div>
    )
  }

  // PC端布局
  return (
    <div>
      <Text strong style={{ fontSize: 18 }}>🛒 购物车</Text>

      <Card style={{ marginTop: 12 }} loading={loading}>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ color: '#999', marginBottom: 16 }}>购物车是空的</div>
            <Button type="primary" onClick={() => navigate('/products')}>去选购</Button>
          </div>
        ) : (
          <>
            <Table
              rowSelection={rowSelection}
              columns={columns}
              dataSource={items}
              rowKey="id"
              pagination={false}
            />

            <Row justify="end" style={{ marginTop: 24, padding: '16px 0', borderTop: '1px solid #f0f0f0' }}>
              <Col>
                <Space>
                  <Text type="secondary">已选 {selectedIds.length} 个商品</Text>
                  <Text>合计：</Text>
                  <Text strong style={{ fontSize: 20, color: '#B12704' }}>¥{selectedTotal.toFixed(2)}</Text>
                  <Button
                    type="primary"
                    size="large"
                    icon={<ShoppingCartOutlined />}
                    loading={submitting}
                    disabled={selectedIds.length === 0}
                    onClick={submitOrder}
                  >
                    提交订单
                  </Button>
                </Space>
              </Col>
            </Row>
          </>
        )}
      </Card>
    </div>
  )
}