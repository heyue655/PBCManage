import axios from 'axios';
import { message } from 'antd';
import { useAuthStore } from '../store/authStore';

// 动态获取后端地址，支持localhost和局域网IP访问
const getBaseURL = () => {
  // 如果设置了环境变量，优先使用环境变量
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // 否则根据当前访问的主机名动态构建后端地址
  const hostname = window.location.hostname;
  return `http://${hostname}:3001/api`;
};

const request = axios.create({
  baseURL: getBaseURL(),
  timeout: 10000,
});

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      
      if (status === 401) {
        message.error('登录已过期，请重新登录');
        useAuthStore.getState().logout();
        window.location.href = '/login';
      } else if (status === 403) {
        message.error('没有权限执行此操作');
      } else {
        message.error(data.message || '请求失败');
      }
    } else {
      message.error('网络错误，请检查网络连接');
    }
    return Promise.reject(error);
  }
);

export default request;
