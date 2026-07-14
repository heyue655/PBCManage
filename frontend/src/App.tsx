import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import MainLayout from './components/MainLayout';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import PBCList from './pages/PBC/PBCList';
import PBCForm from './pages/PBC/PBCForm';
import TaskDetail from './pages/PBC/TaskDetail';
import DistributeTask from './pages/PBC/DistributeTask';
import TeamGoals from './pages/PBC/TeamGoals';
import ReviewList from './pages/Review/ReviewList';
import ReviewDetail from './pages/Review/ReviewDetail';
import UserManage from './pages/UserManage';
import ChangePassword from './pages/ChangePassword';
import { DepartmentList } from './pages/Department';
import DingtalkAppManage from './pages/DingtalkAppManage';
import PerformanceList from './pages/Performance';
import MyPerformance from './pages/MyPerformance';
import SystemConfig from './pages/SystemConfig';
import { request } from './api';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const RoleRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles: string[];
  allowEmployeeIfSupervisor?: boolean;
}> = ({ children, allowedRoles, allowEmployeeIfSupervisor }) => {
  const { user } = useAuthStore();
  const userRole = user?.role || 'employee';
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (allowEmployeeIfSupervisor && userRole === 'employee') {
      request.get('/users/me/is-supervisor')
        .then((res: any) => setIsSupervisor(res.isSupervisor))
        .catch(() => setIsSupervisor(false))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [userRole, allowEmployeeIfSupervisor]);

  if (loading) return null;

  let canAccess = allowedRoles.includes(userRole);

  // 如果是普通员工且允许主管访问，检查是否是主管
  if (!canAccess && userRole === 'employee' && allowEmployeeIfSupervisor && isSupervisor) {
    canAccess = true;
  }

  if (!canAccess) {
    return <Navigate to="/pbc" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/transfer" element={<AuthCallback />} />
        <Route path="/transit" element={<AuthCallback />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <MainLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/pbc" replace />} />
          <Route path="pbc" element={<PBCList />} />
          <Route path="pbc/task/:taskId" element={<TaskDetail />} />
          <Route path="pbc/create" element={<PBCForm />} />
          <Route path="pbc/edit/:id" element={<PBCForm />} />

          <Route
            path="distribute-task"
            element={
              <RoleRoute allowedRoles={['assistant', 'gm']}>
                <DistributeTask />
              </RoleRoute>
            }
          />
          
          <Route
            path="team-goals"
            element={
              <RoleRoute allowedRoles={['manager', 'assistant', 'gm']}>
                <TeamGoals />
              </RoleRoute>
            }
          />
          
          <Route
            path="review"
            element={
              <RoleRoute allowedRoles={['manager', 'assistant', 'gm']} allowEmployeeIfSupervisor>
                <ReviewList />
              </RoleRoute>
            }
          />
          <Route
            path="review/:id"
            element={
              <RoleRoute allowedRoles={['manager', 'assistant', 'gm']} allowEmployeeIfSupervisor>
                <ReviewDetail />
              </RoleRoute>
            }
          />
          
          <Route
            path="users"
            element={
              <RoleRoute allowedRoles={['manager', 'assistant', 'gm']}>
                <UserManage />
              </RoleRoute>
            }
          />
          
          <Route
            path="departments"
            element={
              <RoleRoute allowedRoles={['assistant', 'gm']}>
                <DepartmentList />
              </RoleRoute>
            }
          />
          
          <Route path="my-performance" element={<MyPerformance />} />

          <Route
            path="performance"
            element={
              <RoleRoute allowedRoles={['manager', 'assistant', 'gm']} allowEmployeeIfSupervisor>
                <PerformanceList />
              </RoleRoute>
            }
          />

          <Route
            path="system-config"
            element={
              <RoleRoute allowedRoles={['gm']}>
                <SystemConfig />
              </RoleRoute>
            }
          />

          <Route
            path="dingtalk-apps"
            element={
              <RoleRoute allowedRoles={['manager', 'assistant', 'gm']}>
                <DingtalkAppManage />
              </RoleRoute>
            }
          />
          
          <Route path="change-password" element={<ChangePassword />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
