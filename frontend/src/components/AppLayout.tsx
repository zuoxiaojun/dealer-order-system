import { Layout, Menu, Badge, Dropdown, Space, Typography, Drawer, Button } from 'antd'
import {
  ShoppingOutlined,
  UserOutlined,
  HeartOutlined,
  UnorderedListOutlined,
  ReconciliationOutlined,
  LogoutOutlined,
  ShoppingCartOutlined,
  MenuOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { useCartStore } from '../store/cart'
import { useState } from 'react'
import type { MenuProps } from 'antd'

const { Header, Content } = Layout
const { Text } = Typography

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const { itemCount } = useCartStore()
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false)

  const menuItems: MenuProps['items'] = [
    {
      key: '/products',
      icon: <ShoppingOutlined />,
      label: '商品',
    },
    {
      key: '/favorites',
      icon: <HeartOutlined />,
      label: '我的收藏',
    },
    {
      key: '/reorder',
      icon: <UnorderedListOutlined />,
      label: '快速复购',
    },
    {
      key: '/orders',
      icon: <ShoppingCartOutlined />,
      label: '我的订单',
    },
    {
      key: '/reconciliation',
      icon: <ReconciliationOutlined />,
      label: '对账',
    },
  ]

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'info',
      label: (
        <Space direction="vertical" size={0}>
          <Text strong>{user?.full_name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{user?.company_name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{user?.dealer_tier}经销商</Text>
        </Space>
      ),
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: () => {
        logout()
        navigate('/login')
      },
    },
  ]

  const selectedKey = '/' + location.pathname.split('/')[1]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 顶部导航 */}
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#fff',
          padding: '0 24px',
          borderBottom: '1px solid #f0f0f0',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        {/* 左侧 Logo + 菜单 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Text strong style={{ fontSize: 18, color: '#B12704', whiteSpace: 'nowrap' }}>
            🛒 经销商订货平台
          </Text>
          {/* PC端菜单 */}
          <Menu
            mode="horizontal"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ border: 'none', minWidth: 400 }}
            className="pc-menu"
          />
          {/* 移动端汉堡按钮 */}
          <Button
            icon={<MenuOutlined />}
            onClick={() => setMobileMenuVisible(true)}
            className="mobile-menu-btn"
            style={{ display: 'none' }}
          />
        </div>

        {/* 右侧：购物车 + 用户 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            onClick={() => navigate('/cart')}
            style={{ cursor: 'pointer', position: 'relative' }}
          >
            <Badge count={itemCount} size="small">
              <ShoppingCartOutlined style={{ fontSize: 20 }} />
            </Badge>
          </div>

          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <UserOutlined />
              <Text className="pc-only">{user?.full_name}</Text>
            </Space>
          </Dropdown>
        </div>
      </Header>

      {/* 移动端抽屉菜单 */}
      <Drawer
        title="导航菜单"
        placement="left"
        onClose={() => setMobileMenuVisible(false)}
        open={mobileMenuVisible}
        width={280}
      >
        <Menu
          mode="vertical"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => {
            navigate(key)
            setMobileMenuVisible(false)
          }}
        />
      </Drawer>

      {/* 主内容 */}
      <Content style={{ padding: '16px 24px', background: '#f5f5f5', minHeight: 'calc(100vh - 64px)' }}>
        {children}
      </Content>
    </Layout>
  )
}
