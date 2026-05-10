import { useState, useEffect } from 'react'
import { Table, Tag, Space, Button, Input, Select, Modal, Form, InputNumber, Popconfirm, message, Card, Row, Col } from 'antd'
import adminApi from '../../api/adminClient'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: '上架', color: 'green' },
  inactive: { label: '下架', color: 'default' },
  disabled: { label: '停用', color: 'orange' },
  deleted: { label: '已删除', color: 'red' },
}

export default function AdminProducts() {
  const [data, setData] = useState<any>({ items: [], total: 0 })
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filters, setFilters] = useState<any>({})
  const [createVisible, setCreateVisible] = useState(false)
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
      if (filters.status) params.status = filters.status
      if (filters.category_id) params.category_id = filters.category_id
      const res = await adminApi.get('/products', { params })
      setData(res.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleCreate = () => {
    form.resetFields()
    setCreateVisible(true)
  }

  const handleCreateSubmit = async () => {
    try {
      await form.validateFields()
      const values = form.getFieldsValue()
      await adminApi.post('/products', values)
      message.success('商品创建成功')
      setCreateVisible(false)
      fetchProducts()
    } catch (err: any) {
      message.error(err.response?.data?.detail || '创建失败')
    }
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

  const handleUpdateStatus = async (product: any, newStatus: string) => {
    try {
      await adminApi.put(`/products/${product.id}/status`, { status: newStatus })
      const labels: Record<string, string> = { active: '上架', inactive: '下架', disabled: '停用' }
      message.success(`已${labels[newStatus]}`)
      fetchProducts()
    } catch (err: any) { message.error(err.response?.data?.detail || '操作失败') }
  }

  const handleDelete = async (product: any) => {
    try {
      await adminApi.delete(`/products/${product.id}`)
      message.success('已删除')
      fetchProducts()
    } catch (err: any) { message.error(err.response?.data?.detail || '删除失败') }
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
    invForm.setFieldsValue({ warehouse_id: 1, quantity: product.total_stock || 0 })
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
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (v: string) => {
        const s = STATUS_MAP[v] || { label: v, color: 'default' }
        return <Tag color={s.color}>{s.label}</Tag>
      },
    },
    {
      title: '操作',
      width: 300,
      render: (_: any, record: any) => (
        <Space size="small">
          {record.status !== 'disabled' && record.status !== 'deleted' && (
            <>
              <Button size="small" onClick={() => handleEdit(record)}>编辑</Button>
              <Button size="small" onClick={() => handleEditPrice(record)}>价格</Button>
              <Button size="small" onClick={() => handleEditInventory(record)}>库存</Button>
            </>
          )}
          {record.status === 'disabled' && (
            <>
              <Button size="small" type="primary" onClick={() => handleUpdateStatus(record, 'active')}>上架</Button>
              <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record)}>
                <Button size="small" danger>删除</Button>
              </Popconfirm>
            </>
          )}
          {record.status === 'active' && (
            <Button size="small" onClick={() => handleUpdateStatus(record, 'inactive')}>下架</Button>
          )}
          {record.status === 'inactive' && (
            <Button size="small" onClick={() => handleUpdateStatus(record, 'disabled')}>停用</Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <h2>商品管理</h2>

      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={handleCreate}>新建商品</Button>
        <Input.Search placeholder="搜索商品名称/SKU" onSearch={(v) => { setFilters({ ...filters, search: v }); setPage(1); }} style={{ width: 200 }} />
        <Select
          placeholder="状态"
          allowClear
          onChange={(v) => { setFilters({ ...filters, status: v }); setPage(1); }}
          style={{ width: 100 }}
        >
          <Select.Option value="active">上架</Select.Option>
          <Select.Option value="inactive">下架</Select.Option>
          <Select.Option value="disabled">停用</Select.Option>
        </Select>
        <Button onClick={fetchProducts}>刷新</Button>
      </Space>

      <Table
        columns={columns}
        dataSource={data.items}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page, pageSize, total: data.total,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />

      <Modal
        title="新建商品"
        open={createVisible}
        onOk={handleCreateSubmit}
        onCancel={() => setCreateVisible(false)}
        okText="创建"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="商品名称" rules={[{ required: true, message: '请输入商品名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="sku" label="SKU编码" rules={[{ required: true, message: '请输入SKU编码' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category_id" label="分类">
            <Input type="number" />
          </Form.Item>
          <Form.Item name="spec" label="规格型号">
            <Input />
          </Form.Item>
          <Form.Item name="unit" label="单位" rules={[{ required: true, message: '请输入单位' }]}>
            <Input defaultValue="件" />
          </Form.Item>
          <Form.Item name="min_order_qty" label="最小起订量" rules={[{ required: true, message: '请输入最小起订量' }]}>
            <InputNumber min={1} defaultValue={1} />
          </Form.Item>
          <Form.Item name="list_price" label="标价" rules={[{ required: true, message: '请输入标价' }]}>
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="image_url" label="图片URL">
            <Input />
          </Form.Item>
          <Form.Item name="description" label="商品描述">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="编辑商品" open={editVisible} onOk={handleUpdate} onCancel={() => setEditVisible(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="商品名称"><Input /></Form.Item>
          <Form.Item name="spec" label="规格"><Input /></Form.Item>
          <Form.Item name="unit" label="单位"><Input /></Form.Item>
          <Form.Item name="min_order_qty" label="最小起订量"><InputNumber min={1} /></Form.Item>
          <Form.Item name="image_url" label="图片URL"><Input /></Form.Item>
          <Form.Item name="description" label="商品描述"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="修改价格" open={priceVisible} onOk={handleUpdatePrice} onCancel={() => setPriceVisible(false)}>
        <Form form={priceForm} layout="vertical">
          <Form.Item name="list_price" label="标价"><InputNumber min={0} step={0.01} style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="修改库存" open={inventoryVisible} onOk={handleUpdateInventory} onCancel={() => setInventoryVisible(false)}>
        <Form form={invForm} layout="vertical">
          <Form.Item name="warehouse_id" label="仓库ID"><InputNumber min={1} /></Form.Item>
          <Form.Item name="quantity" label="库存数量"><InputNumber min={0} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}