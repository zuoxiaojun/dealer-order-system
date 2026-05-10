import { useState, useEffect } from 'react'
import { Table, Tag, Space, Button, Select, DatePicker, Input, Modal, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import adminApi from '../../api/adminClient'

const STATUS_COLORS: Record<string, string> = {
  pending: 'orange',
  confirmed: 'blue',
  processing: 'purple',
  shipped: 'cyan',
  completed: 'green',
  cancelled: 'default',
  rejected: 'red',
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待审核',
  confirmed: '已确认',
  processing: '处理中',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消',
  rejected: '已拒绝',
}

export default function AdminOrders() {
  const [data, setData] = useState<any>({ items: [], total: 0 })
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filters, setFilters] = useState<any>({})
  const [selectedRow, setSelectedRow] = useState<any>(null)
  const [detailVisible, setDetailVisible] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetchOrders()
  }, [page, pageSize, filters])

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const params: any = { page, page_size: pageSize }
      if (filters.status) params.status = filters.status
      if (filters.search) params.search = filters.search
      const res = await adminApi.get('/orders', { params })
      setData(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async (order: any, action: string) => {
    try {
      await adminApi.post(`/orders/${order.id}/review`, { action })
      message.success(action === 'confirm' ? '审核通过' : '已拒绝')
      fetchOrders()
    } catch (err: any) {
      message.error(err.response?.data?.detail || '操作失败')
    }
  }

  const columns = [
    { title: '订单号', dataIndex: 'order_no', width: 150 },
    { title: '经销商', dataIndex: 'dealer_name', width: 120 },
    { title: '采购员', dataIndex: 'user_name', width: 100 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => <Tag color={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Tag>,
    },
    { title: '订单金额', dataIndex: 'net_amount', width: 120, render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '商品数', dataIndex: 'total_items', width: 80 },
    { title: '下单时间', dataIndex: 'created_at', width: 180, render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm') },
    {
      title: '操作',
      width: 200,
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" onClick={() => { setSelectedRow(record); setDetailVisible(true); }}>详情</Button>
          {record.status === 'pending' && (
            <>
              <Button size="small" type="primary" onClick={() => handleReview(record, 'confirm')}>通过</Button>
              <Button size="small" danger onClick={() => handleReview(record, 'reject')}>拒绝</Button>
            </>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <h2>订单管理</h2>

      <Space style={{ marginBottom: 16 }}>
        <Input.Search placeholder="搜索订单号/采购员" onSearch={(v) => { setFilters({ ...filters, search: v }); setPage(1); }} style={{ width: 200 }} />
        <Select placeholder="订单状态" allowClear onChange={(v) => { setFilters({ ...filters, status: v }); setPage(1); }} style={{ width: 120 }}>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <Select.Option key={k} value={k}>{v}</Select.Option>)}
        </Select>
        <Button onClick={fetchOrders}>刷新</Button>
      </Space>

      <Table
        columns={columns}
        dataSource={data.items}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total: data.total,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />

      <Modal title="订单详情" open={detailVisible} onCancel={() => setDetailVisible(false)} footer={null} width={700}>
        {selectedRow && (
          <div>
            <p><strong>订单号：</strong>{selectedRow.order_no}</p>
            <p><strong>经销商：</strong>{selectedRow.dealer_name}</p>
            <p><strong>采购员：</strong>{selectedRow.user_name}</p>
            <p><strong>状态：</strong><Tag color={STATUS_COLORS[selectedRow.status]}>{STATUS_LABELS[selectedRow.status]}</Tag></p>
            <p><strong>订单金额：</strong>¥{selectedRow.net_amount?.toFixed(2)}</p>
            <p><strong>下单时间：</strong>{dayjs(selectedRow.created_at).format('YYYY-MM-DD HH:mm:ss')}</p>
          </div>
        )}
      </Modal>
    </div>
  )
}