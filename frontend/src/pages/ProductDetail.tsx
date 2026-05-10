import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Row, Col, Card, Image, Button, InputNumber, Typography, Tag, message, Spin } from 'antd'
import { HeartOutlined, HeartFilled, ShoppingCartOutlined } from '@ant-design/icons'
import api from '../api/client'
import { useCartStore } from '../store/cart'

const { Text, Title } = Typography

interface Product {
  id: number
  name: string
  sku: string
  spec: string | null
  unit: string
  min_order_qty: number
  image_url: string | null
  list_price: number | null
  your_price: number | null
  inventory: { available: number; status: string; safe_stock: number } | null
  is_favorited: boolean
  description: string | null
  category_name: string | null
}

const BREAKPOINT = 768

function StockTag({ status, available }: { status: string; available: number }) {
  if (status === 'out_of_stock') return <Tag color="error">缺货</Tag>
  if (status === 'low_stock') return <Tag color="warning">库存紧张({available})</Tag>
  return <Tag color="success">有货({available})</Tag>
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { setCart } = useCartStore()

  const [isMobile, setIsMobile] = useState(false)
  const [loading, setLoading] = useState(false)
  const [product, setProduct] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)

  const checkMobile = useCallback(() => {
    setIsMobile(window.innerWidth < BREAKPOINT)
  }, [])

  useEffect(() => {
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [checkMobile])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api.get<Product>(`/products/${id}`)
      .then(r => {
        setProduct(r.data)
        setQuantity(r.data.min_order_qty)
      })
      .catch(() => message.error('加载商品详情失败'))
      .finally(() => setLoading(false))
  }, [id])

  const toggleFavorite = async () => {
    if (!product) return
    try {
      if (product.is_favorited) {
        await api.delete(`/favorites/${product.id}`)
        message.success('已取消收藏')
      } else {
        await api.post('/favorites', { product_id: product.id })
        message.success('已添加收藏')
      }
      setProduct({ ...product, is_favorited: !product.is_favorited })
    } catch (err: any) {
      message.error(err.response?.data?.detail || '操作失败')
    }
  }

  const addToCart = async () => {
    if (!product) return
    setAdding(true)
    try {
      await api.post('/cart/items', { product_id: product.id, quantity })
      message.success(`已加入购物车：${product.name}`)
      const cartRes = await api.get('/cart')
      setCart(cartRes.data.items, cartRes.data.total_amount)
    } catch (err: any) {
      message.error(err.response?.data?.detail || '加入购物车失败')
    } finally {
      setAdding(false)
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
  if (!product) return null

  // 移动端布局
  if (isMobile) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#fff', padding: '12px 16px', borderBottom: '1px solid #eee' }}>
          <Button type="text" onClick={() => navigate(-1)}>&lt; 返回</Button>
        </div>

        <div style={{ background: '#fff', padding: 16 }}>
          {product.image_url ? (
            <Image src={product.image_url} alt={product.name} style={{ width: '100%', height: 250, objectFit: 'contain' }} />
          ) : (
            <div style={{ height: 250, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Text type="secondary">暂无图片</Text>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {product.category_name && <Tag color="primary" style={{ marginBottom: 8 }}>{product.category_name}</Tag>}
          <Title level={4} style={{ marginBottom: 8 }}>{product.name}</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>SKU：{product.sku}{product.spec && ` · ${product.spec}`}</Text>

          <Card style={{ marginBottom: 12 }}>
            <Text strong style={{ fontSize: 24, color: '#B12704' }}>¥{product.your_price?.toFixed(2) ?? '-'}</Text>
            <Text type="secondary"> / {product.unit}</Text>
            {product.list_price && product.list_price !== product.your_price && (
              <Text type="secondary" style={{ display: 'block', textDecoration: 'line-through' }}>标价：¥{product.list_price.toFixed(2)}</Text>
            )}
          </Card>

          <Card style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>库存</span>
              {product.inventory && <StockTag status={product.inventory.status} available={product.inventory.available} />}
            </div>
            {product.min_order_qty > 1 && <Text type="secondary" style={{ fontSize: 12 }}>最小起订量：{product.min_order_qty}{product.unit}</Text>}
          </Card>

          {product.description && (
            <Card title="商品说明" style={{ marginBottom: 12 }}>
              <Text>{product.description}</Text>
            </Card>
          )}
        </div>

        <div style={{ background: '#fff', borderTop: '1px solid #eee', padding: '12px 16px', display: 'flex', gap: 12 }}>
          <Button variant="outlined" onClick={toggleFavorite} style={{ flex: 1 }}>
            {product.is_favorited ? <HeartFilled /> : <HeartOutlined />}
            {product.is_favorited ? '已收藏' : '收藏'}
          </Button>
          <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
            <InputNumber min={product.min_order_qty} value={quantity} onChange={v => setQuantity(v || product.min_order_qty)} style={{ width: 80 }} />
            <Button type="primary" loading={adding} disabled={product.inventory?.status === 'out_of_stock'} onClick={addToCart} style={{ flex: 1 }}>
              加入购物车
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // PC端布局
  return (
    <div>
      <Button onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>&lt; 返回</Button>

      <Row gutter={32}>
        <Col span={10}>
          <Card>
            {product.image_url ? (
              <Image src={product.image_url} alt={product.name} style={{ width: '100%', maxHeight: 400, objectFit: 'contain' }} />
            ) : (
              <div style={{ height: 300, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Text type="secondary">暂无图片</Text>
              </div>
            )}
          </Card>
        </Col>

        <Col span={14}>
          <Card>
            {product.category_name && <Tag color="primary" style={{ marginBottom: 8 }}>{product.category_name}</Tag>}
            <Title level={3} style={{ marginBottom: 8 }}>{product.name}</Title>
            <Text type="secondary">SKU：{product.sku}</Text>
            {product.spec && <Text type="secondary"> · 规格：{product.spec}</Text>}

            <Card style={{ background: '#fafafa', marginTop: 16, marginBottom: 16 }}>
              {product.list_price && product.list_price !== product.your_price && (
                <Text type="secondary" style={{ textDecoration: 'line-through' }}>标价：¥{product.list_price.toFixed(2)} / {product.unit}</Text>
              )}
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#B12704' }}>¥{product.your_price?.toFixed(2) ?? '-'}</div>
              <Text type="secondary"> / {product.unit}</Text>
            </Card>

            <div style={{ marginBottom: 16 }}>
              <Text strong>库存：</Text>
              {product.inventory && <StockTag status={product.inventory.status} available={product.inventory.available} />}
              {product.min_order_qty > 1 && <Text type="secondary" style={{ marginLeft: 12 }}>最小起订量：{product.min_order_qty}{product.unit}</Text>}
            </div>

            {product.description && (
              <div style={{ marginBottom: 16 }}>
                <Text strong>商品说明：</Text>
                <Text style={{ display: 'block', marginTop: 4 }}>{product.description}</Text>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Text>数量：</Text>
              <InputNumber min={product.min_order_qty} value={quantity} onChange={v => setQuantity(v || product.min_order_qty)} addonAfter={product.unit} />
              <Button type="primary" size="large" icon={<ShoppingCartOutlined />} loading={adding} disabled={product.inventory?.status === 'out_of_stock'} onClick={addToCart}>
                加入购物车
              </Button>
              <Button size="large" icon={product.is_favorited ? <HeartFilled style={{ color: '#B12704' }} /> : <HeartOutlined />} onClick={toggleFavorite}>
                {product.is_favorited ? '已收藏' : '收藏'}
              </Button>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}