# GitLab Board Plus

一个增强 GitLab Board 管理功能的 Chrome 插件，提供更好的项目管理体验。

## 功能特性

### 🚀 Board 增强功能
- **全新界面布局**: 采用现代化的三层结构设计
  - 顶部 Tabs: Board 选择器从下拉框改为横向标签页
  - 左侧过滤面板: 按人员、标签、里程碑等维度快速过滤
  - 右侧内容区: 搜索栏在上，Board 列表在下
- **智能过滤系统**: 多维度过滤支持，实时统计计数
- **可折叠界面**: 左侧面板支持折叠，节省屏幕空间
- **实时统计**: 显示 Board 上的 Issues 总数、已分配数量、逾期数量
- **拖拽增强**: 改进的拖拽视觉反馈和动画效果
- **视觉提示**: 高优先级、逾期、分配给我的 Issues 的特殊视觉标识
- **响应式设计**: 适配不同屏幕尺寸，支持移动端查看

### 📊 数据管理
- **智能缓存**: 自动缓存 GitLab API 数据，减少网络请求
- **实时同步**: 支持手动刷新数据，保持信息最新
- **离线支持**: 缓存的数据支持离线查看

### 🎯 快速操作
- **项目快速访问**: 在弹窗中快速切换到不同项目的 Board
- **一键创建**: 快速创建新的 Issue
- **快速导航**: 便捷的 Board 页面导航

## 安装使用

### 1. 下载插件
```bash
git clone https://github.com/your-username/gitlab-board-plus.git
cd gitlab-board-plus
```

### 2. 安装依赖（可选）
```bash
npm install
```

### 3. 加载到 Chrome
1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目文件夹

### 4. 配置 GitLab
1. 点击插件图标打开弹窗
2. 点击设置按钮（⚙️）
3. 填写你的 GitLab URL 和 Access Token
4. 点击"测试连接"验证配置
5. 保存设置

## GitLab Access Token 配置

### 创建 Access Token
1. 登录你的 GitLab 实例
2. 进入 `User Settings` > `Access Tokens`
3. 创建新的 Personal Access Token
4. 选择以下权限：
   - `api` - 访问 API
   - `read_user` - 读取用户信息
   - `read_repository` - 读取仓库信息

### 支持的 GitLab 版本
- GitLab.com
- GitLab 自托管实例（版本 13.0+）
- GitLab CE/EE

## 项目结构

```
gitlab-board-plus/
├── manifest.json              # Chrome 插件配置
├── package.json              # 项目依赖
├── README.md                 # 项目说明
├── 
├── src/
│   ├── background.js         # 后台脚本（API 调用）
│   ├── content.js           # 内容脚本（页面增强）
│   ├── popup/
│   │   ├── popup.html       # 弹窗页面
│   │   ├── popup.js         # 弹窗逻辑
│   │   └── popup.css        # 弹窗样式
│   └── styles/
│       └── content.css      # 页面注入样式
└── icons/                   # 插件图标
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

## 开发指南

### 本地开发
1. 修改代码后，在 `chrome://extensions/` 页面点击刷新按钮
2. 重新加载 GitLab 页面查看效果

### 构建发布
```bash
npm run package
```
这将创建一个 `gitlab-board-plus.zip` 文件，可以上传到 Chrome Web Store。

### API 使用
插件使用 GitLab REST API v4，主要端点包括：
- `/projects` - 获取项目列表
- `/projects/:id/boards` - 获取项目 Board
- `/projects/:id/boards/:board_id/lists` - 获取 Board 列表
- `/projects/:id/issues` - 获取 Issues
- `/projects/:id/issues/:issue_iid` - 更新 Issue

## 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发环境设置
1. Fork 本仓库
2. 创建功能分支
3. 提交更改
4. 创建 Pull Request

### 代码规范
- 使用 ES6+ 语法
- 遵循 JavaScript Standard Style
- 添加适当的注释
- 保持代码简洁易读

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 更新日志

### v1.0.0
- 初始版本发布
- 基础 Board 增强功能
- GitLab API 集成
- 弹窗界面和设置

## 支持

如果你遇到问题或有功能建议，请：
1. 查看 [Issues](https://github.com/your-username/gitlab-board-plus/issues)
2. 创建新的 Issue
3. 提供详细的问题描述和环境信息

## 致谢

感谢 GitLab 团队提供优秀的 API 和平台。 