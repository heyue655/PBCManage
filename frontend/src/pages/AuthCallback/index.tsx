import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Spin, Result, Button } from 'antd';
import { authApi } from '../../api';
import { useAuthStore } from '../../store/authStore';

const AuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const code = searchParams.get('code');
    const redirectPath =
      searchParams.get('redirectPath') || searchParams.get('path') || '/';

    if (!code) {
      setError('缺少授权码，请重新登录');
      return;
    }

    const doLogin = async () => {
      try {
        const result = await authApi.daslinkCallback(code);
        login(result.access_token, result.user);
        navigate(redirectPath, { replace: true });
      } catch (err: any) {
        const msg = err?.response?.data?.message || 'DASLink 登录失败';
        setError(msg);
      }
    };

    doLogin();
  }, []);

  if (error) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Result
          status="error"
          title="登录失败"
          subTitle={error}
          extra={
            <Button type="primary" onClick={() => navigate('/login', { replace: true })}>
              返回登录页
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <Spin size="large" />
      <p style={{ marginTop: 16, color: '#666' }}>正在登录，请稍候...</p>
    </div>
  );
};

export default AuthCallback;
