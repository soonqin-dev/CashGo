# CashGo v2

Mobile-first 私人记账 PWA，支持 Supabase 云端同步。

## v2 功能

- 收入 / 支出快速记账
- 自定义账户
- 自定义收入 / 支出分类
- 项目 / 收入来源
- 固定月费 / 固定收入
- 月度预算、今日建议可花
- 分类统计、收入来源统计
- 搜索与删除记录
- PWA：可 Add to Home Screen
- Supabase Email + Password 登录与云端同步
- 浏览器 Local Storage 缓存；没有配置 Supabase 时可独立运行本机模式

## 1. 本机运行

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## 2. Supabase 设置

1. 在 Supabase 建立一个 Project。
2. 进入 `SQL Editor`。
3. 将 `supabase/schema.sql` 全部复制进去并 Run。
4. 到 Project Settings / API 复制：
   - Project URL
   - public anon key / publishable key
5. 在项目根目录建立 `.env.local`：

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_KEY
```

6. 重新运行 `npm run dev`。

配置完成后 CashGo 会显示登录页；第一次使用可以建立自己的 Email + Password 帐号。

> Supabase 默认可能要求 Email confirmation。如果你只自己使用，可以保留；也可以在 Supabase Authentication 设置中按自己的需求调整。

## 3. 固定月费逻辑

CashGo 每次载入云端资料时，会检查当前月份已经到期的固定项目。如果该固定项目本月还没有对应记录，会自动生成一次，不会重复生成。

因此不需要额外 cron / server job，很适合私人使用。

## 4. PWA

项目内已经包含：

- `app/manifest.ts`
- `public/sw.js`
- App icons
- standalone / Apple web app metadata

部署到 HTTPS（Vercel）后，可从手机浏览器加入主画面。

## 5. Vercel 环境变量

部署后，在 Vercel：

`Project -> Settings -> Environment Variables`

加入：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

然后 Redeploy。

## 6. 从当前 CashGo 更新 GitHub

如果你已经在本机 CashGo repo：

1. 将这个 v2 项目的文件覆盖到原本 CashGo 文件夹（不要覆盖你的 `.git` 文件夹）。
2. 运行：

```bash
git add .
git commit -m "Upgrade CashGo to v2"
git push
```

如果 Vercel 已连接 GitHub，push 后会自动部署。
