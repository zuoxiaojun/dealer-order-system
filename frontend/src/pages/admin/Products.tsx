import { useState, useEffect } from 'react'
import { Table, Tag, Space, Button, Input, Select, Modal, Form, InputNumber, message, Switch } from 'antd'
import adminApi from '../../api/adminClient'

const STATUS_LABELS: Record<string, string> = { 'true': '上架', 'false': '下架' }
const STATUS_COLORS: Record<string, string> = { 'true': 'green', 'false': 'default' }

export default function AdminProducts() {
  const [data, setData] = useState<any>({ items: [], total: 0 })
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filters, setFilters] = useState<any>({})
  const [editVisible, setEditVisible] = useState(false)
  const [priceVisible, setPriceVisible] = useState(false)
  const [inventoryVisible, setInventoryVisible] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [form] = Form.useForm()
  const [priceForm] = Form.useForm()
  const [invForm] = Form.useForm()

  useEffect(() => { fetchProducts() }, [page, pageSize, filters])

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const params: any = { page, page_size: pageSize }
      if (filters.search) params.search = filters.search
      if (filters.is_active !== undefined) params.is_active = filters.is_active
      const res = await adminApi.get('/products', { params })
      setData(res.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleToggleActive = async (product: any) => {
    try {
      const res = await adminApi.post(`/products/${product.id}/toggle-active`)
      message.success(res.data.is_active ? '已上架' : '已下架')
      fetchProducts()
    } catch (err: any) { message.error(err.response?.data?.detail || '操作失败') }
  }

  const handleEdit = (product: any) => {
    setSelectedProduct(product)
    form.setFieldsValue(product)
    setEditVisible(true)
  }

  const handleUpdate = async () => {
    try {
      await adminApi.put(`/products/${selectedProduct.id}`, form.getFieldsValue())
      message.success('更新成功')
      setEditVisible(false)
      fetchProducts()
    } catch (err: any) { message.error(err.response?.data?.detail || '更新失败') }
  }

  const handleEditPrice = (product: any) => {
    setSelectedProduct(product)
    priceForm.setFieldsValue({ list_price: product.list_price })
    setPriceVisible(true)
  }

  const handleUpdatePrice = async () => {
    try {
      await adminApi.put(`/products/${selectedProduct.id}/price`, priceForm.getFieldsValue())
      message.success('价格已更新')
      setPriceVisible(false)
      fetchProducts()
    } catch (err: any) { message.error(err.response?.data?.detail || '更新失败') }
  }

  const handleEditInventory = (product: any) => {
    setSelectedProduct(product)
    invForm.setFieldsValue({ warehouse_id: 1, quantity: 0 })
    setInventoryVisible(true)
  }

  const handleUpdateInventory = async () => {
    try {
      await adminApi.put(`/products/${selectedProduct.id}/inventory`, invForm.getFieldsValue())
      message.success('库存已更新')
      setInventoryVisible(false)
      fetchProducts()
    } catch (err: any) { message.error(err.response?.data?.detail || '更新失败') }
  }

  const columns = [
    { title: 'SKU', dataIndex: 'sku', width: 120 },
    { title: '商品名称', dataIndex: 'name' },
    { title: '分类', dataIndex: 'category_name', width: 100 },
    { title: '单价', dataIndex: 'list_price', width: 100, render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '库存', dataIndex: 'total_stock', width: 80 },
    { title: '状态', dataIndex: 'is_active', width: 80, render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '上架' : '下架'}</Tag> },
    {
      title: '操作',
      width: 280,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Button size="small" onClick={() => handleEditPrice(record)}>价格</Button>
          <Button size="small" onClick={() => handleEditInventory(record)}>库存</Button>
          <Switch checkedChildren="上架" unCheckedChildren="下架" checked={record.is_active} onChange={() => handleToggleActive(record)} size="small" />
        </Space>
      ),
    },
  ]

  return (
    <div>
      <h2>商品管理</h2>

      <Space style={{ marginBottom: 16 }}>
        <Input.Search placeholder="搜索商品名称/SKU" onSearch={(v) => { setFilters({ ...filters, search: v }); setPage(1); }} style={{ width: 200 }} />
        <Select placeholder="状态" allowClear onChange={(v) => { setFilters({ ...filters, is_active: v }); setPage(1); }} style={{ width: 100 }}>
          <Select.Option value={true}>上架</Select.Option>
          <Select.Option value={false}>下架</Select.Option>
        </Select>
        <Button onClick={fetchProducts}>刷新</Button>
      </Space>

      <Table columns={columns} dataSource={data.items} rowKey="id" loading={loading} pagination={{
        current: page, pageSize, total: data.total,
        onChange: (p, ps) => { setPage(p); setPageSize(ps); },
      }} />

      <Modal title="编辑商品" open={editVisible} onOk={handleUpdate} onCancel={() => setEditVisible(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="商品名称"><Input /></Form.Item>
          <Form.Item name="spec" label="规格"><Input /></Form.Item>
          <Form.Item name="unit" label="单位"><Input /></Form.Item>
          <Form.Item name="min_order_qty" label="最小起订量"><InputNumber min={1} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="修改价格" open={priceVisible} onOk={handleUpdatePrice} onCancel={() => setPriceVisible(false)}>
        <Form form={priceForm} layout="vertical">
          <Form.Item name="list_price" label="标价"><InputNumber min={0} step={0.01} style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="修改库存" open={inventoryVisible} onOk={handleUpdateInventory} onCancel={() => setInventoryVisible(false)}>
        <Form form={invForm} layout="vertical">
          <Form.Item name="warehouse_id" label="仓库"><InputNumber min={1} /></Form.Item>
          <Form.Item name="quantity" label="库存数量"><InputNumber min={0} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}