const App=window.NomadApp;
const supabase=window.NomadSupabase;
let currentWorkspaceId=null;
let applyingRemote=false;
let saveTimer=null;
let channel=null;
let workspaces=[];

function setStatus(status,detail){
  const a=document.querySelector("#cloud-sync-status"),b=document.querySelector("#cloud-sync-detail");
  if(a)a.textContent=status;if(b)b.textContent=detail||"";
}
function stateLooksEmpty(data){return !data||!Array.isArray(data.accounts)}
async function loadWorkspaceList(){
  if(!supabase||!App.getUser())return;
  const {data:members,error}=await supabase.from("workspace_members").select("workspace_id,role");
  if(error)throw error;
  const ids=members.map(m=>m.workspace_id);
  if(!ids.length){workspaces=[];return}
  const {data:spaces,error:spaceError}=await supabase.from("finance_workspaces").select("id,name,is_personal,invite_code,owner_id").in("id",ids);
  if(spaceError)throw spaceError;
  workspaces=spaces.map(space=>({...space,role:members.find(m=>m.workspace_id===space.id)?.role||"member"}));
  renderWorkspaces();
}
function renderWorkspaces(){
  const select=document.querySelector("#workspace-select"),details=document.querySelector("#workspace-details");if(!select)return;
  select.innerHTML=workspaces.map(w=>`<option value="${w.id}">${escapeHtml(w.name)}${w.is_personal?" · Personal":""}</option>`).join("");
  if(currentWorkspaceId&&workspaces.some(w=>w.id===currentWorkspaceId))select.value=currentWorkspaceId;
  const current=workspaces.find(w=>w.id===select.value);
  if(details&&current)details.innerHTML=`<div><span>Role</span><strong>${escapeHtml(current.role)}</strong></div><div><span>Invite code</span><strong>${current.is_personal?"Not available":escapeHtml(current.invite_code||"—")}</strong></div>${!current.is_personal?'<small>Share this code with a trusted person. Members can view and update the shared financial workspace.</small>':""}`;
}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
async function ensureWorkspace(){
  const {data,error}=await supabase.rpc("ensure_personal_workspace");
  if(error)throw error;
  await loadWorkspaceList();
  currentWorkspaceId=localStorage.getItem(`nomad_workspace_${App.getUser().id}`)||data;
  if(!workspaces.some(w=>w.id===currentWorkspaceId))currentWorkspaceId=data;
  localStorage.setItem(`nomad_workspace_${App.getUser().id}`,currentWorkspaceId);
  renderWorkspaces();
}
async function loadCloudState(){
  if(!currentWorkspaceId)return;
  setStatus("Synchronizing…","Loading your workspace from Supabase.");
  const {data,error}=await supabase.from("workspace_state").select("data,updated_at").eq("workspace_id",currentWorkspaceId).maybeSingle();
  if(error)throw error;
  if(data?.data&&!stateLooksEmpty(data.data)){applyingRemote=true;App.replaceState(data.data,{persist:true});applyingRemote=false}
  else await pushCloudState();
  setStatus("Cloud sync active",`Last loaded ${new Date(data?.updated_at||Date.now()).toLocaleString()}`);
  subscribeRealtime();
}
async function pushCloudState(){
  if(!currentWorkspaceId||applyingRemote)return;
  const user=App.getUser();if(!user)return;
  const {error}=await supabase.from("workspace_state").upsert({workspace_id:currentWorkspaceId,data:App.getState(),updated_by:user.id,updated_at:new Date().toISOString()},{onConflict:"workspace_id"});
  if(error)throw error;
  setStatus("Cloud sync active",`Saved ${new Date().toLocaleTimeString()}`);
}
function schedulePush(){
  if(!currentWorkspaceId||applyingRemote)return;
  clearTimeout(saveTimer);saveTimer=setTimeout(()=>pushCloudState().catch(error=>setStatus("Sync error",error.message)),700);
}
function subscribeRealtime(){
  if(channel)supabase.removeChannel(channel);
  channel=supabase.channel(`workspace-${currentWorkspaceId}`).on("postgres_changes",{event:"UPDATE",schema:"public",table:"workspace_state",filter:`workspace_id=eq.${currentWorkspaceId}`},payload=>{
    if(payload.new?.updated_by===App.getUser()?.id)return;
    if(payload.new?.data){applyingRemote=true;App.replaceState(payload.new.data,{persist:true,message:"Workspace updated on another device"});applyingRemote=false}
  }).subscribe();
}
async function switchWorkspace(id){
  currentWorkspaceId=id;localStorage.setItem(`nomad_workspace_${App.getUser().id}`,id);renderWorkspaces();await loadCloudState();
}
async function bootstrap(){
  if(!supabase){setStatus("Cloud sync unavailable","Supabase is not configured.");return}
  try{await ensureWorkspace();await loadCloudState()}catch(error){
    console.error(error);setStatus("Database setup required","Run supabase-schema.sql in the Supabase SQL Editor, then refresh.");
  }
}
document.querySelector("#workspace-select")?.addEventListener("change",event=>switchWorkspace(event.target.value).catch(e=>App.toast(e.message)));
document.querySelector("#create-workspace-form")?.addEventListener("submit",async event=>{
  event.preventDefault();if(!supabase)return;
  const name=new FormData(event.currentTarget).get("name").trim();
  const {data,error}=await supabase.rpc("create_shared_workspace",{p_name:name});
  if(error){App.toast(error.message);return}
  event.currentTarget.reset();await loadWorkspaceList();const id=Array.isArray(data)?data[0]?.workspace_id:data?.workspace_id;if(id)await switchWorkspace(id);App.toast("Shared workspace created");
});
document.querySelector("#join-workspace-form")?.addEventListener("submit",async event=>{
  event.preventDefault();if(!supabase)return;
  const code=new FormData(event.currentTarget).get("code").trim().toUpperCase();
  const {data,error}=await supabase.rpc("join_workspace_by_code",{p_code:code});
  if(error){App.toast(error.message);return}
  event.currentTarget.reset();await loadWorkspaceList();if(data)await switchWorkspace(data);App.toast("Workspace joined");
});
window.addEventListener("nomad:user-ready",bootstrap);
window.addEventListener("nomad:state-saved",schedulePush);
if(App?.getUser())bootstrap();
