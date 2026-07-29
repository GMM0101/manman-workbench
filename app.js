/* ===================== 漫漫工作台 · 应用逻辑 ===================== */
'use strict';

/* ---------- 内置热点池（每个平台若干，按日期种子轮换） ---------- */
const HOT_POOL = {
  weibo: ["某明星工作室官宣分手引发热议","暑期档电影票房创新高","专家称每天步行八千步最健康","城市夜经济持续升温","高考志愿填报指南登上热搜","年轻人开始流行电子木鱼解压"],
  douyin: ["三农博主用无人机种地获赞","非遗手作短视频爆火","露营装备销量同比翻倍","职场穿搭挑战赛刷屏","宠物拟人化剧情涨粉快","县城美食探店成新流量密码"],
  zhihu: ["如何评价大模型的Agent化趋势","普通人该不该学AI编程","为什么年轻人越来越爱存钱","远程办公真的提高效率吗","读研还是就业怎么选","怎样建立自己的知识体系"],
  bilibili: ["硬核科普：一分钟看懂光猫原理","毕业季vlog引发共鸣","老照片修复教程涨粉","独立游戏开发者访谈","考研复盘干货合集","国风动画短片惊艳出圈"],
  toutiao: ["多地发放消费券促内需","新能源补贴政策延续","城乡居民养老金上调","文旅市场上半年数据亮眼","数字人民币试点扩容","夏季用电高峰保供稳价"],
  baidu: ["今日天气台风路径更新","本地三甲医院挂号攻略","公积金提取新规","学区划片调整方案","公务员考试公告发布","医保异地结算指南"],
  "36kr": ["AI编程工具融资过亿","SaaS出海东南亚机会","银发经济成新风口","跨境电商上半年增长强劲","具身智能站上风口","企业服务降本增效需求旺"]
};

/* 播客内置库 */
const PODCASTS = [
  {cat:"商业财经", items:[
    {name:"商业就是这样", host:"肖文杰等", desc:"用大白话讲清每周商业大事"},
    {name:"无人知晓", host:"孟岩", desc:"关于投资、阅读与生活的长期思考"},
    {name:"声动早咖啡", host:"声动活泼", desc:"用一杯咖啡的时间读懂商业世界"}
  ]},
  {cat:"个人成长", items:[
    {name:"得意忘形", host:"也谈钱等", desc:"关于自我、关系与自由的多元对话"},
    {name:"知行小酒馆", host:"倾心", desc:"探索如何过更从容而丰盈的生活"},
    {name:"组织进化论", host:"混沌", desc:"拆解高手的心智模型与决策逻辑"}
  ]},
  {cat:"文化闲聊", items:[
    {name:"忽左忽右", host:"程衍樑", desc:"当代文化热点与公共议题对谈"},
    {name:"故事FM", host:"寇爱哲", desc:"用真实声音记录普通人的故事"},
    {name:"不合时宜", host:"若含等", desc:"在变动时代理解我们所处的世界"}
  ]}
];

/* ---------- 默认状态 ---------- */
const DEFAULT_STATE = {
  english: { target:"2026-12-18", assigned:{}, learned:[], reviews:[], study:{}, timerStart:null },
  fitness: { log:{}, plan:[] },
  media: { accounts:[], data:{}, topics:[] },
  knowledge: { clips:[], books:[], talks:[] },
  finance: { salary:8000, alloc:{living:50,save:20,invest:20,fun:10}, coursesDone:[] },
  fundPlan: { records:[], funds:[], month:'', period:'month', chartMode:'exp', expand:{} },
  tasks: { done:{} },
  podcast: { listened:[] },
  ai: { key:"", base:"", model:"" },
  schedule: { items:[] }   // 日历日程 {id,date,time,title,note,done,createdAt}
};

/* ---------- 状态加载/保存 ---------- */
let state = JSON.parse(JSON.stringify(DEFAULT_STATE));
try {
  const raw = localStorage.getItem("wb_state");
  if (raw) {
    const saved = JSON.parse(raw);
    for (const k in DEFAULT_STATE) {
      if (saved[k] && typeof saved[k] === "object" && !Array.isArray(saved[k])) {
        state[k] = Object.assign(JSON.parse(JSON.stringify(DEFAULT_STATE[k])), saved[k]);
      } else if (saved[k] !== undefined) {
        state[k] = saved[k];
      }
    }
  }
} catch(e) { /* 损坏则使用默认 */ }
const save = () => { try { localStorage.setItem("wb_state", JSON.stringify(state)); } catch(e){} cloudAutoPush(); };

/* ---------- 工具函数 ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s==null?"":s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
function today(){ const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function fmtDate(d){ return d.getMonth()+1+"月"+d.getDate()+"日"; }
function daysBetween(a,b){ const x=new Date(a), y=new Date(b); return Math.round((y-x)/86400000); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function weekday(dStr){ return new Date(dStr).getDay(); }
function isWeekend(dStr){ const w=new Date(dStr).getDay(); return w===0||w===6; }

/* 元素深层合并兜底（防止旧备份缺字段） */
function deepFill(obj, def){
  for (const k in def){
    if (obj[k]===undefined) obj[k]=JSON.parse(JSON.stringify(def[k]));
    else if (def[k] && typeof def[k]==="object" && !Array.isArray(def[k]) && typeof obj[k]==="object") deepFill(obj[k], def[k]);
  }
}
deepFill(state, DEFAULT_STATE);
/* 老数据迁移：旧 records 用 cat 字段(need/fun/buy) 映射到 cat1+cat2 */
(function migrateFund(){
  const mp={need:"必要支出",fun:"娱乐支出",buy:"物资采购"};
  if(state.fundPlan && Array.isArray(state.fundPlan.records)){
    state.fundPlan.records.forEach(r=>{
      if(!r.cat1 && r.cat){ r.cat1=mp[r.cat]||"其他"; r.cat2=""; r.type=r.type||"exp"; }
      if(!r.type) r.type="exp";
    });
  }
  if(!state.fundPlan.month){
    const d=new Date();
    state.fundPlan.month=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
  }
})();

/* ---------- 导航定义 ---------- */
const NAV = [
  {v:"home",     ico:"🏠", t:"首页"},
  {v:"english",  ico:"📚", t:"英语备考专区"},
  {v:"schedule", ico:"📅", t:"日历日程"},
  {v:"fitness",  ico:"🏃", t:"健身计划"},
  {v:"media",    ico:"📱", t:"自媒体运营"},
  {v:"knowledge",ico:"💡", t:"知识库"},
  {v:"fund",     ico:"💰", t:"资金规划"},
  {v:"podcast",  ico:"🎧", t:"播客收听"},
  {v:"tools",    ico:"🛠", t:"通用工具"}
];
const MOBILE_NAV = [
  {v:"home",     ico:"🏠", t:"首页"},
  {v:"english",  ico:"📚", t:"英语"},
  {v:"schedule", ico:"📅", t:"日程"},
  {v:"fitness",  ico:"🏃", t:"健身"},
  {v:"media",    ico:"📱", t:"自媒体"},
  {v:"fund",     ico:"💰", t:"资金"},
  {v:"tools",    ico:"🛠", t:"更多"}
];

/* 各模块的二级目录（模块化导航数据源）：[子键, 图标, 名称] */
const SUBNAV = {
  english:   [["overview","📊","总览"],["words","📚","每日单词"],["sentences","📝","长难句"]],
  schedule:  [["day","📋","日"],["week","🗓","周"],["month","📅","月"]],
  fitness:   [["calendar","📅","月历打卡"],["plan","🏋️","训练计划"],["stats","📈","统计"]],
  media:     [["accounts","👤","账号"],["hot","🔥","热点速报"],["topics","💡","选题生成"],["data","📊","数据录入"],["month","🗓","月度报"],["quarter","📑","季度报"]],
  knowledge: [["clips","✏️","摘抄"],["books","📚","书单"],["ai","🤖","AI书友"],["finance","📈","理财课"]],
  fund:      [["overview","📊","总览&明细"],["category","🍩","分类统计"],["calendar","📅","日历视图"],["other","💹","基金&报表"],["salary","💵","工资规划"]]
};

let current = { view:"home", sub:"" };

function renderNav(){
  $("navList").innerHTML = NAV.map(n => {
    let h = `<button class="nav-item ${current.view===n.v?"active":""}" onclick="go('${n.v}')">
       <span class="ico">${n.ico}</span><span>${n.t}</span>
       ${SUBNAV[n.v]&&current.view===n.v?'<span class="chev">▾</span>':''}
     </button>`;
    if (SUBNAV[n.v] && current.view===n.v){
      h += `<div class="nav-sub">` + SUBNAV[n.v].map(s =>
        `<button class="nav-sub-item ${current.sub===s[0]?"active":""}" onclick="go('${n.v}','${s[0]}')">
           <span class="si">${s[1]}</span><span>${s[2]}</span>
         </button>`).join("") + `</div>`;
    }
    return h;
  }).join("");
  $("mobileTab").innerHTML = MOBILE_NAV.map(n =>
    `<button class="mt ${current.view===n.v?"active":""}" onclick="go('${n.v}')">
       <span class="e">${n.ico}</span><span>${n.t}</span>
     </button>`).join("");
  renderUserStats();
}

function renderUserStats(){
  const td = today();
  const doneToday = (state.tasks.done[td]||[]).length;
  const learned = state.english.learned.length;
  const fitMin = (state.fitness.log[td]||[]).reduce((a,b)=>a+b.minutes,0);
  const books = state.knowledge.books.filter(b=>b.status!=="读完").length;
  const stats = [
    {n:doneToday, l:"今日完成"},
    {n:learned, l:"已学单词"},
    {n:fitMin+"′", l:"今日健身"},
    {n:books, l:"在读的书"}
  ];
  $("userStats").innerHTML = stats.map(s=>`<div class="stat"><div class="num">${s.n}</div><div class="lab">${s.l}</div></div>`).join("");
}

/* ---------- 顶部时间 ---------- */
function tickTop(){
  const d = new Date();
  const wk = ["日","一","二","三","四","五","六"][d.getDay()];
  const hh = String(d.getHours()).padStart(2,"0");
  const mm = String(d.getMinutes()).padStart(2,"0");
  const el = $("topTime");
  if (el) el.textContent = `${d.getMonth()+1}月${d.getDate()}日 周${wk} ${hh}:${mm}`;
}

/* ===================== 路由 ===================== */
function go(view, sub){
  current.view = view; current.sub = sub||"";
  renderNav();
  let html = "";
  try {
    if (view==="home") html = viewHome();
    else if (view==="english") html = viewEnglish();
    else if (view==="schedule") html = viewSchedule();
    else if (view==="fitness") html = viewFitness();
    else if (view==="media") html = viewMedia();
    else if (view==="knowledge") html = viewKnowledge();
    else if (view==="fund") html = viewFund();
    else if (view==="podcast") html = viewPodcast();
    else if (view==="tools") html = viewTools();
    else html = viewHome();
  } catch(e){
    html = `<div class="err-box">⚠️ 渲染出错：${esc(e.message)}<br><small>${esc(e.stack||"")}</small></div>`;
  }
  $("main").innerHTML = html;
  window.scrollTo(0,0);
  afterRender(view, sub);
}

/* 模块化二级导航（带图标+分隔+当前高亮，与内容明显分层） */
function subNav(view){
  const tabs = SUBNAV[view]||[];
  return `<div class="subnav">` + tabs.map(t =>
    `<button class="snav ${current.sub===t[0]?"active":""}" onclick="go('${view}','${t[0]}')">
       <span class="si">${t[1]}</span><span class="st">${t[2]}</span>
     </button>`).join("") + `</div>`;
}
function subTabs(view, tabs){ return subNav(view); } /* 兼容旧调用 */

/* ===================== 首页 ===================== */
function viewHome(){
  const td = today();
  const doneToday = (state.tasks.done[td]||[]).length;
  const wordDone = (state.english.assigned[td]||[]).filter(w=>w.done).length;
  const fitMin = (state.fitness.log[td]||[]).reduce((a,b)=>a+b.minutes,0);
  const total = 3, done = (doneToday>0?1:0)+(wordDone>=20?1:0)+(fitMin>0?1:0);
  const prog = Math.round(done/total*100);

  const cd = englishCountdown();
  const fitStreak = fitnessStreak();
  const fitWeek = fitnessWeekMinutes();
  const accCount = state.media.accounts.length;
  const clipCount = state.knowledge.clips.length;
  const bookTodo = state.knowledge.books.filter(b=>b.status!=="读完").length;

  // 今日支出汇总
  const todayRecs = state.fundPlan.records.filter(r=>r.date===td && r.type!=="inc");
  const todayExp = todayRecs.reduce((a,r)=>a+r.amount,0);
  const yestDate = addDays(td, -1);
  const yestExp = state.fundPlan.records.filter(r=>r.date===yestDate && r.type!=="inc").reduce((a,r)=>a+r.amount,0);
  const diff = todayExp - yestExp;
  const [monthMs,monthMe] = monthRange(state.fundPlan.month);
  const monthExp = state.fundPlan.records.filter(r=>r.date>=monthMs && r.date<=monthMe && r.type!=="inc").reduce((a,r)=>a+r.amount,0);
  // 今日分类 top3
  const catMap={};
  todayRecs.forEach(r=>{ catMap[r.cat1]=(catMap[r.cat1]||0)+r.amount; });
  const topCats = Object.entries(catMap).map(([id,amt])=>({id,amt})).sort((a,b)=>b.amt-a.amt).slice(0,3);

  return `
  <div class="hero">
    <h2>下午好，漫漫 ☀️</h2>
    <p>${fmtDate(new Date())} · 今天也要闪闪发光呀</p>
  </div>

  <div class="card today-spend">
    <div class="ts-head">
      <h3><span class="ico">💸</span>今日支出总计</h3>
      <button class="btn btn-sm btn-ghost" onclick="go('fund','overview')">去记一笔 →</button>
    </div>
    <div class="ts-main">
      <div class="ts-amount">¥${todayExp.toFixed(2)}</div>
      <div class="ts-meta">
        <div class="ts-row"><span class="muted">笔数</span><b>${todayRecs.length}</b></div>
        <div class="ts-row"><span class="muted">对比昨日</span><b style="color:${diff>=0?'#e25555':'#2e9e5b'}">${diff>=0?'+':''}¥${Math.abs(diff).toFixed(2)} ${diff>0?'↑':diff<0?'↓':'—'}</b></div>
        <div class="ts-row"><span class="muted">月累计支出</span><b>¥${monthExp.toFixed(2)}</b></div>
      </div>
    </div>
    ${topCats.length?`<div class="ts-topcats">${topCats.map(c=>{
      const ci=catInfo(c.id);
      return `<span class="chip" style="background:${ci.color}22;color:${ci.color}">${ci.ico} ${c.id} ¥${c.amt.toFixed(0)}</span>`;
    }).join("")}</div>`:""}
    ${todayRecs.length?`<div class="ts-today-list">${todayRecs.slice(0,5).map(r=>{
      const ci=catInfo(r.cat1);
      return `<div class="ts-item"><span class="ts-ico" style="background:${ci.color}">${ci.ico}</span><span class="ts-title">${esc(r.item||"(未命名)")}</span><span class="ts-time">${r.time||""}</span><span class="ts-amt">-¥${r.amount.toFixed(2)}</span></div>`;
    }).join("")}${todayRecs.length>5?`<div class="ts-more">还有 ${todayRecs.length-5} 笔 · <a onclick="go('fund','overview')" style="cursor:pointer;color:var(--mint-d)">查看全部</a></div>`:""}</div>`
    :`<div class="empty">今天还没有支出，养成记账好习惯 ✨</div>`}
  </div>

  <div class="dash mt-14">
    <div class="card span2">
      <h3><span class="ico">📊</span>今日综合进度</h3>
      <div class="bar-row"><div class="t">总体完成</div><div class="bar"><i style="width:${prog}%"></i></div><div class="v">${prog}%</div></div>
      <div class="bar-row"><div class="t">完成记录</div><div class="bar"><i style="width:${doneToday>0?100:0}%"></i></div><div class="v">${doneToday}项</div></div>
      <div class="bar-row"><div class="t">单词学习</div><div class="bar"><i style="width:${wordDone/20*100}%"></i></div><div class="v">${wordDone}/20</div></div>
      <div class="bar-row"><div class="t">健身打卡</div><div class="bar"><i style="width:${fitMin>0?100:0}%"></i></div><div class="v">${fitMin}′</div></div>
      <button class="btn btn-p btn-block mt-12" onclick="go('tools','rec')">✅ 记一件今天完成的事</button>
    </div>

    <div class="card">
      <h3><span class="ico">🎯</span>英语备考倒计时</h3>
      <div class="countdown">
        <div class="cd-box"><div class="cd-num">${cd.days}</div><div class="cd-lab">天后考试</div></div>
        <div class="cd-box"><div class="cd-num">${cd.label}</div><div class="cd-lab">目标考试</div></div>
      </div>
      <button class="btn btn-ghost btn-block mt-12" onclick="go('english')">进入备考专区 →</button>
    </div>

    <div class="card">
      <h3><span class="ico">🏃</span>健身状态</h3>
      <div class="flex gap-12 wrap">
        <div><div class="cd-num" style="font-size:22px">${fitStreak}</div><div class="cd-lab">连续打卡(天)</div></div>
        <div><div class="cd-num" style="font-size:22px">${fitWeek}</div><div class="cd-lab">本周分钟</div></div>
      </div>
      <button class="btn btn-ghost btn-block mt-12" onclick="go('fitness')">去打卡 →</button>
    </div>

    <div class="card">
      <h3><span class="ico">📱</span>自媒体运营</h3>
      <p class="muted">已管理 <b style="color:var(--ink)">${accCount}</b> 个账号</p>
      <div class="flex gap-8 mt-8 wrap">
        <button class="btn btn-sm" onclick="go('media','hot')">🔥 今日热点</button>
        <button class="btn btn-sm" onclick="go('media','topics')">💡 生成选题</button>
      </div>
    </div>

    <div class="card">
      <h3><span class="ico">💡</span>知识库</h3>
      <p class="muted">摘抄 <b style="color:var(--ink)">${clipCount}</b> 条 · 待读 <b style="color:var(--ink)">${bookTodo}</b> 本</p>
      <button class="btn btn-ghost btn-block mt-8" onclick="go('knowledge')">打开知识库 →</button>
    </div>

    <div class="card">
      <h3><span class="ico">🔔</span>消息提醒</h3>
      <div class="li"><div class="num">1</div><div class="body"><div class="title">艾宾浩斯复习</div><div class="desc">今天有 ${dueReviews(td).length} 个单词待复习</div></div></div>
      <div class="li"><div class="num">2</div><div class="body"><div class="title">健身计划</div><div class="desc">本周已练 ${Math.round(fitWeek/30)} 次</div></div></div>
    </div>
  </div>`;
}

/* ===================== 英语备考 ===================== */
function englishCountdown(){
  const t = new Date(state.english.target);
  const now = new Date();
  const days = daysBetween(today(), state.english.target);
  if (days >= 0) return { days, label: state.english.target.slice(5) };
  return { days:0, label:"已结束" };
}

function dailyWords(date){
  if (state.english.assigned[date]) return state.english.assigned[date];
  const keys = Object.keys(state.english.assigned).sort();
  const start = (keys.length * 20) % WORDS.length;
  const list = [];
  for (let k=0;k<20;k++) list.push({ i:(start+k)%WORDS.length, done:false });
  state.english.assigned[date] = list; save();
  return list;
}

function markWord(i){
  const td = today();
  const list = dailyWords(td);
  const w = list.find(x=>x.i===i);
  if (w) w.done = true;
  if (!state.english.learned.find(x=>x.i===i)) state.english.learned.push({i, date:td});
  const r = state.english.reviews.find(x=>x.i===i);
  if (r) r.next = addDays(td, 1);
  else state.english.reviews.push({i, next:addDays(td,1), round:1});
  save(); go("english", current.sub||"words");
}

function learnedToday(i){
  const td = today();
  const list = dailyWords(td);
  const w = list.find(x=>x.i===i);
  if (w) w.done = true;
  if (!state.english.learned.find(x=>x.i===i)) state.english.learned.push({i, date:td});
  save(); go("english", current.sub||"words");
}

function reviewPass(i, ok){
  const td = today();
  const r = state.english.reviews.find(x=>x.i===i);
  if (ok){
    const gaps = [2,4,7,15,30];
    const idx = Math.min(r?r.round-1:0, gaps.length-1);
    const next = addDays(td, gaps[idx]);
    if (r){ r.round += 1; r.next = next; } else state.english.reviews.push({i, next, round:2});
  } else {
    if (r) r.next = addDays(td, 1); else state.english.reviews.push({i, next:addDays(td,1), round:1});
  }
  save(); go("english", current.sub||"words");
}

function addDays(dateStr, n){
  const d = new Date(dateStr); d.setDate(d.getDate()+n);
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}

function dueReviews(date){
  return state.english.reviews.filter(r => r.next <= date).map(r=>r.i);
}

function sentencesOfDay(date){
  const seed = Math.abs(hashStr(date)) % SENTENCES.length;
  const out = [];
  for (let k=0;k<3;k++) out.push((seed+k)%SENTENCES.length);
  return out;
}
function hashStr(s){ let h=0; for(let i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))>>>0; } return h; }

function viewEnglish(){
  if (!current.sub) current.sub = "overview";
  let body = "";
  if (current.sub==="overview") body = englishOverview();
  else if (current.sub==="words") body = englishWords();
  else if (current.sub==="sentences") body = englishSentences();
  return subNav("english") + body;
}

function englishOverview(){
  const td = today();
  const words = dailyWords(td);
  const wDone = words.filter(w=>w.done).length;
  const rev = dueReviews(td).length;
  const mins = state.english.study[td]||0;
  const cd = englishCountdown();
  return `
  <div class="card">
    <h3><span class="ico">🎯</span>考试倒计时</h3>
    <div class="countdown">
      <div class="cd-box"><div class="cd-num">${cd.days}</div><div class="cd-lab">天后 · ${cd.label}</div></div>
      <div class="cd-box"><div class="cd-num">${wDone}/20</div><div class="cd-lab">今日单词</div></div>
      <div class="cd-box"><div class="cd-num">${rev}</div><div class="cd-lab">待复习</div></div>
      <div class="cd-box"><div class="cd-num">${mins}′</div><div class="cd-lab">学习时长</div></div>
    </div>
    <button class="btn btn-ghost btn-block mt-12" onclick="go('tools','settings')">⚙️ 修改考试目标日期</button>
  </div>
  <div class="card">
    <h3><span class="ico">📖</span>今日速览</h3>
    <button class="btn btn-p btn-block" onclick="go('english','words')">背今日 20 词 →</button>
    <button class="btn btn-ghost btn-block mt-8" onclick="go('english','sentences')">读今日长难句 →</button>
  </div>`;
}

function englishWords(){
  const td = today();
  const words = dailyWords(td);
  const rev = dueReviews(td);
  const reviewWords = rev.map(i=>({i, round:(state.english.reviews.find(r=>r.i===i)||{}).round||1}));
  return `
  <div class="card">
    <h3><span class="ico">🔁</span>艾宾浩斯复习（${reviewWords.length}）</h3>
    ${reviewWords.length? reviewWords.map(w=>`
      <div class="word-card mb-8">
        <div class="flex-between"><div class="w">${esc(WORDS[w.i][0])}</div><span class="chip pink">第${w.round}轮</span></div>
        <div class="m">${esc(WORDS[w.i][1])}</div>
        <div class="flex mt-8 gap-6">
          <button class="btn btn-p btn-sm" onclick="reviewPass(${w.i},true)">✓ 记住了</button>
          <button class="btn btn-ghost btn-sm" onclick="reviewPass(${w.i},false)">再循环</button>
        </div>
      </div>`).join("") : '<div class="empty">今日暂无复习 🎉</div>'}
  </div>
  <div class="card">
    <h3><span class="ico">📝</span>今日 20 词（${words.filter(w=>w.done).length}/20）</h3>
    <div class="word-list">
      ${words.map(w=>`
        <div class="word-card">
          <div class="flex-between"><div class="w">${esc(WORDS[w.i][0])}</div>
            ${w.done?'<span class="chip pink">✓ 已掌握</span>':`<button class="btn btn-p btn-sm" onclick="markWord(${w.i})">掌握</button>`}
          </div>
          <div class="m">${esc(WORDS[w.i][1])}</div>
          <button class="btn btn-ghost btn-sm mt-8" onclick="learnedToday(${w.i})">记一下</button>
        </div>`).join("")}
    </div>
  </div>
  <div class="card">
    <h3><span class="ico">🔍</span>全部词库（${WORDS.length}）</h3>
    <div class="field"><input class="input" id="wordSearch" placeholder="搜索单词或释义…" oninput="renderWordGrid(this.value)"></div>
    <div class="word-list" id="wordGrid"></div>
  </div>`;
}

function renderWordGrid(filter){
  const learnedSet = new Set(state.english.learned.map(x=>x.i));
  const reviewSet = new Set(dueReviews(today()));
  const f = (filter||"").toLowerCase();
  const list = WORDS.map((w,i)=>({w:w[0], m:w[1], i})).filter(x => !f || x.w.toLowerCase().includes(f) || x.m.includes(filter));
  $("wordGrid").innerHTML = list.slice(0,60).map(x=>`
    <div class="word-card">
      <div class="flex-between"><div class="w">${esc(x.w)}</div>
        ${learnedSet.has(x.i)?'<span class="chip pink">✓</span>':reviewSet.has(x.i)?'<span class="chip orange">复习</span>':'<span class="chip">未学</span>'}
      </div>
      <div class="m">${esc(x.m)}</div>
    </div>`).join("") + (list.length>60?`<div class="empty">显示前 60 条，共 ${list.length} 条</div>`:'');
}

function englishSentences(){
  const td = today();
  const idxs = sentencesOfDay(td);
  return `
  <div class="card">
    <h3><span class="ico">📜</span>今日长难句（3 句）</h3>
    ${idxs.map(i=>`
      <div class="sentence">
        <div class="en">${esc(SENTENCES[i][0])}</div>
        <div class="zh">${esc(SENTENCES[i][1])}</div>
        <div class="meta mt-8 f11 muted">💡 ${esc(SENTENCES[i][2])}</div>
      </div>`).join("")}
  </div>
  <div class="card">
    <h3><span class="ico">📚</span>全部长难句（${SENTENCES.length}）</h3>
    ${SENTENCES.map((s,i)=>`
      <div class="sentence">
        <div class="flex-between"><div class="en">${esc(s[0])}</div><span class="chip">#${i+1}</span></div>
        <div class="zh">${esc(s[1])}</div>
        <div class="meta mt-8 f11 muted">💡 ${esc(s[2])}</div>
      </div>`).join("")}
  </div>`;
}

/* 学习计时器 */
let timerInt = null;
function toggleTimer(){
  const td = today();
  if (timerInt){
    clearInterval(timerInt); timerInt=null;
    const mins = Math.round((Date.now()-state.english.timerStart)/60000);
    if (mins>0){ state.english.study[td]=(state.english.study[td]||0)+mins; save(); }
    state.english.timerStart=null; save();
    renderAfter();
  } else {
    state.english.timerStart = Date.now(); save();
    timerInt = setInterval(renderTimerBtn, 1000);
    renderTimerBtn();
  }
}
function renderTimerBtn(){
  const btn = $("timerBtn");
  if (!btn) return;
  if (timerInt){
    const s = Math.floor((Date.now()-state.english.timerStart)/1000);
    const mm = String(Math.floor(s/60)).padStart(2,"0"), ss = String(s%60).padStart(2,"0");
    btn.textContent = "⏸ "+mm+":"+ss;
  } else btn.textContent = "▶ 开始学习";
}
function renderAfter(){ if (current.view==="english") go("english", current.sub); }

/* ===================== 健身 ===================== */
function fitnessStreak(){
  let streak=0; const d=new Date();
  while(true){
    const ds = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    if ((state.fitness.log[ds]||[]).length>0) streak++;
    else if (streak>0) break;
    d.setDate(d.getDate()-1);
    if (streak===0 && d < new Date(Date.now()-400*86400000)) break;
    if (streak>0 && (state.fitness.log[ds]||[]).length===0) break;
  }
  return streak;
}
function fitnessWeekMinutes(){
  let total=0; const d=new Date();
  for (let k=0;k<7;k++){
    const ds = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    total += (state.fitness.log[ds]||[]).reduce((a,b)=>a+b.minutes,0);
    d.setDate(d.getDate()-1);
  }
  return total;
}

function viewFitness(){
  if (!current.sub) current.sub="calendar";
  let body="";
  if (current.sub==="calendar") body=fitnessCalendar();
  else if (current.sub==="plan") body=fitnessPlan();
  else if (current.sub==="stats") body=fitnessStats();
  return subNav("fitness") + body;
}

function fitnessCalendar(){
  const td = today();
  const y = new Date().getFullYear(), m = new Date().getMonth();
  const first = new Date(y,m,1), startW = first.getDay();
  const days = new Date(y,m+1,0).getDate();
  let cells = [];
  ["日","一","二","三","四","五","六"].forEach(w=>cells.push(`<div class="cell wd">${w}</div>`));
  for (let k=0;k<startW;k++) cells.push(`<div class="cell"></div>`);
  for (let d=1;d<=days;d++){
    const ds = y+"-"+String(m+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");
    const rec = state.fitness.log[ds]||[];
    const mins = rec.reduce((a,b)=>a+b.minutes,0);
    const wei = isWeekend(ds)?" wei":"";
    const has = rec.length?` has`:"";
    cells.push(`<div class="cell${wei}${has}" title="${rec.map(r=>r.type+' '+r.minutes+'′').join('; ')}">${d}${mins?`<div class="mins">${mins}′</div>`:""}</div>`);
  }
  return `
  <div class="card">
    <h3><span class="ico">➕</span>记录今日打卡</h3>
    <div class="row2">
      <div class="field"><label>项目</label>
        <select class="select" id="fitType">${FIT_TYPES.map(t=>`<option>${t}</option>`).join("")}</select></div>
      <div class="field"><label>时长(分钟)</label>
        <input class="input" id="fitMin" type="number" value="30" min="1"></div>
    </div>
    <div class="field"><label>备注(可选)</label><input class="input" id="fitNote" placeholder="如：第3组/感受"></div>
    <button class="btn btn-p btn-block" onclick="logFitness()">打卡 ${td}</button>
  </div>
  <div class="card">
    <h3><span class="ico">📅</span>${y}年${m+1}月 打卡日历</h3>
    <div class="cal">${cells.join("")}</div>
    <div class="flex gap-12 mt-12 f12 muted">
      <span><span class="chip">●</span> 已打卡</span><span><span class="chip grey">●</span> 周末</span>
    </div>
  </div>`;
}

function logFitness(){
  const td = today();
  const type = $("fitType").value;
  const minutes = parseInt($("fitMin").value)||0;
  const note = $("fitNote").value||"";
  if (!state.fitness.log[td]) state.fitness.log[td]=[];
  state.fitness.log[td].push({type, minutes, note, id:uid()});
  save(); go("fitness","calendar");
}

function fitnessPlan(){
  return `
  <div class="card">
    <h3><span class="ico">📋</span>训练计划</h3>
    <div id="planList">
      ${state.fitness.plan.length?state.fitness.plan.map((p,i)=>`
        <div class="li"><div class="num">${i+1}</div>
          <div class="body"><div class="title">${esc(p.name)}</div><div class="desc">每周 ${p.days.map(d=>["日","一","二","三","四","五","六"][d]).join("、")} · ${esc(p.note||"")}</div></div>
          <button class="btn btn-sm btn-ghost" onclick="delPlan(${i})">删除</button></div>`).join("")
        :'<div class="empty">还没有计划，添加一条吧</div>'}
    </div>
    <div class="row2 mt-12">
      <div class="field"><label>计划名</label><input class="input" id="planName" placeholder="如：每周三练"></div>
      <div class="field"><label>备注</label><input class="input" id="planNote" placeholder="如：减脂塑形"></div>
    </div>
    <button class="btn btn-p btn-block" onclick="addPlan()">添加计划</button>
  </div>`;
}
function addPlan(){
  const name=$("planName").value.trim(); if(!name) return;
  state.fitness.plan.push({name, note:$("planNote").value, days:[1,3,5]});
  save(); go("fitness","plan");
}
function delPlan(i){ state.fitness.plan.splice(i,1); save(); go("fitness","plan"); }

function fitnessStats(){
  const y=new Date().getFullYear(), m=new Date().getMonth();
  let totalMin=0, count=0; const byType={};
  for (const ds in state.fitness.log){
    if (ds.startsWith(y+"-"+String(m+1).padStart(2,"0"))){
      state.fitness.log[ds].forEach(r=>{ totalMin+=r.minutes; count++; byType[r.type]=(byType[r.type]||0)+r.minutes; });
    }
  }
  const maxType = Object.entries(byType).sort((a,b)=>b[1]-a[1])[0];
  const dist = Object.entries(byType);
  return `
  <div class="card">
    <h3><span class="ico">📈</span>本月统计（${m+1}月）</h3>
    <div class="flex gap-12 wrap">
      <div class="cd-box"><div class="cd-num">${totalMin}</div><div class="cd-lab">总分钟</div></div>
      <div class="cd-box"><div class="cd-num">${count}</div><div class="cd-lab">打卡次数</div></div>
      <div class="cd-box"><div class="cd-num">${maxType?maxType[0]:"—"}</div><div class="cd-lab">主练项目</div></div>
    </div>
    <h3 class="mt-16"><span class="ico">🥧</span>项目时长分布</h3>
    ${dist.length?dist.map(([t,min])=>`
      <div class="bar-row"><div class="t">${t}</div><div class="bar"><i style="width:${Math.round(min/totalMin*100)}%"></i></div><div class="v">${min}′</div></div>`).join("")
      :'<div class="empty">本月暂无数据</div>'}
  </div>`;
}

/* ===================== 自媒体运营 ===================== */
function viewMedia(){
  if (!current.sub) current.sub="accounts";
  const tabs=[["accounts","账号"],["hot","热点速报"],["topics","选题生成"],["data","数据录入"],["month","月度报"],["quarter","季度报"]];
  let body="";
  if (current.sub==="accounts") body=mediaAccounts();
  else if (current.sub==="hot") body=mediaHot();
  else if (current.sub==="topics") body=mediaTopics();
  else if (current.sub==="data") body=mediaData();
  else if (current.sub==="month") body=mediaMonth();
  else if (current.sub==="quarter") body=mediaQuarter();
  return subNav("media") + body;
}

function mediaAccounts(){
  return `
  <div class="card">
    <h3><span class="ico">📱</span>我的账号（${state.media.accounts.length}）</h3>
    ${state.media.accounts.length?state.media.accounts.map((a,i)=>`
      <div class="li"><div class="num">${i+1}</div>
        <div class="body"><div class="title">${esc(a.name)} <span class="chip">${esc(a.platform)}</span></div>
          <div class="desc">定位：${esc(a.domain||"未填")} · 粉丝 ${esc(a.fans||0)} · ${esc(a.status||"运营中")}</div></div>
        <button class="btn btn-sm btn-ghost" onclick="delAccount(${i})">删</button></div>`).join("")
      :'<div class="empty">还没有账号，添加你运营的平台账号</div>'}
    <div class="row2 mt-12">
      <div class="field"><label>平台</label><select class="select" id="accPlat">${PLATFORMS.map(p=>`<option>${p}</option>`).join("")}</select></div>
      <div class="field"><label>账号名</label><input class="input" id="accName" placeholder="如：漫漫的旅行日记"></div>
    </div>
    <div class="field"><label>内容定位</label><input class="input" id="accDomain" placeholder="如：职场成长/好物分享"></div>
    <div class="row2">
      <div class="field"><label>粉丝数</label><input class="input" id="accFans" type="number" value="0"></div>
      <div class="field"><label>状态</label><input class="input" id="accStatus" placeholder="运营中/筹备中"></div>
    </div>
    <button class="btn btn-p btn-block" onclick="addAccount()">添加账号</button>
  </div>`;
}
function addAccount(){
  const name=$("accName").value.trim(); if(!name) return;
  state.media.accounts.push({id:uid(), platform:$("accPlat").value, name, domain:$("accDomain").value, fans:parseInt($("accFans").value)||0, status:$("accStatus").value||"运营中"});
  save(); go("media","accounts");
}
function delAccount(i){ state.media.accounts.splice(i,1); save(); go("media","accounts"); }

function mediaHot(){
  const td=today();
  const blocks = HOT_SOURCES.map(s=>{
    const pool = HOT_POOL[s.key]||["暂无热点"];
    const list = pool.map((h,i)=>`${i+1}. ${h}`).join("\n");
    return {name:s.name, color:s.color, list};
  });
  const report = blocks.map(b=>`【${b.name}】\n${b.list}`).join("\n\n");
  return `
  <div class="card">
    <h3><span class="ico">🔥</span>${td} 各平台热点速报</h3>
    <div class="flex gap-8 wrap mb-8">
      <button class="btn btn-p btn-sm" onclick="copyText('hotReport')">📋 复制速报</button>
      <span class="chip">按日期智能轮换</span>
    </div>
    <div id="hotReport" style="white-space:pre-wrap;font-size:13px;line-height:1.7">${esc(report)}</div>
  </div>`;
}

function mediaTopics(){
  const td=today();
  if (!state.media.accounts.length){
    return `<div class="card"><div class="empty">请先在「账号」里添加账号并填写「内容定位」，选题会更精准 🙌</div>
      <button class="btn btn-p mt-12" onclick="go('media','accounts')">去添加账号</button></div>`;
  }
  const seed = Math.abs(hashStr(td));
  let rows=[];
  state.media.accounts.forEach(acc=>{
    HOT_SOURCES.slice(0,3).forEach((s,k)=>{
      const pool = HOT_POOL[s.key]||["热点"];
      const hot = pool[(seed+k)%pool.length];
      const tpl = TOPIC_TEMPLATES[(seed+k)%TOPIC_TEMPLATES.length];
      const angle = tpl.replace("{hot}",hot).replace("{domain}",acc.domain||"内容");
      rows.push({acc:acc.name, hot, angle});
    });
  });
  rows.forEach((r,i)=>{ if(!state.media.topics.find(t=>t.acc===r.acc&&t.hot===r.hot)) state.media.topics.push({date:td, acc:r.acc, hot:r.hot, angle:r.angle, used:false, id:uid()}); });
  save();
  const items = state.media.topics.filter(t=>t.date===td);
  return `
  <div class="card">
    <h3><span class="ico">💡</span>${td} 选题建议（${items.length}）</h3>
    <div class="flex gap-8 wrap mb-8">
      <button class="btn btn-p btn-sm" onclick="exportTopics()">⬇️ 导出 CSV</button>
    </div>
    <div class="table-wrap">
      <table><thead><tr><th>账号</th><th>热点</th><th>选题角度</th><th></th></tr></thead><tbody>
        ${items.map(t=>`<tr><td>${esc(t.acc)}</td><td>${esc(t.hot)}</td><td>${esc(t.angle)}</td>
          <td><button class="btn btn-sm ${t.used?'btn-ghost':'btn-p'}" onclick="toggleTopic('${t.id}')">${t.used?'已用':'标记'}</button></td></tr>`).join("")}
      </tbody></table>
    </div>
  </div>`;
}
function toggleTopic(id){
  const t=state.media.topics.find(x=>x.id===id); if(t){ t.used=!t.used; save(); go("media","topics"); }
}
function exportTopics(){
  const td=today();
  const items=state.media.topics.filter(t=>t.date===td);
  const csv="账号,热点,选题角度,已用\n"+items.map(t=>`"${t.acc}","${t.hot}","${t.angle}",${t.used?"是":"否"}`).join("\n");
  downloadFile("选题-"+td+".csv", csv, "text/csv");
}

function mediaData(){
  const td=today();
  const accs=state.media.accounts;
  if(!accs.length) return `<div class="card"><div class="empty">先添加账号才能录数据</div><button class="btn btn-p mt-12" onclick="go('media','accounts')">去添加</button></div>`;
  const day=state.media.data[td]||{};
  return `
  <div class="card">
    <h3><span class="ico">📊</span>${td} 数据录入</h3>
    <div class="field"><label>选择账号</label><select class="select" id="dataAcc">${accs.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select></div>
    <div class="row2">
      <div class="field"><label>播放/阅读</label><input class="input" id="dViews" type="number" value="0"></div>
      <div class="field"><label>新增粉丝</label><input class="input" id="dFans" type="number" value="0"></div>
    </div>
    <div class="row2">
      <div class="field"><label>点赞</label><input class="input" id="dLikes" type="number" value="0"></div>
      <div class="field"><label>评论</label><input class="input" id="dComments" type="number" value="0"></div>
    </div>
    <button class="btn btn-p btn-block" onclick="saveData()">保存今日数据</button>
  </div>
  <div class="card">
    <h3><span class="ico">📈</span>近 14 天趋势（播放/阅读）</h3>
    <div id="trendBox">${mediaTrend()}</div>
  </div>`;
}
function saveData(){
  const td=today();
  const id=$("dataAcc").value;
  const rec={views:parseInt($("dViews").value)||0, fans:parseInt($("dFans").value)||0, likes:parseInt($("dLikes").value)||0, comments:parseInt($("dComments").value)||0};
  if(!state.media.data[td]) state.media.data[td]={};
  state.media.data[td][id]=rec; save(); go("media","data");
}
function mediaTrend(){
  const id = state.media.accounts[0] ? state.media.accounts[0].id : null;
  if(!id) return '<div class="empty">暂无数据</div>';
  const arr=[]; const d=new Date();
  for(let k=13;k>=0;k--){ const x=new Date(d); x.setDate(d.getDate()-k); const ds=x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0"); arr.push({ds, v:(state.media.data[ds]&&state.media.data[ds][id])?state.media.data[ds][id].views:0}); }
  const max=Math.max(1,...arr.map(a=>a.v));
  return `<div style="display:flex;align-items:flex-end;gap:4px;height:120px">`+
    arr.map(a=>`<div title="${a.ds}:${a.v}" style="flex:1;height:${Math.round(a.v/max*100)}%;background:var(--mint);border-radius:4px 4px 0 0;min-height:2px"></div>`).join("")+
    `</div><div class="flex gap-6 f11 muted mt-8 wrap">${arr.map(a=>`<span style="flex:1;text-align:center">${a.ds.slice(5)}</span>`).join("")}</div>`;
}

function mediaMonth(){
  const y=new Date().getFullYear(), m=new Date().getMonth();
  const prefix=y+"-"+String(m+1).padStart(2,"0");
  let rows=state.media.accounts.map(a=>{
    let views=0,fans=0,likes=0,comments=0,days=0;
    for(const ds in state.media.data){ if(ds.startsWith(prefix)&&state.media.data[ds][a.id]){ const r=state.media.data[ds][a.id]; views+=r.views; fans+=r.fans; likes+=r.likes; comments+=r.comments; days++; } }
    return {name:a.name, views, fans, likes, comments, days};
  });
  return `<div class="card"><h3><span class="ico">🗓</span>${m+1}月 各账号汇总</h3>
    <div class="table-wrap"><table><thead><tr><th>账号</th><th>天数</th><th>总播放</th><th>总涨粉</th><th>总赞</th><th>总评</th></tr></thead>
    <tbody>${rows.map(r=>`<tr><td>${esc(r.name)}</td><td>${r.days}</td><td>${r.views}</td><td>${r.fans}</td><td>${r.likes}</td><td>${r.comments}</td></tr>`).join("")}</tbody></table></div>
    <button class="btn btn-p btn-sm mt-12" onclick="exportMonthCSV()">⬇️ 导出月度 CSV</button>
  </div>`;
}
function exportMonthCSV(){
  const y=new Date().getFullYear(), m=new Date().getMonth();
  const prefix=y+"-"+String(m+1).padStart(2,"0");
  let rows=state.media.accounts.map(a=>{
    let views=0,fans=0,likes=0,comments=0,days=0;
    for(const ds in state.media.data){ if(ds.startsWith(prefix)&&state.media.data[ds][a.id]){ const r=state.media.data[ds][a.id]; views+=r.views; fans+=r.fans; likes+=r.likes; comments+=r.comments; days++; } }
    return [a.name,days,views,fans,likes,comments];
  });
  const csv="账号,天数,总播放,总涨粉,总赞,总评\n"+rows.map(r=>r.join(",")).join("\n");
  downloadFile("月度报-"+(m+1)+"月.csv", csv, "text/csv");
}
function mediaQuarter(){
  const d=new Date(); const q=Math.floor(d.getMonth()/3)+1; const y=d.getFullYear();
  const months=[0,1,2].map(i=>(q-1)*3+i).map(mo=>String(mo+1).padStart(2,"0"));
  let rows=state.media.accounts.map(a=>{
    let views=0,fans=0,likes=0,comments=0;
    for(const ds in state.media.data){ if(months.some(mo=>ds.startsWith(y+"-"+mo))&&state.media.data[ds][a.id]){ const r=state.media.data[ds][a.id]; views+=r.views; fans+=r.fans; likes+=r.likes; comments+=r.comments; } }
    return {name:a.name, views, fans, likes, comments};
  });
  return `<div class="card"><h3><span class="ico">📑</span>${y}年 Q${q} 季度报表</h3>
    <div class="table-wrap"><table><thead><tr><th>账号</th><th>总播放</th><th>总涨粉</th><th>总赞</th><th>总评</th></tr></thead>
    <tbody>${rows.map(r=>`<tr><td>${esc(r.name)}</td><td>${r.views}</td><td>${r.fans}</td><td>${r.likes}</td><td>${r.comments}</td></tr>`).join("")}</tbody></table></div>
    <button class="btn btn-p btn-sm mt-12" onclick="alert('季度报已生成，可截图或手动记录')">📸 截图保存</button>
  </div>`;
}

/* ===================== 知识库 ===================== */
function viewKnowledge(){
  if (!current.sub) current.sub="clips";
  const tabs=[["clips","摘抄"],["books","书单"],["ai","AI书友"],["finance","理财课"]];
  let body="";
  if (current.sub==="clips") body=knClips();
  else if (current.sub==="books") body=knBooks();
  else if (current.sub==="ai") body=knAI();
  else if (current.sub==="finance") body=knFinance();
  return subNav("knowledge") + body;
}

function knClips(){
  return `
  <div class="card">
    <h3><span class="ico">✍️</span>摘抄知识库（${state.knowledge.clips.length}）</h3>
    <div class="field"><label>内容</label><textarea class="textarea" id="clipText" placeholder="粘贴一段打动你的话…"></textarea></div>
    <div class="row2">
      <div class="field"><label>标签</label><input class="input" id="clipTag" placeholder="如：成长/金句"></div>
      <div class="field"><label>来源</label><input class="input" id="clipSrc" placeholder="书名/作者/出处"></div>
    </div>
    <button class="btn btn-p btn-block" onclick="addClip()">保存摘抄</button>
  </div>
  <div class="card">
    <h3><span class="ico">📚</span>我的摘抄</h3>
    <div class="field"><input class="input" id="clipSearch" placeholder="搜索摘抄/标签…" oninput="renderClips(this.value)"></div>
    <div id="clipList"></div>
  </div>`;
}
function addClip(){
  const text=$("clipText").value.trim(); if(!text) return;
  state.knowledge.clips.unshift({id:uid(), text, tag:$("clipTag").value.trim(), src:$("clipSrc").value.trim(), date:today()});
  save(); go("knowledge","clips");
}
function renderClips(filter){
  const f=(filter||"").toLowerCase();
  const list=state.knowledge.clips.filter(c=>!f||c.text.toLowerCase().includes(f)||(c.tag||"").toLowerCase().includes(f));
  $("clipList").innerHTML = list.length?list.map(c=>`
    <div class="li"><div class="body"><div class="title" style="font-weight:500">${esc(c.text)}</div>
      <div class="desc">${c.tag?`<span class="chip">${esc(c.tag)}</span> `:""}${esc(c.src||"")} · ${esc(c.date)}</div></div>
      <button class="btn btn-sm btn-ghost" onclick="delClip('${c.id}')">删</button></div>`).join("")
    : '<div class="empty">还没有摘抄</div>';
}
function delClip(id){ state.knowledge.clips=state.knowledge.clips.filter(c=>c.id!==id); save(); renderClips($("clipSearch")?$("clipSearch").value:""); }

function knBooks(){
  return `
  <div class="card">
    <h3><span class="ico">📖</span>书单（${state.knowledge.books.length}）</h3>
    <div class="row2">
      <div class="field"><label>书名</label><input class="input" id="bkTitle" placeholder="如：被讨厌的勇气"></div>
      <div class="field"><label>作者</label><input class="input" id="bkAuthor" placeholder="作者"></div>
    </div>
    <div class="field"><label>状态</label><select class="select" id="bkStatus"><option>想读</option><option>在读</option><option>读完</option></select></div>
    <button class="btn btn-p btn-block" onclick="addBook()">加入书单</button>
  </div>
  <div class="card">
    <h3><span class="ico">🗂</span>列表</h3>
    ${state.knowledge.books.length?state.knowledge.books.map((b,i)=>`
      <div class="li"><div class="num">${i+1}</div><div class="body"><div class="title">${esc(b.title)} <span class="chip">${esc(b.status)}</span></div><div class="desc">${esc(b.author||"")}</div></div>
      <select class="select" style="width:auto" onchange="setBookStatus('${b.id}',this.value)">${["想读","在读","读完"].map(s=>`<option ${b.status===s?"selected":""}>${s}</option>`).join("")}</select></div>`).join("")
      :'<div class="empty">书单空空，加一本吧</div>'}
  </div>`;
}
function addBook(){ const t=$("bkTitle").value.trim(); if(!t) return; state.knowledge.books.push({id:uid(), title:t, author:$("bkAuthor").value, status:$("bkStatus").value}); save(); go("knowledge","books"); }
function setBookStatus(id,v){ const b=state.knowledge.books.find(x=>x.id===id); if(b){ b.status=v; save(); renderNav(); } }

function knAI(){
  return `
  <div class="card">
    <h3><span class="ico">💬</span>AI 书友 · 探讨窗口</h3>
    <p class="muted f12">把读到的内容贴进来，和 AI 深度探讨。配了 API Key（设置里）可真对话，没配也能用引导模式。</p>
    <div class="field"><label>贴一段书里的内容 / 你的想法</label><textarea class="textarea" id="aiBookText" placeholder="如：书里说'课题分离'——把自己的课题和别人的课题分开…"></textarea></div>
    <button class="btn btn-p btn-block" onclick="aiBookTalk()">开始探讨</button>
    <div id="bookTalk" class="mt-12"></div>
    <h3 class="mt-16"><span class="ico">🎲</span>引导问题</h3>
    <div class="flex gap-6 wrap" id="bookPrompts"></div>
  </div>`;
}
function aiBookTalk(){
  const text=$("aiBookText").value.trim(); if(!text) return;
  const prompts=LOCAL_PROMPTS;
  const html = `<div class="bubble ai"><div class="who">小顾</div>收到～结合你贴的内容，我们可以从这几个角度深聊：<br>`+
    prompts.slice(0,3).map(p=>`· ${esc(p)}`).join("<br>")+`</div>`;
  $("bookTalk").innerHTML = html;
  renderBookPrompts();
}
function renderBookPrompts(){
  $("bookPrompts").innerHTML = LOCAL_PROMPTS.map(p=>`<button class="chip" onclick="alert('${esc(p)}')">${esc(p.slice(0,12))}…</button>`).join("");
}

function knFinance(){
  return `
  <div class="card">
    <h3><span class="ico">🎓</span>基金入门 12 课（${state.finance.coursesDone.length}/12）</h3>
    ${FUND_LESSONS.map((c,i)=>`
      <div class="li"><div class="num">${state.finance.coursesDone.includes(i)?"✓":i+1}</div>
        <div class="body"><div class="title">${esc(c.t)}</div><div class="desc">${esc(c.c)}</div></div>
        <button class="btn btn-sm ${state.finance.coursesDone.includes(i)?'btn-ghost':'btn-p'}" onclick="toggleCourse(${i})">${state.finance.coursesDone.includes(i)?'取消':'学完'}</button></div>`).join("")}
  </div>`;
}
function toggleCourse(i){ const a=state.finance.coursesDone; const k=a.indexOf(i); if(k>=0)a.splice(k,1); else a.push(i); save(); go("knowledge","finance"); }

function knSalary(){
  const s=state.finance.salary, a=state.finance.alloc;
  const sum=a.living+a.save+a.invest+a.fun;
  const parts=[["living","生活","a.living"],["save","储蓄","a.save"],["invest","投资","a.invest"],["fun","享乐","a.fun"]];
  return `
  <div class="card">
    <h3><span class="ico">💰</span>工资规划</h3>
    <p class="muted f12">工资规划已移至「资金规划」二级目录下的「工资规划」模块，便于和日常收支、基金报表一起统筹。👇</p>
    <button class="btn btn-p btn-block mt-12" onclick="go('fund','salary')">前往「资金规划 · 工资规划」→</button>
  </div>`;
}

/* 资金规划 / 工资规划（实际渲染由资金规划模块加载） */
function fpSalary(){
  const s=state.finance.salary, a=state.finance.alloc;
  const sum=a.living+a.save+a.invest+a.fun;
  const parts=[["living","生活","a.living"],["save","储蓄","a.save"],["invest","投资","a.invest"],["fun","享乐","a.fun"]];
  return `
  <div class="card">
    <h3><span class="ico">💵</span>工资规划</h3>
    <p class="muted f12">按月收入拆分「生活 / 储蓄 / 投资 / 享乐」四笔钱，自动换算金额与环形比例。</p>
    <div class="field"><label>月收入（元）</label><input class="input" id="salary" type="number" value="${s}" oninput="updateSalary()"></div>
    <div class="field"><label>分配比例（当前合计 ${sum}%）</label>
      ${parts.map(p=>`<div class="bar-row"><div class="t">${p[1]}</div><div class="bar"><input type="range" min="0" max="100" value="${a[p[0]]}" style="width:100%" oninput="setAlloc('${p[0]}',this.value)"></div><div class="v">${a[p[0]]}%</div></div>`).join("")}
    </div>
    <div class="mt-12" id="allocResult">${salaryResult()}</div>
    <div class="mt-12 muted f12">合计 ${sum}% ${sum===100?"✓":"⚠️ 应等于 100%"}</div>
  </div>`;
}
function setAlloc(key,v){ state.finance.alloc[key]=parseInt(v)||0; save(); $("allocResult").innerHTML=salaryResult();
  const parts=["living","save","invest","fun"]; document.querySelectorAll('.bar-row .v').forEach((el,idx)=>{ if(parts[idx]) el.textContent=state.finance.alloc[parts[idx]]+"%"; }); }
function updateSalary(){ const v=parseInt($("salary").value)||0; state.finance.salary=v; save(); if($("allocResult"))$("allocResult").innerHTML=salaryResult(); }
function salaryResult(){
  const s=state.finance.salary, a=state.finance.alloc;
  const segs=[["生活",a.living,"#9ed1a8"],["储蓄",a.save,"#7fc093"],["投资",a.invest,"#f7c6d0"],["享乐",a.fun,"#ffd6a5"]];
  const cones=segs.map((x,i)=>`${x[2]} ${segs.slice(0,i).reduce((t,y)=>t+y[1],0)}% ${segs.slice(0,i).reduce((t,y)=>t+y[1],0)+x[1]}%`).join(",");
  return `<div style="display:flex;gap:8px;flex-wrap:wrap">`+
    segs.map(x=>`<div style="background:${x[2]};color:#fff;border-radius:10px;padding:8px 12px"><div style="font-size:11px;opacity:.9">${x[0]}</div><div style="font-weight:800">¥${Math.round(s*x[1]/100)}</div><div style="font-size:10px">${x[1]}%</div></div>`).join("")+
    `</div><div class="mt-12" style="height:14px;border-radius:8px;background:conic-gradient(${cones})"></div>`;
}

/* ===================== 日历日程 ===================== */
const schCurrentDate = { day: today(), week: today(), month: today().slice(0,7) };

function viewSchedule(){
  if(!current.sub) current.sub="day";
  let body="";
  if(current.sub==="day") body=schDay();
  else if(current.sub==="week") body=schWeek();
  else if(current.sub==="month") body=schMonth();
  return subNav("schedule") + schQuickAdd() + body;
}

function schQuickAdd(){
  return `<div class="card sch-quick">
    <h3><span class="ico">✨</span>智能添加（自然语言 / 小顾对话）</h3>
    <p class="muted f12">说人话就行：「明天下午3点开周会」「下周一上午10点约牙医」「今晚8点跑步30分钟」。也可在小顾对话里直接说，刷新后就会出现在这里。</p>
    <div class="field"><input class="input" id="schNL" placeholder="例：明天下午3点开周会" onkeydown="if(event.key==='Enter')schNLParse()"></div>
    <button class="btn btn-p btn-block" onclick="schNLParse()">✨ 智能解析添加</button>
  </div>`;
}

function schNLParse(){
  const text = (($("schNL")||{}).value||"").trim();
  if(!text){ alert("请输入内容"); return; }
  const r = parseNLSchedule(text);
  addScheduleItem({date:r.date, time:r.time, title:r.title, note:text});
  $("schNL").value="";
  go("schedule", current.sub||"day");
}

/* 自然语言解析 → {date,time,title} */
function parseNLSchedule(text){
  const t = new Date();
  let date = today();
  let time = "";
  const offset = (w)=>{ const cur = t.getDay(); let d = (w - cur + 7) % 7; if(d===0) d = 7; return d; };
  if(/今天/.test(text)) date = today();
  else if(/大后天/.test(text)) date = addDays(today(),3);
  else if(/后天/.test(text)) date = addDays(today(),2);
  else if(/明天/.test(text)) date = addDays(today(),1);
  else if(/今晚/.test(text)){ date = today(); time = "20:00"; }
  else if(/明晚/.test(text)){ date = addDays(today(),1); time = "20:00"; }
  else if(/明早|明天上午/.test(text)){ date = addDays(today(),1); time = "09:00"; }
  else if(/明天下午/.test(text)){ date = addDays(today(),1); time = "14:00"; }
  else if(/下周日|下周天/.test(text)) date = addDays(today(), offset(0));
  else if(/下周六/.test(text)) date = addDays(today(), offset(6));
  else if(/下周五/.test(text)) date = addDays(today(), offset(5));
  else if(/下周四/.test(text)) date = addDays(today(), offset(4));
  else if(/下周三/.test(text)) date = addDays(today(), offset(3));
  else if(/下周二/.test(text)) date = addDays(today(), offset(2));
  else if(/下周一/.test(text)) date = addDays(today(), offset(1));
  else if(/周[日天]/.test(text)) date = addDays(today(), offset(0));
  else if(/周六/.test(text)) date = addDays(today(), offset(6));
  else if(/周五/.test(text)) date = addDays(today(), offset(5));
  else if(/周四/.test(text)) date = addDays(today(), offset(4));
  else if(/周三/.test(text)) date = addDays(today(), offset(3));
  else if(/周二/.test(text)) date = addDays(today(), offset(2));
  else if(/周一/.test(text)) date = addDays(today(), offset(1));
  // 绝对日期
  let m = text.match(/(\d{4})[-\/年](\d{1,2})[-\/月](\d{1,2})/);
  if(m) date = m[1]+"-"+m[2].padStart(2,"0")+"-"+m[3].padStart(2,"0");
  else if((m = text.match(/(\d{1,2})月(\d{1,2})[日号]/))) date = t.getFullYear()+"-"+m[1].padStart(2,"0")+"-"+m[2].padStart(2,"0");
  // 时间
  m = text.match(/(上午|下午|早上|晚上|凌晨|中午)?\s?(\d{1,2})[：:点](\d{1,2})?\s?分?/);
  if(m){
    let h = parseInt(m[2]); const mn = m[3] ? parseInt(m[3]) : 0;
    const pd = m[1];
    if(pd==="下午"||pd==="晚上"||pd==="中午"){ if(h<12) h+=12; }
    else if(pd==="凌晨"||pd==="早上"||pd==="上午"){ if(h===12) h=0; }
    time = String(h).padStart(2,"0")+":"+String(mn).padStart(2,"0");
  }
  // 标题
  let title = text
    .replace(/(今天|明天|后天|大后天|今晚|明晚|明早|明上午|明下午|这周|下周)/g,"")
    .replace(/周[一二三四五六日天]/g,"")
    .replace(/\d{4}[-\/年]\d{1,2}[-\/月]\d{1,2}[日号]?/g,"")
    .replace(/\d{1,2}月\d{1,2}[日号]/g,"")
    .replace(/(上午|下午|早上|晚上|凌晨|中午)\d{1,2}[：:点](\d{1,2})?分?/g,"")
    .replace(/\d{1,2}[：:点]\d{1,2}分?/g,"")
    .replace(/^[，。、 ]+|[，。、 ]+$/g,"")
    .trim();
  if(!title) title = "未命名日程";
  return {date, time, title};
}

/* 日视图 */
function schDay(){
  if(!schCurrentDate.day) schCurrentDate.day = today();
  const date = schCurrentDate.day;
  const items = state.schedule.items.filter(i=>i.date===date).sort((a,b)=>(a.time||"99:99").localeCompare(b.time||"99:99"));
  const total = items.length, done = items.filter(i=>i.done).length;
  return `
    <div class="sch-bar">
      <button class="fp-arrow" onclick="schShiftDate('day',-1)">‹</button>
      <div class="sch-date">${date} · 周${["日","一","二","三","四","五","六"][new Date(date).getDay()]}${date===today()?'（今天）':''}</div>
      <button class="fp-arrow" onclick="schShiftDate('day',1)">›</button>
      <input type="date" class="input sch-date-input" value="${date}" onchange="schCurrentDate.day=this.value;go('schedule','day')">
    </div>
    <div class="card">
      <h3><span class="ico">📋</span>${date} 的日程（${total} 项 · 已完成 ${done}）</h3>
      <div class="field"><input class="input" id="schNew" placeholder="快速加一条，回车保存" onkeydown="if(event.key==='Enter')schAddByInput()"></div>
      <button class="btn btn-p btn-block" onclick="schAddByInput()">添加日程</button>
      <div class="sch-list mt-12">
        ${items.length?items.map(it=>schItemHTML(it)).join(""):'<div class="empty">今天没有日程，休息一下 ☕</div>'}
      </div>
    </div>
  `;
}
function schAddByInput(){
  const v = (($("schNew")||{}).value||"").trim();
  if(!v) return;
  addScheduleItem({date: schCurrentDate.day, time:"", title:v, note:""});
  $("schNew").value="";
  go("schedule","day");
}

/* 周视图 */
function schWeek(){
  if(!schCurrentDate.week) schCurrentDate.week = today();
  const [ms,me] = weekRange(schCurrentDate.week);
  const days = []; let cur = new Date(ms);
  for(let k=0;k<7;k++){ days.push(cur.toISOString().slice(0,10)); cur.setDate(cur.getDate()+1); }
  const total = state.schedule.items.filter(i=>i.date>=ms && i.date<=me).length;
  return `
    <div class="sch-bar">
      <button class="fp-arrow" onclick="schShiftDate('week',-7)">‹</button>
      <div class="sch-date">${ms} ~ ${me} · 共 ${total} 项</div>
      <button class="fp-arrow" onclick="schShiftDate('week',7)">›</button>
      <button class="btn btn-sm" onclick="schCurrentDate.week=today();go('schedule','week')">回到本周</button>
    </div>
    <div class="card">
      <div class="sch-week">
        ${days.map(d=>{
          const items = state.schedule.items.filter(i=>i.date===d).sort((a,b)=>(a.time||"99:99").localeCompare(b.time||"99:99"));
          const isToday = d===today();
          return `<div class="sch-wday ${isToday?'today':''}" onclick="schJumpToDate('day','${d}')">
            <div class="sch-wd-head"><span>${d.slice(5)}</span><span>周${["日","一","二","三","四","五","六"][new Date(d).getDay()]}</span></div>
            ${items.length?items.map(it=>`<div class="sch-wd-item ${it.done?'done':''}"><span class="wd-t">${it.time||"·"}</span><span class="wd-tx">${esc(it.title)}</span></div>`).join(""):'<div class="wd-empty">— 空 —</div>'}
          </div>`;
        }).join("")}
      </div>
    </div>
  `;
}

/* 月视图 */
function schMonth(){
  if(!schCurrentDate.month) schCurrentDate.month = today().slice(0,7);
  const [y,mm] = schCurrentDate.month.split("-").map(Number);
  const first = new Date(y,mm-1,1);
  const days = new Date(y,mm,0).getDate();
  const startW = first.getDay();
  const byDay = {};
  state.schedule.items.forEach(i=>{ if(i.date.startsWith(schCurrentDate.month)){ (byDay[i.date]=byDay[i.date]||[]).push(i); } });
  const cells = [];
  ["日","一","二","三","四","五","六"].forEach(w=>cells.push(`<div class="sch-wd-cell">${w}</div>`));
  for(let k=0;k<startW;k++) cells.push(`<div class="sch-md-cell empty"></div>`);
  const totalMonth = state.schedule.items.filter(i=>i.date.startsWith(schCurrentDate.month)).length;
  for(let d=1;d<=days;d++){
    const ds = `${schCurrentDate.month}-${String(d).padStart(2,"0")}`;
    const items = byDay[ds]||[];
    const done = items.filter(i=>i.done).length;
    const isToday = ds===today();
    const ratio = items.length? done/items.length : 0;
    cells.push(`<div class="sch-md-cell ${items.length?'has':''} ${isToday?'today':''}" onclick="schJumpToDate('day','${ds}')">
      <div class="md-num">${d}</div>
      ${items.length?`<div class="md-cnt">${done}/${items.length}</div><div class="md-bar"><i style="width:${Math.round(ratio*100)}%"></i></div>`:''}
    </div>`);
  }
  return `
    <div class="sch-bar">
      <button class="fp-arrow" onclick="schShiftMonth(-1)">‹</button>
      <div class="sch-date">${y}年${mm}月 · 共 ${totalMonth} 项</div>
      <button class="fp-arrow" onclick="schShiftMonth(1)">›</button>
      <button class="btn btn-sm" onclick="schCurrentDate.month=today().slice(0,7);go('schedule','month')">回到本月</button>
    </div>
    <div class="card">
      <div class="sch-month">
        ${cells.join("")}
      </div>
      <div class="mt-12 muted f12">绿=已完成比例 · 点击日期跳到日视图</div>
    </div>
  `;
}

function schShiftMonth(d){
  const [y,mm] = schCurrentDate.month.split("-").map(Number);
  let nm = mm + d; let ny = y;
  if(nm<1){nm=12;ny--;} if(nm>12){nm=1;ny++;}
  schCurrentDate.month = `${ny}-${String(nm).padStart(2,"0")}`;
  go("schedule","month");
}
function schShiftDate(view, delta){
  const cur = schCurrentDate[view];
  if(view==="day") schCurrentDate.day = addDays(cur, delta);
  else if(view==="week") schCurrentDate.week = addDays(cur, delta);
  go("schedule", view);
}
function schJumpToDate(view, val){
  schCurrentDate[view] = val;
  current.sub = view;
  go("schedule", view);
}

/* 列表项 HTML（已完成划横杠但仍显示） */
function schItemHTML(it){
  return `<div class="sch-item ${it.done?'is-done':''}">
    <button class="sch-check ${it.done?'on':''}" onclick="toggleScheduleItem('${it.id}')" aria-label="完成">${it.done?'✓':''}</button>
    <div class="sch-body">
      <div class="sch-title">${esc(it.title)}</div>
      <div class="sch-meta">${it.time?`<span>⏰ ${it.time}</span>`:''}${it.note?`<span>📝 ${esc((it.note||"").slice(0,60))}</span>`:''}</div>
    </div>
    <button class="btn btn-sm btn-ghost" onclick="delScheduleItem('${it.id}')">删</button>
  </div>`;
}

/* 全局 CRUD（也供 window.WB 调用） */
function addScheduleItem({date, time, title, note}){
  if(!date) date = today();
  if(!title) return null;
  const it = {id:uid(), date, time:time||"", title:String(title).slice(0,200), note:note?String(note).slice(0,500):"", done:false, createdAt:Date.now()};
  state.schedule.items.push(it); save();
  return it;
}
function toggleScheduleItem(id){
  const it = state.schedule.items.find(x=>x.id===id);
  if(!it) return;
  it.done = !it.done;
  save();
  go("schedule", current.sub||"day");
}
function delScheduleItem(id){
  state.schedule.items = state.schedule.items.filter(x=>x.id!==id);
  save();
  go("schedule", current.sub||"day");
}

/* ===================== 资金规划 ===================== */
function viewFund(){
  if(!current.sub) current.sub="overview";
  let body="";
  if(current.sub==="overview") body=fpOverview();
  else if(current.sub==="category") body=fpCategory();
  else if(current.sub==="calendar") body=fpCalendar();
  else if(current.sub==="other") body=fpOther();
  else if(current.sub==="salary") body=fpSalary();
  return subNav("fund") + fpMonthBar() + body;
}

const FUND_CATS=[
  {id:"餐饮", ico:"🍱", color:"#FFA07A", subs:["午餐","买菜","晚餐","早餐"]},
  {id:"日常", ico:"🏠", color:"#9ed1a8", subs:["日用品","超市","居家","通讯","快递","汽车"]},
  {id:"手工", ico:"🎨", color:"#87CEEB", subs:["手工","辅料"]},
  {id:"零食", ico:"🍬", color:"#C8A2C8", subs:["零食","奶茶"]},
  {id:"小宝", ico:"👶", color:"#FFB6C1", subs:["小宝"]},
  {id:"水果", ico:"🍎", color:"#FFD1DC", subs:["水果"]},
  {id:"民宿", ico:"🏨", color:"#DDA0DD", subs:["民宿"]},
  {id:"大宝", ico:"👦", color:"#ADD8E6", subs:["大宝"]},
  {id:"其他", ico:"📦", color:"#FFE4B5", subs:["其他"]}
];
function catInfo(id){ return FUND_CATS.find(x=>x.id===id)||FUND_CATS[FUND_CATS.length-1]; }

function fpOverview(){
  const month=state.fundPlan.month;
  const [ms,me]=monthRange(month);
  const recs=state.fundPlan.records.filter(r=>r.date>=ms&&r.date<=me).slice().sort((a,b)=>b.date.localeCompare(a.date));
  const exp=recs.filter(r=>r.type!=="inc").reduce((a,r)=>a+r.amount,0);
  const inc=recs.filter(r=>r.type==="inc").reduce((a,r)=>a+r.amount,0);
  const bal=inc-exp;
  const daySet=new Set(recs.map(r=>r.date));
  const avg=daySet.size?exp/daySet.size:0;
  return `
  <div class="card fp-quick">
    <h3><span class="ico">🧾</span>记一笔</h3>
    <div class="row2">
      <div class="field"><label>类型</label><select class="select" id="frType" onchange="fpCat2Sync()">
        <option value="exp">支出</option><option value="inc">收入</option></select></div>
      <div class="field"><label>日期</label><input class="input" id="frDate" type="date" value="${today()}"></div>
    </div>
    <div class="row2">
      <div class="field"><label>一级分类</label><select class="select" id="frCat1" onchange="fpCat2Sync()">${FUND_CATS.map(c=>`<option value="${c.id}">${c.ico} ${c.id}</option>`).join("")}</select></div>
      <div class="field"><label>二级分类</label><select class="select" id="frCat2">${FUND_CATS[0].subs.map(s=>`<option value="${s}">${s}</option>`).join("")}</select></div>
    </div>
    <div class="row2">
      <div class="field"><label>项目</label><input class="input" id="frItem" placeholder="如：午饭 / 电影票"></div>
      <div class="field"><label>金额(元)</label><input class="input" id="frAmt" type="number" placeholder="0"></div>
    </div>
    <button class="btn btn-p btn-block" onclick="addFundRecord()">保存记录</button>
  </div>
  <div class="card">
    <h3><span class="ico">💰</span>${month} 收支总览</h3>
    <div class="fp-summary">
      <div class="fps"><div class="fps-n" style="color:#e25555">¥${exp.toFixed(2)}</div><div class="fps-l">支出</div></div>
      <div class="fps"><div class="fps-n" style="color:#2e9e5b">¥${inc.toFixed(2)}</div><div class="fps-l">收入</div></div>
      <div class="fps"><div class="fps-n" style="color:${bal>=0?'#2e9e5b':'#e25555'}">¥${bal.toFixed(2)}</div><div class="fps-l">结余</div></div>
    </div>
    <div class="fp-subline">日均支出 ¥${avg.toFixed(2)} · 共 ${recs.length} 笔 · 覆盖 ${daySet.size} 天</div>
  </div>
  <div class="card">
    <h3><span class="ico">📈</span>支出趋势（按日）</h3>
    ${drawTrend(recs,'exp')}
  </div>
  <div class="card">
    <h3><span class="ico">📒</span>明细（${recs.length}）</h3>
    ${recs.length?recs.map(r=>{const c=catInfo(r.cat1); const up=r.type==="inc"; return `
      <div class="li"><div class="num" style="background:${c.color};color:#fff">${c.ico}</div>
        <div class="body"><div class="title">${esc(r.item||"(未命名)")} <span class="chip">${esc(r.date)}</span></div>
          <div class="desc">${esc(r.cat1)}${r.cat2?" / "+esc(r.cat2):""}</div></div>
        <div style="font-weight:800;color:${up?'#2e9e5b':'#e25555'}">${up?"+":"-"}¥${r.amount}</div>
        <button class="btn btn-sm btn-ghost" onclick="delFundRecord('${r.id}')">删</button></div>`;
    }).join("") : '<div class="empty">本月还没有记录，记一笔吧</div>'}
  </div>`;
}
function fpCat2Sync(){
  const c=catInfo($("frCat1").value);
  if($("frCat2")) $("frCat2").innerHTML=c.subs.map(s=>`<option value="${s}">${s}</option>`).join("");
}
function addFundRecord(){
  const type=$("frType").value, cat1=$("frCat1").value, cat2=$("frCat2").value, item=$("frItem").value.trim(), amt=parseFloat($("frAmt").value)||0, date=$("frDate").value||today();
  if(!amt){ alert("请填写金额"); return; }
  state.fundPlan.records.push({id:uid(), date, type, cat1, cat2, item, amount:amt});
  save(); go("fund","overview");
}
function delFundRecord(id){ state.fundPlan.records=state.fundPlan.records.filter(r=>r.id!==id); save(); go("fund","overview"); }
function addFundRecord(){
  const cat=$("frCat").value, item=$("frItem").value.trim(), amt=parseFloat($("frAmt").value)||0, date=$("frDate").value||today();
  if(!amt){ alert("请填写金额"); return; }
  state.fundPlan.records.push({id:uid(), date, cat, item, amount:amt});
  save(); go("fund","record");
}
function delFundRecord(id){ state.fundPlan.records=state.fundPlan.records.filter(r=>r.id!==id); save(); go("fund","record"); }

function fpFunds(){
  const funds=state.fundPlan.funds;
  const totalBase=funds.reduce((a,f)=>a+f.base,0);
  const totalNow=funds.reduce((a,f)=>a+f.base*(1+f.rate/100),0);
  const totalRate=totalBase?((totalNow/totalBase-1)*100):0;
  return `
  <div class="card">
    <h3><span class="ico">📈</span>添加基金</h3>
    <div class="field"><label>基金名称</label><input class="input" id="fdName" placeholder="如：沪深300ETF"></div>
    <div class="row2">
      <div class="field"><label>基数(投入元)</label><input class="input" id="fdBase" type="number" placeholder="0"></div>
      <div class="field"><label>涨幅(%)</label><input class="input" id="fdRate" type="number" placeholder="如 5.2 或 -3.1"></div>
    </div>
    <button class="btn btn-p btn-block" onclick="addFund()">添加基金</button>
  </div>
  <div class="card">
    <h3><span class="ico">💹</span>基金持仓（${funds.length}）<span class="chip orange">总收益 ${totalRate>=0?"+":""}${totalRate.toFixed(2)}%</span></h3>
    ${funds.length?`
    <div class="fund-sum">本金 <b>¥${totalBase}</b> · 现值 <b>¥${totalNow.toFixed(0)}</b> · 盈亏 <b style="color:${totalNow>=totalBase?'#2e9e5b':'#e25555'}">${totalNow>=totalBase?"+":""}${(totalNow-totalBase).toFixed(0)}</b></div>
    ${funds.map(f=>{const profit=f.base*f.rate/100; const up=f.rate>=0; return `
      <div class="li"><div class="num" style="background:${up?'#9ed1a8':'#f3a9a9'};color:#fff">${up?"▲":"▼"}</div>
        <div class="body"><div class="title">${esc(f.name)}</div><div class="desc">基数 ¥${f.base}</div></div>
        <div style="text-align:right"><div style="font-weight:800;color:${up?'#2e9e5b':'#e25555'}">${up?"+":""}${f.rate}%</div><div class="desc">${up?"+":""}${profit.toFixed(0)} 元</div></div>
        <button class="btn btn-sm btn-ghost" onclick="delFundItem('${f.id}')">删</button></div>`;
    }).join("")}
    ` : '<div class="empty">还没有基金，添加一只跟踪基数与涨幅</div>'}
  </div>`;
}
function addFund(){
  const name=$("fdName").value.trim(), base=parseFloat($("fdBase").value)||0, rate=parseFloat($("fdRate").value)||0;
  if(!name||!base){ alert("请填写基金名称和基数"); return; }
  state.fundPlan.funds.push({id:uid(), name, base, rate});
  save(); go("fund","funds");
}
function delFundItem(id){ state.fundPlan.funds=state.fundPlan.funds.filter(f=>f.id!==id); save(); go("fund","funds"); }

function weekRange(dStr){
  const d=new Date(dStr); const day=d.getDay()||7; // 周一=1..周日=7
  const mon=new Date(d); mon.setDate(d.getDate()-day+1);
  const sun=new Date(mon); sun.setDate(mon.getDate()+6);
  const f=x=>x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0");
  return [f(mon), f(sun)];
}
function weekKey(dStr){ return weekRange(dStr)[0]; }

function fpOther(){
  return fpFunds() + fpWeekReport();
}
function fpWeekReport(){
  const recs=state.fundPlan.records.filter(r=>r.type!=="inc");
  const map={};
  recs.forEach(r=>{ const k=weekKey(r.date); if(!map[k]){ map[k]={total:0}; FUND_CATS.forEach(c=>map[k][c.id]=0); } map[k][r.cat1]=(map[k][r.cat1]||0)+r.amount; map[k].total+=r.amount; });
  const weeks=Object.keys(map).sort().reverse();
  if(weeks.length===0) return `<div class="card"><h3><span class="ico">📑</span>周度分析报表</h3><div class="empty">还没有支出数据，先去「总览&明细」记几笔</div></div>`;
  const thisW=weeks[0], lastW=weeks[1];
  const cur=map[thisW], prev=lastW?map[lastW]:null;
  const pct=(a,b)=> b ? ((a-b)/b*100) : (a?100:0);
  const row=(label,a,b)=>{ const p=pct(a,b); const up=p>0; const na=!prev;
    return `<tr><td>${label}</td><td class="num">¥${a.toFixed(0)}</td><td class="num">${na?"—":"¥"+b.toFixed(0)}</td>
      <td class="num" style="color:${na?"#999":(p>0?"#e25555":p<0?"#2e9e5b":"#999")}">${na?"—":(up?"▲ +":"▼ ")+p.toFixed(1)+"%"}</td></tr>`;
  };
  const totalPct=pct(cur.total, prev?prev.total:0);
  return `
  <div class="card">
    <h3><span class="ico">📑</span>周度分析报表 <span class="chip">对比上周</span></h3>
    <p class="muted f12">本周 ${thisW} ~ ${weekRange(thisW)[1]}${prev?(" · 对比上周 "+lastW):" · 暂无上周数据"}</p>
    <table class="rpt">
      <thead><tr><th>分类</th><th>本周</th><th>上周</th><th>环比</th></tr></thead>
      <tbody>
        ${FUND_CATS.map(c=>row(c.id, cur[c.id]||0, prev?prev[c.id]||0:0)).join("")}
        <tr class="rpt-total"><td>合计</td><td class="num">¥${cur.total.toFixed(0)}</td><td class="num">${prev?"¥"+prev.total.toFixed(0):"—"}</td>
          <td class="num" style="color:${!prev?"#999":(totalPct>0?"#e25555":totalPct<0?"#2e9e5b":"#999")}">${!prev?"—":(totalPct>0?"▲ +":"▼ ")+totalPct.toFixed(1)+"%"}</td></tr>
      </tbody>
    </table>
    <div class="mt-12 muted f12">环比 = (本周 − 上周) / 上周 × 100%。红=支出增加，绿=支出减少。${!prev?"上周无数据时不计环比。":""}</div>
  </div>`;
}

/* ---------- 资金规划 工具 ---------- */
function monthRange(monthStr){
  const p=monthStr.split("-"); const y=+p[0], m=+p[1];
  const first=new Date(y,m-1,1), last=new Date(y,m,0);
  const f=x=>x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0");
  return [f(first), f(last)];
}
function fpMonthBar(){
  const m=state.fundPlan.month; const p=m.split("-");
  return `<div class="fp-monthbar">
    <button class="fp-arrow" onclick="fpSwitchMonth(-1)">‹</button>
    <div class="fp-monthlabel">${p[0]}年${+p[1]}月</div>
    <button class="fp-arrow" onclick="fpSwitchMonth(1)">›</button>
  </div>`;
}
function fpSwitchMonth(d){
  let [y,m]=state.fundPlan.month.split("-").map(Number);
  m+=d; if(m<1){m=12;y--;} if(m>12){m=1;y++;}
  state.fundPlan.month=y+"-"+String(m).padStart(2,"0"); save();
  go("fund", current.sub||"overview");
}

/* ---------- 分类统计（饼图 + 下钻） ---------- */
function fpCategory(){
  const [ms,me]=monthRange(state.fundPlan.month);
  const recs=state.fundPlan.records.filter(r=>r.date>=ms&&r.date<=me && r.type!=="inc");
  const stat={}; let total=0;
  recs.forEach(r=>{ stat[r.cat1]=(stat[r.cat1]||0)+r.amount; total+=r.amount; });
  const subStat={};
  recs.forEach(r=>{ if(r.cat2){(subStat[r.cat1]=subStat[r.cat1]||{})[r.cat2]=(subStat[r.cat1][r.cat2]||0)+r.amount;} });
  return `
  <div class="card">
    <h3><span class="ico">🍩</span>${state.fundPlan.month} 支出分类</h3>
    ${total? drawDonut(FUND_CATS.map(c=>({id:c.id,ico:c.ico,color:c.color,val:stat[c.id]||0})).filter(d=>d.val>0), total) : '<div class="empty">本月暂无支出</div>'}
    <div class="cat-list">
      ${FUND_CATS.map(c=>{
        const v=stat[c.id]||0; if(v<=0) return "";
        const pct=total?(v/total*100):0; const open=state.fundPlan.expand[c.id];
        const subs=subStat[c.id]?Object.entries(subStat[c.id]).sort((a,b)=>b[1]-a[1]):[];
        const cnt=recs.filter(r=>r.cat1===c.id).length;
        return `<div class="cat-row">
          <button class="cat-head" onclick="fpCatToggle('${c.id}')">
            <span class="dot" style="background:${c.color}"></span>
            <span class="cat-name">${c.ico} ${c.id}</span>
            <span class="cat-pct">${pct.toFixed(1)}%</span>
            <span class="cat-cnt">${cnt}笔</span>
            <span class="cat-amt">¥${v.toFixed(0)}</span>
            <span class="chev2">${open?'▴':'▾'}</span>
          </button>
          ${open&&subs.length?`<div class="cat-sub">${subs.map(s=>`<div class="sub-row"><span>${esc(s[0])}</span><span>¥${s[1].toFixed(0)}</span></div>`).join("")}</div>`:""}
        </div>`;
      }).join("")}
    </div>
  </div>`;
}
function fpCatToggle(cat){
  state.fundPlan.expand[cat]=!state.fundPlan.expand[cat]; save(); go("fund","category");
}
function drawDonut(data, total){
  const R=70, r=46, cx=90, cy=90, C=2*Math.PI*R; let off=0;
  const segs=data.map(d=>{
    const frac=d.val/total, len=frac*C;
    const s=`<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${d.color}" stroke-width="${R-r}" stroke-dasharray="${len.toFixed(2)} ${(C-len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`;
    off+=len; return s;
  }).join("");
  return `<div class="donut-wrap"><svg viewBox="0 0 180 180" class="donut">${segs}
    <text x="${cx}" y="${cy-4}" text-anchor="middle" class="donut-t1">合计</text>
    <text x="${cx}" y="${cy+16}" text-anchor="middle" class="donut-t2">¥${total.toFixed(0)}</text></svg></div>`;
}

/* ---------- 日历视图 ---------- */
function fpCalendar(){
  const [ms,me]=monthRange(state.fundPlan.month);
  const recs=state.fundPlan.records.filter(r=>r.date>=ms&&r.date<=me);
  const dayBal={};
  recs.forEach(r=>{ dayBal[r.date]=(dayBal[r.date]||0)+(r.type==="inc"?r.amount:-r.amount); });
  const p=state.fundPlan.month.split("-").map(Number);
  const exp=recs.filter(r=>r.type!=="inc").reduce((a,r)=>a+r.amount,0);
  const inc=recs.filter(r=>r.type==="inc").reduce((a,r)=>a+r.amount,0);
  const daySet=new Set(recs.map(r=>r.date));
  return `
  <div class="card">
    <h3><span class="ico">📅</span>${state.fundPlan.month} 日历</h3>
    ${drawCalendar(p[0],p[1],dayBal)}
    <div class="fp-subline">月结余 <b style="color:${inc-exp>=0?'#2e9e5b':'#e25555'}">¥${(inc-exp).toFixed(2)}</b> · 日均支出 ¥${(daySet.size?exp/daySet.size:0).toFixed(2)}</div>
    <div class="mt-12 muted f12">绿=当日净收入，红=当日净支出</div>
  </div>`;
}
function drawCalendar(y,mm,dayBal){
  const first=new Date(y,mm-1,1).getDay();
  const days=new Date(y,mm,0).getDate();
  const cells=[];
  for(let i=0;i<((first+6)%7);i++) cells.push("");
  for(let d=1;d<=days;d++) cells.push(d);
  const wd=["日","一","二","三","四","五","六"];
  const td=today();
  const body=cells.map(d=>{
    if(!d) return `<div class="cal-cell empty"></div>`;
    const ds=`${y}-${String(mm).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const b=dayBal[ds]||0; const cls=b>0?"pos":b<0?"neg":""; const tog=ds===td?"today":"";
    const sign=b>0?"+":b<0?"-":"";
    return `<div class="cal-cell ${cls} ${tog}"><div class="cd">${d}</div>${b?`<div class="cb">${sign}${Math.abs(b).toFixed(0)}</div>`:""}</div>`;
  }).join("");
  return `<div class="calendar"><div class="cal-wd">${wd.map(w=>`<div>${w}</div>`).join("")}</div><div class="cal-grid">${body}</div></div>`;
}

/* ---------- 趋势折线 ---------- */
function drawTrend(recs, mode){
  const p=state.fundPlan.month.split("-").map(Number);
  const y=p[0], mm=p[1]; const days=new Date(y,mm,0).getDate();
  const byDay={};
  for(let d=1;d<=days;d++){ byDay[`${y}-${String(mm).padStart(2,"0")}-${String(d).padStart(2,"0")}`]=0; }
  recs.filter(r=> mode==="exp"?r.type!=="inc":r.type==="inc").forEach(r=>{ if(byDay[r.date]!==undefined) byDay[r.date]+=r.amount; });
  const vals=Object.values(byDay); const max=Math.max(1,...vals);
  const W=320,H=120,pad=16;
  const pts=Object.keys(byDay).sort().map((ds,i)=>{
    const x=pad+(W-pad*2)*(days>1?i/(days-1):0);
    const v=byDay[ds]; const yy=H-pad-(H-pad*2)*(v/max);
    return [x,yy,v];
  });
  const line=pts.map(p2=>p2[0].toFixed(1)+","+p2[1].toFixed(1)).join(" ");
  const area=`${pad},${H-pad} ${line} ${W-pad},${H-pad}`;
  return `<div class="trend"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="trend-svg">
    <polygon points="${area}" fill="rgba(226,85,85,0.10)"/>
    <polyline points="${line}" fill="none" stroke="#e25555" stroke-width="2"/>
    ${pts.filter(p2=>p2[2]>0).map(p2=>`<circle cx="${p2[0].toFixed(1)}" cy="${p2[1].toFixed(1)}" r="2.5" fill="#e25555"/>`).join("")}
  </svg><div class="trend-meta">峰值 ¥${max.toFixed(0)} · 日均 ¥${(vals.reduce((a,b)=>a+b,0)/days).toFixed(0)}</div></div>`;
}

/* ===================== 播客 ===================== */
function viewPodcast(){
  return `<div class="card"><h3><span class="ico">🎧</span>播客收听</h3>
    <div class="flex gap-8 wrap mb-12">
      ${PODCASTS.map((c,i)=>`<button class="chip" onclick="showPod(${i})">${c.cat}</button>`).join("")}
    </div>
    <div id="podBox">${podBlock(0)}</div></div>`;
}
function showPod(i){ $("podBox").innerHTML=podBlock(i); }
function podBlock(i){
  const c=PODCASTS[i];
  return `<h3 class="mt-8">${c.cat}</h3>`+c.items.map(p=>`
    <div class="pod-card mb-8"><div class="pt">${esc(p.name)}</div><div class="pd">🎙 ${esc(p.host)}</div><div class="pd mt-8">${esc(p.desc)}</div>
      <button class="btn btn-sm btn-p mt-8" onclick="markListened('${esc(p.name)}')">标记收听</button></div>`).join("");
}
function markListened(name){ const td=today(); if(!state.podcast.listened.includes(name)){ state.podcast.listened.push(name); save(); } go("podcast"); }

/* ===================== 通用工具 ===================== */
function viewTools(){
  if (current.sub==="settings") return viewSettings();
  if (current.sub==="rec") return viewRec();
  const tools=[
    {e:"⏱",n:"番茄钟",d:"专注25分钟",fn:"startPomodoro()"},
    {e:"🎲",n:"随机摘抄",d:"灵感一下",fn:"toolRandomClip()"},
    {e:"💡",n:"灵感生成",d:"选题灵感",fn:"toolIdea()"},
    {e:"🎯",n:"英语倒计时",d:"查看考试",fn:"go('english')"},
    {e:"🔥",n:"健身打卡",d:"去运动",fn:"go('fitness','calendar')"},
    {e:"📱",n:"自媒体热点",d:"看热点",fn:"go('media','hot')"},
    {e:"✅",n:"记完成",d:"今日成就",fn:"go('tools','rec')"},
    {e:"📜",n:"随机长难句",d:"练阅读",fn:"toolSentence()"},
    {e:"⚙️",n:"设置",d:"备份/API",fn:"go('tools','settings')"}
  ];
  return `
  <div class="card"><h3><span class="ico">🛠</span>通用工具</h3>
    <div class="tool-grid">${tools.map(t=>`<div class="tool-tile" onclick="${t.fn}"><div class="emoji">${t.e}</div><div class="name">${t.n}</div><div class="desc">${t.d}</div></div>`).join("")}</div>
  </div>
  <div class="card" id="toolBox"></div>`;
}
function toolRandomClip(){
  if(!state.knowledge.clips.length){ $("toolBox").innerHTML='<div class="empty">还没有摘抄，去知识库加一条吧</div>'; return; }
  const c=state.knowledge.clips[Math.floor(Math.random()*state.knowledge.clips.length)];
  $("toolBox").innerHTML=`<div class="sentence"><div class="en">${esc(c.text)}</div><div class="zh">${esc(c.tag||"")} ${esc(c.src||"")}</div></div>`;
}
function toolIdea(){
  const t=TOPIC_TEMPLATES[Math.floor(Math.random()*TOPIC_TEMPLATES.length)];
  const hot=HOT_POOL.weibo[Math.floor(Math.random()*HOT_POOL.weibo.length)];
  $("toolBox").innerHTML=`<div class="sentence"><div class="en">${esc(t.replace("{hot}",hot).replace("{domain}","你的领域"))}</div><div class="zh">结合热点：「${esc(hot)}」</div></div>`;
}
function toolSentence(){
  const i=Math.floor(Math.random()*SENTENCES.length);
  $("toolBox").innerHTML=`<div class="sentence"><div class="en">${esc(SENTENCES[i][0])}</div><div class="zh">${esc(SENTENCES[i][1])}</div><div class="meta mt-8 f11 muted">💡 ${esc(SENTENCES[i][2])}</div></div>`;
}
let pomoInt=null;
function startPomodoro(){
  if(pomoInt){ clearInterval(pomoInt); pomoInt=null; $("toolBox").innerHTML='<div class="empty">已停止</div>'; return; }
  let s=25*60;
  $("toolBox").innerHTML=`<div style="text-align:center"><div id="pomo" style="font-size:48px;font-weight:800;color:var(--mint-d)">25:00</div><button class="btn btn-p mt-12" onclick="startPomodoro()">⏹ 停止</button></div>`;
  pomoInt=setInterval(()=>{ s--; const m=String(Math.floor(s/60)).padStart(2,"0"),ss=String(s%60).padStart(2,"0"); const el=$("pomo"); if(el)el.textContent=m+":"+ss; if(s<=0){ clearInterval(pomoInt); pomoInt=null; if(el)el.textContent="完成🎉"; } },1000);
}

/* 完成记录 */
function viewRec(){
  const td=today();
  const list=state.tasks.done[td]||[];
  return `
  <div class="card">
    <h3><span class="ico">✅</span>今日完成（${list.length}）</h3>
    <p class="muted f12">不排计划、只记完成，零压力 ✨</p>
    <div class="field mt-8"><input class="input" id="recInput" placeholder="今天完成了什么？" onkeydown="if(event.key==='Enter')addDone()"></div>
    <button class="btn btn-p btn-block" onclick="addDone()">记下来</button>
    <div id="recList" class="mt-12"></div>
  </div>`;
}
function addDone(){
  const td=today();
  const v=$("recInput").value.trim(); if(!v) return;
  if(!state.tasks.done[td]) state.tasks.done[td]=[];
  state.tasks.done[td].push({text:v, id:uid()});
  save(); renderNav();
  $("recInput").value="";
  renderRecList();
}
function renderRecList(){
  const td=today(); const list=state.tasks.done[td]||[];
  $("recList").innerHTML = list.length?list.map(r=>`<div class="li"><span>✅ ${esc(r.text)}</span><button class="btn btn-sm btn-ghost" onclick="delDone('${r.id}')">×</button></div>`).join(""):'<div class="empty">还没有记录</div>';
}
function delDone(id){ const td=today(); state.tasks.done[td]=(state.tasks.done[td]||[]).filter(r=>r.id!==id); save(); renderNav(); renderRecList(); }

/* 设置 */
function viewSettings(){
  const ai=state.ai;
  return `
  <div class="card">
    <h3><span class="ico">🤖</span>AI 助手配置（可选）</h3>
    <p class="muted f12">填入任意 OpenAI 兼容接口（如 DeepSeek / Kimi / 通义），小顾就能真对话；不填则用本地引导模式。</p>
    <div class="field"><label>API Base</label><input class="input" id="aiBase" value="${esc(ai.base)}" placeholder="https://api.deepseek.com/v1"></div>
    <div class="field"><label>Model</label><input class="input" id="aiModel" value="${esc(ai.model)}" placeholder="deepseek-chat"></div>
    <div class="field"><label>API Key</label><input class="input" id="aiKey" type="password" value="${esc(ai.key)}" placeholder="sk-..."></div>
    <button class="btn btn-p btn-block" onclick="saveAI()">保存配置</button>
  </div>
  <div class="card">
    <h3><span class="ico">⚙️</span>考试目标</h3>
    <div class="field"><label>目标考试日期</label><input class="input" id="examTarget" type="date" value="${esc(state.english.target)}"></div>
    <button class="btn btn-p btn-block" onclick="saveExam()">保存</button>
  </div>
  <div class="card">
    <h3><span class="ico">💾</span>数据管理</h3>
    <div class="flex gap-8 wrap">
      <button class="btn btn-p" onclick="backup()">⬇️ 备份到文件</button>
      <button class="btn btn-ghost" onclick="document.getElementById('importFile').click()">⬆️ 导入</button>
      <button class="btn btn-ghost" onclick="if(confirm('确定清空全部数据？')){localStorage.removeItem('wb_state');location.reload();}">🗑 清空</button>
    </div>
    <input type="file" id="importFile" accept="application/json" style="display:none" onchange="importData(this)">
  </div>
  <div class="card">
    <h3><span class="ico">☁️</span>云同步（GitHub）</h3>
    <p class="muted f12">把数据存到 GitHub 仓库文件，手机/电脑自动共用，且永久不休眠。建议用<strong>私有仓库</strong>。</p>
    <label class="switch-row"><input type="checkbox" id="cloudOn" ${cloudCfg().enabled?'checked':''}> 启用云同步</label>
    <div class="field"><label>仓库 owner</label><input class="input" id="cloudOwner" value="${esc(cloudCfg().owner||'')}" placeholder="你的GitHub用户名"></div>
    <div class="field"><label>仓库名 repo</label><input class="input" id="cloudRepo" value="${esc(cloudCfg().repo||'')}" placeholder="例如 workbench"></div>
    <div class="field"><label>文件名</label><input class="input" id="cloudFile" value="${esc(cloudCfg().file||'data.json')}" placeholder="data.json"></div>
    <div class="field"><label>Token（需 repo 权限）</label><input class="input" id="cloudToken" type="password" value="${esc(cloudCfg().token||'')}" placeholder="ghp_..."></div>
    <div class="flex gap-8 wrap mt-8">
      <button class="btn btn-p" onclick="cloudSave();cloudTest()">保存并测试</button>
      <button class="btn btn-ghost" onclick="cloudSyncNow()">立即同步</button>
    </div>
    <div id="cloudStatus" class="mt-8 f11 muted"></div>
    <p class="muted f11 mt-8">首次同步会在仓库根目录创建 data.json。Token 仅存本机，不会上传。仓库开启 GitHub Pages 后即永久可访问。</p>
  </div>`;
}
/* ===================== 云同步（GitHub） ===================== */
const CLOUD_KEY="wb_cloud";
function cloudCfg(){ try{ return JSON.parse(localStorage.getItem(CLOUD_KEY))||{}; }catch(e){ return {}; } }
function cloudEnabled(){ const c=cloudCfg(); return !!(c.enabled && c.owner && c.repo && c.token); }
function cloudSave(){
  const ownerEl=document.getElementById("cloudOwner");
  if(!ownerEl) return; // 设置表单未渲染时跳过，避免 null.value 崩溃
  const c=Object.assign(cloudCfg(),{
    enabled: document.getElementById("cloudOn") ? document.getElementById("cloudOn").checked : false,
    owner: (ownerEl.value||"").trim(),
    repo: (document.getElementById("cloudRepo").value||"").trim(),
    token: (document.getElementById("cloudToken").value||"").trim(),
    file: (document.getElementById("cloudFile").value||"data.json").trim() || "data.json"
  });
  localStorage.setItem(CLOUD_KEY, JSON.stringify(c));
  const s=document.getElementById("cloudStatus"); if(s) s.innerHTML='<span class="muted f11">已保存配置</span>';
}
function ghReq(method, body){
  const c=cloudCfg();
  const url="https://api.github.com/repos/"+encodeURIComponent(c.owner)+"/"+encodeURIComponent(c.repo)+"/contents/"+encodeURIComponent(c.file||"data.json");
  const opt={method, headers:{Authorization:"Bearer "+c.token, Accept:"application/vnd.github+json"}};
  if(body) opt.body=JSON.stringify(body);
  return fetch(url, opt).then(r=>{ if(!r.ok) return r.text().then(t=>Promise.reject(r.status+" "+t)); return r.json(); });
}
function ghPull(){
  return ghReq("GET").then(j=>{
    const txt=decodeURIComponent(escape(atob(j.content.replace(/\s/g,""))));
    const data=JSON.parse(txt);
    for(const k in DEFAULT_STATE){ if(data[k]!==undefined) state[k]=data[k]; }
    const c=cloudCfg(); c.sha=j.sha; c.lastSync=new Date().toLocaleTimeString('zh-CN');
    localStorage.setItem(CLOUD_KEY, JSON.stringify(c));
    save();
    const s=$("#cloudStatus"); if(s) s.innerHTML='<span style="color:var(--mint-d)">✓ 已拉取 '+c.lastSync+'</span>';
    return j;
  });
}
function ghPush(){
  if(!cloudEnabled()) return Promise.resolve();
  const content=btoa(unescape(encodeURIComponent(JSON.stringify(state))));
  const c=cloudCfg();
  const doPut=(sha)=>{ const body={message:"sync "+new Date().toLocaleString('zh-CN'), content}; if(sha) body.sha=sha; return ghReq("PUT", body).then(j=>{ const cc=cloudCfg(); cc.sha=j.sha; cc.lastSync=new Date().toLocaleTimeString('zh-CN'); localStorage.setItem(CLOUD_KEY, JSON.stringify(cc)); const s=$("#cloudStatus"); if(s) s.innerHTML='<span style="color:var(--mint-d)">✓ 已同步 '+cc.lastSync+'</span>'; return j; }); };
  if(c.sha) return doPut(c.sha).catch(e=>{ if(String(e).indexOf("409")>=0){ return ghReq("GET").then(j=>doPut(j.sha)); } throw e; });
  return ghReq("GET").then(j=>doPut(j.sha)).catch(e=>{ if(String(e).indexOf("404")>=0) return doPut(null); throw e; });
}
function cloudTest(){ if(!cloudEnabled()){ const s=$("#cloudStatus"); if(s) s.innerHTML='<span style="color:#e06">请先填 owner/repo/token</span>'; return; } ghReq("GET").then(()=>{ const s=$("#cloudStatus"); if(s) s.innerHTML='<span style="color:var(--mint-d)">✓ 连接成功</span>'; }).catch(e=>{ const s=$("#cloudStatus"); if(s) s.innerHTML='<span style="color:#e06">✗ '+e+'</span>'; }); }
function cloudSyncNow(){ if(!cloudEnabled()){ const s=$("#cloudStatus"); if(s) s.innerHTML='<span style="color:#e06">请先启用并保存配置</span>'; return; } ghPull().then(()=>ghPush()).then(()=>{ go(current.view, current.sub); }).catch(e=>{ const s=$("#cloudStatus"); if(s) s.innerHTML='<span style="color:#e06">✗ '+e+'</span>'; }); }
let _pushTimer=null;
function cloudAutoPush(){ if(!cloudEnabled()) return; clearTimeout(_pushTimer); _pushTimer=setTimeout(()=>{ ghPush().catch(e=>{ const s=$("#cloudStatus"); if(s) s.innerHTML='<span style="color:#e06">✗ 自动同步失败</span>'; }); }, 2500); }

function saveAI(){ state.ai={base:$("aiBase").value, model:$("aiModel").value, key:$("aiKey").value}; save(); alert("已保存"); }
function saveExam(){ state.english.target=$("examTarget").value; save(); go("english","overview"); }

/* 备份/导入 */
function backup(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
  downloadBlob("workbench-backup-"+today()+".json", blob);
}
function importData(input){
  const file=input.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{ try{ const d=JSON.parse(reader.result); deepFill(d, DEFAULT_STATE); state=Object.assign(JSON.parse(JSON.stringify(DEFAULT_STATE)), d); save(); alert("导入成功"); go("home"); }catch(e){ alert("文件格式错误"); } };
  reader.readAsText(file);
}
function downloadFile(name, content, type){ downloadBlob(name, new Blob([content],{type})); }
function downloadBlob(name, blob){
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
}
function copyText(id){
  const el=$(id); if(!el) return;
  if(navigator.clipboard) navigator.clipboard.writeText(el.innerText).then(()=>alert("已复制")).catch(()=>alert("复制失败"));
  else { const r=document.createRange(); r.selectNode(el); const s=getSelection(); s.removeAllRanges(); s.addRange(r); try{document.execCommand("copy");alert("已复制");}catch(e){alert("复制失败");} s.removeAllRanges(); }
}

/* ===================== AI 助手 ===================== */
const AI_QUICK=[
  ["生成本周英语计划","帮我规划这周英语学习和复习节奏"],
  ["抓今日英语热词","结合今天热点给我 5 个英语表达"],
  ["生成小红书标题","给自媒体账号想 5 组标题"],
  ["分析本周账号数据","帮我看这周运营数据哪里可优化"],
  ["调整健身食谱","根据我的健身目标给饮食建议"],
  ["生成摘抄模板","给我一个好用的读书摘抄格式"]
];
function initAI(){
  $("aiBody").innerHTML = `<div class="bubble ai"><div class="who">小顾</div>你好，漫漫！我是你的 AI 助手 🐚<br>想做点什么？点下面的快捷指令，或直接问我～</div>`;
  $("aiQuick").innerHTML = AI_QUICK.map((q,i)=>`<button class="q" onclick="aiQuick(${i})">${esc(q[0])}</button>`).join("");
}
function aiQuick(i){ const q=AI_QUICK[i]; $("aiInput").value=q[1]; sendAI(); }
function toggleAI(){
  const r=$("rightPanel"), m=$("aiMask");
  const open=r.classList.contains("ai-open");
  if(open){ r.classList.remove("ai-open"); m.classList.remove("ai-open"); }
  else { r.classList.add("ai-open"); m.classList.add("ai-open"); }
}
function pushBubble(role, text){
  const b=document.createElement("div");
  b.className="bubble "+(role==="me"?"me":"ai");
  b.innerHTML=`<div class="who">${role==="me"?"我":"小顾"}</div>${esc(text).replace(/\n/g,"<br>")}`;
  $("aiBody").appendChild(b);
  $("aiBody").scrollTop=$("aiBody").scrollHeight;
}
function sendAI(){
  const input=$("aiInput"); const text=input.value.trim(); if(!text) return;
  pushBubble("me", text); input.value="";
  const ai=state.ai;
  if (ai.key && ai.base){
    pushBubble("ai","思考中…");
    fetch(ai.base.replace(/\/$/,"")+"/chat/completions",{
      method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+ai.key},
      body:JSON.stringify({model:ai.model||"deepseek-chat", messages:[{role:"user",content:text}], stream:false})
    }).then(r=>r.json()).then(d=>{
      const last=$("aiBody").lastChild; if(last) last.remove();
      const ans=(d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content)||JSON.stringify(d).slice(0,200);
      pushBubble("ai", ans);
    }).catch(()=>{ const last=$("aiBody").lastChild; if(last) last.remove(); pushBubble("ai","接口调用失败，检查 Key/Base 是否正确～"); });
  } else {
    setTimeout(()=>pushBubble("ai", localReply(text)), 400);
  }
}
function localReply(text){
  if(text.includes("计划")||text.includes("英语")) return "建议节奏：每天背 20 词 + 复习艾宾浩斯队列，周末做一套真题。要我打开英语备考专区吗？(点左侧「英语备考专区」)";
  if(text.includes("标题")||text.includes("小红书")) return "5 组标题灵感：①3个方法让我效率翻倍 ②普通人也能学会的XX ③别再XX了！正确做法 ④我用一个月养成了XX ⑤建议收藏｜XX避坑指南";
  if(text.includes("数据")||text.includes("运营")) return "先看完播率/涨粉比，热点内容复制爆款结构，固定栏目培养粉丝预期。可在「自媒体运营-数据录入」持续记录，月底自动出报表。";
  if(text.includes("健身")||text.includes("食谱")) return "减脂期：蛋白质足量、碳水放练后、少油少糖；增肌期：热量盈余+训练日多吃。配合你的打卡记录循序渐进～";
  if(text.includes("摘抄")) return "可用模板：〔原文〕+〔出处〕+〔我的理解〕+〔能用在哪〕，四要素让摘抄真正长在自己身上。";
  return "收到～我可以帮你做英语计划、选题灵感、数据分析、健身/理财建议。说具体点，小顾更好使劲 😊";
}

/* ===================== 渲染后钩子 ===================== */
function afterRender(view, sub){
  if (view==="english" && sub==="words") renderWordGrid("");
  if (view==="knowledge" && sub==="clips") renderClips("");
  if (view==="tools" && sub==="rec") renderRecList();
  if (view==="english" && state.english.timerStart) renderTimerBtn();
}

/* ===================== WorkBuddy 对话 API =====================
   在小顾对话里让 WorkBuddy 助手调用这些函数，就能把日程/记账直接写入工作台。 */
window.WB = {
  /* 日程 */
  addSchedule: (opt) => {
    if(typeof opt === "string") opt = {title: opt};
    const r = parseNLSchedule(opt.text || opt.title || "");
    return addScheduleItem({
      date: opt.date || r.date,
      time: opt.time || r.time,
      title: opt.title || r.title,
      note: opt.note || opt.text || ""
    });
  },
  listSchedule: (opt={}) => state.schedule.items.filter(i=>(!opt.from||i.date>=opt.from)&&(!opt.to||i.date<=opt.to)),
  toggleSchedule: (id) => { const it = state.schedule.items.find(x=>x.id===id); if(it){ it.done=!it.done; save(); } return it; },
  delSchedule: (id) => { state.schedule.items = state.schedule.items.filter(x=>x.id!==id); save(); return true; },
  parseNL: parseNLSchedule,
  /* 记账 */
  addExpense: (opt) => {
    const r = {id:uid(), date:opt.date||today(), type:opt.type||"exp", cat1:opt.cat1||"其他", cat2:opt.cat2||"", item:opt.item||"", amount:parseFloat(opt.amount)||0};
    state.fundPlan.records.push(r); save(); return r;
  },
  listExpense: (opt={}) => state.fundPlan.records.filter(r=>(!opt.from||r.date>=opt.from)&&(!opt.to||r.date<=opt.to)),
  /* 状态 */
  getState: () => JSON.parse(JSON.stringify(state))
};

/* 解析 URL hash 触发添加（给小顾对话中发的「一键导入」链接用） */
function wbHashExec(){
  const h = location.hash;
  if(!h || !h.startsWith("#wb:")) return false;
  try {
    let m = h.match(/^#wb:schedule=(.+)$/);
    if(m){
      const obj = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));
      const it = addScheduleItem(obj);
      if(it){
        history.replaceState(null,"",location.pathname+location.search);
        go("schedule","day");
        setTimeout(()=>alert("✓ 已添加日程："+it.title+(it.time?" "+it.time:"")+" ("+it.date+")"),50);
        return true;
      }
    }
    m = h.match(/^#wb:expense=(.+)$/);
    if(m){
      const obj = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));
      const it = window.WB.addExpense(obj);
      if(it){
        history.replaceState(null,"",location.pathname+location.search);
        go("fund","overview");
        setTimeout(()=>alert("✓ 已记账："+it.item+" ¥"+it.amount),50);
        return true;
      }
    }
  } catch(e){ console.warn("wb hash parse failed", e); }
  return false;
}
window.addEventListener("hashchange", wbHashExec);

/* ===================== 安装引导（PWA）===================== */
let deferredInstall = null;
function setupInstall(){
  const ua = navigator.userAgent || "";
  const isWX = /MicroMessenger/i.test(ua);
  const dismissed = (function(){ try { return localStorage.getItem("installDismissed")==="1"; } catch(e){ return false; } })();
  const bar = document.createElement("div");
  bar.className = "install-bar";
  bar.id = "installBar";
  if (isWX){
    bar.innerHTML = '<div class="ib-txt">⚠️ <b>检测到在微信中打开</b>，微信无法直接「添加到主屏幕」。<br>请点右上角 <b>⋯</b> → <b>在浏览器打开</b>，再用 Safari / Chrome 安装。</div><button class="ib-x" onclick="hideInstall()">×</button>';
    bar.style.display = "flex";
  } else {
    bar.innerHTML = '<div class="ib-txt">📲 把工作台装到手机，像 App 一样随时打开</div>' +
                    '<button class="ib-btn" onclick="doInstall()">安装</button>' +
                    '<button class="ib-x" onclick="hideInstall()">×</button>';
    bar.style.display = dismissed ? "none" : "flex";
  }
  document.body.appendChild(bar);

  window.addEventListener("beforeinstallprompt", function(e){
    e.preventDefault();
    deferredInstall = e;
    if(!isWX) bar.style.display = "flex"; // 浏览器满足条件时主动亮出安装按钮
  });
  window.addEventListener("appinstalled", function(){ bar.style.display = "none"; });
}
function doInstall(){
  const bar = document.getElementById("installBar");
  if (deferredInstall){
    deferredInstall.prompt();
    deferredInstall.userChoice.then(function(){ deferredInstall = null; if(bar) bar.style.display = "none"; });
  } else {
    showInstallHelp(); // 不满足自动安装条件时，给出人工步骤
  }
}
function hideInstall(){
  const b = document.getElementById("installBar");
  if(b) b.style.display = "none";
  try { localStorage.setItem("installDismissed","1"); } catch(e){}
}
function showInstallHelp(){
  if(document.getElementById("installHelp")) return;
  const m = document.createElement("div");
  m.className = "modal-mask";
  m.id = "installHelp";
  m.innerHTML = '<div class="modal"><h3>📲 安装到主屏幕</h3>' +
    '<p><b>iPhone（Safari）</b>：底部「分享」→「添加到主屏幕」。</p>' +
    '<p><b>安卓 · Chrome</b>：右上角「⋮」→「安装应用」（一点即装）。</p>' +
    '<p><b>华为 / 其他安卓浏览器</b>：找菜单里的「添加到主屏幕 / 桌面快捷方式 / 添加书签到桌面」。华为浏览器菜单常是「≡」或底部栏，<b>不一定在右上角三点</b>。</p>' +
    '<p><b>微信里打开</b>：点右上角「⋯」→「在浏览器打开」，再去浏览器加。</p>' +
    '<p style="color:#888;font-size:12px">小提醒：桌面「快捷方式」点开就是工作台，用法一样；想要全屏 App 感，可去应用市场装个 Chrome。</p>' +
    '<button class="ib-btn" style="margin-top:6px" onclick="this.parentNode.parentNode.remove()">知道了</button></div>';
  document.body.appendChild(m);
  m.onclick = function(e){ if(e.target===m) m.remove(); };
}

/* ===================== 初始化 ===================== */
function boot(){
  tickTop(); setInterval(tickTop, 30000);
  setupInstall();
  initAI();
  try {
    const up=new URLSearchParams(location.search);
    const iv=up.get("view"), isb=up.get("sub");
    if(iv) current.view=iv;
    if(isb) current.sub=isb;
  } catch(e){}
  // 优先处理 hash 触发（小顾对话中的「一键导入」链接）
  if(!wbHashExec()){
    if(cloudEnabled()){
      ghPull().then(()=>go(current.view||"home", current.sub||"")).catch(()=>go(current.view||"home", current.sub||""));
    } else {
      go(current.view||"home", current.sub||"");
    }
  }
}
if (document.readyState==="loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
