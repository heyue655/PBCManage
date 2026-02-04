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
  Form,
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
  const [supervisorEvaluateModalVisible, setSupervisorEvaluateModalVisible] = useState(false);
  const [currentGoal, setCurrentGoal] = useState<PbcGoal | null>(null);
  const [supervisorForm] = Form.useForm();
  const [overallSupervisorModalVisible, setOverallSupervisorModalVisible] = useState(false);
  const [overallSupervisorForm] = Form.useForm();
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentPeriodId, setCurrentPeriodId] = useState<number | null>(null);

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

  // 打开主管评价模态框
  const handleOpenSupervisorEvaluate = (goal: PbcGoal) => {
    setCurrentGoal(goal);
    supervisorForm.setFieldsValue({
      score: (goal as any).supervisor_score || undefined,
      comment: (goal as any).supervisor_comment || '',
    });
    setSupervisorEvaluateModalVisible(true);
  };

  // 提交单个目标主管评价
  const handleSupervisorEvaluate = async () => {
    try {
      const values = await supervisorForm.validateFields();
      if (currentGoal) {
        await pbcApi.supervisorEvaluate(currentGoal.goal_id, values.score, values.comment);
        message.success('评价提交成功');
        setSupervisorEvaluateModalVisible(false);
        supervisorForm.resetFields();
        fetchData();
        
        // 如果已打开评价详情，刷新数据
        if (currentEvaluationData) {
          handleViewEvaluation(currentGoal.user_id, currentGoal.period_id!);
        }
      }
    } catch (error: any) {
      if (error.errorFields) {
        return;
      }
      message.error(error.response?.data?.message || '评价提交失败');
    }
  };

  // 打开整体主管评价模态框
  const handleOpenOverallSupervisorEvaluate = (userId: number, periodId: number) => {
    setCurrentUserId(userId);
    setCurrentPeriodId(periodId);
    setOverallSupervisorModalVisible(true);
  };

  // 提交整体主管评价
  const handleSubmitOverallSupervisorEvaluate = async () => {
    try {
      const values = await overallSupervisorForm.validateFields();
      if (currentUserId && currentPeriodId) {
        await pbcApi.submitSupervisorEvaluation(
          currentUserId,
          currentPeriodId,
          values.overallComment
        );
        message.success('整体评价提交成功');
        setOverallSupervisorModalVisible(false);
        overallSupervisorForm.resetFields();
        fetchData();
        
        // 关闭评价详情模态框
        setEvaluationModalVisible(false);
      }
    } catch (error: any) {
      if (error.errorFields) {
        return;
      }
      message.error(error.response?.data?.message || '整体评价提交失败');
    }
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
                      <Tag color="orange">权重 {goal.goal_weight}%</Tag>
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
          currentEvaluationData?.evaluation?.self_submitted_at &&
          !currentEvaluationData?.evaluation?.supervisor_submitted_at && (
            <Button
              key="evaluate"
              type="primary"
              onClick={() => {
                if (currentEvaluationData?.goals?.[0]) {
                  handleOpenOverallSupervisorEvaluate(
                    currentEvaluationData.goals[0].user_id,
                    currentEvaluationData.goals[0].period_id
                  );
                }
              }}
            >
              提交整体评价
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

            {/* 整体主管评价 */}
            {currentEvaluationData.evaluation?.supervisor_submitted_at && (
              <Card title="整体主管评价" size="small" style={{ marginBottom: 16 }}>
                <Descriptions column={1}>
                  <Descriptions.Item label="提交时间">
                    {new Date(
                      currentEvaluationData.evaluation.supervisor_submitted_at
                    ).toLocaleString('zh-CN')}
                  </Descriptions.Item>
                  <Descriptions.Item label="整体评价">
                    {currentEvaluationData.evaluation.supervisor_overall_comment}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            )}

            {/* 各目标详细评价 */}
            <Card title="各目标评价详情" size="small">
              <Table
                dataSource={sortGoals(currentEvaluationData.goals)}
                rowKey="goal_id"
                pagination={false}
                size="small"
                scroll={{ x: 'max-content' }}
                columns={[
                  {
                    title: '目标名称',
                    dataIndex: 'goal_name',
                    key: 'goal_name',
                    width: 140,
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
                    title: '类型',
                    dataIndex: 'goal_type',
                    key: 'goal_type',
                    width: 100,
                    render: (type: string) => goalTypeMap[type] || type,
                  },
                  {
                    title: '自评分',
                    key: 'self_score',
                    width: 80,
                    render: (_, record: any) => record.self_score || '-',
                  },
                  {
                    title: '自评说明',
                    key: 'self_comment',
                    width: 180,
                    ellipsis: {
                      showTitle: false,
                    },
                    render: (_, record: any) => (
                      <span title={record.self_comment} style={{ cursor: 'pointer' }}>
                        {record.self_comment || '-'}
                      </span>
                    ),
                  },
                  {
                    title: '主管评分',
                    key: 'supervisor_score',
                    width: 90,
                    render: (_, record: any) => record.supervisor_score || '-',
                  },
                  {
                    title: '主管评价',
                    key: 'supervisor_comment',
                    width: 180,
                    ellipsis: {
                      showTitle: false,
                    },
                    render: (_, record: any) => (
                      <span title={record.supervisor_comment} style={{ cursor: 'pointer' }}>
                        {record.supervisor_comment || '-'}
                      </span>
                    ),
                  },
                  {
                    title: '操作',
                    key: 'action',
                    width: 100,
                    fixed: 'right' as const,
                    render: (_, record: any) => {
                      if (currentEvaluationData.evaluation?.supervisor_submitted_at) {
                        return <span style={{ color: '#999' }}>已完成</span>;
                      }
                      if (!record.self_score) {
                        return <span style={{ color: '#999' }}>待自评</span>;
                      }
                      return (
                        <Button
                          type="link"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => handleOpenSupervisorEvaluate(record)}
                        >
                          {record.supervisor_score ? '修改评价' : '评价'}
                        </Button>
                      );
                    },
                  },
                ]}
              />
            </Card>
          </div>
        )}
      </Modal>

      {/* 主管评价单个目标模态框 */}
      <Modal
        title="主管评价"
        open={supervisorEvaluateModalVisible}
        onOk={handleSupervisorEvaluate}
        onCancel={() => {
          setSupervisorEvaluateModalVisible(false);
          supervisorForm.resetFields();
        }}
        okText="提交"
        cancelText="取消"
        width={700}
      >
        {currentGoal && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <strong>目标名称：</strong>{currentGoal.goal_name}
            </div>
            <div style={{ marginBottom: 16 }}>
              <strong>目标描述：</strong>{currentGoal.goal_description}
            </div>
            <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
              <div><strong>员工自评分数：</strong>{(currentGoal as any).self_score}</div>
              <div style={{ marginTop: 8 }}>
                <strong>员工自评说明：</strong>
                <div style={{ marginTop: 4 }}>{(currentGoal as any).self_comment}</div>
              </div>
            </div>
            <Form form={supervisorForm} layout="vertical">
              <Form.Item
                name="score"
                label="主管评分"
                rules={[
                  { required: true, message: '请输入评分' },
                  { type: 'number', min: 0, max: 100, message: '分数范围：0-100' },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="请输入0-100的分数"
                  min={0}
                  max={100}
                />
              </Form.Item>
              <Form.Item
                name="comment"
                label="主管评价"
                rules={[{ required: true, message: '请输入评价意见' }]}
              >
                <TextArea
                  rows={4}
                  placeholder="请对员工的目标完成情况给出评价和建议"
                />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      {/* 提交整体主管评价模态框 */}
      <Modal
        title="提交整体主管评价"
        open={overallSupervisorModalVisible}
        onOk={handleSubmitOverallSupervisorEvaluate}
        onCancel={() => {
          setOverallSupervisorModalVisible(false);
          overallSupervisorForm.resetFields();
        }}
        okText="提交"
        cancelText="取消"
        width={700}
      >
        <div style={{ marginBottom: 16, color: '#666' }}>
          请对该员工本季度的整体工作表现进行总结和评价
        </div>
        <Form form={overallSupervisorForm} layout="vertical">
          <Form.Item
            name="overallComment"
            label="整体评价（至少100字）"
            rules={[
              { required: true, message: '请输入整体评价' },
              { min: 100, message: '整体评价至少需要100字' },
            ]}
          >
            <TextArea
              rows={8}
              placeholder="请总结员工本季度的工作表现、亮点、不足、改进建议等（至少100字）"
              showCount
              maxLength={1000}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default TeamGoals;
