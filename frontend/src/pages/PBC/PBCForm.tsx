import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Form, Input, Select, InputNumber, Button, Card, Space, Divider, DatePicker, Row, Col, message, Alert, Tag, Typography } from 'antd';
import { PlusOutlined, MinusCircleOutlined, LinkOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { pbcApi, PbcGoal, PbcPeriod, GoalType, PbcStatus } from '../../api';
import { useAuthStore } from '../../store/authStore';

const { Text, Paragraph } = Typography;

const { TextArea } = Input;
const getDefaultGoalNature = (goalType: GoalType) =>
  goalType === 'business' ? 'quantitative' : 'qualitative';

const PBCForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const viewMode = searchParams.get('mode') === 'view';
  const { user } = useAuthStore();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [periods, setPeriods] = useState<PbcPeriod[]>([]);
  const [supervisorGoals, setSupervisorGoals] = useState<PbcGoal[]>([]);
  const [goalType, setGoalType] = useState<GoalType>('business');
  const [isReadonly, setIsReadonly] = useState(false);
  const [currentPeriodId, setCurrentPeriodId] = useState<number | undefined>();
  const [originalStatus, setOriginalStatus] = useState<string | undefined>();
  const [selectedSupervisorGoal, setSelectedSupervisorGoal] = useState<PbcGoal | undefined>();

  const fetchPeriods = async () => {
    try {
      const data = await pbcApi.getPeriods();
      setPeriods(data);
      if (!id && data.length > 0) {
        const activePeriod = data.find((p) => p.status === 'active');
        if (activePeriod) {
          form.setFieldValue('period_id', activePeriod.period_id);
          setCurrentPeriodId(activePeriod.period_id);
        }
      }
    } catch {
      // 错误已处理
    }
  };

  const fetchSupervisorGoals = async (periodId?: number) => {
    try {
      const data = await pbcApi.getSupervisorGoals(periodId);
      setSupervisorGoals(data);
    } catch {
      // 错误已处理
    }
  };

  const fetchGoal = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await pbcApi.getOne(parseInt(id));
      form.setFieldsValue({
        ...data,
        goal_nature: data.goal_nature || getDefaultGoalNature(data.goal_type),
        completion_time: data.completion_time ? dayjs(data.completion_time) : undefined,
      });
      setGoalType(data.goal_type);
      setCurrentPeriodId(data.period_id);
      setOriginalStatus(data.status);
      if (data.supervisor_goal_id) {
        // 回显时设置选中的上级目标（等上级目标加载后再匹配）
        setSelectedSupervisorGoal(data.supervisorGoal);
      }
      // 如果是查看模式，直接设置为只读
      if (viewMode) {
        setIsReadonly(true);
      } else {
        // 允许draft、rejected、approved状态编辑
        setIsReadonly(
          data.status !== 'draft' && 
          data.status !== 'rejected' && 
          data.status !== 'approved'
        );
      }
    } catch {
      // 错误已处理
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeriods();
    if (id) {
      fetchGoal();
    }
  }, [id]);

  // 监听周期变化，重新获取上级目标
  useEffect(() => {
    if (currentPeriodId) {
      fetchSupervisorGoals(currentPeriodId);
    }
  }, [currentPeriodId]);

  // supervisorGoals 加载后，同步 selectedSupervisorGoal（如编辑模式切换周期）
  useEffect(() => {
    const currentSupervisorGoalId = form.getFieldValue('supervisor_goal_id');
    if (currentSupervisorGoalId && supervisorGoals.length > 0) {
      const found = supervisorGoals.find(g => g.goal_id === currentSupervisorGoalId);
      if (found) setSelectedSupervisorGoal(found);
    }
  }, [supervisorGoals]);

  // 处理表单值变化
  const handleValuesChange = (changedValues: any) => {
    if (changedValues.period_id !== undefined) {
      setCurrentPeriodId(changedValues.period_id);
    }
    if (changedValues.goal_type !== undefined) {
      setGoalType(changedValues.goal_type);
      form.setFieldValue('goal_nature', getDefaultGoalNature(changedValues.goal_type));
      // 切换目标类型时清空上级目标选择
      if (changedValues.goal_type !== 'business') {
        form.setFieldValue('supervisor_goal_id', undefined);
        setSelectedSupervisorGoal(undefined);
      }
    }
    if (changedValues.supervisor_goal_id !== undefined) {
      const found = supervisorGoals.find(g => g.goal_id === changedValues.supervisor_goal_id);
      setSelectedSupervisorGoal(found);
    }
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const submitData = {
        ...values,
        completion_time: values.completion_time?.format('YYYY-MM-DD'),
        // 确保数字字段为number类型
        goal_weight: Number(values.goal_weight),
        period_id: values.period_id ? Number(values.period_id) : undefined,
        supervisor_goal_id: values.supervisor_goal_id ? Number(values.supervisor_goal_id) : undefined,
      };

      if (id) {
        await pbcApi.update(parseInt(id), submitData);
        if (originalStatus === 'approved') {
          message.success('变更成功！目标已重置为草稿状态，请重新提交审核');
        } else {
          message.success('更新成功');
        }
      } else {
        await pbcApi.create(submitData);
        message.success('创建成功');
      }
      navigate('/pbc');
    } catch {
      // 错误已处理
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card 
      title={
        id 
          ? (viewMode || isReadonly 
              ? '查看PBC目标' 
              : (originalStatus === 'approved' ? '变更PBC目标' : '编辑PBC目标')
            )
          : '新建PBC目标'
      }
    >
      {id && originalStatus === 'approved' && !viewMode && !isReadonly && (
        <Alert
          message="重要提示"
          description="您正在变更已通过审核的目标。变更后，目标状态将重置为草稿，需要重新提交审核。已有的自评和主管评价将被清空。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      <Form
        form={form}
        layout="horizontal"
        onFinish={onFinish}
        onValuesChange={handleValuesChange}
        initialValues={{ goal_type: 'business', goal_nature: 'quantitative', goal_weight: 0 }}
        disabled={isReadonly}
      >
        {/* 第一行：考核周期、目标类型 */}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="period_id"
              label="考核周期"
              labelCol={{ span: 5 }}
              wrapperCol={{ span: 19 }}
              rules={[{ required: true, message: '请选择考核周期' }]}
            >
              <Select placeholder="请选择考核周期">
                {periods.map((period) => (
                  <Select.Option key={period.period_id} value={period.period_id}>
                    {period.year}年第{period.quarter}季度
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="goal_type"
              label="目标类型"
              labelCol={{ span: 5 }}
              wrapperCol={{ span: 19 }}
              rules={[{ required: true, message: '请选择目标类型' }]}
            >
              <Select placeholder="请选择目标类型">
                <Select.Option value="business">业务目标</Select.Option>
                <Select.Option value="skill">个人能力提升</Select.Option>
                {user?.role !== 'employee' && (
                  <Select.Option value="team">组织与人员管理&团队建设</Select.Option>
                )}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        {/* 第二行：目标名称、权重 */}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="goal_name"
              label="目标名称"
              labelCol={{ span: 5 }}
              wrapperCol={{ span: 19 }}
              rules={[{ required: true, message: '请输入目标名称' }]}
            >
              <Input placeholder="请输入目标名称" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="goal_weight"
              label="权重"
              labelCol={{ span: 5 }}
              wrapperCol={{ span: 19 }}
              rules={[{ required: true, message: '请输入目标权重' }]}
            >
              <InputNumber 
                min={0} 
                max={100} 
                precision={2} 
                style={{ width: '100%' }}
                addonAfter="%" 
              />
            </Form.Item>
          </Col>
        </Row>

        {/* 第三行：性质、关联上级业务目标（仅业务目标且非总经理） */}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="goal_nature"
              label="性质"
              labelCol={{ span: 5 }}
              wrapperCol={{ span: 19 }}
              rules={[{ required: true, message: '请选择性质' }]}
            >
              <Select placeholder="请选择性质">
                <Select.Option value="qualitative">定性</Select.Option>
                <Select.Option value="quantitative">定量</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          {goalType === 'business' && user?.role !== 'gm' && (
            <Col span={12}>
              <Form.Item
                name="supervisor_goal_id"
                label="关联上级目标"
                labelCol={{ span: 5 }}
                wrapperCol={{ span: 19 }}
                extra={supervisorGoals.length === 0 ? <Text type="secondary" style={{ fontSize: 12 }}>当前周期上级暂无业务目标</Text> : undefined}
              >
                <Select 
                  placeholder={supervisorGoals.length > 0 ? "可关联上级当季业务目标（可选）" : "暂无可关联目标"} 
                  allowClear
                  disabled={supervisorGoals.length === 0}
                  optionLabelProp="label"
                >
                  {supervisorGoals.map((goal) => (
                    <Select.Option key={goal.goal_id} value={goal.goal_id} label={goal.goal_name}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500 }}>{goal.goal_name}</div>
                          {goal.goal_description && (
                            <div style={{ fontSize: 12, color: '#888', whiteSpace: 'normal', lineHeight: '1.4' }}>
                              {goal.goal_description.length > 60 ? goal.goal_description.slice(0, 60) + '…' : goal.goal_description}
                            </div>
                          )}
                        </div>
                        <Tag
                          color={goal.status === 'approved' ? 'success' : goal.status === 'submitted' ? 'processing' : goal.status === 'rejected' ? 'error' : 'default'}
                          style={{ marginTop: 2, flexShrink: 0 }}
                        >
                          {({ draft: '草稿', submitted: '待审核', approved: '已通过', rejected: '已驳回', archived: '已归档' } as Record<PbcStatus, string>)[goal.status] || goal.status}
                        </Tag>
                      </div>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          )}
        </Row>

        {/* 选中上级目标后展示详情 */}
        {goalType === 'business' && user?.role !== 'gm' && selectedSupervisorGoal && (
          <Card
            size="small"
            style={{ marginBottom: 16, background: '#f6ffed', border: '1px solid #b7eb8f' }}
            title={
              <Space>
                <LinkOutlined style={{ color: '#52c41a' }} />
                <Text style={{ fontSize: 13 }}>已关联上级目标</Text>
              </Space>
            }
          >
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <div>
                <Text strong>{selectedSupervisorGoal.goal_name}</Text>
                <Tag color="green" style={{ marginLeft: 8 }}>权重 {selectedSupervisorGoal.goal_weight}%</Tag>
                <Tag color="blue" style={{ marginLeft: 4 }}>{selectedSupervisorGoal.goal_nature === 'quantitative' ? '定量' : '定性'}</Tag>
              </div>
              {selectedSupervisorGoal.goal_description && (
                <Paragraph style={{ margin: 0, fontSize: 13, color: '#555', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {selectedSupervisorGoal.goal_description}
                </Paragraph>
              )}
            </Space>
          </Card>
        )}

        {/* 第三行：目标描述 */}
        <Form.Item
          name="goal_description"
          label="目标描述"
          labelCol={{ span: 2 }}
          wrapperCol={{ span: 22 }}
          rules={[{ required: true, message: '请输入目标描述' }]}
        >
          <TextArea rows={4} placeholder="请详细描述目标内容" />
        </Form.Item>

        {/* 实现举措 */}
        {goalType !== 'skill' && (
          <Form.Item 
            name="measures" 
            label="实现举措"
            labelCol={{ span: 2 }}
            wrapperCol={{ span: 22 }}
          >
            <TextArea rows={3} placeholder="请描述实现目标的具体行动和措施" />
          </Form.Item>
        )}

        {/* 预计完成时间 */}
        {goalType === 'skill' && (
          <Form.Item
            name="completion_time"
            label="完成时间"
            labelCol={{ span: 2 }}
            wrapperCol={{ span: 22 }}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        )}

        {/* 评价标准 */}
        {goalType === 'business' && (
          <>
            <Divider>评价标准</Divider>

            <Form.Item 
              name="unacceptable" 
              label="不可接受"
              labelCol={{ span: 2 }}
              wrapperCol={{ span: 22 }}
            >
              <TextArea rows={2} placeholder="描述什么情况下是不可接受的" />
            </Form.Item>

            <Form.Item 
              name="acceptable" 
              label="达标标准"
              labelCol={{ span: 2 }}
              wrapperCol={{ span: 22 }}
            >
              <TextArea rows={2} placeholder="描述达到最低要求的情况" />
            </Form.Item>

            <Form.Item 
              name="excellent" 
              label="卓越标准"
              labelCol={{ span: 2 }}
              wrapperCol={{ span: 22 }}
            >
              <TextArea rows={2} placeholder="描述超越预期的情况" />
            </Form.Item>
          </>
        )}

        <Form.Item 
          wrapperCol={{ span: 22, offset: 2 }}
        >
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              {id ? '保存' : '创建'}
            </Button>
            <Button onClick={() => navigate('/pbc')}>返回</Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default PBCForm;
