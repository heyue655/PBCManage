# 数据库表结构设计文档

## 1. 用户表（users）

用于存储系统中所有用户的信息，包括员工、主管、总经理等。

### 字段设计
| 字段名        | 类型        | 描述               | 约束     |
| ------------- | ----------- | ------------------ | -------- |
| user_id       | INT         | 用户ID             | 主键，自增 |
| username      | VARCHAR(255) | 用户名（登录账号） | 唯一，非空 |
| password_hash | VARCHAR(255) | 密码哈希值         | 非空     |
| real_name     | VARCHAR(255) | 真实姓名           | 非空     |
| job_title     | VARCHAR(255) | 职位               | 非空     |
| department_id | INT         | 所属部门ID         | 外键，指向departments表，可空 |
| supervisor_id | INT         | 直属主管ID         | 外键，指向users表，可空 |
| role          | ENUM        | 用户角色（employee/assistant/manager/gm）| 非空，默认employee |
| created_at    | DATETIME    | 创建时间           | 默认当前时间 |
| updated_at    | DATETIME    | 更新时间           | 默认当前时间 |

## 2. 部门表（departments）

用于存储部门信息，支持层级结构。

### 字段设计
| 字段名        | 类型        | 描述               | 约束     |
| ------------- | ----------- | ------------------ | -------- |
| department_id | INT         | 部门ID             | 主键，自增 |
| department_name | VARCHAR(255) | 部门名称          | 非空     |
| parent_id     | INT         | 上级部门ID         | 外键，指向departments表，可空 |
| created_at    | DATETIME    | 创建时间           | 默认当前时间 |
| updated_at    | DATETIME    | 更新时间           | 默认当前时间 |

## 3. 考核周期表（pbc_periods）

用于管理PBC考核周期（按年度和季度）。

### 字段设计
| 字段名        | 类型        | 描述               | 约束     |
| ------------- | ----------- | ------------------ | -------- |
| period_id     | INT         | 周期ID             | 主键，自增 |
| year          | INT         | 年份               | 非空     |
| quarter       | INT         | 季度（1-4）        | 非空     |
| start_date    | DATE        | 开始日期           | 非空     |
| end_date      | DATE        | 结束日期           | 非空     |
| status        | ENUM        | 状态（active/closed）| 非空，默认active |
| created_at    | DATETIME    | 创建时间           | 默认当前时间 |
| updated_at    | DATETIME    | 更新时间           | 默认当前时间 |

**唯一约束**：(year, quarter) 组合唯一

## 4. 绩效目标表（pbc_goals）

用于存储员工的PBC（个人业务承诺）目标。

**重要说明**：
- `parent_goal_id`：用于标识子目标与主目标的关系
- `supervisor_goal_id`：用于关联上级主管的业务目标（可选，总经理不显示此字段）
- `period_id`：关联考核周期，用于季度管理
- 批量审批：同一周期内员工的所有目标会一起审批，状态应保持一致
- 自评和主管评价：目标审批通过后，员工可以进行自评，主管可以进行评价

### 字段设计
| 字段名            | 类型        | 描述                                 | 约束     |
| ----------------- | ----------- | ------------------------------------ | -------- |
| goal_id           | INT         | 目标ID                               | 主键，自增 |
| user_id           | INT         | 员工ID                               | 外键，指向users表，非空 |
| period_id         | INT         | 考核周期ID                           | 外键，指向pbc_periods表，可空 |
| goal_type         | ENUM        | 目标类型（business/skill/team）      | 非空     |
| goal_name         | VARCHAR(255) | 目标名称                             | 非空     |
| goal_description  | TEXT        | 目标描述                             | 非空     |
| goal_weight       | DECIMAL(5,2) | 目标权重（占比）                     | 非空     |
| parent_goal_id    | INT         | 父目标ID（如果是子目标）             | 外键，指向pbc_goals表，可空 |
| supervisor_goal_id | INT        | 关联上级主管的业务目标ID             | 外键，指向pbc_goals表，可空 |
| measures          | TEXT        | 实施举措                             | 可空     |
| unacceptable      | TEXT        | 不可接受标准（仅业务目标需要）       | 可空     |
| acceptable        | TEXT        | 达标标准（仅业务目标需要）           | 可空     |
| excellent         | TEXT        | 卓越标准（仅业务目标需要）           | 可空     |
| completion_time   | DATE        | 预计完成时间                         | 可空     |
| status            | ENUM        | 目标状态（draft/submitted/approved/rejected/archived） | 非空，默认draft |
| self_score        | DECIMAL(5,2) | 自评分数（0-100）                   | 可空     |
| self_comment      | TEXT        | 自评说明                             | 可空     |
| supervisor_score  | DECIMAL(5,2) | 主管评分（0-100）                   | 可空     |
| supervisor_comment | TEXT       | 主管评价                             | 可空     |
| created_at        | DATETIME    | 创建时间                             | 默认当前时间 |
| updated_at        | DATETIME    | 更新时间                             | 默认当前时间 |

**状态说明**：
- `draft`：草稿状态，可以编辑和删除
- `submitted`：已提交审核，等待主管审批，不可修改
- `approved`：已通过审核，可以进行自评和变更（变更后重置为draft）
- `rejected`：被驳回，需要修改后重新提交
- `archived`：已归档，不可修改

**索引**：
- user_id
- period_id
- status

## 5. 审批记录表（pbc_approvals）

用于记录PBC目标的审批历史。

### 字段设计
| 字段名        | 类型        | 描述               | 约束     |
| ------------- | ----------- | ------------------ | -------- |
| approval_id   | INT         | 审批记录ID         | 主键，自增 |
| goal_id       | INT         | 目标ID             | 外键，指向pbc_goals表，非空 |
| reviewer_id   | INT         | 审批人ID           | 外键，指向users表，非空 |
| action        | ENUM        | 操作类型（submit/approve/reject）| 非空 |
| comments      | TEXT        | 审批意见（驳回时必填）| 可空     |
| created_at    | DATETIME    | 操作时间           | 默认当前时间 |

**索引**：
- goal_id

## 6. 整体评价表（pbc_evaluations）

用于存储员工的整体自评和主管的整体评价（按周期）。

### 字段设计
| 字段名                   | 类型        | 描述               | 约束     |
| ----------------------- | ----------- | ------------------ | -------- |
| evaluation_id           | INT         | 评价ID             | 主键，自增 |
| user_id                 | INT         | 员工ID             | 外键，指向users表，非空 |
| period_id               | INT         | 周期ID             | 外键，指向pbc_periods表，非空 |
| self_overall_comment    | TEXT        | 整体自评内容       | 可空     |
| self_submitted_at       | DATETIME    | 自评提交时间       | 可空     |
| supervisor_overall_comment | TEXT     | 整体主管评价       | 可空     |
| supervisor_submitted_at | DATETIME    | 主管评价提交时间   | 可空     |
| created_at              | DATETIME    | 创建时间           | 默认当前时间 |
| updated_at              | DATETIME    | 更新时间           | 默认当前时间 |

**唯一约束**：(user_id, period_id) 组合唯一

**索引**：
- user_id
- period_id

## 7. 登录日志表（login_logs）

用于记录用户的登录信息。

### 字段设计
| 字段名        | 类型        | 描述               | 约束     |
| ------------- | ----------- | ------------------ | -------- |
| log_id        | INT         | 登录日志ID         | 主键，自增 |
| user_id       | INT         | 用户ID             | 外键，指向users表，非空 |
| login_time    | DATETIME    | 登录时间           | 非空     |
| logout_time   | DATETIME    | 登出时间           | 可空     |
| ip_address    | VARCHAR(255) | 登录IP地址         | 可空     |
| created_at    | DATETIME    | 创建时间           | 默认当前时间 |

**索引**：
- user_id

---

## 8. 数据库设计注意事项

- **外键约束**：确保各表之间的关系正确，所有外键都设置了级联删除或SET NULL策略
- **时间戳**：所有表格都有`created_at`和`updated_at`字段，`updated_at`字段自动更新
- **索引**：对经常查询的字段建立索引以提高查询效率
- **数据一致性**：通过数据库约束和应用层逻辑确保数据一致性
- **级联删除策略**：
  - 删除用户时，其PBC目标、审批记录、评价记录也会被删除
  - 删除部门时，员工的department_id设置为NULL
  - 删除目标时，子目标也会被级联删除

---

## 9. 表关系说明

### 用户与部门
- 用户属于一个部门（多对一）
- 部门支持层级结构（自关联）

### 用户层级
- 用户有直属主管（自关联）
- 形成树形层级结构

### 目标与用户
- 每个目标属于一个用户（多对一）
- 用户可以有多个目标

### 目标与周期
- 目标关联一个考核周期（多对一）
- 周期可以包含多个目标

### 目标层级
- 目标支持父子关系（自关联）
- 目标可以关联上级主管的目标（自关联）

### 审批记录
- 每个审批记录关联一个目标和一个审批人
- 记录完整的审批历史

### 整体评价
- 每个员工在每个周期有唯一的整体评价记录
- 包含自评和主管评价两部分

---

此数据库结构设计文档基于实际实现的Prisma Schema，与代码保持一致。

如果有任何修改或细节调整，请随时告知！
