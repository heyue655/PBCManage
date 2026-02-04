import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Button, Tag, Tabs, Space, message } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons';
import { reviewsApi, pbcApi, PbcGoal, PbcStatus } from '../../api';
import type { ColumnsType } from 'antd/es/table';
import ReviewModal from './ReviewModal';

const statusMap: Record<PbcStatus, { color: string; text: string }> = {
  draft: { color: 'default', text: '草稿' },
  submitted: { color: 'processing', text: '待审核' },
  approved: { color: 'success', text: '已通过' },
  rejected: { color: 'error', text: '已驳回' },
  archived: { color: 'purple', text: '已归档' },
};

const goalTypeMap: Record<string, string> = {
  business: '业务目标',
  skill: '个人能力提升',
  team: '组织与人员管理&团队建设',
};

interface UserGoalGroup {
  userId: number;
  userName: string;
  periodId?: number;
  periodName: string;
  goals: PbcGoal[];
  totalWeight: number;
}

const ReviewList: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [pendingData, setPendingData] = useState<UserGoalGroup[]>([]);
  const [historyData, setHistoryData] = useState<PbcGoal[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentGroup, setCurrentGroup] = useState<UserGoalGroup | null>(null);
  const [modalAction, setModalAction] = useState<'approve' | 'reject'>('approve');

  const fetchPendingData = async () => {
    setLoading(true);
    try {
      const data = await reviewsApi.getPending();
      
      // 按员工和周期分组
      const groups: Map<string, UserGoalGroup> = new Map();
      data.forEach((goal) => {
        const key = `${goal.user_id}-${goal.period_id}`;
        if (!groups.has(key)) {
          groups.set(key, {
            userId: goal.user_id,
            userName: goal.user?.real_name || '',
            periodId: goal.period_id || 0,
            periodName: goal.period
              ? `${goal.period.year}年第${goal.period.quarter}季度`
              : '',
            goals: [],
            totalWeight: 0,
          });
        }
        const group = groups.get(key)!;
        group.goals.push(goal);
        group.totalWeight += Number(goal.goal_weight);
      });
      
      setPendingData(Array.from(groups.values()));
    } catch {
      // 错误已处理
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoryData = async () => {
    try {
      const data = await reviewsApi.getHistory();
      setHistoryData(data);
    } catch {
      // 错误已处理
    }
  };

  useEffect(() => {
    fetchPendingData();
    fetchHistoryData();
  }, []);

  const handleAction = (group: UserGoalGroup, action: 'approve' | 'reject') => {
    setCurrentGroup(group);
    setModalAction(action);
    setModalVisible(true);
  };

  const handleModalOk = async (comments: string) => {
    if (!currentGroup || currentGroup.goals.length === 0) return;
    
    try {
      // 使用第一个目标的ID作为代表进行批量操作
      const goalId = currentGroup.goals[0].goal_id;
      
      if (modalAction === 'approve') {
        await reviewsApi.approve(goalId, comments);
        message.success(`已批量通过 ${currentGroup.userName} 的 ${currentGroup.goals.length} 个目标`);
      } else {
        if (!comments) {
          message.error('请填写驳回原因');
          return;
        }
        await reviewsApi.reject(goalId, comments);
        message.success(`已批量驳回 ${currentGroup.userName} 的 ${currentGroup.goals.length} 个目标`);
      }
      setModalVisible(false);
      fetchPendingData();
      fetchHistoryData();
    } catch {
      // 错误已处理
    }
  };

  const userGroupColumns: ColumnsType<UserGoalGroup> = [
    {
      title: '员工姓名',
      dataIndex: 'userName',
      key: 'userName',
      width: 120,
    },
    {
      title: '周期',
      dataIndex: 'periodName',
      key: 'periodName',
      width: 150,
    },
    {
      title: '目标数量',
      key: 'goalCount',
      width: 100,
      render: (_, record) => `${record.goals.length} 个`,
    },
    {
      title: '权重总和',
      dataIndex: 'totalWeight',
      key: 'totalWeight',
      width: 100,
      render: (weight) => (
        <span style={{ color: Math.abs(weight - 100) > 0.01 ? '#ff4d4f' : '#52c41a' }}>
          {weight}%
        </span>
      ),
    },
    {
      title: '提交时间',
      key: 'submitTime',
      width: 180,
      render: (_, record) => {
        const firstGoal = record.goals[0];
        return firstGoal && firstGoal.updated_at ? new Date(firstGoal.updated_at).toLocaleString('zh-CN') : '-';
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 260,
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={() => handleAction(record, 'approve')}
          >
            批量通过
          </Button>
          <Button
            danger
            size="small"
            icon={<CloseOutlined />}
            onClick={() => handleAction(record, 'reject')}
          >
            批量驳回
          </Button>
        </Space>
      ),
    },
  ];

  const goalDetailColumns: ColumnsType<PbcGoal> = [
    {
      title: '目标名称',
      dataIndex: 'goal_name',
      key: 'goal_name',
      width: 200,
    },
    {
      title: '目标类型',
      dataIndex: 'goal_type',
      key: 'goal_type',
      width: 100,
      render: (type: string) => goalTypeMap[type] || type,
    },
    {
      title: '权重',
      dataIndex: 'goal_weight',
      key: 'goal_weight',
      width: 80,
      render: (weight) => `${weight}%`,
    },
    {
      title: '目标描述',
      dataIndex: 'goal_description',
      key: 'goal_description',
      width: 200,
      ellipsis: {
        showTitle: false,
      },
      render: (text) => (
        <span title={text} style={{ cursor: 'pointer' }}>
          {text}
        </span>
      ),
    },
    {
      title: '不可接受标准',
      dataIndex: 'unacceptable',
      key: 'unacceptable',
      width: 150,
      ellipsis: {
        showTitle: false,
      },
      render: (text) => (
        <span title={text} style={{ cursor: 'pointer' }}>
          {text || '-'}
        </span>
      ),
    },
    {
      title: '达标标准',
      dataIndex: 'acceptable',
      key: 'acceptable',
      width: 150,
      ellipsis: {
        showTitle: false,
      },
      render: (text) => (
        <span title={text} style={{ cursor: 'pointer' }}>
          {text || '-'}
        </span>
      ),
    },
    {
      title: '卓越标准',
      dataIndex: 'excellent',
      key: 'excellent',
      width: 150,
      ellipsis: {
        showTitle: false,
      },
      render: (text) => (
        <span title={text} style={{ cursor: 'pointer' }}>
          {text || '-'}
        </span>
      ),
    },
  ];

  const historyColumns: ColumnsType<PbcGoal> = [
    {
      title: '员工姓名',
      dataIndex: ['user', 'real_name'],
      key: 'user_name',
      width: 100,
    },
    {
      title: '目标名称',
      dataIndex: 'goal_name',
      key: 'goal_name',
      width: 200,
    },
    {
      title: '目标类型',
      dataIndex: 'goal_type',
      key: 'goal_type',
      width: 100,
      render: (type: string) => goalTypeMap[type] || type,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: PbcStatus) => (
        <Tag color={statusMap[status].color}>{statusMap[status].text}</Tag>
      ),
    },
    {
      title: '自评分',
      dataIndex: 'self_score',
      key: 'self_score',
      width: 80,
      render: (score) => score ? `${score}分` : '-',
    },
    {
      title: '主管评分',
      dataIndex: 'supervisor_score',
      key: 'supervisor_score',
      width: 100,
      render: (score) => score ? `${score}分` : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/review/${record.goal_id}`)}
        >
          查看
        </Button>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'pending',
      label: `待审核 (${pendingData.length}人)`,
      children: (
        <Table
          columns={userGroupColumns}
          dataSource={pendingData}
          rowKey={(record) => `${record.userId}_${record.periodId || 'no_period'}`}
          loading={loading}
          pagination={{ pageSize: 10 }}
          expandable={{
            expandedRowRender: (record) => (
              <Table
                columns={goalDetailColumns}
                dataSource={record.goals}
                rowKey="goal_id"
                pagination={false}
                size="small"
              />
            ),
          }}
        />
      ),
    },
    {
      key: 'history',
      label: '历史记录',
      children: (
        <Table
          columns={historyColumns}
          dataSource={historyData}
          rowKey="goal_id"
          pagination={{ pageSize: 10 }}
        />
      ),
    },
  ];

  return (
    <Card title="审核管理">
      <Tabs items={tabItems} />
      <ReviewModal
        visible={modalVisible}
        action={modalAction}
        goal={currentGroup?.goals[0] || null}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        extraInfo={
          currentGroup
            ? `将批量${modalAction === 'approve' ? '通过' : '驳回'} ${currentGroup.userName} 的 ${currentGroup.goals.length} 个目标（权重总和：${currentGroup.totalWeight}%）`
            : undefined
        }
      />
    </Card>
  );
};

export default ReviewList;
