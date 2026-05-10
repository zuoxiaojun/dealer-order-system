import { NavBar, TabBar } from 'antd-mobile'
import { useNavigate, useLocation } from 'react-router-dom'
import { useCartStore } from '../store/cart'

interface MobileLayoutProps {
  children: React.ReactNode
}

const bottomTabs = [
  { key: '/products', title: '商品' },
  { key: '/favorites', title: '收藏' },
  { key: '/reorder', title: '复购' },
  { key: '/orders', title: '订单' },
]

export default function MobileLayout({ children }: MobileLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { itemCount } = useCartStore()

  const currentPath = '/' + location.pathname.split('/')[1]

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <NavBar
        style={{ background: '#fff', borderBottom: '1px solid #eee' }}
        right={
          <div
            onClick={() => navigate('/cart')}
            style={{ cursor: 'pointer', fontSize: 16 }}
          >
            🛒 {itemCount > 0 ? `(${itemCount})` : ''}
          </div>
        }
      >
        <span
          style={{ fontWeight: 'bold', color: '#B12704', cursor: 'pointer' }}
          onClick={() => navigate('/products')}
        >
          订货平台
        </span>
      </NavBar>

      <div style={{ flex: 1, overflow: 'auto', background: '#f5f5f5' }}>
        {children}
      </div>

      <TabBar activeKey={currentPath} onChange={(key) => navigate(key)}>
        {bottomTabs.map(tab => (
          <TabBar.Item key={tab.key} title={tab.title} />
        ))}
      </TabBar>
    </div>
  )
}