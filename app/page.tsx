"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight, BarChart3, Home, ListFilter, Plus,
  Settings, Trash2, WalletCards, X, Search
} from "lucide-react";

type TxType = "expense" | "income";
type Transaction = {
  id: string;
  type: TxType;
  amount: number;
  category: string;
  account: string;
  note: string;
  date: string;
};
type AppState = {
  transactions: Transaction[];
  budget: number;
  accounts: string[];
  categories: { expense: string[]; income: string[] };
};

const DEFAULT_STATE: AppState = {
  budget: 1500,
  accounts: ["Cash", "Maybank", "TNG eWallet"],
  categories: {
    expense: ["餐饮", "交通", "购物", "娱乐", "账单", "其他"],
    income: ["薪资", "佣金", "自由职业", "其他"],
  },
  transactions: [
    { id: "1", type: "expense", amount: 18.5, category: "餐饮", account: "TNG eWallet", note: "午餐", date: new Date().toISOString().slice(0,10) },
    { id: "2", type: "income", amount: 320, category: "佣金", account: "Maybank", note: "Commission", date: new Date().toISOString().slice(0,10) },
  ],
};

const money = (n:number) => new Intl.NumberFormat("en-MY",{style:"currency",currency:"MYR"}).format(n);

export default function Page() {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [tab, setTab] = useState<"home"|"records"|"stats"|"settings">("home");
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<TxType>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(DEFAULT_STATE.categories.expense[0]);
  const [account, setAccount] = useState(DEFAULT_STATE.accounts[0]);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));

  useEffect(() => {
    try {
      const saved = localStorage.getItem("cashgo-state");
      if (saved) setState(JSON.parse(saved));
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem("cashgo-state", JSON.stringify(state));
  }, [state, loaded]);

  useEffect(() => {
    setCategory(state.categories[type][0] || "其他");
  }, [type, state.categories]);

  const now = new Date();
  const monthKey = now.toISOString().slice(0,7);
  const monthTx = useMemo(() => state.transactions.filter(t => t.date.startsWith(monthKey)), [state.transactions, monthKey]);
  const income = monthTx.filter(t=>t.type==="income").reduce((a,b)=>a+b.amount,0);
  const expense = monthTx.filter(t=>t.type==="expense").reduce((a,b)=>a+b.amount,0);
  const balance = income - expense;
  const budgetLeft = state.budget - expense;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const today = now.getDate();
  const remainingDays = Math.max(1, daysInMonth - today + 1);
  const dailySafe = Math.max(0, budgetLeft / remainingDays);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...state.transactions]
      .filter(t => !q || `${t.category} ${t.account} ${t.note} ${t.date}`.toLowerCase().includes(q))
      .sort((a,b)=>b.date.localeCompare(a.date));
  }, [state.transactions, search]);

  const expenseByCategory = useMemo(() => {
    const map: Record<string,number> = {};
    monthTx.filter(t=>t.type==="expense").forEach(t=>map[t.category]=(map[t.category]||0)+t.amount);
    return Object.entries(map).sort((a,b)=>b[1]-a[1]);
  }, [monthTx]);

  function addTransaction(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) return;
    const tx: Transaction = {
      id: crypto.randomUUID(),
      type, amount: value, category, account, note: note.trim(), date
    };
    setState(s => ({...s, transactions:[tx, ...s.transactions]}));
    setAmount(""); setNote(""); setDate(new Date().toISOString().slice(0,10)); setShowForm(false);
  }

  function removeTx(id:string) {
    setState(s=>({...s, transactions:s.transactions.filter(t=>t.id!==id)}));
  }

  function resetData(){
    if(confirm("确定要清除 CashGo 的所有本机数据吗？")){
      localStorage.removeItem("cashgo-state");
      setState({...DEFAULT_STATE, transactions:[]});
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand">CashGo</div>
          <div className="muted">你的个人现金流小助手</div>
        </div>
        <div className="avatar">CG</div>
      </header>

      <section className="content">
        {tab==="home" && <>
          <div className="hero-card">
            <div className="hero-label">本月结余</div>
            <div className="hero-value">{money(balance)}</div>
            <div className="mini-grid">
              <div><span>收入</span><strong className="positive">{money(income)}</strong></div>
              <div><span>支出</span><strong>{money(expense)}</strong></div>
            </div>
          </div>

          <div className="insight-grid">
            <div className="insight-card">
              <span>本月预算剩余</span>
              <strong>{money(Math.max(0,budgetLeft))}</strong>
              <small>预算 {money(state.budget)}</small>
            </div>
            <div className="insight-card accent">
              <span>今日建议可花</span>
              <strong>{money(dailySafe)}</strong>
              <small>按剩余 {remainingDays} 天计算</small>
            </div>
          </div>

          <div className="section-title"><span>最近记录</span><button onClick={()=>setTab("records")}>查看全部</button></div>
          <div className="list">
            {filtered.slice(0,6).map(t=><TxRow key={t.id} t={t} />)}
            {state.transactions.length===0 && <Empty text="还没有记录，先记第一笔吧。" />}
          </div>
        </>}

        {tab==="records" && <>
          <div className="section-head">
            <div>
              <h1>记录</h1><p>管理你的每一笔收入与支出</p>
            </div>
          </div>
          <div className="searchbox"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索分类、账户、备注..." /></div>
          <div className="list roomy">
            {filtered.map(t=><div className="tx-wrap" key={t.id}><TxRow t={t}/><button className="icon-btn danger" onClick={()=>removeTx(t.id)} aria-label="删除"><Trash2 size={17}/></button></div>)}
            {filtered.length===0 && <Empty text="找不到符合条件的记录。" />}
          </div>
        </>}

        {tab==="stats" && <>
          <div className="section-head"><div><h1>统计</h1><p>看看这个月钱都去了哪里</p></div></div>
          <div className="stat-cards">
            <div className="stat-card"><ArrowDownLeft size={20}/><span>收入</span><strong>{money(income)}</strong></div>
            <div className="stat-card"><ArrowUpRight size={20}/><span>支出</span><strong>{money(expense)}</strong></div>
          </div>
          <div className="panel">
            <h2>支出分类</h2>
            {expenseByCategory.length===0 && <Empty text="本月还没有支出记录。" />}
            {expenseByCategory.map(([name,value])=>{
              const pct = expense ? Math.round(value/expense*100) : 0;
              return <div className="bar-row" key={name}>
                <div className="bar-meta"><span>{name}</span><strong>{money(value)} · {pct}%</strong></div>
                <div className="bar-track"><div className="bar-fill" style={{width:`${pct}%`}} /></div>
              </div>
            })}
          </div>
        </>}

        {tab==="settings" && <>
          <div className="section-head"><div><h1>设置</h1><p>调整你的 CashGo</p></div></div>
          <div className="panel settings">
            <label>每月支出预算</label>
            <div className="money-input"><span>RM</span><input type="number" value={state.budget} onChange={e=>setState(s=>({...s,budget:Number(e.target.value)||0}))}/></div>
          </div>
          <div className="panel settings">
            <h2>账户</h2>
            <p>{state.accounts.join(" · ")}</p>
            <small>账户自定义会在下一版加入。</small>
          </div>
          <button className="danger-btn" onClick={resetData}>清除本机数据</button>
          <p className="footnote">当前版本使用浏览器 Local Storage。换设备不会自动同步；后续可接 Supabase 云端账号。</p>
        </>}
      </section>

      <button className="fab" onClick={()=>setShowForm(true)} aria-label="记一笔"><Plus size={28}/></button>

      <nav className="bottom-nav">
        <NavBtn active={tab==="home"} onClick={()=>setTab("home")} icon={<Home size={21}/>} label="首页"/>
        <NavBtn active={tab==="records"} onClick={()=>setTab("records")} icon={<ListFilter size={21}/>} label="记录"/>
        <NavBtn active={tab==="stats"} onClick={()=>setTab("stats")} icon={<BarChart3 size={21}/>} label="统计"/>
        <NavBtn active={tab==="settings"} onClick={()=>setTab("settings")} icon={<Settings size={21}/>} label="设置"/>
      </nav>

      {showForm && <div className="modal-backdrop" onMouseDown={()=>setShowForm(false)}>
        <div className="sheet" onMouseDown={e=>e.stopPropagation()}>
          <div className="sheet-handle"/>
          <div className="sheet-head"><h2>记一笔</h2><button className="icon-btn" onClick={()=>setShowForm(false)}><X/></button></div>
          <form onSubmit={addTransaction}>
            <div className="segmented">
              <button type="button" className={type==="expense"?"active":""} onClick={()=>setType("expense")}>支出</button>
              <button type="button" className={type==="income"?"active":""} onClick={()=>setType("income")}>收入</button>
            </div>
            <label className="field"><span>金额</span><div className="big-money"><b>RM</b><input autoFocus inputMode="decimal" type="number" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/></div></label>
            <div className="two-col">
              <label className="field"><span>分类</span><select value={category} onChange={e=>setCategory(e.target.value)}>{state.categories[type].map(x=><option key={x}>{x}</option>)}</select></label>
              <label className="field"><span>账户</span><select value={account} onChange={e=>setAccount(e.target.value)}>{state.accounts.map(x=><option key={x}>{x}</option>)}</select></label>
            </div>
            <label className="field"><span>日期</span><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
            <label className="field"><span>备注（可选）</span><input value={note} onChange={e=>setNote(e.target.value)} placeholder="例如：午餐、油费、项目佣金"/></label>
            <button className="primary-btn" type="submit">保存记录</button>
          </form>
        </div>
      </div>}
    </main>
  );
}

function NavBtn({active,onClick,icon,label}:{active:boolean;onClick:()=>void;icon:React.ReactNode;label:string}) {
  return <button className={active?"nav-active":""} onClick={onClick}>{icon}<span>{label}</span></button>
}
function TxRow({t}:{t:Transaction}) {
  return <div className="tx-row">
    <div className={`tx-icon ${t.type}`}>{t.type==="income"?<ArrowDownLeft size={19}/>:<ArrowUpRight size={19}/>}</div>
    <div className="tx-main"><strong>{t.note || t.category}</strong><span>{t.category} · {t.account} · {t.date}</span></div>
    <div className={`tx-amount ${t.type}`}>{t.type==="income"?"+":"-"}{money(t.amount)}</div>
  </div>
}
function Empty({text}:{text:string}) {
  return <div className="empty"><WalletCards size={30}/><span>{text}</span></div>
}
