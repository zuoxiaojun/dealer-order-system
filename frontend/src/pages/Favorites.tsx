import { useState, useEffect, useCallback } from 'react'
import { Table, Card, Typography, Tag, Button, message, Spin, Row, Col, Select } from 'antd'
import { HeartFilled, DeleteOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useCartStore } from '../store/cart'

const { Text } = Typography

interface FavoriteItem {
  id: number
  product_id: number
  product_name: string
  sku: string
  spec: string | null
  unit: string
  image_url: string | null
  your_price: number | null
  stock_status: string
  available_qty: number
  created_at: string
}

const BREAKPOINT = 768

export default function Favorites() {
  const navigate = useNavigate()
  const { setCart } = useCartStore()

  const [isMobile, setIsMobile] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<FavoriteItem[]>([])
  const [stockFilter, setStockFilter] = useState<string>('all')

  const checkMobile = useCallback(() => {
    setIsMobile(window.innerWidth < BREAKPOINT)
  }, [])

  useEffect(() => {
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [checkMobile])

  const fetchFavorites = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = {}
      if (stockFilter !== 'all') params.stock_filter = stockFilter
      const res = await api.get('/favorites', { params })
      setItems(res.data.items)
    } catch {
      message.error('加载收藏失败')
    } finally {
      setLoading(false)
    }
  }, [stockFilter])

  useEffect(() => { fetchFavorites() }, [fetchFavorites])

  const removeFavorite = async (productId: number) => {
    try {
      await api.delete(`/favorites/${productId}`)
      message.success('已取消收藏')
      fetchFavorites()
    } catch {
      message.error('操作失败')
    }
  }

  const addToCart = async (item: FavoriteItem) => {
    try {
      await api.post('/cart/items', { product_id: item.product_id, quantity: 1 })
      message.success(`已加入购物车：${item.product_name}`)
      const cartRes = await api.get('/cart')
      setCart(cartRes.data.items, cartRes.data.total_amount)
    } catch (err: any) {
      message.error(err.response?.data?.detail || '加入购物车失败')
    }
  }

  const columns = [
    {
      title: '商品',
      render: (_: any, r: FavoriteItem) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 60, height: 60, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {r.image_url ? (
              <img src={r.image_url} alt={r.product_name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <Text type="secondary">无图</Text>
            )}
          </div>
          <div>
            <Text strong onClick={() => navigate(`/products/${r.product_id}`)} style={{ cursor: 'pointer', color: '#B12704' }}>{r.product_name}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{r.sku}</Text>
            {r.spec && <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{r.spec}</Text>}
          </div>
        </div>
      ),
    },
    {
      title: '价格',
      width: 100,
      render: (_: any, r: FavoriteItem) => <Text strong style={{ color: '#B12704' }}>¥{r.your_price?.toFixed(2) ?? '-'}</Text>,
    },
    {
      title: '库存',
      width: 120,
      render: (_: any, r: FavoriteItem) => {
        if (r.stock_status === 'out_of_stock') return <Tag color="error">缺货</Tag>
        if (r.stock_status === 'low_stock') return <Tag color="warning">库存紧张({r.available_qty})</Tag>
        return <Tag color="success">有货({r.available_qty})</Tag>
      },
    },
    {
      title: '收藏时间',
      width: 150,
      render: (_: any, r: FavoriteItem) => new Date(r.created_at).toLocaleDateString('zh-CN'),
    },
    {
      title: '操作',
      width: 180,
      render: (_: any, r: FavoriteItem) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="primary" size="small" icon={<ShoppingCartOutlined />} disabled={r.stock_status === 'out_of_stock'} onClick={() => addToCart(r)}>加购</Button>
          <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeFavorite(r.product_id)} />
        </div>
      ),
    },
  ]

  // 移动端布局
  if (isMobile) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#fff', padding: '12px 16px', borderBottom: '1px solid #eee' }}>
          <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>❤️ 我的收藏</div>
          <Select value={stockFilter} onChange={v => { setStockFilter(v); setItems([]) }} style={{ width: '100%' }}>
            <Select.Option value="all">全部</Select.Option>
            <Select.Option value="in_stock">有货</Select.Option>
            <Select.Option value="low_stock">库存紧张</Select.Option>
            <Select.Option value="out_of_stock">缺货</Select.Option>
          </Select>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>暂无收藏商品</div>
          ) : (
            <div style={{ padding: 8 }}>
              {items.map(item => (
                <Card key={item.id} size="small" hoverable onClick={() => navigate(`/products/${item.product_id}`)} style={{ marginBottom: 8 }} bodyStyle={{ padding: 12 }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 60, height: 60, background: '#f5f5f5', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.product_name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      ) : (
                        <Text type="secondary">无图</Text>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{item.product_name}</div>
                      <div style={{ fontSize: 12, color: '#999' }}>{item.sku}</div>
                      <div style={{ fontSize: 16, fontWeight: 'bold', color: '#B12704' }}>¥{item.your_price?.toFixed(2) ?? '-'}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                        <Tag color={item.stock_status === 'out_of_stock' ? 'error' : item.stock_status === 'low_stock' ? 'warning' : 'success'}>
                          {item.stock_status === 'out_of_stock' ? '缺货' : item.stock_status === 'low_stock' ? `库存紧张(${item.available_qty})` : `有货(${item.available_qty})`}
                        </Tag>
                        <Button size="small" type="primary" disabled={item.stock_status === 'out_of_stock'} onClick={(e) => { e.stopPropagation(); addToCart(item) }}>加购</Button>
                      </div>
                    </div>
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={(e) => { e.stopPropagation(); removeFavorite(item.product_id) }} />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // PC端布局
  return (
    <div>
      <Text strong style={{ fontSize: 18 }}>❤️ 我的收藏</Text>

      <Card style={{ marginTop: 12 }}>
        <div style={{ marginBottom: 16 }}>
          <Text>筛选：</Text>
          <Select value={stockFilter} onChange={v => { setStockFilter(v); setItems([]) }} style={{ width: 140, marginLeft: 8 }}>
            <Select.Option value="all">全部</Select.Option>
            <Select.Option value="in_stock">有货</Select.Option>
            <Select.Option value="low_stock">库存紧张</Select.Option>
            <Select.Option value="out_of_stock">缺货</Select.Option>
          </Select>
          <Text type="secondary" style={{ marginLeft: 16 }}>共 {items.length} 个收藏</Text>
        </div>

        <Spin spinning={loading}>
          <Table columns={columns} dataSource={items} rowKey="id" pagination={false} />
        </Spin>
      </Card>
    </div>
  )
}