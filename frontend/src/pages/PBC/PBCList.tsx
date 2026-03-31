import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Empty,
} from 'antd';
import {
  EditOutlined,
  EyeOutlined,
  StarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { pbcApi, PbcTask, TaskStatus } from '../../api';
import type { ColumnsType } from 'antd/es/table';

const taskStatusConfig: Record<TaskStatus, { color: string; text: string; icon: React.ReactNode }> = {
  pending: { color: 'default', text: '待填写', icon: <ClockCircleOutlined /> },
  filling: { color: 'processing', text: '填写中', icon: <EditOutlined /> },
  submitted: { color: 'blue', text: '待审核', icon: <SyncOutlined /> },
  approved: { color: 'success', text: '已通过', icon: <CheckCircleOutlined /> },
  rejected: { color: 'error', text: '已驳回', icon: <ClockCircleOutlined /> },
  archived: { color: 'purple', text: '已归档', icon: <FileOutlined /> },
};

const PBCList: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<PbcTask[]>([]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const data = await pbcApi.getTasks();
      setTasks(data);
    } catch {
      // error handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const getActionButton = (task: PbcTask) => {
    const status = task.task_status || 'pending';
    switch (status) {
      case 'pending':
        return (
          <Button type="primary" size="small" icon={<EditOutlined />}
            onClick={() => navigate(`/pbc/task/${task.task_id}`)}>
            开始填写
          </Button>
        );
      case 'filling':
        return (
          <Button type="primary" size="small" icon={<EditOutlined />}
            onClick={() => navigate(`/pbc/task/${task.task_id}`)}>
            继续填写
          </Button>
        );
      case 'rejected':
        return (
          <Button danger size="small" icon={<EditOutlined />}
            onClick={() => navigate(`/pbc/task/${task.task_id}`)}>
            修改重提
          </Button>
        );
      case 'submitted':
        return (
          <Button size="small" icon={<EyeOutlined />}
            onClick={() => navigate(`/pbc/task/${task.task_id}`)}>
            查看
          </Button>
        );
      case 'approved':
        return (
          <Button type="primary" size="small" icon={<StarOutlined />}
            onClick={() => navigate(`/pbc/task/${task.task_id}`)}>
            自评
          </Button>
        );
      case 'archived':
        return (
          <Button size="small" icon={<EyeOutlined />}
            onClick={() => navigate(`/pbc/task/${task.task_id}`)}>
            查看反馈
          </Button>
        );
      default:
        return (
          <Button size="small" icon={<EyeOutlined />}
            onClick={() => navigate(`/pbc/task/${task.task_id}`)}>
            查看
          </Button>
        );
    }
  };

  const columns: ColumnsType<PbcTask> = [
    {
      title: '季度',
      key: 'period',
      width: 150,
      render: (_, record) =>
        record.period ? `${record.period.year}年 Q${record.period.quarter}` : '-',
    },
    {
      title: '任务状态',
      key: 'task_status',
      width: 130,
      render: (_, record) => {
        const status = record.task_status || 'pending';
        const cfg = taskStatusConfig[status];
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.text}</Tag>;
      },
    },
    {
      title: '目标数量',
      key: 'goals_count',
      width: 100,
      render: (_, record) =>
        record.goals_count !== undefined ? `${record.goals_count} 项` : '-',
    },
    {
      title: '权重总和',
      key: 'total_weight',
      width: 110,
      render: (_, record) => {
        const w = record.total_weight ?? 0;
        const ok = record.goals_count && record.goals_count > 0 && Math.abs(w - 100) <= 0.01;
        return (
          <span style={{ color: ok ? '#52c41a' : (w > 0 ? '#fa8c16' : '#999'), fontWeight: 'bold' }}>
            {w}%
          </span>
        );
      },
    },
    {
      title: '下发人',
      key: 'distributor',
      width: 120,
      render: (_, record) => record.distributor?.real_name || '-',
    },
    {
      title: '下发时间',
      key: 'created_at',
      width: 180,
      render: (_, record) =>
        record.created_at ? new Date(record.created_at).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => <Space>{getActionButton(record)}</Space>,
    },
  ];

  return (
    <Card
      title="我的PBC"
      extra={
        <Button size="small" onClick={fetchTasks} loading={loading}>
          刷新
        </Button>
      }
    >
      {tasks.length === 0 && !loading ? (
        <Empty description="暂无本季度任务，请等待助理下发" />
      ) : (
        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="task_id"
          loading={loading}
          pagination={false}
        />
      )}
    </Card>
  );
};

export default PBCList;
