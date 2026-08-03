const createClient = window.supabase?.createClient;
const config=window.NOMAD_WEALTH_CONFIG||{};
const isConfigured=
  config.SUPABASE_URL &&
  config.SUPABASE_ANON_KEY &&
  !config.SUPABASE_URL.includes("YOUR_") &&
  !config.SUPABASE_ANON_KEY.includes("YOUR_");

const supabase=isConfigured&&createClient?createClient(config.SUPABASE_URL,config.SUPABASE_ANON_KEY,{
  auth:{
    persistSession:true,
    autoRefreshToken:true,
    detectSessionInUrl:true,
    flowType:"pkce",
    storage:window.localStorage
  }
}):null;
window.NomadSupabase=supabase;
let currentUser=null;
let pendingSignup=null;
let KEY="nomad-wealth-guest";

const authScreen=document.querySelector("#auth-screen");
const appRoot=document.querySelector("#app-root");
const configWarning=document.querySelector("#auth-config-warning");

if(!isConfigured){
  configWarning?.classList.remove("hidden");
}else if(!supabase){
  configWarning?.classList.remove("hidden");
  if(configWarning)configWarning.innerHTML="<strong>Login system unavailable</strong><p>Supabase could not initialize. Refresh the page or check your network connection.</p>";
}

function setAuthMessage(message="",kind="error"){
  const box=document.querySelector("#auth-inline-message");
  if(!box)return;
  box.textContent=message;
  box.className=`auth-inline-message ${kind}`;
  box.classList.toggle("hidden",!message);
}
async function authRequest(promise,label="Authentication"){
  const timeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error(`${label} timed out. Check your internet connection and try again.`)),18000));
  return Promise.race([promise,timeout]);
}
function friendlyAuthError(error){
  const raw=String(error?.message||error||"Authentication failed.");
  const lower=raw.toLowerCase();
  if(lower.includes("invalid login credentials"))return "The email or password is incorrect.";
  if(lower.includes("email not confirmed"))return "Confirm your email before logging in.";
  if(lower.includes("user already registered"))return "An account already exists for this email. Log in instead.";
  if(lower.includes("rate limit"))return "Too many attempts. Wait a little and try again.";
  if(lower.includes("fetch")||lower.includes("network"))return "Could not connect to Supabase. Check your internet connection.";
  return raw;
}
function authToast(message,isError=false){
  if(isError)setAuthMessage(message,"error");
  const el=document.querySelector("#toast");
  el.textContent=message;
  el.style.background=isError?"#991b1b":"#0f172a";
  el.classList.add("show");
  clearTimeout(window.__authToast);
  window.__authToast=setTimeout(()=>el.classList.remove("show"),2800);
}
function requireConfigured(){
  if(isConfigured&&supabase)return true;
  configWarning?.classList.remove("hidden");
  authToast("Authentication is not configured correctly.",true);
  return false;
}
function setAuthView(id){
  setAuthMessage("");
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
  const source=countryData.length?countryData:[
    {code:"AL",name:"Albania",currency:"ALL"},
    {code:"BD",name:"Bangladesh",currency:"BDT"},
    {code:"RU",name:"Russia",currency:"RUB"},
    {code:"US",name:"United States",currency:"USD"},
    {code:"GB",name:"United Kingdom",currency:"GBP"},
    {code:"DE",name:"Germany",currency:"EUR"},
    {code:"FR",name:"France",currency:"EUR"},
    {code:"ES",name:"Spain",currency:"EUR"},
    {code:"IT",name:"Italy",currency:"EUR"},
    {code:"CA",name:"Canada",currency:"CAD"},
    {code:"AU",name:"Australia",currency:"AUD"},
    {code:"AE",name:"United Arab Emirates",currency:"AED"}
  ];
  let display=null;
  try{display=new Intl.DisplayNames([currentLanguage||"en"],{type:"region"})}catch{
    try{display=new Intl.DisplayNames(["en"],{type:"region"})}catch{}
  }
  const options=source.map(c=>({code:c.code,label:display?.of(c.code)||c.name||c.code}))
    .sort((a,b)=>a.label.localeCompare(b.label,currentLanguage||"en"));
  select.innerHTML='<option value="">Choose a country</option>'+options.map(c=>`<option value="${c.code}">${esc(c.label)}</option>`).join("");
  const wanted=normalizeCountryCode(selected||"AL");
  select.value=options.some(c=>c.code===wanted)?wanted:"AL";
}
function populateCurrencySelect(select,selected){
  if(!select)return;
  const list=currencies.length?currencies:["EUR","USD","GBP","RUB","BDT","ALL"];
  let dn;try{dn=new Intl.DisplayNames([currentLanguage||"en"],{type:"currency"})}catch{
    try{dn=new Intl.DisplayNames(["en"],{type:"currency"})}catch{}
  }
  select.innerHTML=list.map(code=>`<option value="${code}">${code}${dn?` — ${esc(dn.of(code)||code)}`:""}</option>`).join("");
  const wanted=selected&&list.includes(selected)?selected:"EUR";
  select.value=wanted;
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
  populateCountrySelect(document.querySelector("#transaction-country"),state?.currentCountry||"AL");
  populateCountrySelect(document.querySelector("#travel-country"),state?.currentCountry||"AL");
  populateCountrySelect(document.querySelector("#budget-country"),state?.currentCountry||"AL");
  populateCurrencySelect(document.querySelector("#signup-currency"),document.querySelector("#signup-currency")?.value||state?.mainCurrency||"EUR");
  populateCurrencySelect(document.querySelector("#profile-currency"),state?.mainCurrency||"EUR");
  populateCurrencySelect(document.querySelector("#onboarding-currency"),state?.mainCurrency||"EUR");
}


function initializeAuthControls(){
  try{
    populateCountrySelect(document.querySelector("#signup-country"),"AL");
    populateCurrencySelect(document.querySelector("#signup-currency"),"EUR");
    const country=document.querySelector("#signup-country");
    if(country&&!country.dataset.currencyBound){
      country.dataset.currencyBound="1";
      country.addEventListener("change",()=>{
        const item=countryByCode.get(country.value);
        const currency=document.querySelector("#signup-currency");
        if(item?.currency&&currency&&currencies.includes(item.currency))currency.value=item.currency;
      });
    }
  }catch(error){
    console.error("Authentication controls could not initialize:",error);
  }
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

document.querySelector("#show-signup")?.addEventListener("click",()=>{setAuthView("signup-view");setSignupStep(1)});
document.querySelector("#show-login")?.addEventListener("click",()=>setAuthView("login-view"));
document.querySelector("#show-forgot")?.addEventListener("click",()=>setAuthView("forgot-view"));
document.querySelector("#back-to-login")?.addEventListener("click",()=>setAuthView("login-view"));
document.querySelectorAll(".password-toggle").forEach(button=>button.addEventListener("click",()=>{
  const input=button.parentElement.querySelector("input");
  const show=input.type==="password";
  input.type=show?"text":"password";
  button.textContent=show?"Hide":"Show";
}));
document.querySelector("[data-next-signup]")?.addEventListener("click",()=>{
  const form=document.querySelector("#signup-form");
  const fields=[form.elements.name,form.elements.country,form.elements.currency,form.elements.user_type];
  if(fields.some(field=>!field.reportValidity()))return;
  setSignupStep(2);
});
document.querySelector("[data-prev-signup]")?.addEventListener("click",()=>setSignupStep(1));

document.querySelector("#signup-form")?.addEventListener("submit",async event=>{
  event.preventDefault();
  if(!requireConfigured())return;

  const form=event.currentTarget;
  const submit=form.querySelector('button[type="submit"]');
  setAuthMessage("");

  if(form.elements.password.value!==form.elements.confirm_password.value){
    authToast("Passwords do not match.",true);
    return;
  }

  const payload={
    name:form.elements.name.value.trim(),
    country:normalizeCountryCode(form.elements.country.value),
    currency:form.elements.currency.value,
    userType:form.elements.user_type.value,
    email:form.elements.email.value.trim().toLowerCase(),
    password:form.elements.password.value
  };

  try{
    submit.disabled=true;
    submit.textContent="Creating account…";

    const {data,error}=await authRequest(supabase.auth.signUp({
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
    }),"Signup");

    if(error)throw error;

    if(data?.session&&data?.user){
      authToast("Account created successfully.");
      showApp(data.user);
      return;
    }

    form.reset();
    initializeAuthControls();
    setSignupStep(1);
    setAuthView("login-view");
    setAuthMessage(
      "Account created. Check your email and click the confirmation link, then return here and log in.",
      "success"
    );
  }catch(error){
    authToast(friendlyAuthError(error),true);
  }finally{
    submit.disabled=false;
    submit.textContent="Create account";
  }
});

document.querySelector("#login-form")?.addEventListener("submit",async event=>{
  event.preventDefault();
  const form=event.currentTarget;
  const button=form.querySelector('button[type="submit"]');
  try{
    if(!requireConfigured())return;
    button.disabled=true;button.textContent="Logging in…";
    setAuthMessage("");
    const {data,error}=await authRequest(supabase.auth.signInWithPassword({
      email:form.elements.email.value.trim().toLowerCase(),
      password:form.elements.password.value
    }),"Login");
    if(error)throw error;
    if(!data?.user)throw new Error("Login succeeded but no user session was returned.");
    showApp(data.user);
  }catch(error){
    authToast(friendlyAuthError(error),true);
  }finally{
    button.disabled=false;button.textContent="Log in";
  }
});

document.querySelector("#forgot-form")?.addEventListener("submit",async event=>{
  event.preventDefault();
  if(!requireConfigured())return;
  const email=event.currentTarget.elements.email.value.trim().toLowerCase();
  const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+window.location.pathname});
  if(error)authToast(error.message,true);
  else{authToast("Password reset email sent.");setAuthView("login-view")}
});

document.querySelector("#reset-form")?.addEventListener("submit",async event=>{
  event.preventDefault();
  const form=event.currentTarget;
  if(form.elements.password.value!==form.elements.confirm_password.value){
    authToast("Passwords do not match.",true);return;
  }
  const {error}=await supabase.auth.updateUser({password:form.elements.password.value});
  if(error)authToast(error.message,true);
  else{authToast("Password updated.");if(currentUser)showApp(currentUser)}
});

document.querySelector("#logout-button")?.addEventListener("click",async()=>{
  if(supabase)await supabase.auth.signOut();
  showAuth();
  authToast("You have been logged out.");
});

async function initializeAuthentication(){
  if(!isConfigured||!supabase){showAuth();return}
  try{
    const {data,error}=await authRequest(supabase.auth.getSession(),"Session check");
    if(error)throw error;
    if(data?.session?.user)showApp(data.session.user);else showAuth();
  }catch(error){
    console.error(error);
    showAuth();
    setAuthMessage(friendlyAuthError(error),"error");
  }

  supabase.auth.onAuthStateChange((event,session)=>{
    if(event==="PASSWORD_RECOVERY"){
      setAuthView("reset-view");authScreen.classList.remove("hidden");appRoot.classList.add("hidden");
    }else if(event==="SIGNED_OUT"){
      showAuth();
    }else if(session?.user&&!currentUser){
      showApp(session.user);
    }
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
    {id:crypto.randomUUID(),group:"Essential",category:"Housing",limit:520,currency:"EUR",country:"AL"},
    {id:crypto.randomUUID(),group:"Flexible",category:"Food",limit:200,currency:"EUR",country:"AL"},
    {id:crypto.randomUUID(),group:"Savings",category:"Emergency Fund",limit:200,currency:"EUR",country:"AL"},
    {id:crypto.randomUUID(),group:"Investments",category:"Monthly Investing",limit:150,currency:"EUR",country:"AL"}
  ],
  investments:[
    {id:crypto.randomUUID(),name:"Global Index Fund",type:"ETF",currency:"EUR",cost:1200,value:1350},
    {id:crypto.randomUUID(),name:"Tech Shares",type:"Stock",currency:"USD",cost:900,value:1040}
  ]
};

function seed(data){data.accounts=[];data.transactions=[];data.budgets=[];data.investments=[];data.goals=[];data.netWorthSnapshots=[];data.currentCountry=data.currentCountry||"AL";data.mainCurrency=data.mainCurrency||"EUR";data.travel={country:data.currentCountry,budget:0,spent:0,days:1};return data;}
function normalizeState(data){
  const normalized=data&&typeof data==="object"?data:structuredClone(demo);
  normalized.accounts=Array.isArray(normalized.accounts)?normalized.accounts:[];
  normalized.transactions=Array.isArray(normalized.transactions)?normalized.transactions:[];
  normalized.budgets=Array.isArray(normalized.budgets)?normalized.budgets:[];
  normalized.investments=Array.isArray(normalized.investments)?normalized.investments:[];
  normalized.goals=Array.isArray(normalized.goals)?normalized.goals:[];
  normalized.netWorthSnapshots=Array.isArray(normalized.netWorthSnapshots)?normalized.netWorthSnapshots:[];
  normalized.rates={...demo.rates,...(normalized.rates||{})};
  normalized.transactions=normalized.transactions.map((t,index)=>({
    ...t,
    country:normalizeCountryCode(t.country||normalized.currentCountry||"US"),
    frequency:t.frequency||"once",
    createdAt:t.createdAt||`${t.date||"1970-01-01"}T${String(23-Math.min(index,23)).padStart(2,"0")}:00:00.000Z`
  }));
  normalized.budgets=normalized.budgets.map(b=>({
    ...b,
    currency:b.currency||"EUR",
    country:normalizeCountryCode(b.country||normalized.currentCountry||"US")
  }));
  return normalized;
}
function load(){
  try{
    const raw=localStorage.getItem(KEY);
    if(raw)return normalizeState(JSON.parse(raw));
  }catch{}
  const fresh=normalizeState(seed(structuredClone(demo)));
  localStorage.setItem(KEY,JSON.stringify(fresh));
  return fresh;
}
function save(message){
  localStorage.setItem(KEY,JSON.stringify(state));
  render();
  window.dispatchEvent(new CustomEvent("nomad:state-saved",{detail:{state:structuredClone(state)}}));
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
function empty(message="No data yet.",action=""){
  return `<div class="empty-state"><div class="empty-state-icon">◇</div><h3>${esc(message)}</h3><p>Add your first item to start building a useful financial overview.</p>${action?`<span>${esc(action)}</span>`:""}</div>`
}

function render(){
  document.querySelector("#main-currency").value=state.mainCurrency;
  document.querySelector("#current-location").textContent=`Current country: ${countryName(state.currentCountry)}`;
  const nonDebt=state.accounts.filter(a=>a.type!=="Debt").reduce((s,a)=>s+inMain(accountBalance(a),a.currency),0);
  const debt=state.accounts.filter(a=>a.type==="Debt").reduce((s,a)=>s+Math.abs(inMain(accountBalance(a),a.currency)),0);
  const investments=state.investments.reduce((s,i)=>s+inMain(i.value,i.currency),0);
  const income=state.transactions.filter(t=>t.type==="income"&&isThisMonth(t.date)).reduce((s,t)=>s+inMain(t.amount,t.currency),0);
  const expenses=state.transactions.filter(t=>t.type==="expense"&&isThisMonth(t.date)).reduce((s,t)=>s+inMain(t.amount,t.currency),0);
  const budgetTotal=state.budgets.reduce((s,b)=>s+inMain(b.limit,b.currency||"EUR"),0);
  const essential=state.budgets.filter(b=>b.group==="Essential").reduce((s,b)=>s+inMain(b.limit,b.currency||"EUR"),0);
  const savingsTarget=state.budgets.filter(b=>["Savings","Investments"].includes(b.group)).reduce((s,b)=>s+inMain(b.limit,b.currency||"EUR"),0);
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

  renderAccounts();renderTransactions();renderBudgets(expenses,budgetTotal);renderInvestments();populateSelects();renderCurrencyConverter();
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
  const query=(document.querySelector("#transaction-search")?.value||"").trim().toLowerCase();
  const type=document.querySelector("#transaction-filter")?.value||"all";
  const category=document.querySelector("#transaction-category-filter")?.value||"all";
  const country=document.querySelector("#transaction-country-filter")?.value||"all";
  const dateFrom=document.querySelector("#transaction-date-from")?.value||"";
  const dateTo=document.querySelector("#transaction-date-to")?.value||"";
  const minRaw=document.querySelector("#transaction-min-amount")?.value;
  const maxRaw=document.querySelector("#transaction-max-amount")?.value;
  const min=minRaw===""||minRaw==null?null:Number(minRaw);
  const max=maxRaw===""||maxRaw==null?null:Number(maxRaw);
  const sort=document.querySelector("#transaction-sort")?.value||"newest";
  const filtered=state.transactions.filter(t=>{
    const account=state.accounts.find(a=>a.id===t.accountId);
    const searchable=`${t.category} ${t.note||""} ${countryName(t.country)} ${account?.name||""}`.toLowerCase();
    const mainAmount=Math.abs(inMain(t.amount,t.currency));
    return (type==="all"||t.type===type) &&
      (category==="all"||t.category===category) &&
      (country==="all"||normalizeCountryCode(t.country)===country) &&
      (!query||searchable.includes(query)) &&
      (!dateFrom||t.date>=dateFrom) &&
      (!dateTo||t.date<=dateTo) &&
      (min===null||mainAmount>=min) &&
      (max===null||mainAmount<=max);
  });
  return filtered.sort((a,b)=>{
    const dateA=new Date(a.createdAt||`${a.date}T00:00:00`);
    const dateB=new Date(b.createdAt||`${b.date}T00:00:00`);
    if(sort==="oldest")return dateA-dateB;
    if(sort==="largest")return Math.abs(inMain(b.amount,b.currency))-Math.abs(inMain(a.amount,a.currency));
    if(sort==="smallest")return Math.abs(inMain(a.amount,a.currency))-Math.abs(inMain(b.amount,b.currency));
    if(sort==="category")return a.category.localeCompare(b.category);
    return dateB-dateA;
  });
}
function transactionHTML(items,deletable=false){
  if(!items.length)return empty("No matching transactions.");
  return items.map(t=>{
    const a=state.accounts.find(x=>x.id===t.accountId);
    const sign=t.type==="income"?"+":"-";
    return `<article class="transaction-item">
      <div class="transaction-main">
        <div class="transaction-icon ${t.type}">${t.type==="income"?"↙":"↗"}</div>
        <div class="transaction-copy">
          <div class="row-title">${esc(t.category)}${t.frequency&&t.frequency!=="once"?` <span class="recurring-badge">↻ ${esc(t.frequency)}</span>`:""}</div>
          <div class="row-subtitle">${esc(countryName(t.country))} · ${esc(a?.name||"Unknown")} · ${esc(t.date)}${t.note?` · ${esc(t.note)}`:""}</div>
        </div>
      </div>
      <div class="transaction-value">
        <strong class="amount ${t.type}">${sign}${money(t.amount,t.currency)}</strong>
        <small>${money(inMain(t.amount,t.currency))}</small>
      </div>
      ${deletable?`<button class="delete-transaction delete-tx" data-id="${t.id}" aria-label="Delete transaction" title="Delete transaction">×</button>`:""}
    </article>`;
  }).join("");
}
function renderTransactions(){
  const all=[...state.transactions].sort((a,b)=>new Date(b.createdAt||`${b.date}T00:00:00`)-new Date(a.createdAt||`${a.date}T00:00:00`));
  document.querySelector("#recent-transactions").innerHTML=transactionHTML(all.slice(0,5));
  const filtered=filteredTransactions();
  document.querySelector("#transaction-list").innerHTML=transactionHTML(filtered,true);
  const count=document.querySelector("#transaction-result-count");
  if(count)count.textContent=`${filtered.length} transaction${filtered.length===1?"":"s"}`;
  window.dispatchEvent(new CustomEvent("nomad:transactions-rendered"));
}
function renderBudgets(expenses,budgetTotal){
  const html=state.budgets.map(b=>{
    const currency=b.currency||"EUR";
    const spentMain=categorySpent(b.category);
    const spentInBudget=convert(spentMain,state.mainCurrency,currency);
    const pct=Math.min(100,spentInBudget/b.limit*100);
    const over=spentInBudget>b.limit;
    return `<article class="budget-item ${over?"is-over":""}">
      <div class="budget-item-head">
        <div><strong>${esc(b.group)} · ${esc(b.category)}</strong><small>${esc(countryName(b.country||state.currentCountry))} · ${currency}</small></div>
        <span>${money(spentInBudget,currency)} / ${money(b.limit,currency)}</span>
      </div>
      <div class="progress ${over?"over":""}"><span style="width:${pct}%"></span></div>
    </article>`;
  }).join("")||empty();
  document.querySelector("#budget-overview").innerHTML=html;
  document.querySelector("#budget-list").innerHTML=html;
  const remaining=Math.max(0,budgetTotal-expenses);
  document.querySelector("#budget-explanation").innerHTML=`<div class="budget-total">${money(remaining)}</div><p>Estimated budget remaining this month.</p><div class="budget-summary-list"><div><span>Planned budget</span><strong>${money(budgetTotal)}</strong></div><div><span>Spent so far</span><strong>${money(expenses)}</strong></div><div><span>Remaining</span><strong>${money(remaining)}</strong></div></div>`;
}
function renderInvestments(){
  document.querySelector("#investment-list").innerHTML=state.investments.map(i=>{
    const gain=i.value-i.cost,pct=i.cost?gain/i.cost*100:0;
    return `<article class="mini-card"><small>${esc(i.type)} · ${esc(i.currency)}</small><strong>${money(i.value,i.currency)}</strong><span>${esc(i.name)}</span><div class="${gain>=0?"gain":"loss"}">${gain>=0?"+":""}${money(gain,i.currency)} (${pct.toFixed(1)}%)</div></article>`;
  }).join("")||empty();
}
function renderCurrencyConverter(){
  const from=document.querySelector("#converter-from");
  const to=document.querySelector("#converter-to");
  if(!from||!to)return;
  const previousFrom=from.value||state.mainCurrency||"USD";
  const previousTo=to.value||(state.mainCurrency==="RUB"?"BDT":"RUB");
  populateCurrencySelect(from,previousFrom);
  populateCurrencySelect(to,previousTo);
  from.value=currencies.includes(previousFrom)?previousFrom:"USD";
  to.value=currencies.includes(previousTo)?previousTo:"RUB";
  calculateCurrencyConversion();
}
function calculateCurrencyConversion(){
  const form=document.querySelector("#currency-converter-form");
  const result=document.querySelector("#converter-result");
  if(!form||!result||!state)return;
  const data=new FormData(form);
  const amount=Number(data.get("amount"))||0;
  const from=data.get("from");
  const to=data.get("to");
  const converted=convert(amount,from,to);
  result.innerHTML=`<span>${money(amount,from)}</span><strong>${money(converted,to)}</strong><small>1 ${from} ≈ ${Number(convert(1,from,to)).toLocaleString(undefined,{maximumFractionDigits:6})} ${to}</small>`;
}
function populateSelects(){
  ["main-currency","transaction-currency","account-currency","investment-currency","budget-currency","goal-currency"].forEach(id=>populateCurrencySelect(document.querySelector("#"+id),id==="main-currency"?state.mainCurrency:undefined));
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
    populateCountrySelect(form.elements.country,state.currentCountry||"AL");
    const account=state.accounts.find(a=>a.type!=="Debt");
    if(account){form.elements.accountId.value=account.id;form.elements.currency.value=account.currency}
    setTimeout(()=>form.elements.amount.focus(),50);
  }
  if(id==="account-dialog"){
    populateCountryBankSelects();
  }
  if(id==="budget-dialog"){
    const form=document.querySelector("#budget-form");
    populateCountrySelect(form.elements.country,state.currentCountry||"AL");
    populateCurrencySelect(form.elements.currency,state.mainCurrency||"EUR");
    form.elements.currency.value=state.mainCurrency||"EUR";
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
  if(account){
    document.querySelector("#transaction-currency").value=account.currency;
    const country=document.querySelector("#transaction-country");
    if(country)country.value=normalizeCountryCode(account.country);
  }
});
document.querySelector("#main-currency").addEventListener("change",e=>{state.mainCurrency=e.target.value;save("Main currency updated")});
document.querySelectorAll(".transaction-filter-control").forEach(control=>{
  control.addEventListener(control.type==="search"||control.type==="number"?"input":"change",renderTransactions);
});
document.querySelector("#clear-transaction-filters")?.addEventListener("click",()=>{
  ["transaction-search","transaction-date-from","transaction-date-to","transaction-min-amount","transaction-max-amount"].forEach(id=>{const el=document.querySelector("#"+id);if(el)el.value=""});
  ["transaction-filter","transaction-category-filter","transaction-country-filter"].forEach(id=>{const el=document.querySelector("#"+id);if(el)el.value="all"});
  const sort=document.querySelector("#transaction-sort");if(sort)sort.value="newest";
  renderTransactions();
});

document.querySelector("#transaction-form").addEventListener("submit",e=>{
  e.preventDefault();const f=new FormData(e.target);
  state.transactions.push({id:crypto.randomUUID(),type:f.get("type"),amount:+f.get("amount"),currency:f.get("currency"),category:f.get("category").trim(),country:normalizeCountryCode(f.get("country")),accountId:f.get("accountId"),date:f.get("date"),createdAt:new Date().toISOString(),frequency:f.get("frequency")||"once",note:f.get("note").trim()});
  e.target.reset();closeDialog(document.querySelector("#transaction-dialog"));save("Transaction saved");
});
document.querySelector("#account-form").addEventListener("submit",e=>{
  e.preventDefault();const f=new FormData(e.target);
  state.accounts.push({id:crypto.randomUUID(),name:f.get("name").trim(),institution:f.get("institution").trim(),country:normalizeCountryCode(f.get("country")),currency:f.get("currency"),type:f.get("type"),openingBalance:+f.get("balance")});
  e.target.reset();closeDialog(document.querySelector("#account-dialog"));save("Account added");
});
document.querySelector("#budget-form").addEventListener("submit",e=>{
  e.preventDefault();const f=new FormData(e.target);
  state.budgets.push({id:crypto.randomUUID(),group:f.get("group"),category:f.get("category").trim(),currency:f.get("currency"),country:normalizeCountryCode(f.get("country")),limit:+f.get("limit")});
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



document.querySelector("#currency-converter-form")?.addEventListener("submit",e=>{e.preventDefault();calculateCurrencyConversion()});
document.querySelector("#swap-currencies")?.addEventListener("click",()=>{
  const from=document.querySelector("#converter-from"),to=document.querySelector("#converter-to");
  [from.value,to.value]=[to.value,from.value];
  calculateCurrencyConversion();
});
document.querySelector("#converter-from")?.addEventListener("change",calculateCurrencyConversion);
document.querySelector("#converter-to")?.addEventListener("change",calculateCurrencyConversion);
document.querySelector("#refresh-rates")?.addEventListener("click",async()=>{
  const button=document.querySelector("#refresh-rates");
  const status=document.querySelector("#rate-status");
  button.disabled=true;button.textContent="Refreshing…";
  try{
    const response=await fetch("https://open.er-api.com/v6/latest/EUR",{cache:"no-store"});
    if(!response.ok)throw new Error("Rate service unavailable");
    const data=await response.json();
    if(data.result!=="success"||!data.rates)throw new Error("Invalid rate response");
    currencies.forEach(code=>{if(Number(data.rates[code]))state.rates[code]=Number(data.rates[code])});
    state.rates.EUR=1;
    save();
    calculateCurrencyConversion();
    status.textContent=`Rates refreshed ${new Date().toLocaleString()}.`;
    toast("Currency rates refreshed");
  }catch(error){
    status.textContent="Could not refresh rates. Saved reference rates are still available.";
    toast("Could not refresh exchange rates");
  }finally{
    button.disabled=false;button.textContent="Refresh rates";
  }
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
  e.preventDefault();const f=new FormData(e.target),country=normalizeCountryCode(f.get("country")),budget=+f.get("budget"),spent=+f.get("spent"),days=Math.max(1,+f.get("days")),left=Math.max(0,budget-spent);
  state.currentCountry=country;save("Travel plan updated");
  setResult("#travel-result",`${countryName(country)} travel plan`,money(left),[["Trip budget",money(budget)],["Spent",money(spent)],["Days remaining",days],["Safe daily spending",money(left/days)]]);
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
  populateCountrySelect(document.querySelector("#travel-country"),state.currentCountry||"AL");
  document.querySelector("#travel-form").dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));
}
if("serviceWorker" in navigator){
  navigator.serviceWorker.getRegistrations()
    .then(registrations=>registrations.forEach(registration=>registration.unregister()))
    .catch(()=>{});
}


window.NomadApp={
  getState:()=>state,
  getUser:()=>currentUser,
  getSupabase:()=>supabase,
  getMainCurrency:()=>state?.mainCurrency||"EUR",
  money,
  convert,
  inMain,
  countryName,
  normalizeCountryCode,
  populateCountrySelect,
  populateCurrencySelect,
  replaceState(next,{persist=true,message=""}={}){
    state=normalizeState(next);
    if(persist)localStorage.setItem(KEY,JSON.stringify(state));
    render();
    window.dispatchEvent(new CustomEvent("nomad:state-replaced",{detail:{state:structuredClone(state)}}));
    if(message)toast(message);
  },
  save,
  render,
  renderTransactions,
  toast
};

applyTheme(currentTheme);initializeAuthControls();applyLanguage(currentLanguage);initializeAuthControls();initializeAuthentication();
