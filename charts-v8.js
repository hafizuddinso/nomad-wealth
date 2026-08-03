const App=window.NomadApp;
const charts=new Map();
const palette=["#14b8a6","#2563eb","#f59e0b","#8b5cf6","#ef4444","#06b6d4","#84cc16","#f97316","#ec4899","#64748b"];

function state(){return App?.getState()}
function main(value,currency){return App.inMain(Number(value)||0,currency)}
function monthKey(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`}
function shortMonth(date){return date.toLocaleDateString(undefined,{month:"short",year:"2-digit"})}
function textColor(){return getComputedStyle(document.documentElement).getPropertyValue("--text").trim()||"#172033"}
function mutedColor(){return getComputedStyle(document.documentElement).getPropertyValue("--muted").trim()||"#64748b"}
function lineColor(){return getComputedStyle(document.documentElement).getPropertyValue("--line").trim()||"#e5e7eb"}
function panelColor(){return getComputedStyle(document.documentElement).getPropertyValue("--panel").trim()||"#ffffff"}

function accountBalance(account){
  return Number(account.openingBalance||0)+(state().transactions||[]).filter(t=>t.accountId===account.id)
    .reduce((sum,t)=>sum+(t.type==="income"?Number(t.amount):-Number(t.amount)),0);
}
function currentNetWorth(){
  const s=state();
  const assets=(s.accounts||[]).filter(a=>a.type!=="Debt").reduce((sum,a)=>sum+main(accountBalance(a),a.currency),0);
  const debt=(s.accounts||[]).filter(a=>a.type==="Debt").reduce((sum,a)=>sum+Math.abs(main(accountBalance(a),a.currency)),0);
  const investments=(s.investments||[]).reduce((sum,i)=>sum+main(i.value,i.currency),0);
  return assets+investments-debt;
}
function lastMonths(count=6){
  const result=[],now=new Date();
  for(let i=count-1;i>=0;i--)result.push(new Date(now.getFullYear(),now.getMonth()-i,1));
  return result;
}
function moneyTick(value){
  return new Intl.NumberFormat(undefined,{notation:"compact",maximumFractionDigits:1}).format(value);
}
function baseOptions(extra={}){
  return {
    responsive:true,
    maintainAspectRatio:false,
    animation:{duration:450},
    interaction:{mode:"index",intersect:false},
    plugins:{
      legend:{labels:{color:textColor(),usePointStyle:true,boxWidth:9}},
      tooltip:{callbacks:{label(context){const label=context.dataset.label?`${context.dataset.label}: `:"";return `${label}${App.money(context.raw)}`}}}
    },
    scales:{
      x:{ticks:{color:mutedColor()},grid:{color:lineColor()}},
      y:{beginAtZero:true,ticks:{color:mutedColor(),callback:moneyTick},grid:{color:lineColor()}}
    },
    ...extra
  };
}
function emptyPlugin(message){
  return {
    id:`empty-${message}`,
    afterDraw(chart){
      const has=chart.data.datasets.some(d=>(d.data||[]).some(v=>Number(v)>0));
      if(has)return;
      const {ctx,chartArea}=chart;
      if(!chartArea)return;
      ctx.save();ctx.fillStyle=mutedColor();ctx.font="600 14px system-ui";ctx.textAlign="center";
      ctx.fillText(message,(chartArea.left+chartArea.right)/2,(chartArea.top+chartArea.bottom)/2);ctx.restore();
    }
  };
}
function make(id,config){
  const canvas=document.getElementById(id);
  if(!canvas||!window.Chart||!state())return;
  charts.get(id)?.destroy();
  charts.set(id,new Chart(canvas,config));
}
function categoryTotals(transactions){
  const totals={};
  transactions.filter(t=>t.type==="expense").forEach(t=>totals[t.category]=(totals[t.category]||0)+main(t.amount,t.currency));
  return Object.entries(totals).sort((a,b)=>b[1]-a[1]);
}
function filteredTransactions(){
  const all=[...(state().transactions||[])];
  const query=(document.querySelector("#transaction-search")?.value||"").toLowerCase();
  const type=document.querySelector("#transaction-filter")?.value||"all";
  const category=document.querySelector("#transaction-category-filter")?.value||"all";
  const country=document.querySelector("#transaction-country-filter")?.value||"all";
  const from=document.querySelector("#transaction-date-from")?.value||"";
  const to=document.querySelector("#transaction-date-to")?.value||"";
  return all.filter(t=>{
    const account=state().accounts.find(a=>a.id===t.accountId);
    const text=`${t.category} ${t.note||""} ${App.countryName(t.country)} ${account?.name||""}`.toLowerCase();
    return (!query||text.includes(query))&&(type==="all"||t.type===type)&&(category==="all"||t.category===category)&&
      (country==="all"||App.normalizeCountryCode(t.country)===country)&&(!from||t.date>=from)&&(!to||t.date<=to);
  });
}
function renderDashboard(){
  const months=lastMonths();
  const income=months.map(m=>(state().transactions||[]).filter(t=>t.date?.startsWith(monthKey(m))&&t.type==="income").reduce((s,t)=>s+main(t.amount,t.currency),0));
  const expense=months.map(m=>(state().transactions||[]).filter(t=>t.date?.startsWith(monthKey(m))&&t.type==="expense").reduce((s,t)=>s+main(t.amount,t.currency),0));
  make("dashboard-cashflow-chart",{type:"bar",data:{labels:months.map(shortMonth),datasets:[
    {label:"Income",data:income,backgroundColor:"rgba(20,184,166,.78)",borderRadius:7},
    {label:"Expenses",data:expense,backgroundColor:"rgba(239,68,68,.72)",borderRadius:7}
  ]},options:baseOptions(),plugins:[emptyPlugin("Add transactions to see monthly cash flow")]});
  const now=monthKey(new Date()),cats=categoryTotals((state().transactions||[]).filter(t=>t.date?.startsWith(now))).slice(0,8);
  make("dashboard-category-chart",{type:"doughnut",data:{labels:cats.map(x=>x[0]),datasets:[{data:cats.map(x=>x[1]),backgroundColor:palette,borderColor:panelColor(),borderWidth:3}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:"58%",plugins:{legend:{position:"bottom",labels:{color:textColor(),usePointStyle:true}},tooltip:{callbacks:{label:c=>`${c.label}: ${App.money(c.raw)}`}}}},plugins:[emptyPlugin("No expenses recorded this month")]});
}
function renderAccounts(){
  const accounts=(state().accounts||[]).filter(a=>a.type!=="Debt");
  make("accounts-balance-chart",{type:"bar",data:{labels:accounts.map(a=>a.name),datasets:[{label:"Balance",data:accounts.map(a=>main(accountBalance(a),a.currency)),backgroundColor:palette,borderRadius:8}]},
    options:baseOptions({indexAxis:accounts.length>5?"y":"x"}),plugins:[emptyPlugin("Add an account to see balances")]});
  const exposure={};accounts.forEach(a=>exposure[a.currency]=(exposure[a.currency]||0)+Math.max(0,main(accountBalance(a),a.currency)));
  const rows=Object.entries(exposure).sort((a,b)=>b[1]-a[1]);
  make("accounts-currency-chart",{type:"doughnut",data:{labels:rows.map(x=>x[0]),datasets:[{data:rows.map(x=>x[1]),backgroundColor:palette,borderColor:panelColor(),borderWidth:3}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"bottom",labels:{color:textColor(),usePointStyle:true}},tooltip:{callbacks:{label:c=>`${c.label}: ${App.money(c.raw)}`}}}},plugins:[emptyPlugin("No currency balances available")]});
}
function renderTransactions(){
  const transactions=filteredTransactions();
  const cats=categoryTotals(transactions).slice(0,10);
  make("transactions-category-chart",{type:"pie",data:{labels:cats.map(x=>x[0]),datasets:[{data:cats.map(x=>x[1]),backgroundColor:palette,borderColor:panelColor(),borderWidth:2}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"bottom",labels:{color:textColor(),usePointStyle:true}},tooltip:{callbacks:{label:c=>`${c.label}: ${App.money(c.raw)}`}}}},plugins:[emptyPlugin("No expense data matches these filters")]});
  const dates=[];const now=new Date();
  for(let i=29;i>=0;i--){const d=new Date(now);d.setDate(now.getDate()-i);dates.push(d.toISOString().slice(0,10))}
  const values=dates.map(date=>transactions.filter(t=>t.type==="expense"&&t.date===date).reduce((s,t)=>s+main(t.amount,t.currency),0));
  make("transactions-daily-chart",{type:"line",data:{labels:dates.map(d=>new Date(`${d}T12:00:00`).toLocaleDateString(undefined,{month:"short",day:"numeric"})),datasets:[{label:"Daily spending",data:values,borderColor:"#14b8a6",backgroundColor:"rgba(20,184,166,.16)",fill:true,tension:.32,pointRadius:2}]},
    options:baseOptions(),plugins:[emptyPlugin("No expenses during the last 30 days")]});
}
function renderBudgets(){
  const budgets=state().budgets||[];
  const labels=[],used=[],remaining=[];
  budgets.forEach(b=>{
    const limit=main(b.limit,b.currency||state().mainCurrency);
    const spent=(state().transactions||[]).filter(t=>t.type==="expense"&&t.category===b.category&&t.date?.startsWith(monthKey(new Date()))).reduce((s,t)=>s+main(t.amount,t.currency),0);
    labels.push(b.category);used.push(Math.min(spent,limit));remaining.push(Math.max(0,limit-spent));
  });
  make("budget-progress-chart",{type:"bar",data:{labels,datasets:[
    {label:"Used",data:used,backgroundColor:"rgba(239,68,68,.78)",borderRadius:6},
    {label:"Remaining",data:remaining,backgroundColor:"rgba(20,184,166,.72)",borderRadius:6}
  ]},options:baseOptions({indexAxis:"y",scales:{x:{stacked:true,ticks:{color:mutedColor(),callback:moneyTick},grid:{color:lineColor()}},y:{stacked:true,ticks:{color:mutedColor()},grid:{display:false}}}}),plugins:[emptyPlugin("Create a budget to see progress")]});
}
function renderInvestments(){
  const items=state().investments||[];
  make("investments-performance-chart",{type:"bar",data:{labels:items.map(i=>i.name),datasets:[
    {label:"Invested cost",data:items.map(i=>main(i.cost,i.currency)),backgroundColor:"rgba(100,116,139,.65)",borderRadius:7},
    {label:"Current value",data:items.map(i=>main(i.value,i.currency)),backgroundColor:"rgba(37,99,235,.78)",borderRadius:7}
  ]},options:baseOptions(),plugins:[emptyPlugin("Add an investment to compare performance")]});
  const allocation=items.map(i=>[i.name,main(i.value,i.currency)]).filter(x=>x[1]>0);
  make("investments-allocation-chart",{type:"doughnut",data:{labels:allocation.map(x=>x[0]),datasets:[{data:allocation.map(x=>x[1]),backgroundColor:palette,borderColor:panelColor(),borderWidth:3}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:"55%",plugins:{legend:{position:"bottom",labels:{color:textColor(),usePointStyle:true}},tooltip:{callbacks:{label:c=>`${c.label}: ${App.money(c.raw)}`}}}},plugins:[emptyPlugin("No investment allocation available")]});
}
function renderGoals(){
  const goals=state().goals||[];
  make("goals-progress-chart",{type:"bar",data:{labels:goals.map(g=>g.name),datasets:[
    {label:"Saved",data:goals.map(g=>main(g.current,g.currency)),backgroundColor:"rgba(20,184,166,.78)",borderRadius:6},
    {label:"Remaining",data:goals.map(g=>Math.max(0,main(g.target-g.current,g.currency))),backgroundColor:"rgba(37,99,235,.24)",borderRadius:6}
  ]},options:baseOptions({indexAxis:"y",scales:{x:{stacked:true,ticks:{color:mutedColor(),callback:moneyTick},grid:{color:lineColor()}},y:{stacked:true,ticks:{color:mutedColor()},grid:{display:false}}}}),plugins:[emptyPlugin("Create a savings goal to see progress")]});
}
function renderInsights(){
  const months=lastMonths(12);
  const income=months.map(m=>(state().transactions||[]).filter(t=>t.type==="income"&&t.date?.startsWith(monthKey(m))).reduce((s,t)=>s+main(t.amount,t.currency),0));
  const expense=months.map(m=>(state().transactions||[]).filter(t=>t.type==="expense"&&t.date?.startsWith(monthKey(m))).reduce((s,t)=>s+main(t.amount,t.currency),0));
  make("insights-monthly-chart",{type:"line",data:{labels:months.map(shortMonth),datasets:[
    {label:"Income",data:income,borderColor:"#14b8a6",backgroundColor:"rgba(20,184,166,.11)",tension:.3,fill:false},
    {label:"Expenses",data:expense,borderColor:"#ef4444",backgroundColor:"rgba(239,68,68,.11)",tension:.3,fill:false},
    {label:"Net savings",data:income.map((v,i)=>v-expense[i]),borderColor:"#2563eb",backgroundColor:"rgba(37,99,235,.11)",tension:.3,fill:false}
  ]},options:baseOptions(),plugins:[emptyPlugin("Add transactions to build financial trends")]});
}
function renderAll(){
  if(!state()||!window.Chart)return;
  Chart.defaults.font.family='Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
  Chart.defaults.color=textColor();
  renderDashboard();renderAccounts();renderTransactions();renderBudgets();renderInvestments();renderGoals();renderInsights();
}
let timer;
function schedule(){clearTimeout(timer);timer=setTimeout(renderAll,100)}
window.addEventListener("nomad:user-ready",schedule);
window.addEventListener("nomad:state-saved",schedule);
window.addEventListener("nomad:state-replaced",schedule);
window.addEventListener("nomad:transactions-rendered",schedule);
window.addEventListener("resize",schedule);
document.addEventListener("change",event=>{if(event.target.closest(".transaction-filter-control"))schedule()});
document.addEventListener("input",event=>{if(event.target.closest(".transaction-filter-control"))schedule()});
document.addEventListener("click",event=>{if(event.target.closest("[data-page],.theme-toggle,#clear-transaction-filters"))setTimeout(renderAll,180)});
if(App?.getState())schedule();
