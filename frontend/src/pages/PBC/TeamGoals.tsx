import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Select,
  Input,
  Tag,
  Space,
  Button,
  Modal,
  InputNumber,
  message,
  Descriptions,
} from 'antd';
import { EyeOutlined, EditOutlined } from '@ant-design/icons';
import { pbcApi, PbcGoal, PbcPeriod, PbcStatus } from '../../api';
import type { ColumnsType } from 'antd/es/table';
import { sortGoals } from '../../utils/goalSort';

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

interface UserPeriodGroup {
  userId: number;
  userName: string;
  departmentName: string;
  periodId: number;
  periodName: string;
  goals: PbcGoal[];
  totalWeight: number;
  supervisorOverallScore?: number;
}

const TeamGoals: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PbcGoal[]>([]);
  const [groupedData, setGroupedData] = useState<UserPeriodGroup[]>([]);
  const [filteredData, setFilteredData] = useState<UserPeriodGroup[]>([]);
  const [periods, setPeriods] = useState<PbcPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<number | undefined>();
  const [searchName, setSearchName] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string | undefined>();
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [viewDetailGroup, setViewDetailGroup] = useState<UserPeriodGroup | null>(null);

  // 评价相关状态
  const [evaluationModalVisible, setEvaluationModalVisible] = useState(false);
  const [currentEvaluationData, setCurrentEvaluationData] = useState<any>(null);
  const [supervisorInputs, setSupervisorInputs] = useState<Record<number, { score?: number; comment: string }>>({});
  const [overallSupervisorComment, setOverallSupervisorComment] = useState('');
  const [overallSupervisorScore, setOverallSupervisorScore] = useState<number | undefined>(undefined);

  const fetchPeriods = async () => {
    try {
      const data = await pbcApi.getPeriods();
      setPeriods(data);
    } catch {
      // 错误已处理
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await pbcApi.getTeamGoals(selectedPeriod);
      setData(result);
      groupDataByUserAndPeriod(result);
    } catch {
      // 错误已处理
    } finally {
      setLoading(false);
    }
  };

  const groupDataByUserAndPeriod = (goals: PbcGoal[]) => {
    const groups: Map<string, UserPeriodGroup> = new Map();
    
    goals.forEach((goal) => {
      const key = `${goal.user_id}-${goal.period_id || 0}`;
      if (!groups.has(key)) {
        const evaluation = (goal as any).evaluation;
        groups.set(key, {
          userId: goal.user_id,
          userName: goal.user?.real_name || '',
          departmentName: goal.user?.department?.department_name || '',
          periodId: goal.period_id || 0,
          periodName: goal.period
            ? `${goal.period.year}年第${goal.period.quarter}季度`
            : '未指定周期',
          goals: [],
          totalWeight: 0,
          supervisorOverallScore: evaluation?.supervisor_overall_score ?? undefined,
        });
      }
      const group = groups.get(key)!;
      group.goals.push(goal);
      group.totalWeight += Number(goal.goal_weight);
    });

    const grouped = Array.from(groups.values());
    setGroupedData(grouped);
    setFilteredData(grouped);
  };

  useEffect(() => {
    fetchPeriods();
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedPeriod]);

  // 初始化内联主管评价数据
  useEffect(() => {
    if (currentEvaluationData?.goals) {
      const inputs: Record<number, { score?: number; comment: string }> = {};
      currentEvaluationData.goals.forEach((g: any) => {
        inputs[g.goal_id] = {
          score: g.supervisor_score ? Number(g.supervisor_score) : undefined,
          comment: g.supervisor_comment || '',
        };
      });
      setSupervisorInputs(inputs);
      setOverallSupervisorComment(currentEvaluationData.evaluation?.supervisor_overall_comment || '');
      setOverallSupervisorScore(currentEvaluationData.evaluation?.supervisor_overall_score ?? undefined);
    }
  }, [currentEvaluationData]);

  useEffect(() => {
    // 筛选逻辑
    let filtered = groupedData;

    if (searchName) {
      filtered = filtered.filter((group) =>
        group.userName.toLowerCase().includes(searchName.toLowerCase())
      );
    }

    if (selectedDepartment) {
      filtered = filtered.filter((group) =>
        group.departmentName === selectedDepartment
      );
    }

    setFilteredData(filtered);
  }, [searchName, selectedDepartment, groupedData]);

  const handleNameSearch = (value: string) => {
    setSearchName(value);
  };

  // 查看自评
  const handleViewEvaluation = async (userId: number, periodId: number) => {
    try {
      const data = await pbcApi.getEvaluation(userId, periodId);
      setCurrentEvaluationData(data);
      setEvaluationModalVisible(true);
    } catch (error: any) {
      message.error(error.response?.data?.message || '获取评价信息失败');
    }
  };

  // 批量保存所有主管评价
  const [supervisorSavingAll, setSupervisorSavingAll] = useState(false);
  const handleSaveAllSupervisorEval = async () => {
    if (!currentEvaluationData?.goals) return;
    if (!overallSupervisorComment.trim()) {
      message.warning('请填写整体主管评价');
      return;
    }
    setSupervisorSavingAll(true);
    const evaluableGoals = currentEvaluationData.goals.filter((g: any) => g.self_score);
    for (const g of evaluableGoals) {
      const input = supervisorInputs[g.goal_id];
      if (input?.score != null) {
        try {
          await pbcApi.supervisorEvaluate(g.goal_id, input.score, input.comment);
        } catch { /* skip */ }
      }
    }
    // 保存整体主管评价
    if (currentEvaluationData?.goals?.[0]) {
      try {
        await pbcApi.submitSupervisorEvaluation(
          currentEvaluationData.goals[0].user_id,
          currentEvaluationData.goals[0].period_id,
          overallSupervisorComment,
          overallSupervisorScore,
        );
      } catch { /* skip */ }
    }
    setSupervisorSavingAll(false);
    message.success('整体评价已提交');
    fetchData();
    setEvaluationModalVisible(false);
  };



  const userGroupColumns: ColumnsType<UserPeriodGroup> = [
    {
      title: '员工姓名',
      dataIndex: 'userName',
      key: 'userName',
      width: 120,
    },
    {
      title: '部门',
      dataIndex: 'departmentName',
      key: 'departmentName',
      width: 150,
    },
    {
      title: '季度',
      key: 'quarter',
      width: 100,
      render: (_, record) => {
        if (record.goals.length > 0 && record.goals[0].period) {
          const period = record.goals[0].period;
          return `${period.year}年Q${period.quarter}`;
        }
        return '-';
      },
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => {
        if (record.goals.length > 0) {
          const status = record.goals[0].status;
          return <Tag color={statusMap[status].color}>{statusMap[status].text}</Tag>;
        }
        return '-';
      },
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
      title: '主管整体评分',
      key: 'supervisorOverallScore',
      dataIndex: 'supervisorOverallScore',
      width: 120,
      sorter: (a, b) => {
        const aScore = a.supervisorOverallScore ?? -1;
        const bScore = b.supervisorOverallScore ?? -1;
        return aScore - bScore;
      },
      defaultSortOrder: 'descend',
      render: (score?: number) =>
        score != null ? (
          <span style={{ fontWeight: 700, color: '#52c41a' }}>{score} 分</span>
        ) : (
          <span style={{ color: '#bbb' }}>-</span>
        ),
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 200,
      render: (_, record) => {
        // 检查是否已提交自评
        const hasSelfEvaluation = record.goals.some((g: any) => g.self_score);
        
        return (
          <Space>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setViewDetailGroup(record);
                setDetailModalVisible(true);
              }}
            >
              查看目标
            </Button>
            {hasSelfEvaluation ? (
              <Button
                type="link"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handleViewEvaluation(record.userId, record.periodId)}
              >
                查看自评
              </Button>
            ) : (
              <span style={{ color: '#999', fontSize: 12 }}>待自评</span>
            )}
          </Space>
        );
      },
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
      width: 120,
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
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: PbcStatus) => (
        <Tag color={statusMap[status].color}>{statusMap[status].text}</Tag>
      ),
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
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date) => new Date(date).toLocaleString('zh-CN'),
    },
  ];

  // 从分组数据中提取所有部门
  const departments = Array.from(new Set(groupedData.map(g => g.departmentName).filter(d => d)));

  return (
    <>
      <Card title="团队目标查看">
      <Space style={{ marginBottom: 16 }} size="middle">
        <Input
          placeholder="搜索员工姓名"
          value={searchName}
          onChange={(e) => handleNameSearch(e.target.value)}
          style={{ width: 200 }}
          allowClear
        />
        <Select
          placeholder="选择周期"
          value={selectedPeriod}
          onChange={setSelectedPeriod}
          style={{ width: 200 }}
          allowClear
        >
          {periods.map((period) => (
            <Select.Option key={period.period_id} value={period.period_id}>
              {period.year}年第{period.quarter}季度
            </Select.Option>
          ))}
        </Select>
        <Select
          placeholder="选择部门"
          value={selectedDepartment}
          onChange={setSelectedDepartment}
          style={{ width: 200 }}
          allowClear
        >
          {departments.map((dept) => (
            <Select.Option key={dept} value={dept}>
              {dept}
            </Select.Option>
          ))}
        </Select>
      </Space>

      <Table
        columns={userGroupColumns}
        dataSource={filteredData}
        rowKey={(record) => `${record.userId}_${record.periodId}`}
        loading={loading}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 'max-content' }}
      />
    </Card>

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
                    <Space wrap>
                      <Tag color="processing">{goalTypeMap[goal.goal_type] || goal.goal_type}</Tag>
                      <Tag color={statusMap[goal.status].color}>{statusMap[goal.status].text}</Tag>
                      {/* 醒目权重展示 */}
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
                  <Descriptions.Item label="目标描述">
                    {goal.goal_description}
                  </Descriptions.Item>
                  
                  {goal.goal_type !== 'skill' && goal.measures && (
                    <Descriptions.Item label="实现举措">
                      {goal.measures}
                    </Descriptions.Item>
                  )}
                  
                  {goal.goal_type === 'business' && (
                    <>
                      <Descriptions.Item label="不可接受标准">
                        <span style={{ color: '#ff4d4f' }}>
                          {goal.unacceptable || '-'}
                        </span>
                      </Descriptions.Item>
                      <Descriptions.Item label="达标标准">
                        <span style={{ color: '#1890ff' }}>
                          {goal.acceptable || '-'}
                        </span>
                      </Descriptions.Item>
                      <Descriptions.Item label="卓越标准">
                        <span style={{ color: '#52c41a' }}>
                          {goal.excellent || '-'}
                        </span>
                      </Descriptions.Item>
                    </>
                  )}
                  
                  {goal.created_at && (
                    <Descriptions.Item label="创建时间">
                      {new Date(goal.created_at).toLocaleString('zh-CN')}
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </Card>
            ))}
          </div>
        )}
      </Modal>

      {/* 查看自评模态框 */}
      <Modal
        title="查看自评与评价"
        open={evaluationModalVisible}
        onCancel={() => {
          setEvaluationModalVisible(false);
          setCurrentEvaluationData(null);
        }}
        footer={[
          <Button key="close" onClick={() => setEvaluationModalVisible(false)}>
            关闭
          </Button>,
          currentEvaluationData?.evaluation?.self_submitted_at && (
            <Button
              key="saveAll"
              type="primary"
              loading={supervisorSavingAll}
              icon={<EditOutlined />}
              onClick={handleSaveAllSupervisorEval}
            >
              保存评价
            </Button>
          ),
        ]}
        width={1100}
      >
        {currentEvaluationData && (
          <div>
            {/* 整体自评 */}
            {currentEvaluationData.evaluation?.self_submitted_at && (
              <Card title="整体自评" size="small" style={{ marginBottom: 16 }}>
                <Descriptions column={1}>
                  <Descriptions.Item label="提交时间">
                    {new Date(
                      currentEvaluationData.evaluation.self_submitted_at
                    ).toLocaleString('zh-CN')}
                  </Descriptions.Item>
                  <Descriptions.Item label="整体评价">
                    {currentEvaluationData.evaluation.self_overall_comment}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            )}

            {/* 整体主管评价 - 已提交展示 */}
            {currentEvaluationData.evaluation?.supervisor_submitted_at && (
              <Card title="整体主管评价（已提交）" size="small" style={{ marginBottom: 16 }}>
                <Descriptions column={2}>
                  <Descriptions.Item label="提交时间">
                    {new Date(
                      currentEvaluationData.evaluation.supervisor_submitted_at
                    ).toLocaleString('zh-CN')}
                  </Descriptions.Item>
                  <Descriptions.Item label="整体评分">
                    {currentEvaluationData.evaluation.supervisor_overall_score != null ? (
                      <span style={{ fontWeight: 700, color: '#52c41a', fontSize: 16 }}>
                        {currentEvaluationData.evaluation.supervisor_overall_score} 分
                      </span>
                    ) : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="整体评价" span={2}>
                    {currentEvaluationData.evaluation.supervisor_overall_comment}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            )}

            {/* 各目标评价详情 - 卡片布局 + 内联评价 */}
            <Card title="各目标评价详情" size="small">
              {sortGoals(currentEvaluationData.goals).map((goal: any, index: number) => (
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
                    <Descriptions.Item label="目标描述">{goal.goal_description}</Descriptions.Item>
                    {goal.goal_type !== 'skill' && goal.measures && (
                      <Descriptions.Item label="实现举措">{goal.measures}</Descriptions.Item>
                    )}
                    {goal.goal_type === 'business' && (
                      <>
                        <Descriptions.Item label={<span style={{ color: '#ff4d4f' }}>不可接受标准</span>}>
                          <span style={{ color: '#ff4d4f' }}>{goal.unacceptable || '-'}</span>
                        </Descriptions.Item>
                        <Descriptions.Item label={<span style={{ color: '#1890ff' }}>达标标准</span>}>
                          <span style={{ color: '#1890ff' }}>{goal.acceptable || '-'}</span>
                        </Descriptions.Item>
                        <Descriptions.Item label={<span style={{ color: '#52c41a' }}>卓越标准</span>}>
                          <span style={{ color: '#52c41a' }}>{goal.excellent || '-'}</span>
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
                        <span>{goal.self_comment || '-'}</span>
                      </div>
                    </div>
                  )}

                  {/* 内联主管评价区域 */}
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
                    <div style={{ marginTop: 8, color: '#999', fontStyle: 'italic' }}>员工尚未完成自评</div>
                  )}
                </Card>
              ))}
            </Card>

            {/* 内联整体主管评价 - 始终可编辑 */}
            {currentEvaluationData.evaluation?.self_submitted_at && (
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
            )}
          </div>
        )}
      </Modal>
    </>
  );
};

export default TeamGoals;
