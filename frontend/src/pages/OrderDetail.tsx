import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Table, Tag, Typography, Button, Card, Space, Spin, message, Timeline, Row, Col } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import api from '../api/client'

const { Text, Title } = Typography

interface OrderItem {
  id: number
  product_id: number
  product_name: string
  sku: string
  unit_price: number
  quantity: number
  subtotal: number
}

interface TimelineStep {
  status: string
  label: string
  time: string | null
  note: string | null
}

interface OrderDetail {
  id: number
  order_no: string
  status: string
  total_amount: number
  discount_amount: number
  net_amount: number
  warehouse_name: string | null
  remark: string | null
  rejection_reason: string | null
  items: OrderItem[]
  status_timeline: TimelineStep[]
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

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(false)
  const [loading, setLoading] = useState(false)
  const [order, setOrder] = useState<OrderDetail | null>(null)

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
    api.get<OrderDetail>(`/orders/${id}`)
      .then(r => setOrder(r.data))
      .catch(() => message.error('加载订单详情失败'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
  if (!order) return null

  const s = STATUS_MAP[order.status] || { label: order.status, color: 'default' }

  const itemColumns = [
    { title: '商品', dataIndex: 'product_name', key: 'product_name' },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', render: (v: string) => <Text type="secondary">{v}</Text> },
    { title: '单价', dataIndex: 'unit_price', key: 'unit_price', render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '数量', dataIndex: 'quantity', key: 'quantity' },
    { title: '小计', dataIndex: 'subtotal', key: 'subtotal', render: (v: number) => <Text strong>¥{v.toFixed(2)}</Text> },
  ]

  // 移动端布局
  if (isMobile) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#fff', padding: '12px 16px', borderBottom: '1px solid #eee' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/orders')} type="text">返回</Button>
        </div>

        <div style={{
          background: order.status === 'rejected' ? '#fff2f0' : order.status === 'completed' ? '#f6ffed' : '#f0f5ff',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Text type="secondary">订单号</Text>
              <Title level={4} style={{ margin: 0 }}>{order.order_no}</Title>
            </div>
            <Tag color={s.color} style={{ fontSize: 14 }}>{s.label}</Tag>
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>下单时间：{new Date(order.created_at).toLocaleString('zh-CN')}</Text>

          {order.rejection_reason && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: '#fff', borderRadius: 8, borderLeft: '3px solid #ff4d4f' }}>
              <Text type="secondary">拒绝原因：</Text>
              <Text style={{ color: '#cf1322' }}>{order.rejection_reason}</Text>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
          <Card title="商品明细" style={{ marginBottom: 8 }}>
            {order.items.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                <div style={{ flex: 1 }}>
                  <Text>{item.product_name}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>{item.sku}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>¥{item.unit_price.toFixed(2)} × {item.quantity}</Text>
                </div>
                <Text strong style={{ color: '#B12704' }}>¥{item.subtotal.toFixed(2)}</Text>
              </div>
            ))}
            <div style={{ paddingTop: 12, textAlign: 'right' }}>
              <Text>商品总额：¥{order.total_amount.toFixed(2)}</Text>
              {order.discount_amount > 0 && <Text type="secondary" style={{ display: 'block' }}>优惠：-¥{order.discount_amount.toFixed(2)}</Text>}
              <Title level={4} style={{ color: '#B12704' }}>实付：¥{order.net_amount.toFixed(2)}</Title>
            </div>
          </Card>

          <Card title="订单跟踪" style={{ marginBottom: 16 }}>
            <Timeline
              items={order.status_timeline.map(step => ({
                color: step.status === 'rejected' ? 'red' : step.status === 'completed' ? 'green' : 'blue',
                children: (
                  <div>
                    <Text strong>{step.label}</Text>
                    <br />
                    {step.time && <Text type="secondary" style={{ fontSize: 12 }}>{new Date(step.time).toLocaleString('zh-CN')}</Text>}
                    {step.note && <Text type="secondary" style={{ fontSize: 12 }}>{step.note}</Text>}
                  </div>
                ),
              }))}
            />
          </Card>
        </div>
      </div>
    )
  }

  // PC端布局
  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/orders')} style={{ marginBottom: 16 }}>
        返回订单列表
      </Button>

      <Card
        style={{ marginBottom: 16, background: order.status === 'rejected' ? '#fff2f0' : order.status === 'completed' ? '#f6ffed' : '#f0f5ff' }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <div>
            <Text type="secondary">订单号</Text>
            <Title level={4} style={{ margin: 0 }}>{order.order_no}</Title>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Tag color={s.color} style={{ fontSize: 16, padding: '4px 12px' }}>{s.label}</Tag>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>下单时间：{new Date(order.created_at).toLocaleString('zh-CN')}</Text>
          </div>
        </Space>

        {order.rejection_reason && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: '#fff', borderRadius: 4, borderLeft: '3px solid #ff4d4f' }}>
            <Text type="secondary">拒绝原因：</Text>
            <Text style={{ color: '#cf1322' }}>{order.rejection_reason}</Text>
          </div>
        )}
      </Card>

      <Row gutter={16} align="top">
        <Col span={16}>
          <Card title="商品明细">
            <Table
              columns={itemColumns}
              dataSource={order.items}
              rowKey="id"
              pagination={false}
              footer={() => (
                <div style={{ textAlign: 'right' }}>
                  <Space direction="vertical" align="end">
                    <Text>商品总额：¥{order.total_amount.toFixed(2)}</Text>
                    {order.discount_amount > 0 && <Text type="secondary">优惠：-¥{order.discount_amount.toFixed(2)}</Text>}
                    <Title level={4} style={{ color: '#B12704' }}>实付：¥{order.net_amount.toFixed(2)}</Title>
                  </Space>
                </div>
              )}
            />
            {order.remark && (
              <div style={{ marginTop: 12 }}>
                <Text type="secondary">订单备注：</Text>
                <Text>{order.remark}</Text>
              </div>
            )}
          </Card>
        </Col>
        <Col span={8}>
          <Card title="订单跟踪">
            <Timeline
              items={order.status_timeline.map(step => ({
                color: step.status === 'rejected' ? 'red' : step.status === 'completed' ? 'green' : 'blue',
                children: (
                  <div>
                    <Text strong>{step.label}</Text>
                    <br />
                    {step.time && <Text type="secondary" style={{ fontSize: 12 }}>{new Date(step.time).toLocaleString('zh-CN')}</Text>}
                    {step.note && <Text type="secondary" style={{ fontSize: 12 }}>{step.note}</Text>}
                  </div>
                ),
              }))}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}