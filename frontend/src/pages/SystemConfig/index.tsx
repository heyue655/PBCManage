import React, { useState, useEffect } from 'react';
import { Card, Form, InputNumber, Button, message, Descriptions } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { systemConfigApi } from '../../api';

const SystemConfig: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [functionalWeight, setFunctionalWeight] = useState(30);
  const [businessWeight, setBusinessWeight] = useState(70);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const config = await systemConfigApi.getAll();
      setFunctionalWeight(parseInt(config['evaluation_weight_functional'] || '30', 10));
      setBusinessWeight(parseInt(config['evaluation_weight_business'] || '70', 10));
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async () => {
    if (functionalWeight + businessWeight !== 100) {
      message.error('职能主管权重和业务主管权重之和必须等于100%');
      return;
    }
    setSaving(true);
    try {
      await systemConfigApi.update('evaluation_weight_functional', String(functionalWeight));
      await systemConfigApi.update('evaluation_weight_business', String(businessWeight));
      message.success('配置已保存');
    } catch {
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title={<><SettingOutlined /> 系统配置</>}>
      <Descriptions column={1} bordered size="middle">
        <Descriptions.Item label="考核权重配置">
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <div>
              <div style={{ marginBottom: 4, fontWeight: 500 }}>职能主管权重 (%)</div>
              <InputNumber
                min={0}
                max={100}
                value={functionalWeight}
                onChange={(val) => setFunctionalWeight(val || 0)}
                style={{ width: 120 }}
              />
            </div>
            <div>
              <div style={{ marginBottom: 4, fontWeight: 500 }}>业务主管权重 (%)</div>
              <InputNumber
                min={0}
                max={100}
                value={businessWeight}
                onChange={(val) => setBusinessWeight(val || 0)}
                style={{ width: 120 }}
              />
            </div>
            <div style={{ paddingTop: 22 }}>
              <span style={{
                color: functionalWeight + businessWeight === 100 ? '#52c41a' : '#ff4d4f',
                fontWeight: 700,
              }}>
                合计: {functionalWeight + businessWeight}%
              </span>
            </div>
          </div>
        </Descriptions.Item>
      </Descriptions>
      <div style={{ marginTop: 24 }}>
        <Button type="primary" loading={saving} onClick={handleSave}>
          保存配置
        </Button>
      </div>
    </Card>
  );
};

export default SystemConfig;
