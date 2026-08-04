const App=window.NomadApp;
let recurringProcessing=false;

function state(){return App?.getState()}
function money(v,c){return App.money(v,c)}
function mainAmount(t){return Math.abs(App.inMain(t.amount,t.currency))}
function isoDate(date){return date.toISOString().slice(0,10)}
function monthKey(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`}
function startOfMonth(date){return new Date(date.getFullYear(),date.getMonth(),1)}
function addFrequency(date,frequency){
  const d=new Date(date);
  if(frequency==="weekly")d.setDate(d.getDate()+7);
  else if(frequency==="monthly")d.setMonth(d.getMonth()+1);
  else if(frequency==="yearly")d.setFullYear(d.getFullYear()+1);
  return d;
}
function nextOccurrence(transaction){
  if(!transaction.frequency||transaction.frequency==="once")return null;
  let next=new Date(`${transaction.date}T12:00:00`);
  const today=new Date();today.setHours(0,0,0,0);
  while(next<=today)next=addFrequency(next,transaction.frequency);
  return next;
}
function processRecurringTransactions(){
  if(recurringProcessing||!state())return;
  recurringProcessing=true;
  const s=state();
  const today=new Date();today.setHours(23,59,59,999);
  const additions=[];
  s.transactions.filter(t=>t.frequency&&t.frequency!=="once"&&!t.generatedFrom).forEach(source=>{
    const seriesId=source.recurringSeriesId||source.id;
    source.recurringSeriesId=seriesId;
    let next=addFrequency(new Date(`${source.date}T12:00:00`),source.frequency);
    let safety=0;
    while(next<=today&&safety<240){
      const date=isoDate(next);
      const exists=s.transactions.some(t=>t.recurringSeriesId===seriesId&&t.date===date);
      if(!exists)additions.push({
        ...source,id:crypto.randomUUID(),date,createdAt:new Date().toISOString(),
        frequency:"once",generatedFrom:source.id,recurringSeriesId:seriesId,
        note:source.note?`${source.note} · recurring`:"Recurring entry"
      });
      next=addFrequency(next,source.frequency);safety++;
    }
  });
  if(additions.length){s.transactions.push(...additions);App.save(`${additions.length} recurring transaction${additions.length===1?"":"s"} added`)}
  recurringProcessing=false;
}

function populateTransactionFilters(){
  const s=state();if(!s)return;
  const category=document.querySelector("#transaction-category-filter");
  const country=document.querySelector("#transaction-country-filter");
  if(category){
    const selected=category.value||"all";
    const categories=[...new Set(s.transactions.map(t=>t.category).filter(Boolean))].sort();
    category.innerHTML='<option value="all">All categories</option>'+categories.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
    category.value=categories.includes(selected)?selected:"all";
  }
  if(country){
    const selected=country.value||"all";
    const countries=[...new Set(s.transactions.map(t=>App.normalizeCountryCode(t.country)))].sort((a,b)=>App.countryName(a).localeCompare(App.countryName(b)));
    country.innerHTML='<option value="all">All countries</option>'+countries.map(c=>`<option value="${c}">${escapeHtml(App.countryName(c))}</option>`).join("");
    country.value=countries.includes(selected)?selected:"all";
  }
}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

function monthlyStats(offset=0){
  const now=new Date();
  const target=new Date(now.getFullYear(),now.getMonth()+offset,1);
  const key=monthKey(target);
  const items=state().transactions.filter(t=>t.date?.startsWith(key));
  const income=items.filter(t=>t.type==="income").reduce((sum,t)=>sum+App.inMain(t.amount,t.currency),0);
  const expense=items.filter(t=>t.type==="expense").reduce((sum,t)=>sum+App.inMain(t.amount,t.currency),0);
  return {income,expense,saved:income-expense,items};
}
function spendingByCategory(){
  const items=monthlyStats(0).items.filter(t=>t.type==="expense");
  const result={};
  items.forEach(t=>result[t.category]=(result[t.category]||0)+App.inMain(t.amount,t.currency));
  return Object.entries(result).sort((a,b)=>b[1]-a[1]);
}
function currentNetWorth(){
  const s=state();
  const cash=s.accounts.filter(a=>a.type!=="Debt").reduce((sum,a)=>{
    const balance=a.openingBalance+s.transactions.filter(t=>t.accountId===a.id).reduce((x,t)=>x+(t.type==="income"?t.amount:-t.amount),0);
    return sum+App.inMain(balance,a.currency);
  },0);
  const debt=s.accounts.filter(a=>a.type==="Debt").reduce((sum,a)=>sum+Math.abs(App.inMain(a.openingBalance,a.currency)),0);
  const investments=s.investments.reduce((sum,i)=>sum+App.inMain(i.value,i.currency),0);
  return cash+investments-debt;
}
function recordNetWorthSnapshot(){
  const s=state();if(!s)return;
  const month=monthKey(new Date());
  const value=currentNetWorth();
  const found=s.netWorthSnapshots.find(x=>x.month===month);
  if(found)found.value=value;else s.netWorthSnapshots.push({month,value,recordedAt:new Date().toISOString()});
  s.netWorthSnapshots=s.netWorthSnapshots.sort((a,b)=>a.month.localeCompare(b.month)).slice(-24);
  localStorage.setItem(`nomad_snapshot_${App.getUser()?.id||"guest"}`,JSON.stringify(s.netWorthSnapshots));
}

function renderMonthlySummary(){
  const current=monthlyStats(0),previous=monthlyStats(-1);
  const difference=current.expense-previous.expense;
  const percent=previous.expense?difference/previous.expense*100:null;
  const thisEl=document.querySelector("#summary-this-month");
  if(thisEl)thisEl.textContent=money(current.expense);
  const vs=document.querySelector("#summary-vs-last");
  if(vs)vs.textContent=percent===null?"No previous-month comparison":`${Math.abs(percent).toFixed(0)}% ${percent<=0?"less":"more"} than last month`;
  const categories=spendingByCategory();
  const top=document.querySelector("#summary-top-category");
  const topValue=document.querySelector("#summary-top-category-value");
  if(top)top.textContent=categories[0]?.[0]||"No spending";
  if(topValue)topValue.textContent=categories[0]?money(categories[0][1]):"Add an expense to begin";
  const recurring=monthlyStats(0).items.filter(t=>t.generatedFrom).length;
  const recurringEl=document.querySelector("#summary-recurring");if(recurringEl)recurringEl.textContent=String(recurring);
  const comparison=document.querySelector("#monthly-comparison");
  if(comparison)comparison.innerHTML=[
    ["Income this month",current.income],["Expenses this month",current.expense],["Saved this month",current.saved],
    ["Expenses last month",previous.expense]
  ].map(([label,value])=>`<article><span>${label}</span><strong>${money(value)}</strong></article>`).join("");
}

function drawPie(){
  const canvas=document.querySelector("#category-chart");if(!canvas)return;
  const ctx=canvas.getContext("2d"),data=spendingByCategory(),dpr=devicePixelRatio||1;
  const width=canvas.clientWidth||520,height=300;canvas.width=width*dpr;canvas.height=height*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,width,height);
  const colors=["#14b8a6","#2563eb","#f59e0b","#8b5cf6","#ef4444","#06b6d4","#84cc16","#f97316"];
  const total=data.reduce((s,x)=>s+x[1],0),cx=width*.42,cy=height/2,r=Math.min(width*.28,height*.38);
  if(!total){ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue("--muted");ctx.font="16px system-ui";ctx.textAlign="center";ctx.fillText("No spending data yet",width/2,height/2);return}
  let angle=-Math.PI/2;
  data.forEach(([_,value],i)=>{const portion=value/total*Math.PI*2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,angle,angle+portion);ctx.closePath();ctx.fillStyle=colors[i%colors.length];ctx.fill();angle+=portion});
  ctx.beginPath();ctx.arc(cx,cy,r*.55,0,Math.PI*2);ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue("--panel")||"#fff";ctx.fill();
  ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue("--text")||"#172033";ctx.textAlign="center";ctx.font="700 18px system-ui";ctx.fillText(money(total),cx,cy+5);
  const legend=document.querySelector("#category-chart-legend");
  if(legend)legend.innerHTML=data.slice(0,8).map(([name,value],i)=>`<div><i style="background:${colors[i%colors.length]}"></i><span>${escapeHtml(name)}</span><strong>${money(value)}</strong></div>`).join("");
}
function drawLine(){
  const canvas=document.querySelector("#net-worth-chart");if(!canvas)return;
  const ctx=canvas.getContext("2d"),snapshots=state().netWorthSnapshots||[],dpr=devicePixelRatio||1;
  const width=canvas.clientWidth||520,height=300;canvas.width=width*dpr;canvas.height=height*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,width,height);
  if(snapshots.length<2){ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue("--muted");ctx.font="16px system-ui";ctx.textAlign="center";ctx.fillText("Trend appears after multiple monthly snapshots",width/2,height/2);return}
  const values=snapshots.map(x=>x.value),min=Math.min(...values),max=Math.max(...values),range=max-min||1,pad=35;
  ctx.strokeStyle="#334155";ctx.globalAlpha=.25;ctx.beginPath();ctx.moveTo(pad,pad);ctx.lineTo(pad,height-pad);ctx.lineTo(width-pad,height-pad);ctx.stroke();ctx.globalAlpha=1;
  ctx.strokeStyle="#14b8a6";ctx.lineWidth=4;ctx.beginPath();
  snapshots.forEach((x,i)=>{const px=pad+i*(width-2*pad)/(snapshots.length-1),py=height-pad-(x.value-min)/range*(height-2*pad);if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py)});
  ctx.stroke();
  snapshots.forEach((x,i)=>{const px=pad+i*(width-2*pad)/(snapshots.length-1),py=height-pad-(x.value-min)/range*(height-2*pad);ctx.beginPath();ctx.arc(px,py,5,0,Math.PI*2);ctx.fillStyle="#2563eb";ctx.fill()});
  const caption=document.querySelector("#net-worth-trend-caption");
  if(caption){const first=snapshots[0].value,last=snapshots.at(-1).value;caption.textContent=`${snapshots[0].month} to ${snapshots.at(-1).month}: ${money(last-first)} change`;}
}

function renderUpcoming(){
  const list=document.querySelector("#upcoming-recurring");if(!list)return;
  const recurring=state().transactions.filter(t=>t.frequency&&t.frequency!=="once"&&!t.generatedFrom).map(t=>({t,date:nextOccurrence(t)})).filter(x=>x.date).sort((a,b)=>a.date-b.date);
  if(!recurring.length){list.innerHTML='<div class="empty-state"><div class="empty-state-icon">↻</div><h3>No recurring transactions yet</h3><p>Set a transaction to weekly, monthly or yearly to automate future entries.</p></div>';return}
  list.innerHTML=recurring.slice(0,10).map(({t,date})=>`<article class="upcoming-item"><div><strong>${escapeHtml(t.category)}</strong><small>${t.type==="income"?"Income":"Bill"} · ${escapeHtml(t.frequency)}</small></div><span>${date.toLocaleDateString()}</span><strong>${money(t.amount,t.currency)}</strong></article>`).join("");
}
async function enableNotifications(){
  if(!("Notification" in window)){App.toast("Notifications are not supported in this browser");return}
  const permission=await Notification.requestPermission();
  if(permission==="granted"){localStorage.setItem("nomad_notifications","enabled");App.toast("Bill reminders enabled");checkNotifications()}
  else App.toast("Notification permission was not granted");
}
function checkNotifications(){
  if(Notification.permission!=="granted"||localStorage.getItem("nomad_notifications")!=="enabled")return;
  const now=new Date(),limit=new Date();limit.setDate(limit.getDate()+3);
  state().transactions.filter(t=>t.frequency&&t.frequency!=="once"&&!t.generatedFrom).forEach(t=>{
    const date=nextOccurrence(t);
    if(date&&date>=now&&date<=limit){
      const key=`nomad_notice_${t.id}_${isoDate(date)}`;
      if(!localStorage.getItem(key)){new Notification(`Upcoming ${t.type==="income"?"income":"bill"}: ${t.category}`,{body:`${money(t.amount,t.currency)} due ${date.toLocaleDateString()}`,icon:"icon-192.png"});localStorage.setItem(key,"1")}
    }
  });
}

function renderGoals(){
  const list=document.querySelector("#goals-list");if(!list)return;
  const goals=state().goals||[];
  if(!goals.length){list.innerHTML='<div class="empty-state"><div class="empty-state-icon">◎</div><h3>No savings goals yet</h3><p>Create a goal for an emergency fund, property, travel or another milestone.</p><span>Use “Add goal” to begin.</span></div>';return}
  list.innerHTML=goals.map(g=>{const pct=Math.min(100,g.current/g.target*100);return `<article class="goal-card">
    <div class="goal-card-head"><div><strong>${escapeHtml(g.name)}</strong><small>${g.targetDate?`Target ${escapeHtml(g.targetDate)}`:"No target date"}</small></div><button class="goal-delete" data-goal-delete="${g.id}" aria-label="Delete goal">×</button></div>
    <div class="goal-amount"><strong>${money(g.current,g.currency)}</strong><span>of ${money(g.target,g.currency)}</span></div>
    <div class="progress"><span style="width:${pct}%"></span></div><small>${pct.toFixed(0)}% complete</small>
    <form class="goal-contribution-form" data-goal-id="${g.id}"><input name="amount" type="number" min="0.01" step="0.01" placeholder="Add savings" required><button class="secondary" type="submit">Add</button></form>
  </article>`}).join("");
}
function exportCSV(){
  const headers=["Date","Type","Category","Account","Country","Original Amount","Currency","Main Currency Amount","Main Currency","Note","Recurring"];
  const rows=state().transactions.map(t=>{const account=state().accounts.find(a=>a.id===t.accountId);return [t.date,t.type,t.category,account?.name||"",App.countryName(t.country),t.amount,t.currency,App.inMain(t.amount,t.currency),state().mainCurrency,t.note||"",t.frequency||"once"]});
  const csv=[headers,...rows].map(row=>row.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`nomad-wealth-transactions-${isoDate(new Date())}.csv`;a.click();URL.revokeObjectURL(a.href);
}
function exportPDF(){
  const current=monthlyStats(0),categories=spendingByCategory(),win=window.open("","_blank");
  if(!win){App.toast("Allow pop-ups to export the PDF report");return}
  win.document.write(`<!doctype html><html><head><title>Nomad Wealth Report</title><style>body{font-family:Arial;padding:40px;color:#172033}h1{margin-bottom:4px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.card{border:1px solid #ddd;border-radius:12px;padding:16px}.card strong{display:block;font-size:24px;margin-top:8px}table{width:100%;border-collapse:collapse;margin-top:25px}th,td{text-align:left;padding:9px;border-bottom:1px solid #ddd}.muted{color:#64748b}@media print{button{display:none}}</style></head><body>
  <h1>Nomad Wealth Monthly Report</h1><p class="muted">${new Date().toLocaleDateString(undefined,{month:"long",year:"numeric"})} · Generated ${new Date().toLocaleString()}</p>
  <div class="grid"><div class="card">Income<strong>${money(current.income)}</strong></div><div class="card">Expenses<strong>${money(current.expense)}</strong></div><div class="card">Saved<strong>${money(current.saved)}</strong></div></div>
  <h2>Spending by category</h2><table><thead><tr><th>Category</th><th>Amount</th></tr></thead><tbody>${categories.map(([c,v])=>`<tr><td>${escapeHtml(c)}</td><td>${money(v)}</td></tr>`).join("")||'<tr><td colspan="2">No spending data</td></tr>'}</tbody></table>
  <h2>Recent transactions</h2><table><thead><tr><th>Date</th><th>Category</th><th>Type</th><th>Amount</th></tr></thead><tbody>${[...state().transactions].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,20).map(t=>`<tr><td>${t.date}</td><td>${escapeHtml(t.category)}</td><td>${t.type}</td><td>${money(t.amount,t.currency)}</td></tr>`).join("")}</tbody></table>
  <p class="muted">Nomad Wealth · Developed by Hafizuddin</p><script>window.onload=()=>window.print()<\/script></body></html>`);win.document.close();
}
function refreshFeatureUI(){
  if(!state())return;
  populateTransactionFilters();renderMonthlySummary();recordNetWorthSnapshot();drawPie();drawLine();renderUpcoming();renderGoals();checkNotifications();
}

document.querySelector("#goal-form")?.addEventListener("submit",event=>{
  event.preventDefault();const f=new FormData(event.currentTarget),s=state();
  s.goals.push({id:crypto.randomUUID(),name:f.get("name").trim(),target:Number(f.get("target")),current:Number(f.get("current"))||0,currency:f.get("currency"),targetDate:f.get("target_date")||""});
  event.currentTarget.reset();event.currentTarget.closest("dialog").close();App.save("Savings goal created");renderGoals();
});
document.addEventListener("submit",event=>{
  const form=event.target.closest(".goal-contribution-form");if(!form)return;
  event.preventDefault();const goal=state().goals.find(g=>g.id===form.dataset.goalId);if(!goal)return;goal.current=Math.min(goal.target,goal.current+Number(new FormData(form).get("amount")));form.reset();App.save("Goal progress updated");renderGoals();
});
document.addEventListener("click",event=>{
  const del=event.target.closest("[data-goal-delete]");if(del&&confirm("Delete this savings goal?")){state().goals=state().goals.filter(g=>g.id!==del.dataset.goalDelete);App.save("Goal deleted");renderGoals()}
});
["#export-csv","#export-csv-settings"].forEach(s=>document.querySelector(s)?.addEventListener("click",exportCSV));
["#export-pdf","#export-pdf-settings"].forEach(s=>document.querySelector(s)?.addEventListener("click",exportPDF));
["#enable-reminders","#enable-reminders-settings"].forEach(s=>document.querySelector(s)?.addEventListener("click",enableNotifications));

window.addEventListener("nomad:user-ready",()=>{processRecurringTransactions();refreshFeatureUI()});
window.addEventListener("nomad:state-saved",refreshFeatureUI);
window.addEventListener("nomad:state-replaced",refreshFeatureUI);
window.addEventListener("nomad:transactions-rendered",populateTransactionFilters);
window.addEventListener("resize",()=>{clearTimeout(window.__charts);window.__charts=setTimeout(()=>{drawPie();drawLine()},150)});
if(App?.getState())setTimeout(()=>{processRecurringTransactions();refreshFeatureUI()},300);
