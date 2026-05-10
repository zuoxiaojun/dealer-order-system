import { useState, useEffect, useCallback } from 'react'
import { Table, Card, Tag, Button, Modal, Input, message, Spin, Typography, Row, Col } from 'antd'
import api from '../api/client'

const { Text } = Typography

interface OrderSummary {
  order_no: string
  order_date: string
  net_amount: number
  paid_amount: number
  outstanding: number
  status: string
}

interface MonthlyRecon {
  period: string
  total_orders: number
  total_amount: number
  total_paid: number
  outstanding: number
  status: string
  details: OrderSummary[]
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '待确认', color: 'warning' },
  confirmed: { label: '已确认', color: 'primary' },
  disputed: { label: '有异议', color: 'danger' },
  settled: { label: '已结清', color: 'success' },
}

const BREAKPOINT = 768

export default function Reconciliation() {
  const [isMobile, setIsMobile] = useState(false)
  const [loading, setLoading] = useState(false)
  const [monthlyList, setMonthlyList] = useState<MonthlyRecon[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null)
  const [detailData, setDetailData] = useState<MonthlyRecon | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [disputeModalOpen, setDisputeModalOpen] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [detailModalOpen, setDetailModalOpen] = useState(false)

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
    api.get<MonthlyRecon[]>('/reconciliation/monthly')
      .then(r => setMonthlyList(r.data))
      .catch(() => message.error('加载对账数据失败'))
      .finally(() => setLoading(false))
  }, [])

  const showDetail = async (period: string) => {
    setSelectedPeriod(period)
    setDetailLoading(true)
    setDetailModalOpen(true)
    try {
      const res = await api.get<MonthlyRecon>(`/reconciliation/monthly/${period}`)
      setDetailData(res.data)
    } catch {
      message.error('加载明细失败')
    } finally {
      setDetailLoading(false)
    }
  }

  const submitDispute = async () => {
    if (!disputeReason.trim()) {
      message.warning('请输入异议原因')
      return
    }
    try {
      await api.post(`/reconciliation/dispute/${selectedPeriod}`, { reason: disputeReason })
      message.success('异议已提交')
      setDisputeModalOpen(false)
      setDisputeReason('')
      const res = await api.get<MonthlyRecon[]>('/reconciliation/monthly')
      setMonthlyList(res.data)
      if (selectedPeriod) {
        const detailRes = await api.get<MonthlyRecon>(`/reconciliation/monthly/${selectedPeriod}`)
        setDetailData(detailRes.data)
      }
    } catch {
      message.error('提交失败')
    }
  }

  const columns = [
    {
      title: '账期',
      dataIndex: 'period',
      key: 'period',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: '订单数',
      dataIndex: 'total_orders',
      key: 'total_orders',
      width: 80,
    },
    {
      title: '应付总额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 120,
      render: (v: number) => `¥${v.toFixed(2)}`,
    },
    {
      title: '已付金额',
      dataIndex: 'total_paid',
      key: 'total_paid',
      width: 120,
      render: (v: number) => <Text style={{ color: '#52c41a' }}>¥{v.toFixed(2)}</Text>,
    },
    {
      title: '未付金额',
      dataIndex: 'outstanding',
      key: 'outstanding',
      width: 120,
      render: (v: number) => <Text style={{ color: v > 0 ? '#B12704' : '#52c41a' }}>¥{v.toFixed(2)}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => {
        const s = STATUS_MAP[v] || { label: v, color: 'default' }
        return <Tag color={s.color}>{s.label}</Tag>
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, r: MonthlyRecon) => (
        <Button type="link" onClick={() => showDetail(r.period)}>查看明细</Button>
      ),
    },
  ]

  // 移动端布局
  if (isMobile) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#fff', padding: '12px 16px', borderBottom: '1px solid #eee' }}>
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>📊 在线对账</div>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
          ) : monthlyList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>暂无对账数据</div>
          ) : (
            <div style={{ padding: 8 }}>
              {monthlyList.map(item => {
                const s = STATUS_MAP[item.status] || { label: item.status, color: 'default' }
                return (
                  <Card
                    key={item.period}
                    size="small"
                    hoverable
                    onClick={() => showDetail(item.period)}
                    style={{ marginBottom: 8 }}
                    bodyStyle={{ padding: 12 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 500 }}>{item.period}</span>
                      <Tag color={s.color}>{s.label}</Tag>
                    </div>
                    <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
                      订单数：{item.total_orders} · 应付：¥{item.total_amount.toFixed(2)}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: item.outstanding > 0 ? '#B12704' : '#52c41a' }}>
                        未付：¥{item.outstanding.toFixed(2)}
                      </span>
                      <span style={{ fontSize: 14, color: '#52c41a' }}>
                        已付：¥{item.total_paid.toFixed(2)}
                      </span>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* 明细弹窗 */}
        <Modal
          open={detailModalOpen}
          title={selectedPeriod ? `${selectedPeriod} 对账明细` : ''}
          onCancel={() => { setDetailModalOpen(false); setDetailData(null); setSelectedPeriod(null) }}
          footer={detailData?.status === 'pending' ? [
            <Button key="dispute" danger onClick={() => { setDetailModalOpen(false); setDisputeModalOpen(true) }}>提交异议</Button>,
            <Button key="close" onClick={() => { setDetailModalOpen(false); setDetailData(null); setSelectedPeriod(null) }}>关闭</Button>
          ] : [
            <Button key="close" onClick={() => { setDetailModalOpen(false); setDetailData(null); setSelectedPeriod(null) }}>关闭</Button>
          ]}
        >
          {detailLoading ? (
            <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
          ) : detailData ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
                <span>应付总额</span>
                <span style={{ fontWeight: 'bold', color: '#B12704' }}>¥{detailData.total_amount.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
                <span>已付金额</span>
                <span style={{ color: '#52c41a' }}>¥{detailData.total_paid.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
                <span>未付金额</span>
                <span style={{ fontWeight: 'bold' }}>¥{detailData.outstanding.toFixed(2)}</span>
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>订单明细</div>
                {detailData.details.map(d => (
                  <div key={d.order_no} style={{
                    padding: '8px 0',
                    borderBottom: '1px solid #f5f5f5',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontSize: 13 }}>{d.order_no}</div>
                      <div style={{ fontSize: 11, color: '#999' }}>{d.order_date}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13 }}>¥{d.net_amount.toFixed(2)}</div>
                      <Tag color={STATUS_MAP[d.status]?.color} style={{ fontSize: 10 }}>{STATUS_MAP[d.status]?.label}</Tag>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Modal>

        {/* 异议弹窗 */}
        <Modal
          open={disputeModalOpen}
          title="提交对账异议"
          onCancel={() => setDisputeModalOpen(false)}
          footer={[
            <Button key="cancel" onClick={() => setDisputeModalOpen(false)}>取消</Button>,
            <Button key="submit" type="primary" onClick={submitDispute}>提交</Button>
          ]}
        >
          <div>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
              请详细描述您对对账数据的异议原因，我们将尽快处理。
            </div>
            <Input.TextArea
              rows={4}
              value={disputeReason}
              onChange={e => setDisputeReason(e.target.value)}
              placeholder="请输入异议原因..."
            />
          </div>
        </Modal>
      </div>
    )
  }

  // PC端布局
  return (
    <div>
      <Text strong style={{ fontSize: 18 }}>📊 在线对账</Text>

      <Card style={{ marginTop: 12 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
        ) : monthlyList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>暂无对账数据</div>
        ) : (
          <Table columns={columns} dataSource={monthlyList} rowKey="period" pagination={false} />
        )}
      </Card>

      {/* 明细弹窗 */}
      <Modal
        open={detailModalOpen}
        title={selectedPeriod ? `${selectedPeriod} 对账明细` : ''}
        onCancel={() => { setDetailModalOpen(false); setDetailData(null); setSelectedPeriod(null) }}
        width={700}
        footer={detailData?.status === 'pending' ? [
          <Button key="dispute" danger onClick={() => { setDetailModalOpen(false); setDisputeModalOpen(true) }}>提交异议</Button>,
          <Button key="close" onClick={() => { setDetailModalOpen(false); setDetailData(null); setSelectedPeriod(null) }}>关闭</Button>
        ] : [
          <Button key="close" onClick={() => { setDetailModalOpen(false); setDetailData(null); setSelectedPeriod(null) }}>关闭</Button>
        ]}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
        ) : detailData ? (
          <div>
            <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <div style={{ padding: 12, background: '#fafafa', borderRadius: 4 }}>
                  <Text type="secondary">应付总额</Text>
                  <div style={{ fontSize: 18, fontWeight: 'bold', color: '#B12704' }}>¥{detailData.total_amount.toFixed(2)}</div>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ padding: 12, background: '#f6fffd', borderRadius: 4 }}>
                  <Text type="secondary">已付金额</Text>
                  <div style={{ fontSize: 18, fontWeight: 'bold', color: '#52c41a' }}>¥{detailData.total_paid.toFixed(2)}</div>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ padding: 12, background: '#fff2f0', borderRadius: 4 }}>
                  <Text type="secondary">未付金额</Text>
                  <div style={{ fontSize: 18, fontWeight: 'bold' }}>¥{detailData.outstanding.toFixed(2)}</div>
                </div>
              </Col>
            </Row>

            <Table
              dataSource={detailData.details}
              rowKey="order_no"
              pagination={false}
              size="small"
              columns={[
                { title: '订单号', dataIndex: 'order_no', key: 'order_no' },
                { title: '订单日期', dataIndex: 'order_date', key: 'order_date' },
                { title: '订单金额', dataIndex: 'net_amount', key: 'net_amount', render: (v: number) => `¥${v.toFixed(2)}` },
                { title: '已付', dataIndex: 'paid_amount', key: 'paid_amount', render: (v: number) => `¥${v.toFixed(2)}` },
                { title: '未付', dataIndex: 'outstanding', key: 'outstanding', render: (v: number) => `¥${v.toFixed(2)}` },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  render: (v: string) => {
                    const s = STATUS_MAP[v] || { label: v, color: 'default' }
                    return <Tag color={s.color}>{s.label}</Tag>
                  },
                },
              ]}
            />
          </div>
        ) : null}
      </Modal>

      {/* 异议弹窗 */}
      <Modal
        open={disputeModalOpen}
        title="提交对账异议"
        onCancel={() => setDisputeModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setDisputeModalOpen(false)}>取消</Button>,
          <Button key="submit" type="primary" onClick={submitDispute}>提交</Button>
        ]}
      >
        <div>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
            请详细描述您对对账数据的异议原因，我们将尽快处理。
          </div>
          <Input.TextArea
            rows={4}
            value={disputeReason}
            onChange={e => setDisputeReason(e.target.value)}
            placeholder="请输入异议原因..."
          />
        </div>
      </Modal>
    </div>
  )
}