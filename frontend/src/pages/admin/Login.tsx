import { useState } from 'react'
import { Form, Input, Button, Card, Typography, Alert } from 'antd'
import { UserOutlined, LockOutlined, SafetyOutlined, SwapOutlined } from '@ant-design/icons'
import { useNavigate, Link } from 'react-router-dom'
import adminApi from '../../api/adminClient'
import { useAdminStore } from '../../store/adminAuth'

const { Title, Text } = Typography

export default function AdminLogin() {
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const navigate = useNavigate()
  const { setAuth } = useAdminStore()

  const onFinish = async (values: { username: string; password: string }) => {
    setErrorMsg(null)
    setLoading(true)
    try {
      const res = await adminApi.post('/auth/login', values)
      setAuth(res.data.access_token, res.data.admin)
      navigate('/admin')
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || '登录失败，请检查用户名和密码')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Tech grid background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
        pointerEvents: 'none',
      }} />

      {/* Glow effects */}
      <div style={{
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0, 240, 255, 0.2) 0%, transparent 60%)',
        top: -100,
        left: -100,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0, 200, 255, 0.15) 0%, transparent 60%)',
        bottom: -50,
        right: -50,
        pointerEvents: 'none',
      }} />

      <style>{`
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 30px rgba(0, 240, 255, 0.3); }
          50% { box-shadow: 0 0 50px rgba(0, 240, 255, 0.5); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ position: 'relative', zIndex: 1, animation: 'slideUp 0.5s ease-out' }}>
        <Card
          style={{
            width: 440,
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(20px)',
            borderRadius: 24,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
          }}
          styles={{ body: { padding: 48 } }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{
              width: 80,
              height: 80,
              borderRadius: 24,
              background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              boxShadow: '0 10px 40px rgba(30, 60, 114, 0.4)',
              animation: 'glow 3s ease-in-out infinite',
            }}>
              <SafetyOutlined style={{ fontSize: 40, color: '#fff' }} />
            </div>
            <Title level={2} style={{ color: '#1e3c72', margin: 0, fontWeight: 700, letterSpacing: 1 }}>
              管理控制台
            </Title>
            <Text style={{ color: '#666', fontSize: 14 }}>
              System Administration Portal
            </Text>
          </div>

          {/* Form */}
          <Form onFinish={onFinish} layout="vertical" size="large">
            {errorMsg && (
              <Alert
                message={errorMsg}
                type="error"
                showIcon
                style={{ marginBottom: 16, borderRadius: 12 }}
              />
            )}
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入管理员账号' }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#999' }} />}
                placeholder="管理员账号"
                style={{
                  background: '#f8f9fa',
                  border: '2px solid #e9ecef',
                  borderRadius: 12,
                  height: 52,
                  fontSize: 15,
                }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#999' }} />}
                placeholder="登录密码"
                style={{
                  background: '#f8f9fa',
                  border: '2px solid #e9ecef',
                  borderRadius: 12,
                  height: 52,
                  fontSize: 15,
                }}
              />
            </Form.Item>

            <Form.Item style={{ marginTop: 8 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                size="large"
                style={{
                  height: 52,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: 16,
                  letterSpacing: 1,
                }}
              >
                登录系统
              </Button>
            </Form.Item>
          </Form>

          {/* Footer hint */}
          <div style={{
            marginTop: 32,
            padding: 16,
            background: '#f0f4ff',
            borderRadius: 12,
            border: '1px solid #dce4ff',
          }}>
            <Text style={{ color: '#666', fontSize: 12, display: 'block', textAlign: 'center' }}>
              管理员账号：admin &nbsp;|&nbsp; 密码：admin123
            </Text>
          </div>

          {/* Switch to dealer login */}
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <Link to="/login" style={{ color: '#666', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <SwapOutlined />
              返回经销商端登录
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}