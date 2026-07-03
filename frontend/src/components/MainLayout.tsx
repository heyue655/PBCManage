import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Dropdown, Avatar, Space, message, Badge } from 'antd';
import {
  FormOutlined,
  AuditOutlined,
  TeamOutlined,
  UserOutlined,
  LogoutOutlined,
  KeyOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DingdingOutlined,
  DeploymentUnitOutlined,
  TrophyOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import { authApi, reviewsApi, request } from '../api';

const { Header, Sider, Content } = Layout;

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSupervisor, setIsSupervisor] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  // 获取待审核数量
  const fetchPendingCount = async () => {
    try {
      const result = await reviewsApi.getPendingCount();
      setPendingCount(result.count);
    } catch {
      // 忽略错误
    }
  };

  // 获取当前用户是否是主管
  const fetchIsSupervisor = async () => {
    try {
      const result: any = await request.get('/users/me/is-supervisor');
      setIsSupervisor(result.isSupervisor);
    } catch {
      setIsSupervisor(false);
    }
  };

  useEffect(() => {
    fetchPendingCount();
    fetchIsSupervisor();
    // 每60秒刷新一次
    const timer = setInterval(() => {
      fetchPendingCount();
      fetchIsSupervisor();
    }, 60000);
    return () => clearInterval(timer);
  }, [user]);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // 忽略登出错误
    }
    logout();
    message.success('已退出登录');
    navigate('/login');
  };

  // 根据用户角色过滤菜单项
  const getMenuItems = () => {
    const userRole = user?.role || 'employee';
    const isEmployee = userRole === 'employee';
    // 普通员工且不是主管的，不开放审核管理和绩效管理
    const canAccessReviewAndPerformance = !isEmployee || isSupervisor;

    const allMenuItems = [
      {
        key: '/pbc',
        icon: <FormOutlined />,
        label: '我的PBC',
        roles: ['employee', 'manager', 'assistant', 'gm'],
      },
      {
        key: '/my-performance',
        icon: <TrophyOutlined />,
        label: '我的绩效',
        roles: ['employee', 'manager', 'assistant', 'gm'],
      },
      {
        key: '/review',
        icon: <AuditOutlined />,
        label: pendingCount > 0
          ? <span>审核管理<Badge count={pendingCount} size="small" style={{ marginLeft: 8 }} /></span>
          : '审核管理',
        roles: canAccessReviewAndPerformance ? ['employee', 'manager', 'assistant', 'gm'] : ['manager', 'assistant', 'gm'],
      },
      {
        key: '/team-goals',
        icon: <AuditOutlined />,
        label: '团队目标',
        roles: ['manager', 'assistant', 'gm'],
      },
      {
        key: '/performance',
        icon: <TrophyOutlined />,
        label: '绩效管理',
        roles: canAccessReviewAndPerformance ? ['employee', 'manager', 'assistant', 'gm'] : ['manager', 'assistant', 'gm'],
      },
      {
        key: '/distribute-task',
        icon: <DeploymentUnitOutlined />,
        label: '下发任务',
        roles: ['assistant', 'gm'],
      },
      {
        key: '/users',
        icon: <TeamOutlined />,
        label: '人员管理',
        roles: ['manager', 'assistant', 'gm'],
      },
      {
        key: '/departments',
        icon: <TeamOutlined />,
        label: '部门管理',
        roles: ['assistant', 'gm'],
      },
      {
        key: '/dingtalk-apps',
        icon: <DingdingOutlined />,
        label: '钉钉应用管理',
        roles: ['manager', 'assistant', 'gm'],
      },
      {
        key: '/system-config',
        icon: <SettingOutlined />,
        label: '系统配置',
        roles: ['gm'],
      },
    ];

    return allMenuItems
      .filter(item => item.roles.includes(userRole))
      .map(({ roles, ...item }) => item);
  };

  const menuItems = getMenuItems();

  const userMenuItems = [
    {
      key: 'change-password',
      icon: <KeyOutlined />,
      label: '修改密码',
      onClick: () => navigate('/change-password'),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="dark"
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: collapsed ? 16 : 18,
            fontWeight: 'bold',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {collapsed ? 'PBC' : 'PBC绩效管理'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'all 0.2s' }}>
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          <div
            onClick={() => setCollapsed(!collapsed)}
            style={{ cursor: 'pointer', fontSize: 18 }}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </div>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} />
              <span>{user?.real_name}</span>
            </Space>
          </Dropdown>
        </Header>
        <Content className="page-container">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
