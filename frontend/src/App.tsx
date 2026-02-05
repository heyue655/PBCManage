import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import MainLayout from './components/MainLayout';
import Login from './pages/Login';
import PBCList from './pages/PBC/PBCList';
import PBCForm from './pages/PBC/PBCForm';
import TeamGoals from './pages/PBC/TeamGoals';
import ReviewList from './pages/Review/ReviewList';
import ReviewDetail from './pages/Review/ReviewDetail';
import UserManage from './pages/UserManage';
import ChangePassword from './pages/ChangePassword';
import { DepartmentList } from './pages/Department';
import DingtalkAppManage from './pages/DingtalkAppManage';

// 路由守卫组件
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

// 角色路由守卫组件
const RoleRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles: string[];
}> = ({ children, allowedRoles }) => {
  const { user } = useAuthStore();
  const userRole = user?.role || 'employee';

  if (!allowedRoles.includes(userRole)) {
    return <Navigate to="/pbc" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <MainLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/pbc" replace />} />
          {/* 我的PBC - 所有角色 */}
          <Route path="pbc" element={<PBCList />} />
          <Route path="pbc/create" element={<PBCForm />} />
          <Route path="pbc/edit/:id" element={<PBCForm />} />
          
          {/* 团队目标 - 经理、助理、总经理 */}
          <Route
            path="team-goals"
            element={
              <RoleRoute allowedRoles={['manager', 'assistant', 'gm']}>
                <TeamGoals />
              </RoleRoute>
            }
          />
          
          {/* 审核管理 - 经理、助理、总经理 */}
          <Route
            path="review"
            element={
              <RoleRoute allowedRoles={['manager', 'assistant', 'gm']}>
                <ReviewList />
              </RoleRoute>
            }
          />
          <Route
            path="review/:id"
            element={
              <RoleRoute allowedRoles={['manager', 'assistant', 'gm']}>
                <ReviewDetail />
              </RoleRoute>
            }
          />
          
          {/* 人员管理 - 经理、助理、总经理 */}
          <Route
            path="users"
            element={
              <RoleRoute allowedRoles={['manager', 'assistant', 'gm']}>
                <UserManage />
              </RoleRoute>
            }
          />
          
          {/* 部门管理 - 助理、总经理 */}
          <Route
            path="departments"
            element={
              <RoleRoute allowedRoles={['assistant', 'gm']}>
                <DepartmentList />
              </RoleRoute>
            }
          />
          
          {/* 钉钉应用管理 - 经理、助理、总经理 */}
          <Route
            path="dingtalk-apps"
            element={
              <RoleRoute allowedRoles={['manager', 'assistant', 'gm']}>
                <DingtalkAppManage />
              </RoleRoute>
            }
          />
          
          {/* 修改密码 - 所有角色 */}
          <Route path="change-password" element={<ChangePassword />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
