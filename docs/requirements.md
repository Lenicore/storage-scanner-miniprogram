# Scan Archive System（扫码归档系统）

## 项目目标
开发一个基于微信小程序的团队工具，用于：
- 扫描条形码 / 二维码
- 自动生成标准二维码/条形码图片
- 按分类 + 批次进行归档存储
- 支持标记、归档、撤回
- 提供管理员数据查看与管理能力

---

## 用户角色

### 普通用户（User）
- 扫码
- 创建/选择分类
- 查看自己的记录
- 标记/归档数据
- 撤回操作（有限制）

### 管理员（Admin）
- 查看所有用户数据
- 管理分类（创建 / 删除 / 合并 / 锁定）
- 查看统计数据
- 查看操作日志

---

## 系统模块

### 认证模块
- 微信登录（wx.login）
- JWT Token

### 数据结构
```json
User {
  id: string
  openid: string
  name: string
  role: "user" | "admin"
  created_at: datetime
}
```

---

### 扫码模块
流程：
扫码 → 获取 code_value → 上传后端 → 生成二维码/条形码图片 → 存储

支持：
- 手动输入
- 连续扫码（可选）

---

### 分类系统
```json
Category {
  id: string
  name: string
  parent_id: string | null
  created_by: user_id
  is_locked: boolean
  created_at: datetime
}
```

---

### 批次系统
```json
Batch {
  id: string
  category_id: string
  created_by: user_id
  created_at: datetime
}
```

---

### 扫码记录
```json
ScanRecord {
  id: string
  code_value: string
  code_type: "QR" | "BAR"
  image_url: string
  category_id: string
  batch_id: string
  user_id: string
  status: "pending" | "marked" | "archived"
  created_at: datetime
  updated_at: datetime
}
```

---

### 状态流
pending → marked → archived  
（支持撤回）

---

### 操作日志
```json
OperationLog {
  id: string
  user_id: string
  action: string
  target_id: string
  target_type: string
  created_at: datetime
}
```

---

## 核心功能

### 用户端
- 微信登录
- 扫码
- 分类管理
- 标记 / 归档 / 撤回
- 批量操作

### 管理端
- 数据查看
- 分类管理
- 数据统计
- 操作日志

---

## 查询与过滤
支持：
- 分类
- 用户
- 状态
- 时间范围

---

## 导出功能
- Excel（CSV）
- 图片（ZIP）

---

## 技术架构
- 前端：微信小程序
- 后端：Node.js（NestJS）
- 数据库：MySQL
- ORM：Prisma

---

## API 示例
- POST /auth/login
- POST /scan
- GET /records
- POST /records/mark
- POST /records/archive
- POST /records/undo

---

## 页面结构
- 首页（扫码）
- 分类页
- 记录页
- 管理页

---

## MVP优先级

### 第一阶段
- 登录
- 扫码
- 分类
- 标记 / 撤回
- 管理员查看

### 第二阶段
- 搜索
- 导出
- 防重复
- 批量操作
- 数据统计

---

## Cursor 提示
使用 NestJS + Prisma + MySQL 构建完整后端系统，实现所有模块与API。
