import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Dropdown, Avatar, Space, message } from 'antd';
import {
  FormOutlined,
  AuditOutlined,
  TeamOutlined,
  UserOutlined,
  LogoutOutlined,
  KeyOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api';

const { Header, Sider, Content } = Layout;

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

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
    const allMenuItems = [
      {
        key: '/pbc',
        icon: <FormOutlined />,
        label: '我的PBC',
        roles: ['employee', 'manager', 'assistant', 'gm'], // 所有角色
      },
      {
        key: '/team-goals',
        icon: <AuditOutlined />,
        label: '团队目标',
        roles: ['manager', 'assistant', 'gm'], // 经理、助理、总经理
      },
      {
        key: '/review',
        icon: <AuditOutlined />,
        label: '审核管理',
        roles: ['manager', 'assistant', 'gm'], // 经理、助理、总经理
      },
      {
        key: '/users',
        icon: <TeamOutlined />,
        label: '人员管理',
        roles: ['manager', 'assistant', 'gm'], // 经理、助理、总经理
      },
      {
        key: '/departments',
        icon: <TeamOutlined />,
        label: '部门管理',
        roles: ['assistant', 'gm'], // 助理、总经理
      },
    ];

    // 根据当前用户角色过滤菜单
    const userRole = user?.role || 'employee';
    return allMenuItems
      .filter(item => item.roles.includes(userRole))
      .map(({ roles, ...item }) => item); // 移除roles属性
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
