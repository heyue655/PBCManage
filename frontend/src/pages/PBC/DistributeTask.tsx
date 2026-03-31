import React, { useState, useEffect } from 'react';
import {
  Card, Select, Button, Table, Checkbox, message, Tag, Space, Result, Alert,
} from 'antd';
import { SendOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { pbcApi, PbcPeriod } from '../../api';
import { usersApi, User } from '../../api/users';
import type { ColumnsType } from 'antd/es/table';

const roleMap: Record<string, { color: string; text: string }> = {
  employee: { color: 'default', text: '员工' },
  manager: { color: 'blue', text: '经理' },
  assistant: { color: 'purple', text: '助理' },
  gm: { color: 'gold', text: '总经理' },
};

const DistributeTask: React.FC = () => {
  const [periods, setPeriods] = useState<PbcPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<number | undefined>();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: number } | null>(null);

  useEffect(() => {
    pbcApi.getPeriods().then(setPeriods).catch(() => {});
    setLoading(true);
    usersApi.getAll()
      .then(data => setUsers(data.filter(u => u.role !== 'gm'))) // gm通常管理自己
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDistribute = async () => {
    if (!selectedPeriod) {
      message.warning('请先选择下发周期');
      return;
    }
    if (selectedUserIds.length === 0) {
      message.warning('请至少选择一名员工');
      return;
    }
    setDistributing(true);
    try {
      const res = await pbcApi.createTasks(selectedUserIds, selectedPeriod);
      setResult({ success: res.success, errors: res.errors });
      if (res.success > 0) {
        message.success(`成功下发 ${res.success} 人的季度PBC任务`);
      }
      setSelectedUserIds([]);
    } catch (err: any) {
      message.error(err.response?.data?.message || '下发失败');
    } finally {
      setDistributing(false);
    }
  };

  const columns: ColumnsType<User> = [
    {
      title: (
        <Checkbox
          indeterminate={selectedUserIds.length > 0 && selectedUserIds.length < users.length}
          checked={selectedUserIds.length === users.length && users.length > 0}
          onChange={e => setSelectedUserIds(e.target.checked ? users.map(u => u.user_id) : [])}
        />
      ),
      key: 'select',
      width: 50,
      render: (_, record) => (
        <Checkbox
          checked={selectedUserIds.includes(record.user_id)}
          onChange={e => {
            setSelectedUserIds(prev =>
              e.target.checked
                ? [...prev, record.user_id]
                : prev.filter(id => id !== record.user_id)
            );
          }}
        />
      ),
    },
    {
      title: '姓名',
      dataIndex: 'real_name',
      key: 'real_name',
      width: 100,
    },
    {
      title: '职位',
      dataIndex: 'job_title',
      key: 'job_title',
      width: 150,
    },
    {
      title: '部门',
      key: 'department',
      width: 140,
      render: (_, record) => record.department?.department_name || '-',
    },
    {
      title: '角色',
      key: 'role',
      width: 90,
      render: (_, record) => {
        const cfg = roleMap[record.role] || { color: 'default', text: record.role };
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      },
    },
  ];

  return (
    <div>
      <Card
        title="下发本季度PBC任务"
        extra={
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={distributing}
            disabled={!selectedPeriod || selectedUserIds.length === 0}
            onClick={handleDistribute}
          >
            下发任务（已选 {selectedUserIds.length} 人）
          </Button>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <Space>
            <span style={{ color: '#666' }}>选择下发周期：</span>
            <Select
              style={{ width: 220 }}
              placeholder="请选择季度"
              value={selectedPeriod}
              onChange={setSelectedPeriod}
            >
              {periods.map(p => (
                <Select.Option key={p.period_id} value={p.period_id}>
                  {p.year}年 Q{p.quarter}
                  {p.status === 'active' && <Tag color="green" style={{ marginLeft: 6 }}>当前</Tag>}
                </Select.Option>
              ))}
            </Select>
          </Space>
        </div>

        {result && (
          <Alert
            type={result.errors === 0 ? 'success' : 'warning'}
            message={`下发完成：成功 ${result.success} 人${result.errors > 0 ? `，${result.errors} 人失败（可能已存在该周期任务）` : ''}`}
            closable
            onClose={() => setResult(null)}
            style={{ marginBottom: 16 }}
          />
        )}

        <Alert
          type="info"
          message="选中员工后点击「下发任务」，被选员工在「我的PBC」页面将看到本季度任务并开始填写"
          style={{ marginBottom: 16 }}
        />

        <Table
          columns={columns}
          dataSource={users}
          rowKey="user_id"
          loading={loading}
          pagination={{ pageSize: 20 }}
          rowSelection={undefined}
          size="small"
        />
      </Card>
    </div>
  );
};

export default DistributeTask;
