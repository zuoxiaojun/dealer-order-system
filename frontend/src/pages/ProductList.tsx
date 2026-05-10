import { useState, useEffect, useCallback } from 'react'
import { Row, Col, Card, Image, Input, Select, Button, Typography, Spin, Tag, message } from 'antd'
import { SearchOutlined, HeartOutlined, HeartFilled, ShoppingCartOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useCartStore } from '../store/cart'

const { Text, Title } = Typography
const { Option } = Select

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
}

interface Category {
  id: number
  name: string
  children: Category[]
}

interface ProductListResponse {
  items: Product[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

const BREAKPOINT = 768

function StockTag({ status, available }: { status: string; available: number }) {
  if (status === 'out_of_stock') return <Tag color="error">缺货</Tag>
  if (status === 'low_stock') return <Tag color="warning">库存紧张({available})</Tag>
  return <Tag color="success">有货({available})</Tag>
}

export default function ProductList() {
  const navigate = useNavigate()
  const { setCart } = useCartStore()

  const [isMobile, setIsMobile] = useState(false)
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [showCategories, setShowCategories] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1 })
  const [searchValue, setSearchValue] = useState('')

  const checkMobile = useCallback(() => {
    setIsMobile(window.innerWidth < BREAKPOINT)
  }, [])

  useEffect(() => {
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [checkMobile])

  const fetchProducts = useCallback(async (page = 1, keyword = '') => {
    setLoading(true)
    try {
      const params: Record<string, any> = {
        page,
        page_size: 20,
        keyword: keyword || undefined,
        category_id: selectedCategory || undefined,
      }
      const res = await api.get<ProductListResponse>('/products', { params })
      setProducts(res.data.items)
      setPagination({
        page: res.data.page,
        total_pages: res.data.total_pages,
      })
    } catch {
      message.error('加载商品失败')
    } finally {
      setLoading(false)
    }
  }, [selectedCategory])

  const fetchCategories = async () => {
    try {
      const res = await api.get<Category[]>('/products/categories')
      setCategories(res.data)
    } catch { /* 忽略 */ }
  }

  useEffect(() => { fetchCategories() }, [])
  useEffect(() => { fetchProducts() }, [fetchProducts])

  const addToCart = async (product: Product) => {
    try {
      await api.post('/cart/items', { product_id: product.id, quantity: product.min_order_qty })
      message.success(`已加入购物车：${product.name}`)
      const cartRes = await api.get('/cart')
      setCart(cartRes.data.items, cartRes.data.total_amount)
    } catch (err: any) {
      message.error(err.response?.data?.detail || '加入购物车失败')
    }
  }

  const toggleFavorite = async (product: Product, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      if (product.is_favorited) {
        await api.delete(`/favorites/${product.id}`)
        message.success('已取消收藏')
      } else {
        await api.post('/favorites', { product_id: product.id })
        message.success('已添加收藏')
      }
      fetchProducts()
    } catch {
      message.error('操作失败')
    }
  }

  const flattenCategories = (cats: Category[], depth = 0): Category[] => {
    let result: Category[] = []
    for (const c of cats) {
      result.push({ ...c, name: (depth > 0 ? '　'.repeat(depth) + '└ ' : '') + c.name })
      if (c.children?.length) result = result.concat(flattenCategories(c.children, depth + 1))
    }
    return result
  }

  // 移动端布局
  if (isMobile) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* 搜索栏 */}
        <div style={{ background: '#fff', padding: '8px 12px', borderBottom: '1px solid #eee' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              placeholder="搜索商品..."
              prefix={<SearchOutlined style={{ color: '#999' }} />}
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              onPressEnter={() => fetchProducts(1, searchValue)}
              style={{ flex: 1 }}
              allowClear
            />
            <Button onClick={() => setShowCategories(!showCategories)}>
              分类
            </Button>
          </div>
        </div>

        {/* 分类筛选 */}
        {showCategories && (
          <div style={{ background: '#fff', padding: '8px 12px', borderBottom: '1px solid #eee' }}>
            <Select
              placeholder="选择分类"
              style={{ width: '100%' }}
              allowClear
              value={selectedCategory}
              onChange={v => { setSelectedCategory(v ?? null); setPagination(p => ({ ...p, page: 1 })) }}
            >
              {flattenCategories(categories).map(cat => (
                <Option key={cat.id} value={cat.id}>{cat.name}</Option>
              ))}
            </Select>
          </div>
        )}

        {/* 商品列表 */}
        <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
          ) : products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>暂无商品</div>
          ) : (
            <Row gutter={[8, 8]}>
              {products.map(p => (
                <Col span={12} key={p.id}>
                  <Card
                    hoverable
                    onClick={() => navigate(`/products/${p.id}`)}
                    bodyStyle={{ padding: 8 }}
                  >
                    {p.image_url ? (
                      <Image
                        src={p.image_url}
                        alt={p.name}
                        style={{ width: '100%', height: 120, objectFit: 'contain' }}
                      />
                    ) : (
                      <div style={{ height: 120, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Text type="secondary">暂无图片</Text>
                      </div>
                    )}
                    <div style={{ fontSize: 13, fontWeight: 500, margin: '8px 0 4px', lineHeight: 1.3, height: 38, overflow: 'hidden' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#999' }}>{p.sku}</div>
                    <div style={{ marginTop: 4 }}>
                      <Text strong style={{ color: '#B12704', fontSize: 16 }}>¥{p.your_price?.toFixed(2) ?? '-'}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}> / {p.unit}</Text>
                    </div>
                    {p.inventory && <StockTag status={p.inventory.status} available={p.inventory.available} />}
                    {p.min_order_qty > 1 && (
                      <Text type="secondary" style={{ fontSize: 11 }}>起订：{p.min_order_qty}{p.unit}</Text>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                      <Button
                        size="small"
                        icon={p.is_favorited ? <HeartFilled style={{ color: '#ff7000' }} /> : <HeartOutlined />}
                        onClick={(e) => toggleFavorite(p, e)}
                      />
                      <Button
                        size="small"
                        type="primary"
                        icon={<ShoppingCartOutlined />}
                        onClick={(e) => { e.stopPropagation(); addToCart(p) }}
                        disabled={p.inventory?.status === 'out_of_stock'}
                      />
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </div>

        {/* 分页 */}
        {pagination.total_pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, padding: '12px', background: '#fff', borderTop: '1px solid #eee' }}>
            <Button disabled={pagination.page <= 1} onClick={() => fetchProducts(pagination.page - 1, searchValue)}>上一页</Button>
            <span style={{ lineHeight: '32px' }}>{pagination.page} / {pagination.total_pages}</span>
            <Button disabled={pagination.page >= pagination.total_pages} onClick={() => fetchProducts(pagination.page + 1, searchValue)}>下一页</Button>
          </div>
        )}
      </div>
    )
  }

  // PC端布局 - 左侧筛选 + 右侧商品网格
  return (
    <Row gutter={16} style={{ minHeight: 'calc(100vh - 120px)' }}>
      {/* 左侧筛选栏 */}
      <Col span={5}>
        <Card size="small" title="商品分类" extra={<a onClick={() => { setSelectedCategory(null); setPagination(p => ({ ...p, page: 1 })) }}>清除</a>}>
          {flattenCategories(categories).map(cat => (
            <div
              key={cat.id}
              onClick={() => { setSelectedCategory(cat.id); setPagination(p => ({ ...p, page: 1 })) }}
              style={{
                padding: '4px 8px',
                cursor: 'pointer',
                color: selectedCategory === cat.id ? '#B12704' : undefined,
                fontWeight: selectedCategory === cat.id ? 'bold' : undefined,
                background: selectedCategory === cat.id ? '#fff5f5' : undefined,
                borderRadius: 4,
                marginBottom: 2,
              }}
            >
              {cat.name}
            </div>
          ))}
        </Card>

        <Card size="small" title="库存状态" style={{ marginTop: 12 }}>
          {[
            { key: 'all', label: '全部' },
            { key: 'in_stock', label: '有货' },
            { key: 'low_stock', label: '库存紧张' },
            { key: 'out_of_stock', label: '缺货' },
          ].map(opt => (
            <div key={opt.key} style={{ padding: '4px 8px', cursor: 'pointer' }}>
              {opt.label}
            </div>
          ))}
        </Card>
      </Col>

      {/* 右侧商品列表 */}
      <Col span={19}>
        {/* 搜索栏 */}
        <Card size="small" style={{ marginBottom: 12 }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Input
                placeholder="搜索商品名称 / SKU / 规格..."
                prefix={<SearchOutlined style={{ color: '#999' }} />}
                value={searchValue}
                onChange={e => setSearchValue(e.target.value)}
                onPressEnter={() => fetchProducts(1, searchValue)}
                style={{ width: 300 }}
                allowClear
              />
            </Col>
            <Col>
              <Text type="secondary">共 {pagination.total_pages * 20} 个商品</Text>
            </Col>
          </Row>
        </Card>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
        ) : (
          <Row gutter={[16, 16]}>
            {products.map(p => (
              <Col span={6} key={p.id}>
                <Card
                  hoverable
                  onClick={() => navigate(`/products/${p.id}`)}
                  cover={
                    p.image_url ? (
                      <Image
                        src={p.image_url}
                        alt={p.name}
                        style={{ height: 160, objectFit: 'contain', padding: 8 }}
                      />
                    ) : (
                      <div style={{ height: 160, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Text type="secondary">暂无图片</Text>
                      </div>
                    )
                  }
                  actions={[
                    <Button key="fav" type="text" icon={p.is_favorited ? <HeartFilled style={{ color: '#B12704' }} /> : <HeartOutlined />} onClick={(e) => toggleFavorite(p, e)} />,
                    <Button key="cart" type="text" icon={<ShoppingCartOutlined />} onClick={(e) => { e.stopPropagation(); addToCart(p) }} disabled={p.inventory?.status === 'out_of_stock'} />,
                  ]}
                >
                  <Card.Meta
                    title={<Text ellipsis={{ tooltip: p.name }}>{p.name}</Text>}
                    description={<><Text type="secondary" style={{ fontSize: 12 }}>{p.sku}</Text></>}
                  />
                  <div style={{ marginTop: 8 }}>
                    <Text strong style={{ color: '#B12704', fontSize: 16 }}>¥{p.your_price?.toFixed(2) ?? '-'}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}> / {p.unit}</Text>
                  </div>
                  {p.inventory && <StockTag status={p.inventory.status} available={p.inventory.available} />}
                  {p.min_order_qty > 1 && <Text type="secondary" style={{ fontSize: 11 }}>起订：{p.min_order_qty}{p.unit}</Text>}
                </Card>
              </Col>
            ))}
          </Row>
        )}

        {pagination.total_pages > 1 && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Button disabled={pagination.page <= 1} onClick={() => fetchProducts(pagination.page - 1, searchValue)}>上一页</Button>
            <Text style={{ margin: '0 16px' }}>第 {pagination.page} / {pagination.total_pages} 页</Text>
            <Button disabled={pagination.page >= pagination.total_pages} onClick={() => fetchProducts(pagination.page + 1, searchValue)}>下一页</Button>
          </div>
        )}
      </Col>
    </Row>
  )
}