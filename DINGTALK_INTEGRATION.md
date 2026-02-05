# 钉钉通知功能集成文档

## 📱 功能概述

系统已集成钉钉工作通知功能，在PBC审批流程的关键节点自动发送消息提醒相关人员。

## 🔔 通知触发场景

### 1. 提交审批通知（给主管）
**触发时机**：员工提交PBC目标审批时

**通知对象**：员工的直属主管

**通知内容**：
```
【PBC通知】
待审核提醒

{员工姓名} 提交了 {年份}年第{季度}季度 的PBC目标（共{数量}个），请及时审核。
```

**示例**：
```
【PBC通知】
待审核提醒

张三 提交了 2026年第1季度 的PBC目标（共3个），请及时审核。
```

### 2. 审核通过通知（给员工）
**触发时机**：主管批准员工的PBC目标时

**通知对象**：目标所属员工

**通知内容**：
```
【PBC通知】
审核通过通知

您的 {年份}年第{季度}季度 PBC目标（共{数量}个）已通过审核。
```

**示例**：
```
【PBC通知】
审核通过通知

您的 2026年第1季度 PBC目标（共3个）已通过审核。
```

### 3. 审核驳回通知（给员工）
**触发时机**：主管驳回员工的PBC目标时

**通知对象**：目标所属员工

**通知内容**：
```
【PBC通知】
审核驳回通知

您的 {年份}年第{季度}季度 PBC目标（共{数量}个）未通过审核。
驳回原因：{驳回理由}
请修改后重新提交。
```

**示例**：
```
【PBC通知】
审核驳回通知

您的 2026年第1季度 PBC目标（共3个）未通过审核。
驳回原因：目标描述不够具体，请补充可衡量的指标。
请修改后重新提交。
```

## ⚙️ 配置信息

### 钉钉应用信息
- **AppKey**: `dingcf5da3sc90itnjb9`
- **AppSecret**: `CI_IG7tpx0XLGFAYnYmh4JM-lnDLts4dLzSl-qlap30FsN73Dc15BRvg7aAL0ypx`
- **CorpId**: `ding0434d73b09f8fd4e`
- **AgentId**: `4219954506`

### 数据库字段
在 `users` 表中新增字段：
- **字段名**: `dingtalk_userid`
- **类型**: `VARCHAR(255)`
- **可空**: 是
- **说明**: 钉钉用户ID，用于发送工作通知

## 🚀 技术实现

### 1. 数据库迁移
执行迁移脚本添加钉钉userid字段：
```sql
-- database/migrations/004_add_dingtalk_userid.sql
ALTER TABLE users ADD COLUMN dingtalk_userid VARCHAR(255) NULL COMMENT '钉钉用户ID' AFTER role;
```

### 2. 后端服务架构

#### DingtalkService（钉钉服务）
**位置**: `backend/src/dingtalk/dingtalk.service.ts`

**核心方法**：
- `getAccessToken()`: 获取钉钉Access Token（自动缓存，7200秒有效期）
- `sendWorkNotification()`: 发送工作通知（基础方法）
- `sendSubmitNotification()`: 发送提交审批通知
- `sendApproveNotification()`: 发送审核通过通知
- `sendRejectNotification()`: 发送审核驳回通知

**特点**：
- ✅ Token自动缓存管理
- ✅ 提前5分钟刷新token避免过期
- ✅ 完善的错误日志记录
- ✅ 通知失败不影响主业务流程

#### 集成点

**PBC Service (`pbc.service.ts`)**
- `submitAll()` 方法：提交审批后发送通知给主管

**Reviews Service (`reviews.service.ts`)**
- `approve()` 方法：审批通过后发送通知给员工
- `reject()` 方法：驳回后发送通知给员工

### 3. 前端界面

在用户管理页面（`UserManage/index.tsx`）新增字段：
- **表单项**: 钉钉用户ID输入框
- **提示**: 用于发送钉钉工作通知，可选填
- **位置**: 直属主管选择框之后

## 📝 使用说明

### 管理员配置步骤

1. **数据库迁移**
   ```bash
   # 在MySQL中执行迁移脚本
   mysql -u root -p < database/migrations/004_add_dingtalk_userid.sql
   ```

2. **重新生成Prisma Client**
   ```bash
   cd backend
   npx prisma generate
   ```

3. **填写钉钉UserID**
   - 登录系统进入"人员管理"
   - 编辑每个用户信息
   - 在"钉钉用户ID"字段填写对应的钉钉userid
   - 保存

### 如何获取钉钉UserID

#### 方法1：通过钉钉管理后台
1. 登录钉钉管理后台
2. 进入"通讯录" -> "成员管理"
3. 点击成员查看详情，找到"用户ID"字段

#### 方法2：通过API
参考文档：https://open.dingtalk.com/document/orgapp/query-users

### 测试步骤

1. **配置测试账号**
   - 为自己的账号和主管账号填写钉钉userid

2. **测试提交通知**
   - 创建PBC目标
   - 点击"提交审批"
   - 检查主管是否收到钉钉通知

3. **测试审批通知**
   - 主管审核目标（通过/驳回）
   - 检查员工是否收到钉钉通知

## 🔍 API参考

### 钉钉开放平台文档
- **发送工作通知**: https://open.dingtalk.com/document/orgapp/asynchronous-sending-of-enterprise-session-messages
- **获取Token**: https://open.dingtalk.com/document/orgapp/obtain-orgapp-token

### 请求示例

#### 获取Access Token
```http
GET https://oapi.dingtalk.com/gettoken?appkey={appkey}&appsecret={appsecret}
```

#### 发送工作通知
```http
POST https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2?access_token={token}

{
  "agent_id": 应用AgentId,
  "userid_list": "userid1,userid2",
  "msg": {
    "msgtype": "text",
    "text": {
      "content": "通知内容"
    }
  }
}
```

## ⚠️ 注意事项

### 1. 字段可选性
- 钉钉userid字段为可选
- 如果用户未配置userid，系统会跳过通知，不影响业务流程

### 2. 通知失败处理
- 通知发送失败会记录错误日志
- 不会影响审批流程的正常执行
- 建议定期检查日志排查问题

### 3. Token管理
- Access Token有效期7200秒（2小时）
- 系统自动缓存并提前5分钟刷新
- 多实例部署时各实例独立管理token

### 4. 权限要求
钉钉应用需要以下权限：
- 发送工作通知权限
- 企业内部应用权限

### 5. 消息频率限制
钉钉对消息发送有频率限制，建议：
- 避免短时间内大量发送
- 合并批量操作的通知
- 关注钉钉返回的错误码

## 🐛 故障排查

### 问题1：收不到通知
**检查项**：
1. 用户的钉钉userid是否正确填写
2. 钉钉应用是否正常启用
3. 查看后端日志中的错误信息
4. 检查AppKey和AppSecret是否正确

### 问题2：Token获取失败
**可能原因**：
- AppKey或AppSecret配置错误
- 网络连接问题
- 钉钉服务异常

**解决方法**：
- 核对配置信息
- 检查服务器网络
- 查看钉钉开放平台服务状态

### 问题3：通知内容显示异常
**检查项**：
- 消息内容是否超长
- 特殊字符是否正确处理
- 消息格式是否符合钉钉规范

## 📊 日志说明

### 日志关键词
- `钉钉Access Token获取成功`: Token获取成功
- `准备发送钉钉通知`: 开始发送通知
- `钉钉通知发送成功`: 通知发送成功
- `钉钉通知发送失败`: 通知发送失败（有错误详情）
- `发送钉钉通知异常`: 发送过程异常
- `未配置钉钉ID，跳过发送通知`: 用户未配置userid

### 日志位置
- NestJS日志输出到控制台
- 建议配置日志文件持久化

## 🔄 后续优化建议

1. **通知模板化**
   - 支持自定义通知模板
   - 配置不同场景的通知文案

2. **通知偏好设置**
   - 允许用户关闭某些类型的通知
   - 支持通知时间设置

3. **消息中心**
   - 记录所有发送的通知
   - 支持重新发送失败的通知

4. **监控告警**
   - 监控通知发送成功率
   - 异常情况自动告警

5. **多渠道支持**
   - 除钉钉外支持企业微信、飞书等
   - 统一消息接口

## 📦 相关文件

### 新增文件
- `backend/src/dingtalk/dingtalk.service.ts` - 钉钉服务
- `backend/src/dingtalk/dingtalk.module.ts` - 钉钉模块
- `database/migrations/004_add_dingtalk_userid.sql` - 数据库迁移

### 修改文件
- `backend/prisma/schema.prisma` - Prisma Schema
- `backend/src/pbc/pbc.service.ts` - PBC服务（集成通知）
- `backend/src/pbc/pbc.module.ts` - PBC模块（导入DingtalkModule）
- `backend/src/reviews/reviews.service.ts` - 审核服务（集成通知）
- `backend/src/reviews/reviews.module.ts` - 审核模块（导入DingtalkModule）
- `frontend/src/pages/UserManage/index.tsx` - 用户管理页面（新增字段）

## 📚 参考资料

- [钉钉开放平台文档](https://open.dingtalk.com/)
- [发送工作通知API](https://open.dingtalk.com/document/orgapp/asynchronous-sending-of-enterprise-session-messages)
- [获取Access Token](https://open.dingtalk.com/document/orgapp/obtain-orgapp-token)
