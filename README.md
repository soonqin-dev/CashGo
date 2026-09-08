# CashGo

CashGo 是一个 mobile-first 的私人记账网页工具，可直接部署到 Vercel。

## 已有功能

- 收入 / 支出快速记录
- 分类与账户选择
- 本月收入、支出、结余
- 本月预算
- “今日建议可花”自动计算
- 记录搜索
- 支出分类统计
- 删除记录
- Local Storage 本机持久化
- 手机优先 UI

## 本机运行

```bash
npm install
npm run dev
```

打开：

```text
http://localhost:3000
```

## 部署到 GitHub + Vercel

1. 在 GitHub 新建 Repository，例如 `cashgo`
2. 将本项目所有文件上传到该 Repository
3. 登录 Vercel
4. 选择 `Add New > Project`
5. Import 你的 `cashgo` GitHub Repository
6. Framework 会自动识别为 Next.js
7. 点击 Deploy

## 数据说明

当前 MVP 使用浏览器 Local Storage，因此：
- 刷新网页不会丢数据
- 同一台手机再次打开仍有数据
- 换手机 / 清浏览器数据后不会自动同步

下一阶段建议接入 Supabase：
- 用户登录
- 云端同步
- 多设备同步
- 自定义账户与分类
- Recurring Transactions
- CSV 导出 / 导入
- PWA 安装到手机主画面
