import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Button, Tag, Tabs, Space, message, Modal, Descriptions, Divider, Input, InputNumber } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined, EditOutlined, StarOutlined } from '@ant-design/icons';
import { reviewsApi, pbcApi, PbcGoal, PbcStatus } from '../../api';
import type { ColumnsType } from 'antd/es/table';
import ReviewModal from './ReviewModal';
import { sortGoals } from '../../utils/goalSort';
import MultilineText from '../../components/MultilineText';

const { TextArea } = Input;

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

const goalNatureMap: Record<string, string> = {
  qualitative: '定性',
  quantitative: '定量',
};

interface UserGoalGroup {
  userId: number;
  userName: string;
  periodId?: number;
  periodName: string;
  goals: PbcGoal[];
  totalWeight: number;
}

interface PendingEvalItem {
  evaluation_id: number;
  user_id: number;
  period_id: number;
  self_overall_comment: string;
  self_submitted_at: string;
  user: { user_id: number; real_name: string; department?: { department_name: string } };
  period: { period_id: number; year: number; quarter: number };
  goals: PbcGoal[];
}

const ReviewList: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [pendingData, setPendingData] = useState<UserGoalGroup[]>([]);
  const [historyData, setHistoryData] = useState<UserGoalGroup[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentGroup, setCurrentGroup] = useState<UserGoalGroup | null>(null);
  const [modalAction, setModalAction] = useState<'approve' | 'reject'>('approve');
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [viewDetailGroup, setViewDetailGroup] = useState<UserGoalGroup | null>(null);

  // 待评价相关状态
  const [pendingEvalData, setPendingEvalData] = useState<PendingEvalItem[]>([]);
  const [evalModalVisible, setEvalModalVisible] = useState(false);
  const [currentEvalItem, setCurrentEvalItem] = useState<PendingEvalItem | null>(null);
  const [supervisorInputs, setSupervisorInputs] = useState<Record<number, { score?: number; comment: string }>>({});
  const [overallSupervisorComment, setOverallSupervisorComment] = useState('');
  const [overallSupervisorScore, setOverallSupervisorScore] = useState<number | undefined>(undefined);
  const [supervisorSavingAll, setSupervisorSavingAll] = useState(false);
  // 驳回自评相关
  const [rejectEvalModalVisible, setRejectEvalModalVisible] = useState(false);
  const [rejectEvalTarget, setRejectEvalTarget] = useState<PendingEvalItem | null>(null);
  const [rejectEvalReason, setRejectEvalReason] = useState('');

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
      
      // 按员工和周期分组（与待审核逻辑一致）
      const groups: Map<string, UserGoalGroup> = new Map();
      data.forEach((goal: PbcGoal) => {
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
      
      setHistoryData(Array.from(groups.values()));
    } catch {
      // 错误已处理
    }
  };

  const fetchPendingEvaluations = async () => {
    try {
      const data = await reviewsApi.getPendingEvaluations();
      setPendingEvalData(data);
    } catch {
      // 错误已处理
    }
  };

  useEffect(() => {
    fetchPendingData();
    fetchHistoryData();
    fetchPendingEvaluations();
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

  // ========== 评价相关逻辑 ==========
  const handleOpenEvalModal = (item: PendingEvalItem) => {
    setCurrentEvalItem(item);
    // 初始化主管评价输入
    const inputs: Record<number, { score?: number; comment: string }> = {};
    item.goals.forEach((g: any) => {
      inputs[g.goal_id] = {
        score: g.supervisor_score ? Number(g.supervisor_score) : undefined,
        comment: g.supervisor_comment || '',
      };
    });
    setSupervisorInputs(inputs);
    setOverallSupervisorComment('');
    setOverallSupervisorScore(undefined);
    setEvalModalVisible(true);
  };

  const handleSaveAllSupervisorEval = async () => {
    if (!currentEvalItem) return;
    if (!overallSupervisorComment.trim()) {
      message.warning('请填写整体主管评价');
      return;
    }
    setSupervisorSavingAll(true);
    const evaluableGoals = currentEvalItem.goals.filter((g: any) => g.self_score);
    for (const g of evaluableGoals) {
      const input = supervisorInputs[g.goal_id];
      if (input?.score != null) {
        try {
          await pbcApi.supervisorEvaluate(g.goal_id, input.score, input.comment);
        } catch { /* skip */ }
      }
    }
    // 保存整体主管评价
    try {
      await pbcApi.submitSupervisorEvaluation(
        currentEvalItem.user_id,
        currentEvalItem.period_id,
        overallSupervisorComment,
        overallSupervisorScore,
      );
    } catch { /* skip */ }
    setSupervisorSavingAll(false);
    message.success('整体评价已提交');
    setEvalModalVisible(false);
    fetchPendingEvaluations();
    fetchHistoryData();
  };

  const handleRejectSelfEval = (item: PendingEvalItem) => {
    setRejectEvalTarget(item);
    setRejectEvalReason('');
    setRejectEvalModalVisible(true);
  };

  const handleConfirmRejectSelfEval = async () => {
    if (!rejectEvalTarget) return;
    if (!rejectEvalReason.trim()) {
      message.warning('请填写驳回原因');
      return;
    }
    try {
      await reviewsApi.rejectSelfEvaluation(
        rejectEvalTarget.user_id,
        rejectEvalTarget.period_id,
        rejectEvalReason,
      );
      message.success('已驳回自评');
      setRejectEvalModalVisible(false);
      fetchPendingEvaluations();
    } catch (err: any) {
      message.error(err.response?.data?.message || '驳回失败');
    }
  };

  // ========== 表格列定义 ==========
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
      fixed: 'right',
      width: 280,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setViewDetailGroup(record);
              setDetailModalVisible(true);
            }}
          >
            查看
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={() => handleAction(record, 'approve')}
          >
            通过
          </Button>
          <Button
            danger
            size="small"
            icon={<CloseOutlined />}
            onClick={() => handleAction(record, 'reject')}
          >
            驳回
          </Button>
        </Space>
      ),
    },
  ];

  const pendingEvalColumns: ColumnsType<PendingEvalItem> = [
    {
      title: '员工姓名',
      key: 'userName',
      width: 120,
      render: (_, record) => record.user?.real_name || '-',
    },
    {
      title: '部门',
      key: 'department',
      width: 150,
      render: (_, record) => record.user?.department?.department_name || '-',
    },
    {
      title: '周期',
      key: 'period',
      width: 150,
      render: (_, record) => record.period ? `${record.period.year}年Q${record.period.quarter}` : '-',
    },
    {
      title: '目标数量',
      key: 'goalCount',
      width: 100,
      render: (_, record) => `${record.goals?.length || 0} 个`,
    },
    {
      title: '自评提交时间',
      key: 'selfSubmittedAt',
      width: 180,
      render: (_, record) => record.self_submitted_at
        ? new Date(record.self_submitted_at).toLocaleString('zh-CN')
        : '-',
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: () => <Tag color="orange">待评价</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEvalModal(record)}
          >
            评价
          </Button>
          <Button
            danger
            size="small"
            icon={<CloseOutlined />}
            onClick={() => handleRejectSelfEval(record)}
          >
            驳回自评
          </Button>
        </Space>
      ),
    },
  ];

  const historyColumns: ColumnsType<UserGoalGroup> = [
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
      title: '最终状态',
      key: 'finalStatus',
      width: 100,
      render: (_, record) => {
        // 取第一个目标的状态作为代表（同一周期的目标状态应该一致）
        const status = record.goals[0]?.status;
        return status ? <Tag color={statusMap[status].color}>{statusMap[status].text}</Tag> : '-';
      },
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
          onClick={() => {
            setViewDetailGroup(record);
            setDetailModalVisible(true);
          }}
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
          scroll={{ x: 'max-content' }}
        />
      ),
    },
    {
      key: 'pendingEval',
      label: `待评价 (${pendingEvalData.length}人)`,
      children: (
        <Table
          columns={pendingEvalColumns}
          dataSource={pendingEvalData}
          rowKey="evaluation_id"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 'max-content' }}
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
          rowKey={(record) => `${record.userId}_${record.periodId || 'no_period'}`}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 'max-content' }}
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

      {/* 查看目标详情Modal */}
      <Modal
        title={`${viewDetailGroup?.userName} - ${viewDetailGroup?.periodName} - 目标详情`}
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setViewDetailGroup(null);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
          viewDetailGroup && (
            <Button
              key="reject"
              danger
              icon={<CloseOutlined />}
              onClick={() => {
                setDetailModalVisible(false);
                handleAction(viewDetailGroup, 'reject');
              }}
            >
              驳回
            </Button>
          ),
          viewDetailGroup && (
            <Button
              key="approve"
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => {
                setDetailModalVisible(false);
                handleAction(viewDetailGroup, 'approve');
              }}
            >
              通过
            </Button>
          ),
        ]}
        width={900}
        bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
      >
        {viewDetailGroup && (
          <div>
            <div style={{ marginBottom: 16, fontSize: 14, color: '#666', textAlign: 'center' }}>
              <span>目标数量：{viewDetailGroup.goals.length} 个</span>
              <span style={{ marginLeft: 24 }}>
                权重总和：
                <span style={{ 
                  color: Math.abs(viewDetailGroup.totalWeight - 100) > 0.01 ? '#ff4d4f' : '#52c41a',
                  fontWeight: 'bold'
                }}>
                  {viewDetailGroup.totalWeight}%
                </span>
              </span>
            </div>
            
            {sortGoals(viewDetailGroup.goals).map((goal, index) => (
              <Card
                key={goal.goal_id}
                size="small"
                style={{ marginBottom: 16 }}
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <span>
                      <Tag color="blue">目标 {index + 1}</Tag>
                      <span style={{ marginLeft: 8 }}>{goal.goal_name}</span>
                    </span>
                    <Space>
                      <Tag color="processing">{goalTypeMap[goal.goal_type] || goal.goal_type}</Tag>
                      <span
                        style={{
                          display: 'inline-block',
                          background: 'linear-gradient(135deg, #fa8c16, #faad14)',
                          color: '#fff',
                          borderRadius: 20,
                          padding: '3px 14px',
                          fontWeight: 700,
                          fontSize: 15,
                          letterSpacing: 1,
                          minWidth: 64,
                          textAlign: 'center',
                          boxShadow: '0 2px 6px rgba(250,140,22,0.4)',
                        }}
                      >
                        {goal.goal_weight}%
                      </span>
                    </Space>
                  </div>
                }
              >
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="性质">
                    {goalNatureMap[(goal as any).goal_nature] || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="目标描述">
                    <MultilineText text={goal.goal_description} />
                  </Descriptions.Item>
                  
                  {goal.goal_type !== 'skill' && goal.measures && (
                    <Descriptions.Item label="实现举措">
                      <MultilineText text={goal.measures} />
                    </Descriptions.Item>
                  )}
                  
                  {goal.goal_type === 'business' && (
                    <>
                      <Descriptions.Item label="不可接受标准">
                        <MultilineText text={goal.unacceptable} style={{ color: '#ff4d4f' }} />
                      </Descriptions.Item>
                      <Descriptions.Item label="达标标准">
                        <MultilineText text={goal.acceptable} style={{ color: '#1890ff' }} />
                      </Descriptions.Item>
                      <Descriptions.Item label="卓越标准">
                        <MultilineText text={goal.excellent} style={{ color: '#52c41a' }} />
                      </Descriptions.Item>
                    </>
                  )}
                </Descriptions>
              </Card>
            ))}
          </div>
        )}
      </Modal>

      {/* 评价详情Modal */}
      <Modal
        title={currentEvalItem ? `评价 - ${currentEvalItem.user?.real_name} - ${currentEvalItem.period?.year}年Q${currentEvalItem.period?.quarter}` : '评价'}
        open={evalModalVisible}
        onCancel={() => {
          setEvalModalVisible(false);
          setCurrentEvalItem(null);
        }}
        maskClosable={false}
        footer={[
          <Button key="close" onClick={() => setEvalModalVisible(false)}>
            关闭
          </Button>,
          <Button
            key="reject"
            danger
            icon={<CloseOutlined />}
            onClick={() => {
              if (currentEvalItem) {
                setEvalModalVisible(false);
                handleRejectSelfEval(currentEvalItem);
              }
            }}
          >
            驳回自评
          </Button>,
          <Button
            key="saveAll"
            type="primary"
            loading={supervisorSavingAll}
            icon={<EditOutlined />}
            onClick={handleSaveAllSupervisorEval}
          >
            保存并提交评价
          </Button>,
        ]}
        width={1100}
        bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
      >
        {currentEvalItem && (
          <div>
            {/* 整体自评展示 */}
            <Card title="整体自评" size="small" style={{ marginBottom: 16 }}>
              <Descriptions column={1}>
                <Descriptions.Item label="提交时间">
                  {new Date(currentEvalItem.self_submitted_at).toLocaleString('zh-CN')}
                </Descriptions.Item>
                <Descriptions.Item label="整体自评">
                  <MultilineText text={currentEvalItem.self_overall_comment} />
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* 各目标评价详情 */}
            <Card title="各目标评价详情" size="small">
              {sortGoals(currentEvalItem.goals).map((goal: any, index: number) => (
                <Card
                  key={goal.goal_id}
                  size="small"
                  style={{ marginBottom: 12, border: '1px solid #f0f0f0' }}
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <Space>
                        <Tag color="blue">目标 {index + 1}</Tag>
                        <span style={{ fontWeight: 600 }}>{goal.goal_name}</span>
                      </Space>
                      <Space>
                        <Tag color="processing">{goalTypeMap[goal.goal_type] || goal.goal_type}</Tag>
                        <span
                          style={{
                            display: 'inline-block',
                            background: 'linear-gradient(135deg, #fa8c16, #faad14)',
                            color: '#fff',
                            borderRadius: 20,
                            padding: '3px 14px',
                            fontWeight: 700,
                            fontSize: 15,
                            letterSpacing: 1,
                            minWidth: 64,
                            textAlign: 'center',
                            boxShadow: '0 2px 6px rgba(250,140,22,0.4)',
                          }}
                        >
                          {goal.goal_weight}%
                        </span>
                      </Space>
                    </div>
                  }
                >
                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="性质">{goalNatureMap[goal.goal_nature] || '-'}</Descriptions.Item>
                    <Descriptions.Item label="目标描述"><MultilineText text={goal.goal_description} /></Descriptions.Item>
                    {goal.goal_type !== 'skill' && goal.measures && (
                      <Descriptions.Item label="实现举措"><MultilineText text={goal.measures} /></Descriptions.Item>
                    )}
                    {goal.goal_type === 'business' && (
                      <>
                        <Descriptions.Item label={<span style={{ color: '#ff4d4f' }}>不可接受标准</span>}>
                          <MultilineText text={goal.unacceptable} style={{ color: '#ff4d4f' }} />
                        </Descriptions.Item>
                        <Descriptions.Item label={<span style={{ color: '#1890ff' }}>达标标准</span>}>
                          <MultilineText text={goal.acceptable} style={{ color: '#1890ff' }} />
                        </Descriptions.Item>
                        <Descriptions.Item label={<span style={{ color: '#52c41a' }}>卓越标准</span>}>
                          <MultilineText text={goal.excellent} style={{ color: '#52c41a' }} />
                        </Descriptions.Item>
                      </>
                    )}
                  </Descriptions>

                  {/* 员工自评 */}
                  {goal.self_score && (
                    <div style={{ display: 'flex', gap: 12, marginTop: 12, padding: '10px 12px', background: '#e6f4ff', borderRadius: 6, border: '1px solid #bae0ff', alignItems: 'flex-start' }}>
                      <div style={{ flexShrink: 0, width: 90 }}>
                        <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>自评分</div>
                        <span style={{ fontWeight: 700, color: '#1890ff', fontSize: 16 }}>{goal.self_score} 分</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>自评说明</div>
                        <MultilineText text={goal.self_comment} />
                      </div>
                    </div>
                  )}

                  {/* 内联主管评价输入 */}
                  {goal.self_score && (
                    <div style={{ display: 'flex', gap: 12, marginTop: 8, padding: '10px 12px', background: '#fcffe6', borderRadius: 6, border: '1px solid #eaff8f', alignItems: 'flex-start' }}>
                      <div style={{ flexShrink: 0, width: 90 }}>
                        <div style={{ fontSize: 12, color: '#52c41a', marginBottom: 4, fontWeight: 600 }}>主管评分</div>
                        <InputNumber
                          style={{ width: '100%' }}
                          min={0} max={100}
                          placeholder="0-100"
                          value={supervisorInputs[goal.goal_id]?.score}
                          onChange={(val) => setSupervisorInputs(prev => ({
                            ...prev,
                            [goal.goal_id]: { ...prev[goal.goal_id], score: val ?? undefined },
                          }))}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: '#52c41a', marginBottom: 4, fontWeight: 600 }}>主管评价</div>
                        <TextArea
                          autoSize={{ minRows: 1, maxRows: 4 }}
                          placeholder="请对员工的目标完成情况给出评价和建议"
                          value={supervisorInputs[goal.goal_id]?.comment}
                          onChange={(e) => setSupervisorInputs(prev => ({
                            ...prev,
                            [goal.goal_id]: { ...prev[goal.goal_id], comment: e.target.value },
                          }))}
                        />
                      </div>
                    </div>
                  )}

                  {!goal.self_score && (
                    <div style={{ marginTop: 8, color: '#999', fontStyle: 'italic' }}>员工尚未完成该目标的自评</div>
                  )}
                </Card>
              ))}
            </Card>

            {/* 内联整体主管评价 */}
            <div style={{ marginTop: 16, padding: '12px 16px', background: '#fcffe6', borderRadius: 6, border: '1px solid #eaff8f' }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: '#52c41a', fontSize: 13 }}>
                <EditOutlined style={{ marginRight: 4 }} />
                整体主管评价 <span style={{ color: '#ff4d4f' }}>*</span>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 12, color: '#52c41a', marginBottom: 4, fontWeight: 600 }}>整体评分（选填）</div>
                  <InputNumber
                    min={0}
                    max={100}
                    placeholder="0-100"
                    value={overallSupervisorScore}
                    onChange={(val) => setOverallSupervisorScore(val ?? undefined)}
                    style={{ width: 100 }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#52c41a', marginBottom: 4, fontWeight: 600 }}>整体评价（必填）</div>
                  <TextArea
                    rows={3}
                    autoSize={{ minRows: 3, maxRows: 8 }}
                    showCount
                    maxLength={1000}
                    placeholder="请总结员工本季度的工作表现、亮点、不足、改进建议等"
                    value={overallSupervisorComment}
                    onChange={(e) => setOverallSupervisorComment(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 驳回自评Modal */}
      <Modal
        title="驳回自评"
        open={rejectEvalModalVisible}
        onOk={handleConfirmRejectSelfEval}
        onCancel={() => {
          setRejectEvalModalVisible(false);
          setRejectEvalTarget(null);
          setRejectEvalReason('');
        }}
        maskClosable={false}
        okText="确认驳回"
        okButtonProps={{ danger: true }}
        cancelText="取消"
      >
        {rejectEvalTarget && (
          <div style={{ marginBottom: 16 }}>
            <p><strong>员工：</strong>{rejectEvalTarget.user?.real_name}</p>
            <p><strong>周期：</strong>{rejectEvalTarget.period?.year}年Q{rejectEvalTarget.period?.quarter}</p>
            <p style={{ color: '#ff4d4f' }}>驳回后员工需重新修改自评并提交</p>
          </div>
        )}
        <TextArea
          rows={4}
          placeholder="请填写驳回原因（必填）"
          value={rejectEvalReason}
          onChange={(e) => setRejectEvalReason(e.target.value)}
        />
      </Modal>
    </Card>
  );
};

export default ReviewList;
