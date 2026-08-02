import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const config=window.NOMAD_WEALTH_CONFIG||{};
const isConfigured=
  config.SUPABASE_URL &&
  config.SUPABASE_ANON_KEY &&
  !config.SUPABASE_URL.includes("YOUR_") &&
  !config.SUPABASE_ANON_KEY.includes("YOUR_");

const supabase=isConfigured?createClient(config.SUPABASE_URL,config.SUPABASE_ANON_KEY):null;
let currentUser=null;
let pendingSignup=null;
let KEY="nomad-wealth-guest";

const authScreen=document.querySelector("#auth-screen");
const appRoot=document.querySelector("#app-root");
const configWarning=document.querySelector("#auth-config-warning");

if(!isConfigured)configWarning.classList.remove("hidden");

function authToast(message,isError=false){
  const el=document.querySelector("#toast");
  el.textContent=message;
  el.style.background=isError?"#991b1b":"#0f172a";
  el.classList.add("show");
  clearTimeout(window.__authToast);
  window.__authToast=setTimeout(()=>el.classList.remove("show"),2800);
}
function requireConfigured(){
  if(isConfigured)return true;
  configWarning.classList.remove("hidden");
  authToast("Add your Supabase credentials in config.js first.",true);
  return false;
}
function setAuthView(id){
  document.querySelectorAll(".auth-view").forEach(v=>v.classList.remove("active"));
  document.querySelector("#"+id).classList.add("active");
}
function setSignupStep(step){
  document.querySelectorAll(".signup-step").forEach(s=>s.classList.remove("active"));
  document.querySelector(`[data-signup-step="${step}"]`)?.classList.add("active");
  document.querySelectorAll("[data-step-dot]").forEach(dot=>{
    const n=Number(dot.dataset.stepDot);
    dot.classList.toggle("active",n===step);
    dot.classList.toggle("complete",n<step);
  });
  const lines=document.querySelectorAll(".step-indicator i");
  lines.forEach((line,index)=>line.classList.toggle("complete",index+1<step));
}

function countryName(code,locale=currentLanguage){
  const normalized=normalizeCountryCode(code);
  try{return new Intl.DisplayNames([locale],{type:"region"}).of(normalized)||countryByCode.get(normalized)?.name||code}catch{return countryByCode.get(normalized)?.name||code}
}
function normalizeCountryCode(value){
  if(!value)return "US";
  const upper=String(value).toUpperCase();
  if(countryByCode.has(upper))return upper;
  const found=countryData.find(c=>c.name.toLowerCase()===String(value).toLowerCase());
  return found?.code||upper.slice(0,2);
}
function populateCountrySelect(select,selected){
  if(!select)return;
  const display=new Intl.DisplayNames([currentLanguage],{type:"region"});
  const options=countryData.map(c=>({code:c.code,label:display.of(c.code)||c.name})).sort((a,b)=>a.label.localeCompare(b.label,currentLanguage));
  select.innerHTML=options.map(c=>`<option value="${c.code}">${esc(c.label)}</option>`).join("");
  if(selected)select.value=normalizeCountryCode(selected);
}
function populateCurrencySelect(select,selected){
  if(!select)return;
  let dn;try{dn=new Intl.DisplayNames([currentLanguage],{type:"currency"})}catch{}
  select.innerHTML=currencies.map(code=>`<option value="${code}">${code}${dn?` — ${esc(dn.of(code)||code)}`:""}</option>`).join("");
  if(selected&&currencies.includes(selected))select.value=selected;
}
function applyTheme(theme=currentTheme){
  currentTheme=theme;
  localStorage.setItem("nomad_theme",theme);
  const resolved=theme==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):theme;
  document.documentElement.dataset.theme=resolved;
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=resolved==="dark"?"#07111f":"#0f766e";
  const toggle=document.querySelector("#theme-toggle");if(toggle){toggle.textContent=resolved==="dark"?"☀":"◐";toggle.title=resolved==="dark"?"Use light mode":"Use dark mode"}
}
function applyLanguage(lang=currentLanguage){
  if(!window.NOMAD_WEALTH_I18N?.[lang])lang="en";
  currentLanguage=lang;localStorage.setItem("nomad_language",lang);
  document.documentElement.lang=lang;document.documentElement.dir=lang==="ar"?"rtl":"ltr";
  const dict=window.NOMAD_WEALTH_I18N[lang];
  document.querySelectorAll("[data-i18n]").forEach(el=>{const text=dict[el.dataset.i18n];if(text)el.textContent=text});
  if(state)render();
  populateAllCountryCurrencyControls();
}
function populateAllCountryCurrencyControls(){
  populateCountrySelect(document.querySelector("#signup-country"),document.querySelector("#signup-country")?.value||"AL");
  populateCountrySelect(document.querySelector("#profile-country"),state?.currentCountry||currentUser?.user_metadata?.country||"AL");
  populateCountrySelect(document.querySelector("#onboarding-country"),currentUser?.user_metadata?.country||"AL");
  populateCountrySelect(document.querySelector("#account-country"),state?.currentCountry||"AL");
  populateCurrencySelect(document.querySelector("#signup-currency"),document.querySelector("#signup-currency")?.value||state?.mainCurrency||"EUR");
  populateCurrencySelect(document.querySelector("#profile-currency"),state?.mainCurrency||"EUR");
  populateCurrencySelect(document.querySelector("#onboarding-currency"),state?.mainCurrency||"EUR");
}

function userDisplayName(user){
  return user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "User";
}
function updateUserInterface(user){
  const name=userDisplayName(user);
  const email=user?.email||"Signed in";
  const initial=name.trim().charAt(0).toUpperCase()||"U";
  document.querySelector("#sidebar-user-name").textContent=name;
  document.querySelector("#sidebar-user-email").textContent=email;
  document.querySelector("#sidebar-user-email").title=email;
  document.querySelector("#sidebar-user-name").title=name;
  document.querySelector("#user-avatar").textContent=initial;
  document.querySelector("#header-avatar").textContent=initial;
  document.querySelector("#header-user-name").textContent=name;
  const pn=document.querySelector("#profile-name");if(pn)pn.textContent=name;
  const pe=document.querySelector("#profile-email");if(pe)pe.textContent=email;
  const metadata=user?.user_metadata||{};
  if(metadata.country)state.currentCountry=normalizeCountryCode(metadata.country);
  if(metadata.main_currency&&currencies.includes(metadata.main_currency))state.mainCurrency=metadata.main_currency;
  if(metadata.language)currentLanguage=metadata.language;
  if(metadata.theme)currentTheme=metadata.theme;
  const pName=document.querySelector("#profile-name-input");if(pName)pName.value=name;
  const pDisplay=document.querySelector("#profile-display-name");if(pDisplay)pDisplay.textContent=name;
  const pEmail=document.querySelector("#profile-display-email");if(pEmail)pEmail.textContent=email;
  const pAvatar=document.querySelector("#profile-avatar");if(pAvatar)pAvatar.textContent=initial;
  applyTheme(currentTheme);applyLanguage(currentLanguage);
}
function showApp(user){
  currentUser=user;
  KEY=`nomad-wealth-${user.id}`;
  state=load();
  updateUserInterface(user);
  authScreen.classList.add("hidden");
  appRoot.classList.remove("hidden");
  initializeFinanceApp();
  render();
  const metadata=user?.user_metadata||{};
  if(!metadata.onboarding_complete){
    const form=document.querySelector("#onboarding-form");
    if(form){form.elements.name.value=userDisplayName(user);populateCountrySelect(form.elements.country,metadata.country||"AL");populateCurrencySelect(form.elements.currency,metadata.main_currency||"EUR");document.querySelector("#onboarding-dialog").showModal();}
  }
}
function showAuth(){
  currentUser=null;
  appRoot.classList.add("hidden");
  authScreen.classList.remove("hidden");
  setAuthView("login-view");
}

document.querySelector("#show-signup").addEventListener("click",()=>{setAuthView("signup-view");setSignupStep(1)});
document.querySelector("#show-login").addEventListener("click",()=>setAuthView("login-view"));
document.querySelector("#show-forgot").addEventListener("click",()=>setAuthView("forgot-view"));
document.querySelector("#back-to-login").addEventListener("click",()=>setAuthView("login-view"));
document.querySelectorAll(".password-toggle").forEach(button=>button.addEventListener("click",()=>{
  const input=button.parentElement.querySelector("input");
  const show=input.type==="password";
  input.type=show?"text":"password";
  button.textContent=show?"Hide":"Show";
}));
document.querySelector("[data-next-signup]").addEventListener("click",()=>{
  const form=document.querySelector("#signup-form");
  const fields=[form.elements.name,form.elements.country,form.elements.currency,form.elements.user_type];
  if(fields.some(field=>!field.reportValidity()))return;
  setSignupStep(2);
});
document.querySelector("[data-prev-signup]").addEventListener("click",()=>setSignupStep(1));

document.querySelector("#signup-form").addEventListener("submit",async event=>{
  event.preventDefault();
  if(!requireConfigured())return;
  const form=event.currentTarget;
  if(form.elements.password.value!==form.elements.confirm_password.value){
    authToast("Passwords do not match.",true);return;
  }
  const payload={
    name:form.elements.name.value.trim(),
    country:normalizeCountryCode(form.elements.country.value),
    currency:form.elements.currency.value,
    userType:form.elements.user_type.value,
    email:form.elements.email.value.trim().toLowerCase(),
    password:form.elements.password.value
  };
  const submit=form.querySelector('button[type="submit"]');
  submit.disabled=true;submit.textContent="Sending code…";
  const {data,error}=await supabase.auth.signUp({
    email:payload.email,
    password:payload.password,
    options:{
      data:{
        full_name:payload.name,
        country:payload.country,
        main_currency:payload.currency,
        user_type:payload.userType,
        language:currentLanguage,
        theme:currentTheme,
        onboarding_complete:true
      },
      emailRedirectTo:window.location.origin+window.location.pathname
    }
  });
  submit.disabled=false;submit.textContent="Send verification code";
  if(error){authToast(error.message,true);return}
  pendingSignup=payload;
  document.querySelector("#otp-email-label").textContent=payload.email;
  setSignupStep(3);
  authToast("Verification email sent.");
  if(data.session){
    showApp(data.user);
  }
});

document.querySelector("#otp-form").addEventListener("submit",async event=>{
  event.preventDefault();
  if(!requireConfigured()||!pendingSignup)return;
  const token=event.currentTarget.elements.token.value.trim();
  const button=event.currentTarget.querySelector('button[type="submit"]');
  button.disabled=true;button.textContent="Verifying…";
  const {data,error}=await supabase.auth.verifyOtp({
    email:pendingSignup.email,
    token,
    type:"signup"
  });
  button.disabled=false;button.textContent="Verify and create account";
  if(error){authToast(error.message,true);return}
  authToast("Email verified. Your account is active.");
  showApp(data.user);
});

document.querySelector("#resend-otp").addEventListener("click",async()=>{
  if(!requireConfigured()||!pendingSignup)return;
  const {error}=await supabase.auth.resend({type:"signup",email:pendingSignup.email});
  if(error)authToast(error.message,true);else authToast("A new verification code was sent.");
});

document.querySelector("#login-form").addEventListener("submit",async event=>{
  event.preventDefault();
  if(!requireConfigured())return;
  const form=event.currentTarget;
  const button=form.querySelector('button[type="submit"]');
  button.disabled=true;button.textContent="Logging in…";
  const {data,error}=await supabase.auth.signInWithPassword({
    email:form.elements.email.value.trim().toLowerCase(),
    password:form.elements.password.value
  });
  button.disabled=false;button.textContent="Log in";
  if(error){authToast(error.message,true);return}
  showApp(data.user);
});

document.querySelector("#google-login").addEventListener("click",async()=>{
  if(!requireConfigured())return;
  const {error}=await supabase.auth.signInWithOAuth({
    provider:"google",
    options:{redirectTo:window.location.origin+window.location.pathname}
  });
  if(error)authToast(error.message,true);
});

document.querySelector("#forgot-form").addEventListener("submit",async event=>{
  event.preventDefault();
  if(!requireConfigured())return;
  const email=event.currentTarget.elements.email.value.trim().toLowerCase();
  const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+window.location.pathname});
  if(error)authToast(error.message,true);
  else{authToast("Password reset email sent.");setAuthView("login-view")}
});

document.querySelector("#reset-form").addEventListener("submit",async event=>{
  event.preventDefault();
  const form=event.currentTarget;
  if(form.elements.password.value!==form.elements.confirm_password.value){
    authToast("Passwords do not match.",true);return;
  }
  const {error}=await supabase.auth.updateUser({password:form.elements.password.value});
  if(error)authToast(error.message,true);
  else{authToast("Password updated.");if(currentUser)showApp(currentUser)}
});

document.querySelector("#logout-button").addEventListener("click",async()=>{
  if(supabase)await supabase.auth.signOut();
  showAuth();
  authToast("You have been logged out.");
});

async function initializeAuthentication(){
  if(!isConfigured){showAuth();return}
  const {data:{session}}=await supabase.auth.getSession();
  if(session?.user)showApp(session.user);else showAuth();

  supabase.auth.onAuthStateChange((event,session)=>{
    if(event==="PASSWORD_RECOVERY"){setAuthView("reset-view");authScreen.classList.remove("hidden");appRoot.classList.add("hidden")}
    else if(event==="SIGNED_OUT")showAuth();
    else if(session?.user&&!currentUser)showApp(session.user);
  });
}



const currencies=window.NOMAD_WEALTH_CURRENCIES||["EUR","USD","GBP","RUB","BDT"];
const countryData=window.NOMAD_WEALTH_COUNTRIES||[];
const countryByCode=new Map(countryData.map(c=>[c.code,c]));
let currentLanguage=localStorage.getItem("nomad_language")||navigator.language?.slice(0,2)||"en";
if(!window.NOMAD_WEALTH_I18N?.[currentLanguage])currentLanguage="en";
let currentTheme=localStorage.getItem("nomad_theme")||"system";
const demo={
  mainCurrency:"EUR",
  currentCountry:"AL",
  rates:{EUR:1,USD:1.09,GBP:.85,RUB:96,BDT:128},
  accounts:[
    {id:crypto.randomUUID(),name:"Main Bank",institution:"T-Bank",country:"RU",currency:"RUB",type:"Bank",openingBalance:120000},
    {id:crypto.randomUUID(),name:"BRAC Savings",institution:"BRAC Bank",country:"BD",currency:"BDT",type:"Savings",openingBalance:250000},
    {id:crypto.randomUUID(),name:"Wise EUR",institution:"Wise",country:"DE",currency:"EUR",type:"Bank",openingBalance:1200},
    {id:crypto.randomUUID(),name:"Freelance USD",institution:"Payoneer",country:"US",currency:"USD",type:"Wallet",openingBalance:800},
    {id:crypto.randomUUID(),name:"Personal Loan",institution:"Local Bank",country:"RU",currency:"EUR",type:"Debt",openingBalance:1200}
  ],
  transactions:[],
  budgets:[
    {id:crypto.randomUUID(),group:"Essential",category:"Housing",limit:520},
    {id:crypto.randomUUID(),group:"Flexible",category:"Food",limit:200},
    {id:crypto.randomUUID(),group:"Savings",category:"Emergency Fund",limit:200},
    {id:crypto.randomUUID(),group:"Investments",category:"Monthly Investing",limit:150}
  ],
  investments:[
    {id:crypto.randomUUID(),name:"Global Index Fund",type:"ETF",currency:"EUR",cost:1200,value:1350},
    {id:crypto.randomUUID(),name:"Tech Shares",type:"Stock",currency:"USD",cost:900,value:1040}
  ]
};

function seed(s){
  const now=new Date(),iso=d=>d.toISOString().slice(0,10);
  s.transactions=[
    {id:crypto.randomUUID(),type:"income",amount:200,currency:"USD",category:"Freelance",country:"US",accountId:s.accounts[3].id,date:iso(now),note:"Client payment"},
    {id:crypto.randomUUID(),type:"expense",amount:400,currency:"EUR",category:"Housing",country:"AL",accountId:s.accounts[2].id,date:iso(now),note:"Rent"},
    {id:crypto.randomUUID(),type:"expense",amount:45.2,currency:"EUR",category:"Food",country:"AL",accountId:s.accounts[2].id,date:iso(new Date(now-86400000)),note:"Groceries"},
    {id:crypto.randomUUID(),type:"expense",amount:1200,currency:"RUB",category:"Transport",country:"RU",accountId:s.accounts[0].id,date:iso(new Date(now-172800000)),note:"Transit"}
  ];
  return s;
}
let state=null;

function load(){
  try{const raw=localStorage.getItem(KEY);if(raw)return JSON.parse(raw)}catch{}
  const fresh=seed(structuredClone(demo));localStorage.setItem(KEY,JSON.stringify(fresh));return fresh;
}
function save(message){
  localStorage.setItem(KEY,JSON.stringify(state));
  render();
  if(message)toast(message);
}
function toast(message){
  const el=document.querySelector("#toast");el.textContent=message;el.classList.add("show");
  clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.remove("show"),2200);
}
function toEUR(amount,currency){return amount/(state.rates[currency]||1)}
function fromEUR(amount,currency){return amount*(state.rates[currency]||1)}
function convert(amount,from,to){return fromEUR(toEUR(amount,from),to)}
function inMain(amount,currency){return convert(amount,currency,state.mainCurrency)}
function money(value,currency=state.mainCurrency){
  return new Intl.NumberFormat(undefined,{style:"currency",currency,maximumFractionDigits:2}).format(Number(value)||0);
}
function accountBalance(account){
  return account.openingBalance+state.transactions.filter(t=>t.accountId===account.id).reduce((sum,t)=>sum+(t.type==="income"?t.amount:-t.amount),0);
}
function isThisMonth(date){
  const d=new Date(date+"T00:00:00"),n=new Date();
  return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth();
}
function categorySpent(category){
  return state.transactions.filter(t=>t.type==="expense"&&isThisMonth(t.date)&&t.category.toLowerCase()===category.toLowerCase()).reduce((s,t)=>s+inMain(t.amount,t.currency),0);
}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function empty(message="No data yet."){return `<div class="empty">${esc(message)}</div>`}

function render(){
  document.querySelector("#main-currency").value=state.mainCurrency;
  document.querySelector("#current-location").textContent=`Current country: ${state.currentCountry}`;
  const nonDebt=state.accounts.filter(a=>a.type!=="Debt").reduce((s,a)=>s+inMain(accountBalance(a),a.currency),0);
  const debt=state.accounts.filter(a=>a.type==="Debt").reduce((s,a)=>s+Math.abs(inMain(accountBalance(a),a.currency)),0);
  const investments=state.investments.reduce((s,i)=>s+inMain(i.value,i.currency),0);
  const income=state.transactions.filter(t=>t.type==="income"&&isThisMonth(t.date)).reduce((s,t)=>s+inMain(t.amount,t.currency),0);
  const expenses=state.transactions.filter(t=>t.type==="expense"&&isThisMonth(t.date)).reduce((s,t)=>s+inMain(t.amount,t.currency),0);
  const budgetTotal=state.budgets.reduce((s,b)=>s+b.limit,0);
  const essential=state.budgets.filter(b=>b.group==="Essential").reduce((s,b)=>s+b.limit,0);
  const savingsTarget=state.budgets.filter(b=>["Savings","Investments"].includes(b.group)).reduce((s,b)=>s+b.limit,0);
  const daysInMonth=new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate();
  const daysLeft=Math.max(1,daysInMonth-new Date().getDate()+1);
  const unallocated=Math.max(0,income-essential-savingsTarget-expenses);
  const safe=unallocated/daysLeft;
  const runway=nonDebt/Math.max(1,essential);
  const saved=Math.max(0,income-expenses);
  const savingsRate=income>0?saved/income*100:0;

  document.querySelector("#net-worth").textContent=money(nonDebt+investments-debt);
  document.querySelector("#available-money").textContent=money(nonDebt);
  document.querySelector("#month-income").textContent=money(income);
  document.querySelector("#month-expense").textContent=money(expenses);
  document.querySelector("#safe-today").textContent=money(safe);
  document.querySelector("#runway").textContent=`${runway.toFixed(1)} months`;
  document.querySelector("#savings-rate").textContent=`${savingsRate.toFixed(0)}%`;
  document.querySelector("#total-debt").textContent=money(debt);
  document.querySelector("#health-banner").textContent=expenses<=income
    ?`You are doing well. You saved ${money(saved)} this month.`
    :`Be careful. Your expenses are higher than your income this month.`;
  document.querySelector("#budget-summary").textContent=`${budgetTotal?Math.min(100,expenses/budgetTotal*100).toFixed(0):0}% of budget used`;

  renderAccounts();renderTransactions();renderBudgets(expenses,budgetTotal);renderInvestments();renderRates();populateSelects();
}
function renderAccounts(){
  const groups={};state.accounts.forEach(a=>(groups[a.country]??=[]).push(a));
  document.querySelector("#country-accounts").innerHTML=Object.entries(groups).map(([country,items])=>{
    const original=items.map(a=>`${money(accountBalance(a),a.currency)} ${a.currency}`).join(" · ");
    const converted=items.reduce((s,a)=>s+inMain(accountBalance(a),a.currency),0);
    return `<div class="country-row"><div><strong>${esc(countryName(country))}</strong><small>${items.length} account${items.length>1?"s":""}</small></div><div>${esc(original)}</div><div><strong>${money(converted)}</strong></div></div>`;
  }).join("")||empty();
  document.querySelector("#account-list").innerHTML=state.accounts.map(a=>`
    <article class="mini-card">
      <small>${esc(countryName(a.country))} · ${esc(a.type)}</small>
      <strong>${money(accountBalance(a),a.currency)}</strong>
      <span>${esc(a.name)}</span>
      <div class="row-subtitle">${esc(a.institution)} · ${money(inMain(accountBalance(a),a.currency))}</div>
    </article>`).join("")||empty();
}
function filteredTransactions(){
  const query=(document.querySelector("#transaction-search")?.value||"").toLowerCase();
  const filter=document.querySelector("#transaction-filter")?.value||"all";
  return [...state.transactions].filter(t=>{
    const matchType=filter==="all"||t.type===filter;
    const text=`${t.category} ${t.note} ${t.country}`.toLowerCase();
    return matchType&&text.includes(query);
  }).sort((a,b)=>b.date.localeCompare(a.date));
}
function transactionHTML(items,deletable=false){
  if(!items.length)return empty("No matching transactions.");
  return items.map(t=>{
    const a=state.accounts.find(x=>x.id===t.accountId);
    return `<div class="row"><div><div class="row-title">${esc(t.category)}${t.frequency&&t.frequency!=="once"?` <span class="recurring-badge">↻ ${esc(t.frequency)}</span>`:""}</div><div class="row-subtitle">${esc(countryName(t.country))} · ${esc(a?.name||"Unknown")} · ${esc(t.date)}${t.note?` · ${esc(t.note)}`:""}</div></div><div><span class="amount ${t.type}">${t.type==="income"?"+":"-"}${money(t.amount,t.currency)}</span><div class="row-subtitle">${money(inMain(t.amount,t.currency))}</div>${deletable?`<button class="icon-button delete-tx" data-id="${t.id}" aria-label="Delete transaction">×</button>`:""}</div></div>`;
  }).join("");
}
function renderTransactions(){
  const all=[...state.transactions].sort((a,b)=>b.date.localeCompare(a.date));
  document.querySelector("#recent-transactions").innerHTML=transactionHTML(all.slice(0,5));
  document.querySelector("#transaction-list").innerHTML=transactionHTML(filteredTransactions(),true);
}
function renderBudgets(expenses,budgetTotal){
  const html=state.budgets.map(b=>{
    const spent=categorySpent(b.category),pct=Math.min(100,spent/b.limit*100);
    return `<div class="progress-wrap"><div class="progress-label"><strong>${esc(b.group)} · ${esc(b.category)}</strong><span>${money(spent)} / ${money(b.limit)}</span></div><div class="progress ${spent>b.limit?"over":""}"><span style="width:${pct}%"></span></div></div>`;
  }).join("")||empty();
  document.querySelector("#budget-overview").innerHTML=html;
  document.querySelector("#budget-list").innerHTML=html;
  const remaining=Math.max(0,budgetTotal-expenses);
  document.querySelector("#budget-explanation").innerHTML=`<div class="result-main" style="color:#172033">${money(remaining)}</div><p style="color:#64748b">Estimated budget remaining this month.</p><div class="result-grid" style="color:#172033"><div><span>Planned budget</span><strong>${money(budgetTotal)}</strong></div><div><span>Spent so far</span><strong>${money(expenses)}</strong></div><div><span>Remaining</span><strong>${money(remaining)}</strong></div></div>`;
}
function renderInvestments(){
  document.querySelector("#investment-list").innerHTML=state.investments.map(i=>{
    const gain=i.value-i.cost,pct=i.cost?gain/i.cost*100:0;
    return `<article class="mini-card"><small>${esc(i.type)} · ${esc(i.currency)}</small><strong>${money(i.value,i.currency)}</strong><span>${esc(i.name)}</span><div class="${gain>=0?"gain":"loss"}">${gain>=0?"+":""}${money(gain,i.currency)} (${pct.toFixed(1)}%)</div></article>`;
  }).join("")||empty();
}
function renderRates(){
  document.querySelector("#rate-settings").innerHTML=currencies.map(c=>`<div class="rate-row"><strong>${c}</strong><input class="rate-input" data-currency="${c}" type="number" step="0.0001" value="${state.rates[c]}"></div>`).join("");
}
function populateSelects(){
  ["main-currency","transaction-currency","account-currency","investment-currency"].forEach(id=>populateCurrencySelect(document.querySelector("#"+id),id==="main-currency"?state.mainCurrency:undefined));
  document.querySelector("#main-currency").value=state.mainCurrency;
  document.querySelector("#transaction-account").innerHTML=state.accounts.filter(a=>a.type!=="Debt").map(a=>`<option value="${a.id}">${esc(a.name)} (${a.currency})</option>`).join("");
  populateAllCountryCurrencyControls();
  const lang=document.querySelector("#language-select");if(lang)lang.value=currentLanguage;
  const theme=document.querySelector("#theme-select");if(theme)theme.value=currentTheme;
}

function showPage(id){
  document.querySelectorAll(".page,.nav-item,.mobile-nav button").forEach(x=>x.classList.remove("active"));
  document.querySelector("#"+id)?.classList.add("active");
  document.querySelectorAll(`[data-page="${id}"]`).forEach(x=>x.classList.add("active"));
  const title=document.querySelector(`.nav-item[data-page="${id}"]`)?.textContent.trim()||id;
  document.querySelector("#page-title").textContent=title;
  window.scrollTo({top:0,behavior:"smooth"});
}
function openDialog(id){
  const dialog=document.querySelector("#"+id);if(!dialog)return;
  if(id==="transaction-dialog"){
    const form=document.querySelector("#transaction-form");
    form.elements.date.value=new Date().toISOString().slice(0,10);
    form.elements.country.value=state.currentCountry||"";
    const account=state.accounts.find(a=>a.type!=="Debt");
    if(account){form.elements.accountId.value=account.id;form.elements.currency.value=account.currency}
    setTimeout(()=>form.elements.amount.focus(),50);
  }
  if(id==="account-dialog"){
    populateCountryBankSelects();
  }
  dialog.showModal();
}
function populateCountryBankSelects(){
  const countrySel=document.querySelector("#account-country");
  if(!countrySel)return;
  populateCountrySelect(countrySel,state?.currentCountry||"AL");
  updateBankOptions(countrySel.value);
  const currency=countryByCode.get(countrySel.value)?.currency;
  if(currency&&currencies.includes(currency))document.querySelector("#account-currency").value=currency;
}
function updateBankOptions(country){
  const list=document.querySelector("#bank-options");
  if(!list)return;
  const code=normalizeCountryCode(country);
  const banks=[...(window.NOMAD_WEALTH_BANKS?.[code]||[]),...(window.NOMAD_WEALTH_UNIVERSAL_BANKS||[])];
  list.innerHTML=[...new Set(banks)].map(b=>`<option value="${esc(b)}"></option>`).join("");
}
document.addEventListener("change",e=>{
  if(e.target&&e.target.id==="account-country"){
    updateBankOptions(e.target.value);
    const currency=countryByCode.get(e.target.value)?.currency;
    if(currency&&currencies.includes(currency))document.querySelector("#account-currency").value=currency;
  }
  if(e.target&&e.target.id==="language-select"){
    applyLanguage(e.target.value);authToast("Language updated.");
  }
});

function closeDialog(dialog){if(dialog?.open)dialog.close()}

document.querySelector("#today-label").textContent=new Intl.DateTimeFormat(undefined,{dateStyle:"full"}).format(new Date());
const hour=new Date().getHours();document.querySelector("#greeting").textContent=hour<12?"Good morning":hour<18?"Good afternoon":"Good evening";
document.querySelectorAll("[data-page]").forEach(el=>el.addEventListener("click",()=>showPage(el.dataset.page)));
document.querySelectorAll("[data-page-link]").forEach(el=>el.addEventListener("click",e=>{e.preventDefault();showPage(el.dataset.pageLink)}));
document.querySelectorAll("[data-open-dialog]").forEach(el=>el.addEventListener("click",()=>openDialog(el.dataset.openDialog)));
document.querySelector("#quick-add").onclick=()=>openDialog("transaction-dialog");
document.querySelectorAll("[data-close-dialog]").forEach(btn=>btn.addEventListener("click",()=>closeDialog(btn.closest("dialog"))));
document.querySelectorAll("dialog").forEach(dialog=>{
  dialog.addEventListener("click",event=>{
    const r=dialog.getBoundingClientRect();
    const inside=event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom;
    if(!inside)closeDialog(dialog);
  });
});
document.querySelectorAll("[data-open-calc]").forEach(btn=>btn.addEventListener("click",()=>{showPage("calculators");openCalc(btn.dataset.openCalc)}));
document.querySelectorAll(".calc-tab").forEach(btn=>btn.addEventListener("click",()=>openCalc(btn.dataset.calc)));
function openCalc(name){
  document.querySelectorAll(".calc-tab,.calculator-panel").forEach(x=>x.classList.remove("active"));
  document.querySelector(`.calc-tab[data-calc="${name}"]`)?.classList.add("active");
  document.querySelector("#calc-"+name)?.classList.add("active");
}

document.querySelector("#transaction-account").addEventListener("change",e=>{
  const account=state.accounts.find(a=>a.id===e.target.value);
  if(account)document.querySelector("#transaction-currency").value=account.currency;
});
document.querySelector("#main-currency").addEventListener("change",e=>{state.mainCurrency=e.target.value;save("Main currency updated")});
document.querySelector("#transaction-search").addEventListener("input",renderTransactions);
document.querySelector("#transaction-filter").addEventListener("change",renderTransactions);

document.querySelector("#transaction-form").addEventListener("submit",e=>{
  e.preventDefault();const f=new FormData(e.target);
  state.transactions.push({id:crypto.randomUUID(),type:f.get("type"),amount:+f.get("amount"),currency:f.get("currency"),category:f.get("category").trim(),country:f.get("country").trim(),accountId:f.get("accountId"),date:f.get("date"),frequency:f.get("frequency")||"once",note:f.get("note").trim()});
  e.target.reset();closeDialog(document.querySelector("#transaction-dialog"));save("Transaction saved");
});
document.querySelector("#account-form").addEventListener("submit",e=>{
  e.preventDefault();const f=new FormData(e.target);
  state.accounts.push({id:crypto.randomUUID(),name:f.get("name").trim(),institution:f.get("institution").trim(),country:normalizeCountryCode(f.get("country")),currency:f.get("currency"),type:f.get("type"),openingBalance:+f.get("balance")});
  e.target.reset();closeDialog(document.querySelector("#account-dialog"));save("Account added");
});
document.querySelector("#budget-form").addEventListener("submit",e=>{
  e.preventDefault();const f=new FormData(e.target);
  state.budgets.push({id:crypto.randomUUID(),group:f.get("group"),category:f.get("category").trim(),limit:+f.get("limit")});
  e.target.reset();closeDialog(document.querySelector("#budget-dialog"));save("Budget added");
});
document.querySelector("#investment-form-dialog").addEventListener("submit",e=>{
  e.preventDefault();const f=new FormData(e.target);
  state.investments.push({id:crypto.randomUUID(),name:f.get("name").trim(),type:f.get("type").trim(),currency:f.get("currency"),cost:+f.get("cost"),value:+f.get("value")});
  e.target.reset();closeDialog(document.querySelector("#investment-dialog"));save("Investment added");
});
document.addEventListener("click",e=>{
  const btn=e.target.closest(".delete-tx");
  if(btn&&confirm("Delete this transaction?")){state.transactions=state.transactions.filter(t=>t.id!==btn.dataset.id);save("Transaction deleted")}
});
document.addEventListener("change",e=>{
  if(e.target.classList.contains("rate-input")){state.rates[e.target.dataset.currency]=+e.target.value||1;save("Exchange rate updated")}
});

function setResult(selector,title,main,rows){
  document.querySelector(selector).innerHTML=`<h3>${title}</h3><div class="result-main">${main}</div><div class="result-grid">${rows.map(([k,v])=>`<div><span>${k}</span><strong>${v}</strong></div>`).join("")}</div><p>Estimate only. Actual results may differ.</p>`;
}
function calculateLoan(){
  const f=new FormData(document.querySelector("#loan-form")),P=+f.get("principal"),annual=+f.get("rate")/100,n=+f.get("years")*12,r=annual/12;
  const monthly=r===0?P/n:P*r*(1+r)**n/((1+r)**n-1),total=monthly*n,interest=total-P;
  setResult("#loan-result","Monthly installment",money(monthly),[["Total payment",money(total)],["Total interest",money(interest)],["Number of payments",n]]);
}
function calculateGrowth(formSelector,resultSelector,fee=0){
  const f=new FormData(document.querySelector(formSelector)),P=+f.get("principal"),monthly=+f.get("monthly")||0,years=+f.get("years"),annual=(+f.get("rate")-fee)/100,r=annual/12,n=years*12;
  const final=P*(1+r)**n+(r===0?monthly*n:monthly*((1+r)**n-1)/r);
  const contributed=P+monthly*n,profit=final-contributed;
  setResult(resultSelector,"Estimated final value",money(final),[["Total contributed",money(contributed)],["Estimated profit",money(profit)],["Effective annual return",`${(annual*100).toFixed(2)}%`]]);
}
document.querySelector("#loan-form").addEventListener("submit",e=>{e.preventDefault();calculateLoan()});
document.querySelector("#investment-form").addEventListener("submit",e=>{e.preventDefault();calculateGrowth("#investment-form","#investment-result")});
document.querySelector("#fund-form").addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.target);calculateGrowth("#fund-form","#fund-result",+f.get("fee")||0)});
document.querySelector("#stock-form").addEventListener("submit",e=>{
  e.preventDefault();const f=new FormData(e.target),buy=+f.get("buy"),sell=+f.get("sell"),shares=+f.get("shares"),fees=+f.get("fees"),cost=buy*shares+fees,sale=sell*shares,profit=sale-cost,ret=cost?profit/cost*100:0,breakEven=(buy*shares+fees)/shares;
  setResult("#stock-result","Net profit / loss",money(profit),[["Total cost",money(cost)],["Sale value",money(sale)],["Return",`${ret.toFixed(2)}%`],["Break-even price",money(breakEven)]]);
});
document.querySelector("#travel-form").addEventListener("submit",e=>{
  e.preventDefault();const f=new FormData(e.target),country=f.get("country"),budget=+f.get("budget"),spent=+f.get("spent"),days=Math.max(1,+f.get("days")),left=Math.max(0,budget-spent);
  state.currentCountry=country;save("Travel plan updated");
  setResult("#travel-result",`${country} travel plan`,money(left),[["Trip budget",money(budget)],["Spent",money(spent)],["Days remaining",days],["Safe daily spending",money(left/days)]]);
});


document.querySelector("#theme-toggle")?.addEventListener("click",()=>applyTheme(document.documentElement.dataset.theme==="dark"?"light":"dark"));
document.querySelector("#theme-select")?.addEventListener("change",e=>applyTheme(e.target.value));
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change",()=>{if(currentTheme==="system")applyTheme("system")});

document.querySelector("#profile-form")?.addEventListener("submit",async event=>{
  event.preventDefault();
  const form=event.currentTarget;
  const updates={
    full_name:form.elements.name.value.trim(),
    country:normalizeCountryCode(form.elements.country.value),
    main_currency:form.elements.currency.value,
    language:form.elements.language.value,
    theme:form.elements.theme.value,
    onboarding_complete:true
  };
  if(!supabase){authToast("Supabase is not configured.",true);return}
  const {data,error}=await supabase.auth.updateUser({data:updates});
  if(error){authToast(error.message,true);return}
  currentUser=data.user;state.currentCountry=updates.country;state.mainCurrency=updates.main_currency;
  currentLanguage=updates.language;currentTheme=updates.theme;
  updateUserInterface(data.user);save("Profile updated");
});
document.querySelector("#profile-password-reset")?.addEventListener("click",async()=>{
  if(!supabase||!currentUser?.email)return;
  const {error}=await supabase.auth.resetPasswordForEmail(currentUser.email,{redirectTo:window.location.origin+window.location.pathname});
  if(error)authToast(error.message,true);else authToast("Password reset email sent.");
});
document.querySelector("#onboarding-form")?.addEventListener("submit",async event=>{
  event.preventDefault();const f=new FormData(event.currentTarget);
  const updates={full_name:f.get("name").trim(),country:normalizeCountryCode(f.get("country")),main_currency:f.get("currency"),user_type:f.get("user_type"),language:currentLanguage,theme:currentTheme,onboarding_complete:true};
  const {data,error}=await supabase.auth.updateUser({data:updates});
  if(error){authToast(error.message,true);return}
  currentUser=data.user;state.currentCountry=updates.country;state.mainCurrency=updates.main_currency;
  document.querySelector("#onboarding-dialog").close();updateUserInterface(data.user);save("Profile setup complete");
});

document.querySelector("#export-data").addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download="nomad-wealth-backup.json";a.click();URL.revokeObjectURL(a.href);
});
document.querySelector("#import-data").addEventListener("change",async e=>{
  try{const incoming=JSON.parse(await e.target.files[0].text());if(!incoming.accounts||!incoming.transactions)throw Error();state=incoming;save("Backup imported")}catch{alert("Invalid Nomad Wealth backup file.")}
});
document.querySelector("#reset-data").addEventListener("click",()=>{if(confirm("Reset all prototype data?")){state=seed(structuredClone(demo));save("Demo data restored")}});

function initializeFinanceApp(){
  if(window.__financeInitialized)return;
  window.__financeInitialized=true;
  render();
  calculateLoan();
  calculateGrowth("#investment-form","#investment-result");
  calculateGrowth("#fund-form","#fund-result",1);
  document.querySelector("#stock-form").dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));
  document.querySelector("#travel-form").dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));
}
if("serviceWorker" in navigator)navigator.serviceWorker.register("service-worker.js").catch(()=>{});

applyTheme(currentTheme);applyLanguage(currentLanguage);initializeAuthentication();
