import { useEffect } from 'react'
import { Layout, Menu, Button } from 'antd'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAdminStore } from '../store/adminAuth'

const { Header, Sider, Content } = Layout

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { admin, logout } = useAdminStore()

  useEffect(() => {
    if (!admin) {
      navigate('/admin/login')
    }
  }, [admin, navigate])

  const handleLogout = () => {
    logout()
    navigate('/admin/login')
  }

  const selectedKey = location.pathname.startsWith('/admin/orders') ? '/admin/orders'
    : location.pathname.startsWith('/admin/products') ? '/admin/products'
    : location.pathname.startsWith('/admin/dealers') ? '/admin/dealers'
    : '/admin'

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#001529', padding: '0 24px' }}>
        <div style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>经销商订货系统 - 管理端</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: '#fff' }}>{admin?.full_name}</span>
          <Button size="small" onClick={handleLogout}>退出</Button>
        </div>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu mode="inline" selectedKeys={[selectedKey]} style={{ height: '100%', paddingTop: 8 }}>
            <Menu.Item key="/admin" onClick={() => navigate('/admin')}>控制台</Menu.Item>
            <Menu.Item key="/admin/orders" onClick={() => navigate('/admin/orders')}>订单管理</Menu.Item>
            <Menu.Item key="/admin/products" onClick={() => navigate('/admin/products')}>商品管理</Menu.Item>
            <Menu.Item key="/admin/dealers" onClick={() => navigate('/admin/dealers')}>经销商管理</Menu.Item>
          </Menu>
        </Sider>
        <Content style={{ padding: '24px', background: '#f0f2f5' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}