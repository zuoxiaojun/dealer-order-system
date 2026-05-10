import { useState, useEffect } from 'react'
import { Table, Tag, Space, Button, Input, Select, Modal, Form, InputNumber, message, Popconfirm } from 'antd'
import adminApi from '../../api/adminClient'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: '正常', color: 'green' },
  disabled: { label: '停用', color: 'orange' },
  deleted: { label: '已删除', color: 'red' },
}

export default function AdminDealers() {
  const [data, setData] = useState<any>({ items: [], total: 0 })
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filters, setFilters] = useState<any>({})
  const [createVisible, setCreateVisible] = useState(false)
  const [editVisible, setEditVisible] = useState(false)
  const [userVisible, setUserVisible] = useState(false)
  const [resetPwdVisible, setResetPwdVisible] = useState(false)
  const [selectedDealer, setSelectedDealer] = useState<any>(null)
  const [dealerUsers, setDealerUsers] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [form] = Form.useForm()
  const [userForm] = Form.useForm()
  const [pwdForm] = Form.useForm()

  useEffect(() => { fetchDealers() }, [page, pageSize, filters])

  const fetchDealers = async () => {
    setLoading(true)
    try {
      const params: any = { page, page_size: pageSize }
      if (filters.search) params.search = filters.search
      if (filters.region) params.region = filters.region
      if (filters.status) params.status = filters.status
      const res = await adminApi.get('/dealers', { params })
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
      await adminApi.post('/dealers', values)
      message.success('经销商创建成功')
      setCreateVisible(false)
      fetchDealers()
    } catch (err: any) {
      message.error(err.response?.data?.detail || '创建失败')
    }
  }

  const handleEdit = (dealer: any) => {
    setSelectedDealer(dealer)
    form.setFieldsValue({
      name: dealer.name,
      contact_name: dealer.contact_name,
      contact_phone: dealer.contact_phone,
      contact_email: dealer.contact_email,
      address: dealer.address,
      region: dealer.region,
      dealer_tier_id: dealer.dealer_tier_id,
      credit_limit: dealer.credit_limit,
    })
    setEditVisible(true)
  }

  const handleUpdate = async () => {
    try {
      await adminApi.put(`/dealers/${selectedDealer.id}`, form.getFieldsValue())
      message.success('更新成功')
      setEditVisible(false)
      fetchDealers()
    } catch (err: any) { message.error(err.response?.data?.detail || '更新失败') }
  }

  const handleDisable = async (dealer: any) => {
    try {
      await adminApi.put(`/dealers/${dealer.id}/status`, { status: 'disabled' })
      message.success('已停用')
      fetchDealers()
    } catch (err: any) { message.error(err.response?.data?.detail || '操作失败') }
  }

  const handleDelete = async (dealer: any) => {
    try {
      await adminApi.delete(`/dealers/${dealer.id}`)
      message.success('已删除')
      fetchDealers()
    } catch (err: any) { message.error(err.response?.data?.detail || '删除失败') }
  }

  const handleViewUsers = async (dealer: any) => {
    setSelectedDealer(dealer)
    try {
      const res = await adminApi.get(`/dealers/${dealer.id}/users`)
      setDealerUsers(res.data)
      setUserVisible(true)
    } catch (err) { console.error(err) }
  }

  const handleResetPassword = (user: any) => {
    setSelectedUser(user)
    pwdForm.resetFields()
    setResetPwdVisible(true)
  }

  const handleDoResetPassword = async () => {
    try {
      const values = await pwdForm.validateFields()
      await adminApi.put(`/users/${selectedUser.id}/reset-password`, values)
      message.success('密码重置成功')
      setResetPwdVisible(false)
    } catch (err: any) { message.error(err.response?.data?.detail || '操作失败') }
  }

  const handleToggleStatus = async (user: any) => {
    try {
      const newStatus = user.status === 'active' ? 'disabled' : 'active'
      await adminApi.put(`/users/${user.id}/status`, { status: newStatus })
      message.success('状态已更新')
      if (selectedDealer) handleViewUsers(selectedDealer)
    } catch (err: any) { message.error(err.response?.data?.detail || '操作失败') }
  }

  const columns = [
    { title: '经销商名称', dataIndex: 'name' },
    { title: '联系人', dataIndex: 'contact_name', width: 100 },
    { title: '区域', dataIndex: 'region', width: 80 },
    { title: '等级', dataIndex: 'dealer_tier_name', width: 80 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (v: string) => {
        const s = STATUS_MAP[v] || { label: v, color: 'default' }
        return <Tag color={s.color}>{s.label}</Tag>
      },
    },
    { title: '账号数', dataIndex: 'user_count', width: 80 },
    {
      title: '操作',
      width: 250,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button size="small" onClick={() => handleViewUsers(record)}>账号</Button>
          {record.status === 'active' && (
            <>
              <Button size="small" onClick={() => handleEdit(record)}>编辑</Button>
              <Button size="small" danger onClick={() => handleDisable(record)}>停用</Button>
            </>
          )}
          {record.status === 'disabled' && (
            <>
              <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record)}>
                <Button size="small" danger>删除</Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ]

  const userColumns = [
    { title: '用户名', dataIndex: 'username' },
    { title: '姓名', dataIndex: 'full_name' },
    { title: '角色', dataIndex: 'role', width: 100 },
    { title: '状态', dataIndex: 'status', render: (v: string) => <Tag color={v === 'active' ? 'green' : 'red'}>{v === 'active' ? '正常' : '禁用'}</Tag> },
    { title: '最后登录', dataIndex: 'last_login_at', render: (v: string) => v ? v.slice(0, 16) : '-' },
    {
      title: '操作',
      render: (_: any, record: any) => (
        <Space size="small">
          <Popconfirm title="确定重置密码?" onConfirm={() => handleResetPassword(record)}>
            <Button size="small">重置密码</Button>
          </Popconfirm>
          <Button size="small" onClick={() => handleToggleStatus(record)}>
            {record.status === 'active' ? '禁用' : '启用'}
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <h2>经销商管理</h2>

      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={handleCreate}>新增经销商</Button>
        <Input.Search placeholder="搜索经销商名称" onSearch={(v) => { setFilters({ ...filters, search: v }); setPage(1); }} style={{ width: 200 }} />
        <Select placeholder="区域" allowClear onChange={(v) => { setFilters({ ...filters, region: v }); setPage(1); }} style={{ width: 100 }}>
          <Select.Option value="华东">华东</Select.Option>
          <Select.Option value="华南">华南</Select.Option>
          <Select.Option value="华北">华北</Select.Option>
          <Select.Option value="西南">西南</Select.Option>
          <Select.Option value="西北">西北</Select.Option>
        </Select>
        <Select placeholder="状态" allowClear onChange={(v) => { setFilters({ ...filters, status: v }); setPage(1); }} style={{ width: 100 }}>
          <Select.Option value="active">正常</Select.Option>
          <Select.Option value="disabled">停用</Select.Option>
        </Select>
        <Button onClick={fetchDealers}>刷新</Button>
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
        title="新增经销商"
        open={createVisible}
        onOk={handleCreateSubmit}
        onCancel={() => setCreateVisible(false)}
        okText="创建"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="公司名称" rules={[{ required: true, message: '请输入公司名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="contact_name" label="联系人" rules={[{ required: true, message: '请输入联系人' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="contact_phone" label="联系电话" rules={[{ required: true, message: '请输入联系电话' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="contact_email" label="邮箱">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="地址">
            <Input />
          </Form.Item>
          <Form.Item name="region" label="区域" rules={[{ required: true, message: '请选择区域' }]}>
            <Select>
              <Select.Option value="华东">华东</Select.Option>
              <Select.Option value="华南">华南</Select.Option>
              <Select.Option value="华北">华北</Select.Option>
              <Select.Option value="西南">西南</Select.Option>
              <Select.Option value="西北">西北</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="dealer_tier_id" label="等级">
            <Input type="number" />
          </Form.Item>
          <Form.Item name="credit_limit" label="信用额度">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="编辑经销商" open={editVisible} onOk={handleUpdate} onCancel={() => setEditVisible(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="公司名称"><Input /></Form.Item>
          <Form.Item name="contact_name" label="联系人"><Input /></Form.Item>
          <Form.Item name="contact_phone" label="联系电话"><Input /></Form.Item>
          <Form.Item name="contact_email" label="邮箱"><Input /></Form.Item>
          <Form.Item name="address" label="地址"><Input /></Form.Item>
          <Form.Item name="region" label="区域">
            <Select>
              <Select.Option value="华东">华东</Select.Option>
              <Select.Option value="华南">华南</Select.Option>
              <Select.Option value="华北">华北</Select.Option>
              <Select.Option value="西南">西南</Select.Option>
              <Select.Option value="西北">西北</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="dealer_tier_id" label="等级">
            <Input type="number" />
          </Form.Item>
          <Form.Item name="credit_limit" label="信用额度">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`${selectedDealer?.name} - 账号列表`}
        open={userVisible}
        onCancel={() => setUserVisible(false)}
        footer={null}
        width={700}
      >
        <Table
          columns={userColumns}
          dataSource={dealerUsers}
          rowKey="id"
          pagination={false}
        />
      </Modal>

      <Modal title="重置密码" open={resetPwdVisible} onOk={handleDoResetPassword} onCancel={() => setResetPwdVisible(false)}>
        <Form form={pwdForm} layout="vertical">
          <Form.Item name="new_password" label="新密码" rules={[{ required: true, min: 6 }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}