import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, message, Modal } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { authApi } from '../../api';
import { useAuthStore } from '../../store/authStore';

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetForm] = Form.useForm();
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const result = await authApi.login(values);
      login(result.access_token, result.user);
      if (result.needResetPassword) {
        message.warning('请修改默认密码后继续使用');
        setResetModalVisible(true);
      } else {
        message.success('登录成功');
        navigate('/');
      }
    } catch (error) {
      // 错误已在拦截器中处理
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    try {
      const values = await resetForm.validateFields();
      setResetLoading(true);
      await authApi.changePassword({
        oldPassword: '123456',
        newPassword: values.newPassword,
      });
      message.success('密码修改成功');
      setResetModalVisible(false);
      navigate('/');
    } catch (error: any) {
      if (error?.response?.data?.message) {
        message.error(error.response.data.message);
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card
        style={{
          width: 400,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          borderRadius: 8,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, marginBottom: 8, color: '#1890ff' }}>
            PBC绩效管理系统
          </h1>
          <p style={{ color: '#666' }}>请使用您的账号登录</p>
        </div>
        <Form
          name="login"
          onFinish={onFinish}
          size="large"
          initialValues={{ username: '', password: '' }}
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入工号' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="工号"
            />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="密码"
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录
            </Button>
          </Form.Item>
        </Form>
        <div style={{ textAlign: 'center', color: '#999', fontSize: 12 }}>
          默认密码：123456
        </div>
      </Card>

      <Modal
        title="请修改默认密码"
        open={resetModalVisible}
        onOk={handleResetPassword}
        confirmLoading={resetLoading}
        closable={false}
        maskClosable={false}
        cancelButtonProps={{ style: { display: 'none' } }}
        okText="确认修改"
      >
        <p style={{ color: '#ff4d4f', marginBottom: 16 }}>
          您当前使用的是默认密码，为保障账号安全，请立即修改密码。
        </p>
        <Form form={resetForm} layout="vertical">
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少6位' },
              {
                validator: (_, value) =>
                  value === '123456'
                    ? Promise.reject(new Error('新密码不能与默认密码相同'))
                    : Promise.resolve(),
              },
            ]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Login;
