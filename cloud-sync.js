const App=window.NomadApp;
const supabase=window.NomadSupabase;
let currentWorkspaceId=null;
let workspaces=[];
let applyingRemote=false;
let pushTimer=null;
let channel=null;
let lastCloudVersion=null;

const tables=["accounts","transactions","budgets","investments","savings_goals","net_worth_snapshots","recurring_rules","reminders"];

function status(title,detail=""){
  document.querySelector("#cloud-sync-status").textContent=title;
  document.querySelector("#cloud-sync-detail").textContent=detail;
}
function esc(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function isMeaningfulLocalState(s){
  return Boolean(s&&(s.accounts?.length||s.transactions?.length||s.budgets?.length||s.investments?.length||s.goals?.length));
}
async function rpc(name,args={}){
  const {data,error}=await supabase.rpc(name,args);
  if(error)throw error;
  return data;
}
async function acceptEmailInvitations(){
  try{await rpc("accept_my_workspace_invitations")}catch(error){console.warn("Invitation acceptance:",error.message)}
}
async function ensurePersonalWorkspace(){
  return await rpc("ensure_personal_workspace_v7");
}
async function loadWorkspaces(){
  const {data,error}=await supabase.from("workspace_members")
    .select("workspace_id,role,finance_workspaces!inner(id,name,is_personal,owner_id,created_at)")
    .eq("user_id",App.getUser().id);
  if(error)throw error;
  workspaces=(data||[]).map(row=>({...row.finance_workspaces,role:row.role}));
  renderWorkspaces();
}
function renderWorkspaces(){
  const select=document.querySelector("#workspace-select");
  if(!select)return;
  select.innerHTML=workspaces.map(w=>`<option value="${w.id}">${esc(w.name)}${w.is_personal?" · Personal":""}</option>`).join("");
  if(currentWorkspaceId&&workspaces.some(w=>w.id===currentWorkspaceId))select.value=currentWorkspaceId;
  else if(workspaces.length){currentWorkspaceId=workspaces[0].id;select.value=currentWorkspaceId}
  const current=workspaces.find(w=>w.id===select.value);
  const details=document.querySelector("#workspace-details");
  if(details&&current){
    details.innerHTML=`<div><span>Your permission</span><strong>${esc(current.role)}</strong></div>
      <div><span>Workspace type</span><strong>${current.is_personal?"Personal":"Shared"}</strong></div>
      <small>${current.role==="viewer"?"You can view this workspace but cannot change its data.":"Changes are synchronized to approved members and your other devices."}</small>`;
  }
}
async function loadInvitations(){
  if(!currentWorkspaceId)return;
  const {data,error}=await supabase.from("workspace_invitations")
    .select("id,email,relationship,role,status,created_at")
    .eq("workspace_id",currentWorkspaceId)
    .order("created_at",{ascending:false});
  const target=document.querySelector("#workspace-invitations");
  if(!target)return;
  if(error){target.innerHTML=`<p class="muted">${esc(error.message)}</p>`;return}
  target.innerHTML=(data||[]).length?(data||[]).map(inv=>`<article class="invite-row">
    <div><strong>${esc(inv.email)}</strong><small>${esc(inv.relationship||"Trusted person")} · ${esc(inv.role)}</small></div>
    <span class="invite-status ${esc(inv.status)}">${esc(inv.status)}</span>
  </article>`).join(""):`<div class="compact-empty">No invitations sent yet.</div>`;
}
function mapCloudToState(rows,base){
  const s=structuredClone(base);
  s.accounts=(rows.accounts||[]).map(r=>({id:r.id,name:r.name,institution:r.institution,country:r.country_code,currency:r.currency,type:r.account_type,openingBalance:Number(r.opening_balance)}));
  s.transactions=(rows.transactions||[]).map(r=>({id:r.id,type:r.transaction_type,amount:Number(r.amount),currency:r.currency,category:r.category,country:r.country_code,accountId:r.account_id,date:r.transaction_date,createdAt:r.created_at,frequency:r.frequency||"once",note:r.note||"",generatedFrom:r.generated_from,recurringSeriesId:r.recurring_series_id}));
  s.budgets=(rows.budgets||[]).map(r=>({id:r.id,group:r.budget_group,category:r.category,limit:Number(r.amount_limit),currency:r.currency,country:r.country_code,rollover:Boolean(r.rollover)}));
  s.investments=(rows.investments||[]).map(r=>({id:r.id,name:r.name,type:r.investment_type,currency:r.currency,cost:Number(r.cost),value:Number(r.current_value)}));
  s.goals=(rows.savings_goals||[]).map(r=>({id:r.id,name:r.name,target:Number(r.target_amount),current:Number(r.current_amount),currency:r.currency,targetDate:r.target_date||"",linkedAccountId:r.linked_account_id||null}));
  s.netWorthSnapshots=(rows.net_worth_snapshots||[]).map(r=>({month:r.snapshot_month,value:Number(r.net_worth),recordedAt:r.created_at}));
  return s;
}
function stateToPayload(s){
  return {
    accounts:(s.accounts||[]).map(a=>({id:a.id,name:a.name,institution:a.institution||"",country_code:App.normalizeCountryCode(a.country),currency:a.currency,account_type:a.type,opening_balance:Number(a.openingBalance)||0})),
    transactions:(s.transactions||[]).map(t=>({id:t.id,account_id:t.accountId||null,transaction_type:t.type,amount:Number(t.amount)||0,currency:t.currency,category:t.category,country_code:App.normalizeCountryCode(t.country),transaction_date:t.date,note:t.note||"",frequency:t.frequency||"once",created_at:t.createdAt||new Date().toISOString(),generated_from:t.generatedFrom||null,recurring_series_id:t.recurringSeriesId||null})),
    budgets:(s.budgets||[]).map(b=>({id:b.id,budget_group:b.group,category:b.category,amount_limit:Number(b.limit)||0,currency:b.currency||s.mainCurrency,country_code:App.normalizeCountryCode(b.country),rollover:Boolean(b.rollover)})),
    investments:(s.investments||[]).map(i=>({id:i.id,name:i.name,investment_type:i.type,currency:i.currency,cost:Number(i.cost)||0,current_value:Number(i.value)||0})),
    savings_goals:(s.goals||[]).map(g=>({id:g.id,name:g.name,target_amount:Number(g.target)||0,current_amount:Number(g.current)||0,currency:g.currency,target_date:g.targetDate||null,linked_account_id:g.linkedAccountId||null})),
    net_worth_snapshots:(s.netWorthSnapshots||[]).map(n=>({snapshot_month:n.month,net_worth:Number(n.value)||0}))
  };
}
async function fetchWorkspaceData(){
  const results={};
  await Promise.all(tables.slice(0,6).map(async table=>{
    const {data,error}=await supabase.from(table).select("*").eq("workspace_id",currentWorkspaceId);
    if(error)throw error;
    results[table]=data||[];
  }));
  return results;
}
async function cloudHasData(){
  const {count,error}=await supabase.from("accounts").select("id",{count:"exact",head:true}).eq("workspace_id",currentWorkspaceId);
  if(error)throw error;
  if(count)return true;
  const tx=await supabase.from("transactions").select("id",{count:"exact",head:true}).eq("workspace_id",currentWorkspaceId);
  if(tx.error)throw tx.error;
  return Boolean(tx.count);
}
async function replaceCloudFromLocal(){
  status("Synchronizing…","Uploading your financial information securely.");
  await rpc("replace_workspace_data",{p_workspace_id:currentWorkspaceId,p_payload:stateToPayload(App.getState())});
  localStorage.setItem(`nomad_v7_migrated_${App.getUser().id}_${currentWorkspaceId}`,"1");
  status("Cloud sync active",`Saved ${new Date().toLocaleString()}`);
  subscribe();
}
async function loadCloudIntoApp(){
  status("Synchronizing…","Loading data from PostgreSQL.");
  const rows=await fetchWorkspaceData();
  applyingRemote=true;
  App.replaceState(mapCloudToState(rows,App.getState()),{persist:true});
  applyingRemote=false;
  status("Cloud sync active",`Loaded ${new Date().toLocaleString()}`);
  subscribe();
}
async function decideInitialData(){
  const hasCloud=await cloudHasData();
  const local=App.getState();
  const migrated=localStorage.getItem(`nomad_v7_migrated_${App.getUser().id}_${currentWorkspaceId}`);
  if(hasCloud){await loadCloudIntoApp();return}
  if(isMeaningfulLocalState(local)&&!migrated){
    const dialog=document.querySelector("#cloud-migration-dialog");
    dialog.showModal();
    return;
  }
  await replaceCloudFromLocal();
}
async function push(){
  if(!currentWorkspaceId||applyingRemote)return;
  const current=workspaces.find(w=>w.id===currentWorkspaceId);
  if(current?.role==="viewer"){status("View-only workspace","Only an editor or owner can save changes.");return}
  try{
    await rpc("replace_workspace_data",{p_workspace_id:currentWorkspaceId,p_payload:stateToPayload(App.getState())});
    status("Cloud sync active",`Saved ${new Date().toLocaleTimeString()}`);
  }catch(error){status("Sync error",error.message)}
}
function schedulePush(){
  if(applyingRemote)return;
  clearTimeout(pushTimer);
  pushTimer=setTimeout(push,800);
}
function subscribe(){
  if(channel)supabase.removeChannel(channel);
  channel=supabase.channel(`workspace-sync-${currentWorkspaceId}`)
    .on("postgres_changes",{event:"UPDATE",schema:"public",table:"workspace_sync",filter:`workspace_id=eq.${currentWorkspaceId}`},async payload=>{
      if(payload.new.updated_by===App.getUser()?.id)return;
      if(payload.new.version===lastCloudVersion)return;
      lastCloudVersion=payload.new.version;
      await loadCloudIntoApp();
      App.toast("Shared financial data updated");
    }).subscribe();
}
async function switchWorkspace(id){
  currentWorkspaceId=id;
  localStorage.setItem(`nomad_v7_workspace_${App.getUser().id}`,id);
  renderWorkspaces();
  await loadInvitations();
  await decideInitialData();
}
async function bootstrap(){
  if(!supabase){status("Cloud sync unavailable","Supabase is not configured.");return}
  try{
    status("Connecting…","Checking your secure workspace.");
    await acceptEmailInvitations();
    const personal=await ensurePersonalWorkspace();
    await loadWorkspaces();
    currentWorkspaceId=localStorage.getItem(`nomad_v7_workspace_${App.getUser().id}`)||personal;
    if(!workspaces.some(w=>w.id===currentWorkspaceId))currentWorkspaceId=personal;
    renderWorkspaces();
    await loadInvitations();
    await decideInitialData();
  }catch(error){
    console.error(error);
    status("Database update required","Run supabase-schema-v7.sql in Supabase SQL Editor, then refresh.");
  }
}

document.querySelector("#workspace-select")?.addEventListener("change",event=>switchWorkspace(event.target.value).catch(e=>App.toast(e.message)));
document.querySelector("#create-workspace-form")?.addEventListener("submit",async event=>{
  event.preventDefault();
  const name=new FormData(event.currentTarget).get("name").trim();
  try{
    const id=await rpc("create_workspace_v7",{p_name:name});
    event.currentTarget.reset();
    await loadWorkspaces();
    await switchWorkspace(id);
    App.toast("Shared workspace created");
  }catch(error){App.toast(error.message)}
});
document.querySelector("#email-invite-form")?.addEventListener("submit",async event=>{
  event.preventDefault();
  if(!currentWorkspaceId){App.toast("Choose a workspace first");return}
  const form=event.currentTarget,data=new FormData(form);
  try{
    const invitationId=await rpc("invite_workspace_member_by_email",{
      p_workspace_id:currentWorkspaceId,
      p_email:String(data.get("email")).trim().toLowerCase(),
      p_relationship:String(data.get("relationship")),
      p_role:String(data.get("role"))
    });
    const {error}=await supabase.functions.invoke("send-workspace-invite",{body:{invitation_id:invitationId}});
    if(error)console.warn("Invitation email function:",error.message);
    form.reset();
    await loadInvitations();
    App.toast(error?"Invitation saved; email function still needs setup":"Invitation email sent");
  }catch(error){App.toast(error.message)}
});
document.querySelector("#import-local-cloud")?.addEventListener("click",async()=>{
  document.querySelector("#cloud-migration-dialog").close();
  await replaceCloudFromLocal();
  App.toast("Existing browser data imported");
});
document.querySelector("#start-fresh-cloud")?.addEventListener("click",async()=>{
  document.querySelector("#cloud-migration-dialog").close();
  const blank={...App.getState(),accounts:[],transactions:[],budgets:[],investments:[],goals:[],netWorthSnapshots:[]};
  applyingRemote=true;App.replaceState(blank,{persist:true});applyingRemote=false;
  await replaceCloudFromLocal();
  App.toast("Fresh cloud workspace created");
});
window.addEventListener("nomad:user-ready",bootstrap);
window.addEventListener("nomad:state-saved",schedulePush);
if(App?.getUser())bootstrap();
