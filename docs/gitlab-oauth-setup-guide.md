# GitLab OAuth 配置指南

> 适用对象：平台管理员
> 预计时间：10-15 分钟
> 配置频率：**只需配置一次**，所有用户共享

---

## 一、重要概念澄清

### Q1: 每个用户都需要配置吗？
**不需要**。OAuth Application 是平台级别的配置，只需管理员配置一次，所有用户共享。

### Q2: Client ID/Secret 是 GitLab 账号密码吗？
**不是**。它们是 OAuth 应用的凭证（类似"应用身份证"），不是用户的登录账号。

### Q3: 可以用 CAS 账号直接登录 GitLab 吗？
**不能**。CAS 和 GitLab OAuth 是独立的认证系统：
- **CAS**：知识中心的身份认证
- **GitLab OAuth**：GitLab 的授权机制

用户需要通过 GitLab 自己的授权流程才能获得仓库访问权限。

---

## 二、配置流程概览

```
┌─────────────────────────────────────────────────────┐
│  步骤 1：管理员配置 OAuth 应用（一次性）             │
│  - 在 GitLab 创建 OAuth Application                 │
│  - 获取 Client ID 和 Secret                         │
│  - 配置到知识中心                                    │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│  步骤 2：用户使用自己的 GitLab 账号授权              │
│  - 点击"连接 GitLab 账号"                           │
│  - 在 GitLab 授权页面登录/确认                      │
│  - 系统自动获得 Access Token                        │
└─────────────────────────────────────────────────────┘
```

---

## 三、详细配置步骤

### 步骤 1：在 GitLab 创建 OAuth Application

1. **登录 GitLab**
   - 访问：https://git-tools.yasdb.com
   - 使用你的 GitLab 账号登录

2. **进入应用设置**
   - 点击右上角头像
   - 选择 **Preferences**（偏好设置）
   - 左侧菜单选择 **Applications**（应用）

3. **创建新应用**
   点击 **New application**，填写：

   | 字段 | 值 | 说明 |
   |------|-----|------|
   | **Name** | `知识中心管理平台` | 应用名称，可自定义 |
   | **Redirect URI** | `http://192.168.130.180:13510/knowledge-center/api/gitlab/oauth/callback` | 必须完全一致 |
   | **Scopes** | 勾选 `read_api` 和 `read_repository` | 只读权限，最小化原则 |

   **重要**：
   - Redirect URI 必须与知识中心配置的完全一致（包括协议、域名、端口、路径）
   - 开发环境可以使用 HTTP，生产环境必须使用 HTTPS

4. **保存并记录凭证**
   点击 **Save application** 后，GitLab 会显示：
   - **Application ID**（客户端 ID）
   - **Secret**（客户端密钥）

   **️ 请立即复制保存 Secret，它只会显示一次！**

   ```
   Application ID: abc123def456...
   Secret: xyz789uvw012...  ← 复制后立即保存！
   ```

---

### 步骤 2：配置知识中心

#### 方法 A：使用交互式脚本（推荐）

```bash
cd /data/docs/AI高效应用示例/06-YashanDB知识库Skill仓库
./scripts/setup-gitlab-oauth.sh
```

脚本会引导你输入：
- Application ID
- Secret
- Redirect URI（可直接回车使用默认值）

#### 方法 B：手动编辑 .env 文件

1. 复制配置模板：
   ```bash
   cp agent-runner/.env.example agent-runner/.env
   ```

2. 编辑 `agent-runner/.env`，添加以下内容：
   ```bash
   # GitLab OAuth 配置
   KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_ID=你的_Application_ID
   KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_SECRET=你的_Secret
   KNOWLEDGE_CENTER_GITLAB_OAUTH_REDIRECT_URI=http://192.168.130.180:13510/knowledge-center/api/gitlab/oauth/callback
   KNOWLEDGE_CENTER_GITLAB_OAUTH_SCOPES=read_api read_repository
   KNOWLEDGE_CENTER_GITLAB_OAUTH_DEV_HTTP=true
   ```

   **替换说明**：
   - `你的_Application_ID` → 步骤 1 中获得的 Application ID
   - `你的_Secret` → 步骤 1 中获得的 Secret

---

### 步骤 3：重启服务

```bash
cd /data/docs/AI高效应用示例/06-YashanDB知识库Skill仓库
./agent-runner/restart-knowledge-center-isolated.sh
```

---

### 步骤 4：验证配置

#### 4.1 检查配置状态

```bash
./scripts/check-oauth-config.sh
```

期望输出：
```
✅ Client ID:     abc123de...
✅ Client Secret: xyz789uv...
✅ Redirect URI:  http://192.168.130.180:13510/...
✅ OAuth 配置完整
```

#### 4.2 测试 OAuth 流程

1. 访问：http://192.168.130.180:13510/knowledge-center/platform
2. 点击"连接 GitLab 账号"按钮
3. 应跳转到 GitLab 授权页面
4. 使用你的 GitLab 账号登录并授权
5. 授权成功后自动跳回知识中心，显示"已连接"

---

## 四、用户使用流程

配置完成后，用户使用流程如下：

```
1. 用户登录知识中心（通过 CAS）
   ↓
2. 访问"平台管理"页面
   ↓
3. 看到 GitLab 连接状态
   - 未连接：显示"连接 GitLab 账号"按钮
   - 已连接：显示"已连接"状态
   ↓
4. 点击"连接 GitLab 账号"
   ↓
5. 跳转到 GitLab 授权页面
   - 如果已登录 GitLab：直接显示授权确认
   - 如果未登录：需要输入 GitLab 账号密码
   ↓
6. 点击"Authorize"授权
   ↓
7. 自动跳回知识中心
   ↓
8. 系统获得该用户的 Access Token
   - Token 保存在服务器内存中
   - 用户看不到 Token
   - 进程重启后需要重新授权
```

---

## 五、常见问题

### Q1: Redirect URI mismatch
**原因**：GitLab 中配置的回调地址与知识中心不一致
**解决**：确保两端完全一致，包括协议、域名、端口和路径

### Q2: invalid_grant
**原因**：授权码已过期或已使用
**解决**：重新点击"连接 GitLab 账号"按钮

### Q3: 生产环境必须使用 HTTPS
**原因**：GitLab OAuth 正式环境要求 HTTPS
**解决**：
- 配置反向代理（Nginx/Caddy）启用 HTTPS
- 或设置 `KNOWLEDGE_CENTER_GITLAB_OAUTH_DEV_HTTP=true`（仅开发环境）

### Q4: 忘记 Secret
**解决**：在 GitLab 应用设置页面重新生成 Secret

### Q5: 每个用户都需要配置吗？
**不需要**。OAuth Application 只需配置一次，所有用户共享。用户只需要点击"连接 GitLab 账号"按钮，使用自己的 GitLab 账号授权即可。

### Q6: 可以用 CAS 账号直接登录 GitLab 吗？
**不能**。CAS 和 GitLab OAuth 是独立的认证系统。用户需要通过 GitLab 自己的授权流程才能获得仓库访问权限。

### Q7: Token 会过期吗？
**会**。Access Token 有有效期（通常 2 小时）。当前实现中，Token 过期后需要用户重新授权。未来可以支持 Refresh Token 自动续期。

---

## 六、安全建议

1. **生产环境**：
   - 必须使用 HTTPS
   - 不要将 `.env` 文件提交到版本控制
   - 定期轮换 Client Secret

2. **权限最小化**：
   - 只申请必要的 scopes（`read_api`、`read_repository`）
   - 不要申请 `write_repository` 等写权限

3. **监控**：
   - 定期检查 OAuth Token 使用情况
   - 发现异常及时撤销授权

4. **Token 存储**：
   - 当前 Token 保存在进程内存中
   - 进程重启后需要重新授权
   - 生产环境应接入加密持久化存储

---

## 七、配置检查清单

- [ ] 已在 GitLab 创建 OAuth Application
- [ ] 已记录 Application ID 和 Secret
- [ ] 已配置 `KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_ID`
- [ ] 已配置 `KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_SECRET`
- [ ] 已配置 `KNOWLEDGE_CENTER_GITLAB_OAUTH_REDIRECT_URI`
- [ ] 已设置 `KNOWLEDGE_CENTER_GITLAB_OAUTH_DEV_HTTP=true`（开发环境）
- [ ] 已重启服务
- [ ] 已测试 OAuth 授权流程
- [ ] 已验证仓库内容可访问
