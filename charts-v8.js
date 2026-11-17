const App=window.NomadApp;
const charts=new Map();
const paletteLight=["#664930","#CCBEB1","#997E67","#FFDBBB","#A96151","#8F9E84","#4F7258","#C5A184","#B68C86","#87766A"];
const paletteDark=["#FFFFFF","#C9C9C9","#7D7D7D","#A0A0A0","#555555","#E3E3E3","#969696","#D1D1D1","#6E6E6E","#B9B9B9"];
function isDark(){return document.documentElement.dataset.theme==="dark"}
function palette(){return isDark()?paletteDark:paletteLight}
function chartColor(light,dark){return isDark()?dark:light}

function state(){return App?.getState()}
function main(value,currency){return App.inMain(Number(value)||0,currency)}
function monthKey(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`}
function shortMonth(date){return date.toLocaleDateString(undefined,{month:"short",year:"2-digit"})}
function textColor(){return getComputedStyle(document.documentElement).getPropertyValue("--text").trim()||"#172033"}
function mutedColor(){return getComputedStyle(document.documentElement).getPropertyValue("--muted").trim()||"#87766A"}
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
    {label:"Income",data:income,backgroundColor:chartColor("rgba(102,73,48,.78)","rgba(238,238,238,.85)"),borderRadius:7},
    {label:"Expenses",data:expense,backgroundColor:chartColor("rgba(169,97,81,.72)","rgba(145,145,145,.9)"),borderRadius:7}
  ]},options:baseOptions(),plugins:[emptyPlugin("Add transactions to see monthly cash flow")]});
  const now=monthKey(new Date()),cats=categoryTotals((state().transactions||[]).filter(t=>t.date?.startsWith(now))).slice(0,8);
  make("dashboard-category-chart",{type:"doughnut",data:{labels:cats.map(x=>x[0]),datasets:[{data:cats.map(x=>x[1]),backgroundColor:palette(),borderColor:panelColor(),borderWidth:3}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:"58%",plugins:{legend:{position:"bottom",labels:{color:textColor(),usePointStyle:true}},tooltip:{callbacks:{label:c=>`${c.label}: ${App.money(c.raw)}`}}}},plugins:[emptyPlugin("No expenses recorded this month")]});
}
function renderAccounts(){
  const accounts=(state().accounts||[]).filter(a=>a.type!=="Debt");
  make("accounts-balance-chart",{type:"bar",data:{labels:accounts.map(a=>a.name),datasets:[{label:"Balance",data:accounts.map(a=>main(accountBalance(a),a.currency)),backgroundColor:palette(),borderRadius:8}]},
    options:baseOptions({indexAxis:accounts.length>5?"y":"x"}),plugins:[emptyPlugin("Add an account to see balances")]});
  const exposure={};accounts.forEach(a=>exposure[a.currency]=(exposure[a.currency]||0)+Math.max(0,main(accountBalance(a),a.currency)));
  const rows=Object.entries(exposure).sort((a,b)=>b[1]-a[1]);
  make("accounts-currency-chart",{type:"doughnut",data:{labels:rows.map(x=>x[0]),datasets:[{data:rows.map(x=>x[1]),backgroundColor:palette(),borderColor:panelColor(),borderWidth:3}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"bottom",labels:{color:textColor(),usePointStyle:true}},tooltip:{callbacks:{label:c=>`${c.label}: ${App.money(c.raw)}`}}}},plugins:[emptyPlugin("No currency balances available")]});
}
function renderTransactions(){
  const transactions=filteredTransactions();
  const cats=categoryTotals(transactions).slice(0,10);
  make("transactions-category-chart",{type:"pie",data:{labels:cats.map(x=>x[0]),datasets:[{data:cats.map(x=>x[1]),backgroundColor:palette(),borderColor:panelColor(),borderWidth:2}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"bottom",labels:{color:textColor(),usePointStyle:true}},tooltip:{callbacks:{label:c=>`${c.label}: ${App.money(c.raw)}`}}}},plugins:[emptyPlugin("No expense data matches these filters")]});
  const dates=[];const now=new Date();
  for(let i=29;i>=0;i--){const d=new Date(now);d.setDate(now.getDate()-i);dates.push(d.toISOString().slice(0,10))}
  const values=dates.map(date=>transactions.filter(t=>t.type==="expense"&&t.date===date).reduce((s,t)=>s+main(t.amount,t.currency),0));
  make("transactions-daily-chart",{type:"line",data:{labels:dates.map(d=>new Date(`${d}T12:00:00`).toLocaleDateString(undefined,{month:"short",day:"numeric"})),datasets:[{label:"Daily spending",data:values,borderColor:chartColor("#664930","#F5F5F5"),backgroundColor:chartColor("rgba(102,73,48,.16)","rgba(238,238,238,.12)"),fill:true,tension:.32,pointRadius:2}]},
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
    {label:"Used",data:used,backgroundColor:chartColor("rgba(169,97,81,.78)","rgba(145,145,145,.9)"),borderRadius:6},
    {label:"Remaining",data:remaining,backgroundColor:chartColor("rgba(102,73,48,.72)","rgba(238,238,238,.85)"),borderRadius:6}
  ]},options:baseOptions({indexAxis:"y",scales:{x:{stacked:true,ticks:{color:mutedColor(),callback:moneyTick},grid:{color:lineColor()}},y:{stacked:true,ticks:{color:mutedColor()},grid:{display:false}}}}),plugins:[emptyPlugin("Create a budget to see progress")]});
}
function renderInvestments(){
  const items=state().investments||[];
  make("investments-performance-chart",{type:"bar",data:{labels:items.map(i=>i.name),datasets:[
    {label:"Invested cost",data:items.map(i=>main(i.cost,i.currency)),backgroundColor:chartColor("rgba(153,126,103,.65)","rgba(145,145,145,.9)"),borderRadius:7},
    {label:"Current value",data:items.map(i=>main(i.value,i.currency)),backgroundColor:chartColor("rgba(102,73,48,.78)","rgba(238,238,238,.85)"),borderRadius:7}
  ]},options:baseOptions(),plugins:[emptyPlugin("Add an investment to compare performance")]});
  const allocation=items.map(i=>[i.name,main(i.value,i.currency)]).filter(x=>x[1]>0);
  make("investments-allocation-chart",{type:"doughnut",data:{labels:allocation.map(x=>x[0]),datasets:[{data:allocation.map(x=>x[1]),backgroundColor:palette(),borderColor:panelColor(),borderWidth:3}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:"55%",plugins:{legend:{position:"bottom",labels:{color:textColor(),usePointStyle:true}},tooltip:{callbacks:{label:c=>`${c.label}: ${App.money(c.raw)}`}}}},plugins:[emptyPlugin("No investment allocation available")]});
}
function renderGoals(){
  const goals=state().goals||[];
  make("goals-progress-chart",{type:"bar",data:{labels:goals.map(g=>g.name),datasets:[
    {label:"Saved",data:goals.map(g=>main(g.current,g.currency)),backgroundColor:chartColor("rgba(102,73,48,.78)","rgba(238,238,238,.85)"),borderRadius:6},
    {label:"Remaining",data:goals.map(g=>Math.max(0,main(g.target-g.current,g.currency))),backgroundColor:chartColor("rgba(153,126,103,.24)","rgba(183,183,183,.26)"),borderRadius:6}
  ]},options:baseOptions({indexAxis:"y",scales:{x:{stacked:true,ticks:{color:mutedColor(),callback:moneyTick},grid:{color:lineColor()}},y:{stacked:true,ticks:{color:mutedColor()},grid:{display:false}}}}),plugins:[emptyPlugin("Create a savings goal to see progress")]});
}
function renderInsights(){
  const months=lastMonths(12);
  const income=months.map(m=>(state().transactions||[]).filter(t=>t.type==="income"&&t.date?.startsWith(monthKey(m))).reduce((s,t)=>s+main(t.amount,t.currency),0));
  const expense=months.map(m=>(state().transactions||[]).filter(t=>t.type==="expense"&&t.date?.startsWith(monthKey(m))).reduce((s,t)=>s+main(t.amount,t.currency),0));
  make("insights-monthly-chart",{type:"line",data:{labels:months.map(shortMonth),datasets:[
    {label:"Income",data:income,borderColor:chartColor("#664930","#F5F5F5"),backgroundColor:chartColor("rgba(102,73,48,.11)","rgba(240,240,240,.10)"),tension:.3,fill:false},
    {label:"Expenses",data:expense,borderColor:chartColor("#A96151","#B5B5B5"),backgroundColor:chartColor("rgba(169,97,81,.11)","rgba(155,155,155,.10)"),tension:.3,fill:false},
    {label:"Net savings",data:income.map((v,i)=>v-expense[i]),borderColor:chartColor("#CCBEB1","#858585"),backgroundColor:chartColor("rgba(153,126,103,.11)","rgba(195,195,195,.10)"),tension:.3,fill:false}
  ]},options:baseOptions(),plugins:[emptyPlugin("Add transactions to build financial trends")]});
}
function renderAll(){
  if(!state()||!window.Chart)return;
  Chart.defaults.font.family=getComputedStyle(document.documentElement).getPropertyValue("--app-font-family").trim()||'Manrope, system-ui, sans-serif';
  Chart.defaults.color=textColor();
  renderDashboard();renderAccounts();renderTransactions();renderBudgets();renderInvestments();renderGoals();renderInsights();
}
let timer;
function schedule(){clearTimeout(timer);timer=setTimeout(renderAll,100)}
window.addEventListener("nomad:user-ready",schedule);
window.addEventListener("nomad:state-saved",schedule);
window.addEventListener("nomad:state-replaced",schedule);
window.addEventListener("nomad:transactions-rendered",schedule);
window.addEventListener("nomad:theme-changed",schedule);
window.addEventListener("resize",schedule);
document.addEventListener("change",event=>{if(event.target.closest(".transaction-filter-control"))schedule()});
document.addEventListener("input",event=>{if(event.target.closest(".transaction-filter-control"))schedule()});
document.addEventListener("click",event=>{if(event.target.closest("[data-page],.theme-toggle,#clear-transaction-filters"))setTimeout(renderAll,180)});
if(App?.getState())schedule();
