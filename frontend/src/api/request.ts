import axios from 'axios';
import CryptoJS from 'crypto-js';
import { message } from 'antd';
import { useAuthStore } from '../store/authStore';

// Sign configuration from environment variables
const SIGN_KEY = process.env.REACT_APP_SIGN_KEY || '';
const SIGN_ENABLED = process.env.REACT_APP_SIGN_ENABLED === 'true';

// Paths that skip sign verification (must match backend whitelist)
const SIGN_WHITELIST = [
  '/auth/login',
  '/auth/daslink/login-url',
  '/auth/daslink/callback',
  '/auth/daslink/status',
];

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

const getErrorMessage = (data: any, fallback: string) => {
  if (!data) {
    return fallback;
  }

  if (Array.isArray(data.message)) {
    return data.message.join('；');
  }

  if (typeof data.message === 'string' && data.message.trim()) {
    return data.message;
  }

  return fallback;
};

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add sign headers if enabled
    if (SIGN_ENABLED && SIGN_KEY) {
      const url = config.url || '';
      const isWhitelisted = SIGN_WHITELIST.some((w) => url.startsWith(w));

      if (!isWhitelisted && config.method?.toUpperCase() !== 'OPTIONS') {
        const timestamp = Date.now().toString();
        const baseURL = config.baseURL || '';
        const uri = url.startsWith('http')
          ? new URL(url).pathname
          : `${baseURL}${url}`;
        const signStr = `${uri}${timestamp}${SIGN_KEY}${token || ''}`;
        const sign = CryptoJS.MD5(signStr).toString().toUpperCase();

        config.headers['timestamp'] = timestamp;
        config.headers['sign'] = sign;
      }
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
      const requestUrl = error.config?.url || '';
      const isLoginRequest = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/daslink/callback');
      
      if (status === 401) {
        if (isLoginRequest) {
          message.error(getErrorMessage(data, '用户名或密码错误'));
        } else {
          message.error('登录已过期，请重新登录');
          useAuthStore.getState().logout();
          window.location.href = '/login';
        }
      } else if (status === 403) {
        message.error(getErrorMessage(data, '没有权限执行此操作'));
      } else {
        message.error(getErrorMessage(data, '请求失败'));
      }
    } else {
      message.error('网络错误，请检查网络连接');
    }
    return Promise.reject(error);
  }
);

export default request;
