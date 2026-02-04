import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Select,
  Statistic,
  Row,
  Col,
  message,
  Popconfirm,
  Modal,
  Form,
  InputNumber,
  Input,
  Descriptions,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SendOutlined,
  StarOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { pbcApi, PbcGoal, PbcPeriod, PbcStatus } from '../../api';
import type { ColumnsType } from 'antd/es/table';
import { useAuthStore } from '../../store/authStore';

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

const PBCList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PbcGoal[]>([]);
  const [periods, setPeriods] = useState<PbcPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<number | undefined>();
  const [summary, setSummary] = useState<any>({ total: 0, status: 'draft', message: '' });
  
  // 自评相关状态
  const [selfEvaluateModalVisible, setSelfEvaluateModalVisible] = useState(false);
  const [currentGoal, setCurrentGoal] = useState<PbcGoal | null>(null);
  const [selfEvaluateForm] = Form.useForm();
  const [overallEvaluateModalVisible, setOverallEvaluateModalVisible] = useState(false);
  const [overallEvaluateForm] = Form.useForm();
  const [evaluationInfo, setEvaluationInfo] = useState<any>(null);
  const [viewFeedbackModalVisible, setViewFeedbackModalVisible] = useState(false);
  const [feedbackData, setFeedbackData] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 根据选中的周期筛选数据
      let queryParams: { year?: number; quarter?: number } = {};
      if (selectedPeriod) {
        const selectedPeriodData = periods.find((p) => p.period_id === selectedPeriod);
        if (selectedPeriodData) {
          queryParams = {
            year: selectedPeriodData.year,
            quarter: selectedPeriodData.quarter,
          };
        }
      }

      const [goalsData, summaryData] = await Promise.all([
        pbcApi.getAll(queryParams),
        pbcApi.getSummary(selectedPeriod),
      ]);
      setData(goalsData);
      setSummary(summaryData);

      // 如果状态是已通过，获取评价信息
      if (summaryData.status === 'approved' && user?.user_id && selectedPeriod) {
        try {
          const evalData = await pbcApi.getEvaluation(user.user_id, selectedPeriod);
          setEvaluationInfo(evalData);
        } catch (error) {
          // 如果没有评价信息，设置为null
          setEvaluationInfo(null);
        }
      } else {
        setEvaluationInfo(null);
      }
    } catch {
      // 错误已处理
    } finally {
      setLoading(false);
    }
  };

  const fetchPeriods = async () => {
    try {
      const periodsData = await pbcApi.getPeriods();
      setPeriods(periodsData);
      if (periodsData.length > 0) {
        const activePeriod = periodsData.find((p) => p.status === 'active');
        if (activePeriod) {
          setSelectedPeriod(activePeriod.period_id);
        }
      }
    } catch {
      // 错误已处理
    }
  };

  useEffect(() => {
    fetchPeriods();
  }, []);

  useEffect(() => {
    if (periods.length > 0) {
      fetchData();
    }
  }, [selectedPeriod, periods]);

  // 批量提交当前周期所有草稿和被驳回的目标
  const handleSubmitAll = async () => {
    try {
      const result = await pbcApi.submitAll(selectedPeriod);
      message.success(result.message || `成功提交 ${result.count} 个目标`);
      fetchData();
    } catch (error: any) {
      message.error(error.response?.data?.message || '提交失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await pbcApi.delete(id);
      message.success('删除成功');
      fetchData();
    } catch {
      // 错误已处理
    }
  };

  // 打开自评模态框
  const handleOpenSelfEvaluate = (goal: PbcGoal) => {
    setCurrentGoal(goal);
    selfEvaluateForm.setFieldsValue({
      score: (goal as any).self_score || undefined,
      comment: (goal as any).self_comment || '',
    });
    setSelfEvaluateModalVisible(true);
  };

  // 提交单个目标自评
  const handleSelfEvaluate = async () => {
    try {
      const values = await selfEvaluateForm.validateFields();
      if (currentGoal) {
        await pbcApi.selfEvaluate(currentGoal.goal_id, values.score, values.comment);
        message.success('自评提交成功');
        setSelfEvaluateModalVisible(false);
        selfEvaluateForm.resetFields();
        fetchData();
        
        // 检查是否所有目标都已自评，如果是则提示提交整体自评
        checkAllEvaluated();
      }
    } catch (error: any) {
      if (error.errorFields) {
        // 表单验证失败
        return;
      }
      message.error(error.response?.data?.message || '自评提交失败');
    }
  };

  // 检查是否所有目标都已自评
  const checkAllEvaluated = () => {
    const approvedGoals = data.filter((g) => g.status === 'approved');
    const evaluatedGoals = approvedGoals.filter((g: any) => g.self_score);
    
    if (approvedGoals.length > 0 && evaluatedGoals.length === approvedGoals.length) {
      Modal.info({
        title: '提示',
        content: '所有目标已完成自评，请提交整体自评！',
        okText: '确定',
      });
    }
  };

  // 打开整体自评模态框
  const handleOpenOverallEvaluate = () => {
    const approvedGoals = data.filter((g) => g.status === 'approved');
    const evaluatedGoals = approvedGoals.filter((g: any) => g.self_score);
    
    if (evaluatedGoals.length < approvedGoals.length) {
      message.warning('请先完成所有目标的自评');
      return;
    }
    
    setOverallEvaluateModalVisible(true);
  };

  // 提交整体自评
  const handleSubmitOverallEvaluate = async () => {
    try {
      const values = await overallEvaluateForm.validateFields();
      if (selectedPeriod) {
        await pbcApi.submitSelfEvaluation(selectedPeriod, values.overallComment);
        message.success('整体自评提交成功');
        setOverallEvaluateModalVisible(false);
        overallEvaluateForm.resetFields();
        fetchData();
      }
    } catch (error: any) {
      if (error.errorFields) {
        // 表单验证失败
        return;
      }
      message.error(error.response?.data?.message || '整体自评提交失败');
    }
  };

  // 查看反馈
  const handleViewEvaluation = async (userId: number, periodId: number) => {
    try {
      const data = await pbcApi.getEvaluation(userId, periodId);
      setFeedbackData(data);
      setViewFeedbackModalVisible(true);
    } catch (error: any) {
      message.error(error.response?.data?.message || '获取反馈信息失败');
    }
  };

  const columns: ColumnsType<PbcGoal> = [
    {
      title: '季度',
      key: 'quarter',
      width: 120,
      render: (_, record) => {
        if (record.period) {
          return `${record.period.year}年Q${record.period.quarter}`;
        }
        return '-';
      },
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
      render: (type) => goalTypeMap[type as keyof typeof goalTypeMap],
    },
    {
      title: '权重',
      dataIndex: 'goal_weight',
      key: 'goal_weight',
      width: 80,
      render: (weight) => `${weight}%`,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      render: (_, record) => (
        <Space>
          {(record.status === 'draft' || record.status === 'rejected') && (
            <>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => navigate(`/pbc/edit/${record.goal_id}`)}
              >
                编辑
              </Button>
              <Popconfirm
                title="确定删除吗？"
                onConfirm={() => handleDelete(record.goal_id)}
              >
                <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            </>
          )}
          {record.status === 'approved' && (
            <>
              {!evaluationInfo?.evaluation?.self_submitted_at ? (
                <>
                  <Button
                    type="link"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => navigate(`/pbc/edit/${record.goal_id}`)}
                  >
                    变更
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    icon={<StarOutlined />}
                    onClick={() => handleOpenSelfEvaluate(record)}
                  >
                    {(record as any).self_score ? '修改自评' : '自评'}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="link"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => navigate(`/pbc/edit/${record.goal_id}?mode=view`)}
                  >
                    查看
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => handleOpenSelfEvaluate(record)}
                  >
                    查看自评
                  </Button>
                </>
              )}
            </>
          )}
          {(record.status === 'submitted' || record.status === 'archived') && (
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/pbc/edit/${record.goal_id}?mode=view`)}
            >
              查看
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // 获取当前选中周期的驳回原因
  const getRejectedReason = () => {
    const rejectedGoal: any = data.find(
      (goal: any) => goal.status === 'rejected' && goal.latestApproval?.comments
    );
    return rejectedGoal?.latestApproval?.comments || '';
  };

  return (
    <div>
      <Card title="当前季度任务情况" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={4}>
            <Statistic title="目标总数" value={summary.total} />
          </Col>
          <Col span={8}>
            <div style={{ fontSize: 14, color: '#666' }}>
              <div>当前状态</div>
              <div style={{ fontSize: 16, fontWeight: 'bold', marginTop: 8 }}>
                <Tag color={statusMap[summary.status as PbcStatus]?.color || 'default'}>
                  {statusMap[summary.status as PbcStatus]?.text || '未知'}
                </Tag>
              </div>
              <div style={{ color: '#999', marginTop: 4 }}>{summary.message}</div>
            </div>
          </Col>
          {summary.status === 'rejected' && getRejectedReason() && (
            <Col span={8}>
              <div style={{ fontSize: 14, color: '#666' }}>
                <div>驳回原因</div>
                <div style={{ color: '#ff4d4f', marginTop: 8, fontSize: 14 }}>
                  {getRejectedReason()}
                </div>
              </div>
            </Col>
          )}
          <Col 
            span={summary.status === 'rejected' && getRejectedReason() ? 4 : 12} 
            style={{ textAlign: 'right' }}
          >
            {(summary.status === 'draft' || summary.status === 'rejected') && summary.total > 0 && (
              <Popconfirm
                title={`确定要提交当前周期的所有目标吗？（共 ${summary.total} 个）`}
                description="提交后将批量提交所有草稿和被驳回的目标给主管审核"
                onConfirm={handleSubmitAll}
                okText="确定"
                cancelText="取消"
              >
                <Button type="primary" size="large" icon={<SendOutlined />}>
                  提交审批（{summary.total}个目标）
                </Button>
              </Popconfirm>
            )}
            {summary.status === 'submitted' && (
              <Button size="large" disabled>
                等待主管审核中...
              </Button>
            )}
            {summary.status === 'approved' && (
              <>
                <Button size="large" type="primary" ghost disabled>
                  已通过审核 ✓
                </Button>
                {evaluationInfo?.evaluation?.self_submitted_at ? (
                  <>
                    <Button
                      size="large"
                      type="default"
                      icon={<StarOutlined />}
                      disabled
                      style={{ marginLeft: 8 }}
                    >
                      已提交自评 ✓
                    </Button>
                    {evaluationInfo?.evaluation?.supervisor_submitted_at && (
                      <Button
                        size="large"
                        type="primary"
                        icon={<EyeOutlined />}
                        onClick={() => {
                          if (user?.user_id && selectedPeriod) {
                            handleViewEvaluation(user.user_id, selectedPeriod);
                          }
                        }}
                        style={{ marginLeft: 8 }}
                      >
                        查看反馈
                      </Button>
                    )}
                  </>
                ) : (
                  <Button
                    size="large"
                    type="primary"
                    icon={<StarOutlined />}
                    onClick={handleOpenOverallEvaluate}
                    style={{ marginLeft: 8 }}
                  >
                    提交整体自评
                  </Button>
                )}
              </>
            )}
          </Col>
        </Row>
      </Card>

      <Card
        title="我的PBC目标"
        extra={
          <Space>
            <Select
              style={{ width: 200 }}
              placeholder="选择周期"
              value={selectedPeriod}
              onChange={setSelectedPeriod}
              allowClear
            >
              {periods.map((period) => (
                <Select.Option key={period.period_id} value={period.period_id}>
                  {period.year}年第{period.quarter}季度
                  {period.status === 'active' && ' (当前)'}
                </Select.Option>
              ))}
            </Select>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/pbc/create')}
            >
              新建目标
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={data}
          rowKey="goal_id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 单个目标自评模态框 */}
      <Modal
        title={evaluationInfo?.evaluation?.self_submitted_at ? '查看自评' : '目标自评'}
        open={selfEvaluateModalVisible}
        onOk={evaluationInfo?.evaluation?.self_submitted_at ? undefined : handleSelfEvaluate}
        onCancel={() => {
          setSelfEvaluateModalVisible(false);
          selfEvaluateForm.resetFields();
        }}
        footer={
          evaluationInfo?.evaluation?.self_submitted_at
            ? [
                <Button
                  key="close"
                  onClick={() => {
                    setSelfEvaluateModalVisible(false);
                    selfEvaluateForm.resetFields();
                  }}
                >
                  关闭
                </Button>,
              ]
            : undefined
        }
        okText="提交"
        cancelText="取消"
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <strong>目标名称：</strong>{currentGoal?.goal_name}
        </div>
        <div style={{ marginBottom: 16 }}>
          <strong>目标描述：</strong>{currentGoal?.goal_description}
        </div>
        {evaluationInfo?.evaluation?.self_submitted_at && (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              background: '#fffbe6',
              border: '1px solid #ffe58f',
              borderRadius: 4,
            }}
          >
            <strong>提示：</strong>已提交整体自评，不允许修改
          </div>
        )}
        <Form form={selfEvaluateForm} layout="vertical">
          <Form.Item
            name="score"
            label="自评分数"
            rules={[
              { required: true, message: '请输入自评分数' },
              { type: 'number', min: 0, max: 100, message: '分数范围：0-100' },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="请输入0-100的分数"
              min={0}
              max={100}
              disabled={!!evaluationInfo?.evaluation?.self_submitted_at}
            />
          </Form.Item>
          <Form.Item
            name="comment"
            label="自评说明"
            rules={[{ required: true, message: '请输入自评说明' }]}
          >
            <TextArea
              rows={4}
              placeholder="请描述目标完成情况、遇到的问题、收获等"
              disabled={!!evaluationInfo?.evaluation?.self_submitted_at}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 整体自评模态框 */}
      <Modal
        title="提交整体自评"
        open={overallEvaluateModalVisible}
        onOk={handleSubmitOverallEvaluate}
        onCancel={() => {
          setOverallEvaluateModalVisible(false);
          overallEvaluateForm.resetFields();
        }}
        okText="提交"
        cancelText="取消"
        width={700}
      >
        <div style={{ marginBottom: 16, color: '#666' }}>
          请对本季度的整体工作表现进行总结和评价
        </div>
        <Form form={overallEvaluateForm} layout="vertical">
          <Form.Item
            name="overallComment"
            label="整体自评（至少100字）"
            rules={[
              { required: true, message: '请输入整体自评' },
              { min: 100, message: '整体自评至少需要100字' },
            ]}
          >
            <TextArea
              rows={8}
              placeholder="请总结本季度的工作完成情况、亮点、不足、改进方向等（至少100字）"
              showCount
              maxLength={1000}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 查看反馈模态框 */}
      <Modal
        title="查看自评与主管反馈"
        open={viewFeedbackModalVisible}
        onCancel={() => {
          setViewFeedbackModalVisible(false);
          setFeedbackData(null);
        }}
        footer={[
          <Button key="close" onClick={() => setViewFeedbackModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={1100}
      >
        {feedbackData && (
          <div>
            {/* 整体自评 */}
            {feedbackData.evaluation?.self_submitted_at && (
              <Card title="整体自评" size="small" style={{ marginBottom: 16 }}>
                <Descriptions column={1}>
                  <Descriptions.Item label="提交时间">
                    {new Date(feedbackData.evaluation.self_submitted_at).toLocaleString(
                      'zh-CN'
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="整体评价">
                    {feedbackData.evaluation.self_overall_comment}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            )}

            {/* 整体主管评价 */}
            {feedbackData.evaluation?.supervisor_submitted_at && (
              <Card title="整体主管评价" size="small" style={{ marginBottom: 16 }}>
                <Descriptions column={1}>
                  <Descriptions.Item label="提交时间">
                    {new Date(
                      feedbackData.evaluation.supervisor_submitted_at
                    ).toLocaleString('zh-CN')}
                  </Descriptions.Item>
                  <Descriptions.Item label="整体评价">
                    {feedbackData.evaluation.supervisor_overall_comment}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            )}

            {/* 各目标详细评价 */}
            <Card title="各目标评价详情" size="small">
              <Table
                dataSource={feedbackData.goals}
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
                ]}
              />
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PBCList;
