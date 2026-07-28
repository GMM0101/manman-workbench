const fs=require('fs'), vm=require('vm');
const data=fs.readFileSync('C:/Users/HUAWEI/WorkBuddy/2026-07-27-17-09-44/workbench/data.js','utf8');
const app=fs.readFileSync('C:/Users/HUAWEI/WorkBuddy/2026-07-27-17-09-44/workbench/app.js','utf8');
const test=`
state.fundPlan.records=[
 {id:'a',date:today(),cat:'need',item:'午饭',amount:30},
 {id:'b',date:today(),cat:'fun',item:'电影',amount:50}
];
const d=new Date(today()); d.setDate(d.getDate()-8);
const f=x=>x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');
state.fundPlan.records.push({id:'c',date:f(d),cat:'need',item:'上周',amount:20});
current.sub='record'; const r1=viewFund();
current.sub='funds'; const r2=viewFund();
current.sub='report'; const r3=viewFund();
if(!r1||!r2||!r3) throw new Error('empty view');
console.log('REC_LEN',r1.length,'FUND_LEN',r2.length,'RPT_LEN',r3.length);
console.log('RPT_HAS_THISWEEK', r3.includes('本周'));
console.log('RPT_HAS_PCT', r3.includes('%'));
console.log('ALL_VIEWS_OK');
`;
const sandbox={ console, localStorage:{getItem:()=>null,setItem:()=>{}}, window:{addEventListener:()=>{}}, document:{getElementById:()=>({innerHTML:'',textContent:'',value:'',style:{},oninput:null}), querySelectorAll:()=>[]}, setTimeout };
vm.createContext(sandbox);
try{
  vm.runInContext(data+'\n'+app+'\n'+test, sandbox, {filename:'bundle.js'});
}catch(e){ console.log('RUNTIME_ERROR', e.message); console.log(e.stack); process.exit(1); }
