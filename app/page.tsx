"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowDownLeft, ArrowUpRight, BarChart3, CalendarClock, Cloud, CloudOff,
  Home, ListFilter, LogOut, Plus, Search, Settings, Trash2, WalletCards, X
} from "lucide-react";
import { DEFAULT_DATA } from "@/lib/defaults";
import { cloudEnabled, supabase } from "@/lib/supabase";
import type { Account, AppData, Category, Project, RecurringItem, Transaction, TxType } from "@/lib/types";

const money = (n:number) => new Intl.NumberFormat("en-MY", { style:"currency", currency:"MYR" }).format(n || 0);
const todayISO = () => new Date().toISOString().slice(0,10);
const uid = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
const CACHE_KEY = "cashgo-v2-cache";

function cloneDefaults(): AppData { return JSON.parse(JSON.stringify(DEFAULT_DATA)); }

export default function Page() {
  const [data, setData] = useState<AppData>(cloneDefaults());
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [tab, setTab] = useState<"home"|"records"|"stats"|"settings">("home");
  const [showForm, setShowForm] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(()=>{});
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) { try { setData(JSON.parse(cached)); } catch {} }

    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data: auth }) => { setSession(auth.session); setLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); }, [data]);

  useEffect(() => {
    if (!supabase || !session) return;
    void loadCloudData();
  }, [session?.user.id]);

  async function loadCloudData() {
    if (!supabase || !session) return;
    setSyncing(true);
    const userId = session.user.id;
    const [accounts, categories, projects, transactions, recurring, settingsRes] = await Promise.all([
      supabase.from("accounts").select("id,name").eq("user_id", userId).order("created_at"),
      supabase.from("categories").select("id,name,type").eq("user_id", userId).order("created_at"),
      supabase.from("projects").select("id,name").eq("user_id", userId).order("created_at"),
      supabase.from("transactions").select("id,type,amount,category_id,account_id,project_id,note,date,recurring_id").eq("user_id", userId).order("date", { ascending:false }),
      supabase.from("recurring_items").select("id,name,type,amount,category_id,account_id,project_id,day_of_month,active").eq("user_id", userId).order("created_at"),
      supabase.from("user_settings").select("monthly_budget").eq("user_id", userId).maybeSingle()
    ]);

    const hasError = [accounts,categories,projects,transactions,recurring,settingsRes].some((r:any)=>r.error);
    if (hasError) { setSyncing(false); return; }

    let next: AppData = {
      accounts: accounts.data || [], categories: (categories.data || []) as Category[], projects: projects.data || [],
      transactions: (transactions.data || []).map((t:any)=>({...t, amount:Number(t.amount)})),
      recurring: (recurring.data || []).map((r:any)=>({...r, amount:Number(r.amount)})),
      monthlyBudget: Number(settingsRes.data?.monthly_budget || 1500)
    };

    if (!next.accounts.length && !next.categories.length) {
      await seedCloud(userId);
      setSyncing(false);
      return loadCloudData();
    }

    next = await materializeRecurring(next, userId);
    setData(next);
    setSyncing(false);
  }

  async function seedCloud(userId:string) {
    if (!supabase) return;
    const d = cloneDefaults();
    const accountRows = d.accounts.map(a=>({ user_id:userId, name:a.name }));
    const catRows = d.categories.map(c=>({ user_id:userId, name:c.name, type:c.type }));
    const projectRows = d.projects.map(p=>({ user_id:userId, name:p.name }));
    await Promise.all([
      supabase.from("accounts").insert(accountRows),
      supabase.from("categories").insert(catRows),
      supabase.from("projects").insert(projectRows),
      supabase.from("user_settings").upsert({ user_id:userId, monthly_budget:d.monthlyBudget })
    ]);
  }

  async function materializeRecurring(input:AppData, userId:string) {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const monthPrefix = `${y}-${String(m+1).padStart(2,"0")}`;
    const due = input.recurring.filter(r=>r.active && r.day_of_month <= now.getDate());
    const missing = due.filter(r=>!input.transactions.some(t=>t.recurring_id===r.id && t.date.startsWith(monthPrefix)));
    if (!missing.length) return input;
    const rows = missing.map(r=>{
      const day = Math.min(r.day_of_month, new Date(y,m+1,0).getDate());
      return { user_id:userId, type:r.type, amount:r.amount, category_id:r.category_id, account_id:r.account_id,
        project_id:r.project_id, note:r.name, recurring_id:r.id, date:`${monthPrefix}-${String(day).padStart(2,"0")}` };
    });
    if (supabase) {
      const { data: inserted, error } = await supabase.from("transactions").insert(rows).select("id,type,amount,category_id,account_id,project_id,note,date,recurring_id");
      if (!error && inserted) return {...input, transactions:[...inserted.map((t:any)=>({...t, amount:Number(t.amount)})), ...input.transactions]};
    }
    return input;
  }

  async function addEntity(kind:"accounts"|"projects", name:string) {
    name = name.trim(); if (!name) return;
    if (supabase && session) {
      const { data: row, error } = await supabase.from(kind).insert({ user_id:session.user.id, name }).select("id,name").single();
      if (!error && row) setData(d=>({...d, [kind]:[...d[kind], row]}));
    } else {
      const row = { id:uid(), name };
      setData(d=>({...d, [kind]:[...d[kind], row]}));
    }
  }

  async function addCategory(name:string, type:TxType) {
    name=name.trim(); if(!name) return;
    if (supabase && session) {
      const { data: row, error } = await supabase.from("categories").insert({ user_id:session.user.id, name, type }).select("id,name,type").single();
      if(!error && row) setData(d=>({...d,categories:[...d.categories,row as Category]}));
    } else setData(d=>({...d,categories:[...d.categories,{id:uid(),name,type}]}));
  }

  async function deleteEntity(kind:"accounts"|"projects"|"categories", id:string) {
    const isUsed = kind==="accounts" ? data.transactions.some(t=>t.account_id===id) :
      kind==="categories" ? data.transactions.some(t=>t.category_id===id) : data.transactions.some(t=>t.project_id===id);
    if (isUsed) { alert("这个项目已经被账目使用，先保留它以免历史记录失去关联。"); return; }
    if (supabase && session) {
      const { error } = await supabase.from(kind).delete().eq("id",id).eq("user_id",session.user.id);
      if(error) return;
    }
    setData(d=>({...d,[kind]:d[kind].filter((x:any)=>x.id!==id)}));
  }

  async function addTransaction(tx:Omit<Transaction,"id">) {
    if (supabase && session) {
      const { data: row, error } = await supabase.from("transactions").insert({ user_id:session.user.id, ...tx }).select("id,type,amount,category_id,account_id,project_id,note,date,recurring_id").single();
      if (!error && row) setData(d=>({...d,transactions:[{...row,amount:Number(row.amount)} as Transaction,...d.transactions]}));
    } else setData(d=>({...d,transactions:[{...tx,id:uid()},...d.transactions]}));
  }

  async function deleteTransaction(id:string){
    if (supabase && session) {
      const { error } = await supabase.from("transactions").delete().eq("id",id).eq("user_id",session.user.id); if(error)return;
    }
    setData(d=>({...d,transactions:d.transactions.filter(t=>t.id!==id)}));
  }

  async function addRecurring(item:Omit<RecurringItem,"id">) {
    if (supabase && session) {
      const { data: row, error } = await supabase.from("recurring_items").insert({user_id:session.user.id,...item}).select("id,name,type,amount,category_id,account_id,project_id,day_of_month,active").single();
      if(!error && row) setData(d=>({...d,recurring:[...d.recurring,{...row,amount:Number(row.amount)} as RecurringItem]}));
    } else setData(d=>({...d,recurring:[...d.recurring,{...item,id:uid()}]}));
  }

  async function deleteRecurring(id:string){
    if(supabase&&session){ const {error}=await supabase.from("recurring_items").delete().eq("id",id).eq("user_id",session.user.id); if(error)return; }
    setData(d=>({...d,recurring:d.recurring.filter(r=>r.id!==id)}));
  }

  async function saveBudget(value:number){
    setData(d=>({...d,monthlyBudget:value}));
    if(supabase&&session) await supabase.from("user_settings").upsert({user_id:session.user.id,monthly_budget:value});
  }

  if (loading) return <main className="center-screen"><div className="loader"/><p>Loading CashGo…</p></main>;
  if (cloudEnabled && !session) return <AuthScreen/>;

  const now = new Date();
  const monthKey = now.toISOString().slice(0,7);
  const monthTx = data.transactions.filter(t=>t.date.startsWith(monthKey));
  const income = monthTx.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const expense = monthTx.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  const balance = income-expense;
  const budgetLeft = data.monthlyBudget-expense;
  const daysInMonth = new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
  const remainingDays = Math.max(1,daysInMonth-now.getDate()+1);
  const dailySafe = Math.max(0,budgetLeft/remainingDays);
  const filtered = [...data.transactions].filter(t=>{
    const q=search.toLowerCase().trim(); if(!q)return true;
    const cat=data.categories.find(c=>c.id===t.category_id)?.name||"";
    const acc=data.accounts.find(a=>a.id===t.account_id)?.name||"";
    const proj=data.projects.find(p=>p.id===t.project_id)?.name||"";
    return `${t.note} ${cat} ${acc} ${proj} ${t.date}`.toLowerCase().includes(q);
  }).sort((a,b)=>b.date.localeCompare(a.date));
  const byCategory = Object.entries(monthTx.filter(t=>t.type==="expense").reduce((m:any,t)=>{ const n=data.categories.find(c=>c.id===t.category_id)?.name||"未分类"; m[n]=(m[n]||0)+t.amount; return m; },{} as Record<string,number>)).sort((a:any,b:any)=>b[1]-a[1]) as [string,number][];
  const byProject = Object.entries(monthTx.filter(t=>t.type==="income"&&t.project_id).reduce((m:any,t)=>{ const n=data.projects.find(p=>p.id===t.project_id)?.name||"其他"; m[n]=(m[n]||0)+t.amount; return m; },{} as Record<string,number>)).sort((a:any,b:any)=>b[1]-a[1]) as [string,number][];

  return <main className="app-shell">
    <header className="topbar"><div><div className="brand">CashGo <span>v2</span></div><div className="muted">你的个人现金流小助手</div></div><div className="sync-pill">{cloudEnabled?<><Cloud size={14}/>{syncing?"同步中":"已连接"}</>:<><CloudOff size={14}/>本机模式</>}</div></header>
    <section className="content">
      {tab==="home"&&<>
        <div className="hero-card"><div className="hero-label">本月结余</div><div className="hero-value">{money(balance)}</div><div className="mini-grid"><div><span>收入</span><strong className="positive">{money(income)}</strong></div><div><span>支出</span><strong>{money(expense)}</strong></div></div></div>
        <div className="insight-grid"><div className="insight-card"><span>本月预算剩余</span><strong>{money(Math.max(0,budgetLeft))}</strong><small>预算 {money(data.monthlyBudget)}</small></div><div className="insight-card accent"><span>今日建议可花</span><strong>{money(dailySafe)}</strong><small>按剩余 {remainingDays} 天计算</small></div></div>
        <div className="section-title"><span>最近记录</span><button onClick={()=>setTab("records")}>查看全部</button></div>
        <div className="list">{filtered.slice(0,6).map(t=><TxRow key={t.id} t={t} data={data}/>)}{!data.transactions.length&&<Empty text="还没有记录，先记第一笔吧。"/>}</div>
      </>}
      {tab==="records"&&<><SectionHead title="记录" subtitle="管理每一笔收入与支出"/><div className="searchbox"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索分类、账户、来源、备注…"/></div><div className="list roomy">{filtered.map(t=><div className="tx-wrap" key={t.id}><TxRow t={t} data={data}/><button className="icon-btn danger" onClick={()=>deleteTransaction(t.id)}><Trash2 size={17}/></button></div>)}{!filtered.length&&<Empty text="没有符合条件的记录。"/>}</div></>}
      {tab==="stats"&&<><SectionHead title="统计" subtitle="看懂这个月的钱去了哪里、从哪里来"/><div className="stat-cards"><Stat title="收入" value={income} icon={<ArrowDownLeft/>}/><Stat title="支出" value={expense} icon={<ArrowUpRight/>}/></div><Breakdown title="支出分类" rows={byCategory} total={expense}/><Breakdown title="收入来源 / 项目" rows={byProject} total={income}/></>}
      {tab==="settings"&&<SettingsPage data={data} saveBudget={saveBudget} addEntity={addEntity} addCategory={addCategory} deleteEntity={deleteEntity} deleteRecurring={deleteRecurring} openRecurring={()=>setShowRecurring(true)} logout={()=>supabase?.auth.signOut()}/>} 
    </section>
    <button className="fab" onClick={()=>setShowForm(true)}><Plus size={28}/></button>
    <nav className="bottom-nav"><Nav active={tab==="home"} onClick={()=>setTab("home")} icon={<Home/>} label="首页"/><Nav active={tab==="records"} onClick={()=>setTab("records")} icon={<ListFilter/>} label="记录"/><Nav active={tab==="stats"} onClick={()=>setTab("stats")} icon={<BarChart3/>} label="统计"/><Nav active={tab==="settings"} onClick={()=>setTab("settings")} icon={<Settings/>} label="设置"/></nav>
    {showForm&&<TransactionSheet data={data} close={()=>setShowForm(false)} save={async tx=>{await addTransaction(tx);setShowForm(false)}}/>}
    {showRecurring&&<RecurringSheet data={data} close={()=>setShowRecurring(false)} save={async r=>{await addRecurring(r);setShowRecurring(false)}}/>}
  </main>;
}

function AuthScreen(){
  const [mode,setMode]=useState<"login"|"signup">("login"), [email,setEmail]=useState(""), [password,setPassword]=useState(""), [busy,setBusy]=useState(false), [message,setMessage]=useState("");
  async function submit(e:React.FormEvent){e.preventDefault(); if(!supabase)return; setBusy(true);setMessage(""); const result=mode==="login"?await supabase.auth.signInWithPassword({email,password}):await supabase.auth.signUp({email,password}); setBusy(false); if(result.error)setMessage(result.error.message); else if(mode==="signup"&&!result.data.session)setMessage("帐号已建立，请检查邮箱完成验证后再登录。");}
  return <main className="auth-screen"><div className="auth-card"><div className="auth-logo">CG</div><h1>CashGo</h1><p>你的私人现金流工具</p><form onSubmit={submit}><label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><label>Password<input type="password" minLength={6} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="至少 6 位"/></label>{message&&<div className="form-message">{message}</div>}<button className="primary-btn" disabled={busy}>{busy?"处理中…":mode==="login"?"登录":"建立帐号"}</button></form><button className="text-btn" onClick={()=>setMode(mode==="login"?"signup":"login")}>{mode==="login"?"第一次使用？建立帐号":"已有帐号？返回登录"}</button></div></main>
}

function TransactionSheet({data,close,save}:{data:AppData;close:()=>void;save:(tx:Omit<Transaction,"id">)=>Promise<void>}){
  const [type,setType]=useState<TxType>("expense"), [amount,setAmount]=useState(""), [note,setNote]=useState(""), [date,setDate]=useState(todayISO()), [project,setProject]=useState("");
  const cats=data.categories.filter(c=>c.type===type), [category,setCategory]=useState(data.categories.find(c=>c.type==="expense")?.id||""); const [account,setAccount]=useState(data.accounts[0]?.id||"");
  useEffect(()=>{setCategory(data.categories.find(c=>c.type===type)?.id||"")},[type]);
  async function submit(e:React.FormEvent){e.preventDefault(); const n=Number(amount); if(!n||!category||!account)return; await save({type,amount:n,category_id:category,account_id:account,project_id:project||null,note:note.trim(),date,recurring_id:null});}
  return <Sheet title="记一笔" close={close}><form onSubmit={submit}><Segmented type={type} setType={setType}/><MoneyField value={amount} setValue={setAmount}/><div className="two-col"><Select label="分类" value={category} setValue={setCategory} options={cats}/><Select label="账户" value={account} setValue={setAccount} options={data.accounts}/></div><Select label="项目 / 收入来源（可选）" value={project} setValue={setProject} options={data.projects} allowEmpty/><label className="field"><span>日期</span><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label className="field"><span>备注（可选）</span><input value={note} onChange={e=>setNote(e.target.value)} placeholder="例如：午餐、油费、项目佣金"/></label><button className="primary-btn">保存记录</button></form></Sheet>
}

function RecurringSheet({data,close,save}:{data:AppData;close:()=>void;save:(r:Omit<RecurringItem,"id">)=>Promise<void>}){
  const [name,setName]=useState(""),[type,setType]=useState<TxType>("expense"),[amount,setAmount]=useState(""),[day,setDay]=useState("1"),[project,setProject]=useState("");
  const cats=data.categories.filter(c=>c.type===type), [category,setCategory]=useState(data.categories.find(c=>c.type==="expense")?.id||""), [account,setAccount]=useState(data.accounts[0]?.id||"");
  useEffect(()=>{setCategory(data.categories.find(c=>c.type===type)?.id||"")},[type]);
  async function submit(e:React.FormEvent){e.preventDefault();const n=Number(amount),d=Math.min(31,Math.max(1,Number(day)||1));if(!name.trim()||!n||!category||!account)return;await save({name:name.trim(),type,amount:n,category_id:category,account_id:account,project_id:project||null,day_of_month:d,active:true});}
  return <Sheet title="新增固定月费" close={close}><form onSubmit={submit}><Segmented type={type} setType={setType}/><label className="field"><span>名称</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="例如：Spotify / 房租"/></label><MoneyField value={amount} setValue={setAmount}/><div className="two-col"><Select label="分类" value={category} setValue={setCategory} options={cats}/><Select label="账户" value={account} setValue={setAccount} options={data.accounts}/></div><Select label="项目 / 来源（可选）" value={project} setValue={setProject} options={data.projects} allowEmpty/><label className="field"><span>每月日期</span><input type="number" min="1" max="31" value={day} onChange={e=>setDay(e.target.value)}/></label><button className="primary-btn">保存固定项目</button></form></Sheet>
}

function SettingsPage({data,saveBudget,addEntity,addCategory,deleteEntity,deleteRecurring,openRecurring,logout}:any){
  const [account,setAccount]=useState(""),[project,setProject]=useState(""),[cat,setCat]=useState(""),[catType,setCatType]=useState<TxType>("expense");
  return <><SectionHead title="设置" subtitle="把 CashGo 调整成最适合你的样子"/><div className="panel settings"><label>每月支出预算</label><div className="money-input"><span>RM</span><input type="number" value={data.monthlyBudget} onChange={e=>saveBudget(Number(e.target.value)||0)}/></div></div>
    <ManageBox title="账户" placeholder="新增账户，例如 Public Bank" value={account} setValue={setAccount} onAdd={()=>{addEntity("accounts",account);setAccount("")}} items={data.accounts} onDelete={(id:string)=>deleteEntity("accounts",id)}/>
    <div className="panel"><h2>分类</h2><div className="segmented compact"><button className={catType==="expense"?"active":""} onClick={()=>setCatType("expense")}>支出</button><button className={catType==="income"?"active":""} onClick={()=>setCatType("income")}>收入</button></div><div className="add-row"><input value={cat} onChange={e=>setCat(e.target.value)} placeholder="新增分类"/><button onClick={()=>{addCategory(cat,catType);setCat("")}}><Plus size={18}/></button></div><TagList items={data.categories.filter((c:Category)=>c.type===catType)} onDelete={(id:string)=>deleteEntity("categories",id)}/></div>
    <ManageBox title="项目 / 收入来源" placeholder="例如 Music / Renovation" value={project} setValue={setProject} onAdd={()=>{addEntity("projects",project);setProject("")}} items={data.projects} onDelete={(id:string)=>deleteEntity("projects",id)}/>
    <div className="panel"><div className="panel-title-row"><div><h2>固定月费 / 固定收入</h2><p>到期后，打开 CashGo 会自动补入当月记录。</p></div><button className="small-primary" onClick={openRecurring}><Plus size={16}/>新增</button></div>{data.recurring.length?data.recurring.map((r:RecurringItem)=><div className="recurring-row" key={r.id}><CalendarClock size={18}/><div><strong>{r.name}</strong><span>每月 {r.day_of_month} 日 · {money(r.amount)}</span></div><button className="icon-btn danger" onClick={()=>deleteRecurring(r.id)}><Trash2 size={16}/></button></div>):<Empty text="还没有固定项目。"/>}</div>
    {cloudEnabled&&<button className="logout-btn" onClick={logout}><LogOut size={18}/>退出登录</button>}
    <p className="footnote">{cloudEnabled?"数据已使用 Supabase 云端同步，并同时保留浏览器缓存。":"目前没有配置 Supabase，因此使用本机缓存。完成 .env.local 配置后会自动切换云端模式。"}</p></>;
}

function ManageBox({title,placeholder,value,setValue,onAdd,items,onDelete}:any){return <div className="panel"><h2>{title}</h2><div className="add-row"><input value={value} onChange={(e:any)=>setValue(e.target.value)} placeholder={placeholder}/><button onClick={onAdd}><Plus size={18}/></button></div><TagList items={items} onDelete={onDelete}/></div>}
function TagList({items,onDelete}:{items:{id:string;name:string}[];onDelete:(id:string)=>void}){return <div className="tag-list">{items.map(x=><span className="tag" key={x.id}>{x.name}<button onClick={()=>onDelete(x.id)}><X size={13}/></button></span>)}</div>}
function TxRow({t,data}:{t:Transaction;data:AppData}){const cat=data.categories.find(c=>c.id===t.category_id)?.name||"未分类",acc=data.accounts.find(a=>a.id===t.account_id)?.name||"未知账户",proj=data.projects.find(p=>p.id===t.project_id)?.name;return <div className="tx-row"><div className={`tx-icon ${t.type}`}>{t.type==="income"?<ArrowDownLeft size={19}/>:<ArrowUpRight size={19}/>}</div><div className="tx-main"><strong>{t.note||cat}</strong><span>{cat} · {acc}{proj?` · ${proj}`:""} · {t.date}</span></div><div className={`tx-amount ${t.type}`}>{t.type==="income"?"+":"-"}{money(t.amount)}</div></div>}
function Nav({active,onClick,icon,label}:any){return <button className={active?"nav-active":""} onClick={onClick}>{icon}<span>{label}</span></button>}
function SectionHead({title,subtitle}:{title:string;subtitle:string}){return <div className="section-head"><div><h1>{title}</h1><p>{subtitle}</p></div></div>}
function Stat({title,value,icon}:{title:string;value:number;icon:React.ReactNode}){return <div className="stat-card">{icon}<span>{title}</span><strong>{money(value)}</strong></div>}
function Breakdown({title,rows,total}:{title:string;rows:[string,number][];total:number}){return <div className="panel"><h2>{title}</h2>{!rows.length&&<Empty text="这个月还没有相关记录。"/>}{rows.map(([name,value])=>{const pct=total?Math.round(value/total*100):0;return <div className="bar-row" key={name}><div className="bar-meta"><span>{name}</span><strong>{money(value)} · {pct}%</strong></div><div className="bar-track"><div className="bar-fill" style={{width:`${pct}%`}}/></div></div>})}</div>}
function Empty({text}:{text:string}){return <div className="empty"><WalletCards size={28}/><span>{text}</span></div>}
function Sheet({title,close,children}:{title:string;close:()=>void;children:React.ReactNode}){return <div className="modal-backdrop" onMouseDown={close}><div className="sheet" onMouseDown={e=>e.stopPropagation()}><div className="sheet-handle"/><div className="sheet-head"><h2>{title}</h2><button className="icon-btn" onClick={close}><X/></button></div>{children}</div></div>}
function Segmented({type,setType}:{type:TxType;setType:(t:TxType)=>void}){return <div className="segmented"><button type="button" className={type==="expense"?"active":""} onClick={()=>setType("expense")}>支出</button><button type="button" className={type==="income"?"active":""} onClick={()=>setType("income")}>收入</button></div>}
function MoneyField({value,setValue}:{value:string;setValue:(v:string)=>void}){return <label className="field"><span>金额</span><div className="big-money"><b>RM</b><input autoFocus inputMode="decimal" type="number" step="0.01" value={value} onChange={e=>setValue(e.target.value)} placeholder="0.00"/></div></label>}
function Select({label,value,setValue,options,allowEmpty=false}:{label:string;value:string;setValue:(v:string)=>void;options:{id:string;name:string}[];allowEmpty?:boolean}){return <label className="field"><span>{label}</span><select value={value} onChange={e=>setValue(e.target.value)}>{allowEmpty&&<option value="">不选择</option>}{options.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
