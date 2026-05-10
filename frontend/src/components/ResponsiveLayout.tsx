import { useState, useEffect, useCallback } from 'react'
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
import type { MenuProps } from 'antd'

const { Header, Content } = Layout
const { Text } = Typography

interface ResponsiveLayoutProps {
  children: React.ReactNode
}

const BREAKPOINT = 768

export default function ResponsiveLayout({ children }: ResponsiveLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const { itemCount } = useCartStore()

  const [isMobile, setIsMobile] = useState(false)
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false)

  // 检测屏幕宽度
  const checkMobile = useCallback(() => {
    setIsMobile(window.innerWidth < BREAKPOINT)
  }, [])

  useEffect(() => {
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [checkMobile])

  const menuItems: MenuProps['items'] = [
    { key: '/products', icon: <ShoppingOutlined />, label: '商品' },
    { key: '/favorites', icon: <HeartOutlined />, label: '我的收藏' },
    { key: '/reorder', icon: <UnorderedListOutlined />, label: '快速复购' },
    { key: '/orders', icon: <ShoppingCartOutlined />, label: '我的订单' },
    { key: '/reconciliation', icon: <ReconciliationOutlined />, label: '对账' },
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

  // 移动端布局
  if (isMobile) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#fff',
            padding: '0 16px',
            borderBottom: '1px solid #f0f0f0',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          <Text strong style={{ fontSize: 16, color: '#B12704' }}>🛒 订货平台</Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Badge count={itemCount} size="small" overflowCount={999}>
              <ShoppingCartOutlined style={{ fontSize: 20, cursor: 'pointer' }} onClick={() => navigate('/cart')} />
            </Badge>
            <Button
              icon={<MenuOutlined />}
              onClick={() => setMobileMenuVisible(true)}
              size="small"
            />
          </div>
        </Header>

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

        <Content style={{ padding: '12px', background: '#f5f5f5', minHeight: 'calc(100vh - 64px)' }}>
          {children}
        </Content>

        {/* 移动端底部 TabBar */}
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fff',
          borderTop: '1px solid #eee',
          display: 'flex',
          zIndex: 100,
        }}>
          {menuItems.slice(0, 4).map(item => {
            if (!item || 'type' in item) return null
            return (
              <div
                key={item.key}
                onClick={() => navigate(item.key as string)}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '8px 0',
                  cursor: 'pointer',
                  color: selectedKey === item.key ? '#B12704' : '#666',
                  fontSize: 12,
                }}
              >
                <div style={{ fontSize: 18, marginBottom: 2 }}>{item.icon}</div>
                <div>{item.label}</div>
              </div>
            )
          })}
        </div>
      </Layout>
    )
  }

  // PC端布局
  return (
    <Layout style={{ minHeight: '100vh' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Text strong style={{ fontSize: 18, color: '#B12704', whiteSpace: 'nowrap' }}>
            🛒 经销商订货平台
          </Text>
          <Menu
            mode="horizontal"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ border: 'none', minWidth: 400 }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Badge count={itemCount} size="small" overflowCount={999}>
            <ShoppingCartOutlined style={{ fontSize: 20, cursor: 'pointer' }} onClick={() => navigate('/cart')} />
          </Badge>

          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <UserOutlined />
              <Text>{user?.full_name}</Text>
            </Space>
          </Dropdown>
        </div>
      </Header>

      <Content style={{ padding: '16px 24px', background: '#f5f5f5', minHeight: 'calc(100vh - 64px)' }}>
        {children}
      </Content>
    </Layout>
  )
}