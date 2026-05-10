import { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Table, Tag, Space, Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import adminApi from '../../api/adminClient'
import { useAdminStore } from '../../store/adminAuth'

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { admin } = useAdminStore()

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const res = await adminApi.get('/stats')
      setStats(res.data)
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2>管理控制台</h2>
      <p>欢迎，{admin?.full_name}</p>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic title="待处理订单" value={stats.pending_orders} />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic title="今日订单" value={stats.today_orders} />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic title="今日金额" value={stats.today_amount} prefix="¥" />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic title="本月订单" value={stats.month_orders} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={8}>
          <Card title="快捷操作">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button block onClick={() => navigate('/admin/orders')}>订单管理</Button>
              <Button block onClick={() => navigate('/admin/products')}>商品管理</Button>
              <Button block onClick={() => navigate('/admin/dealers')}>经销商管理</Button>
            </Space>
          </Card>
        </Col>
        <Col span={16}>
          <Card title="操作指南">
            <ul>
              <li>在"订单管理"中可以审核经销商提交的订单</li>
              <li>在"商品管理"中可以上架/下架商品，修改价格和库存</li>
              <li>在"经销商管理"中可以维护经销商信息和重置密码</li>
            </ul>
          </Card>
        </Col>
      </Row>
    </div>
  )
}