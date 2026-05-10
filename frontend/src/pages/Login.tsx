import { useState } from 'react'
import { Form, Input, Button, Card, Typography, Divider, Alert } from 'antd'
import { UserOutlined, LockOutlined, SettingOutlined, RightOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import api from '../api/client'

const { Title, Text } = Typography

interface LoginForm {
  username: string
  password: string
}

export default function Login() {
  const [form] = Form.useForm()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  const onFinish = async (values: LoginForm) => {
    setErrorMsg(null)
    setLoading(true)
    try {
      const res = await api.post('/auth/login', values)
      const { access_token, user } = res.data
      setAuth(access_token, user)
      navigate('/products')
    } catch (err: any) {
      console.log('Login error:', err)
      const detail = err?.response?.data?.detail || err?.message || '登录失败，请检查用户名和密码'
      setErrorMsg(detail)
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
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        width: 600,
        height: 600,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
        top: -200,
        right: -200,
        animation: 'pulse 4s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
        bottom: -100,
        left: -100,
        animation: 'pulse 6s ease-in-out infinite reverse',
        pointerEvents: 'none',
      }} />

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.1); opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ position: 'relative', zIndex: 1, animation: 'slideUp 0.5s ease-out' }}>
        <Card
          style={{
            width: 420,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: 24,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.5)',
          }}
          styles={{ body: { padding: 48 } }}
        >
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 10px 40px rgba(102, 126, 234, 0.4)',
            }}>
              <span style={{ fontSize: 36 }}>🛒</span>
            </div>
            <Title level={2} style={{ color: '#1a1a2e', margin: 0, fontWeight: 700 }}>
              经销商订货平台
            </Title>
            <Text style={{ color: '#666', fontSize: 14 }}>
              数字化供应链 · 智能订货体验
            </Text>
          </div>

          <Form form={form} layout="vertical" onFinish={onFinish} size="large">
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
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#999' }} />}
                placeholder="用户名"
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
                placeholder="密码"
                style={{
                  background: '#f8f9fa',
                  border: '2px solid #e9ecef',
                  borderRadius: 12,
                  height: 52,
                  fontSize: 15,
                }}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                size="large"
                style={{
                  height: 52,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: 16,
                  boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                }}
              >
                登录
              </Button>
            </Form.Item>
          </Form>

          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <Text style={{ color: '#999', fontSize: 12 }}>
              示例账号：dealer001 / 123456
            </Text>
          </div>

          <Divider style={{ borderColor: '#e9ecef', margin: '24px 0' }} />

          <div style={{ textAlign: 'center' }}>
            <Link to="/admin/login">
              <span style={{ color: '#667eea', fontSize: 14, fontWeight: 500 }}>
                管理端入口 &gt;
              </span>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}