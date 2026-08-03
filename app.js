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
let state=null;

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
  if(!el)return;
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
  document.querySelector("#"+id)?.classList.add("active");
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

const currencies=window.NOMAD_WEALTH_CURRENCIES||["EUR","USD","GBP","RUB","BDT"];
const countryData=window.NOMAD_WEALTH_COUNTRIES||[];
const countryByCode=new Map(countryData.map(c=>[c.code,c]));
let currentLanguage=localStorage.getItem("nomad_language")||navigator.language?.slice(0,2)||"en";
if(!window.NOMAD_WEALTH_I18N?.[currentLanguage])currentLanguage="en";
let currentTheme=localStorage.getItem("nomad_theme")||"system";

function countryName(code,locale=currentLanguage){
  const normalized=normalizeCountryCode(code);
  try{
    return new Intl.DisplayNames([locale],{type:"region"}).of(normalized)
      ||countryByCode.get(normalized)?.name
      ||code;
  }catch{
    return countryByCode.get(normalized)?.name||code;
  }
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
  try{
    display=new Intl.DisplayNames([currentLanguage||"en"],{type:"region"});
  }catch{
    try{display=new Intl.DisplayNames(["en"],{type:"region"});}catch{}
  }

  const options=source
    .map(c=>({code:c.code,label:display?.of(c.code)||c.name||c.code}))
    .sort((a,b)=>a.label.localeCompare(b.label,currentLanguage||"en"));

  select.innerHTML=
    '<option value="">Choose a country</option>'+
    options.map(c=>`<option value="${c.code}">${esc(c.label)}</option>`).join("");

  const wanted=normalizeCountryCode(selected||"AL");
  select.value=options.some(c=>c.code===wanted)?wanted:"AL";
}
function populateCurrencySelect(select,selected){
  if(!select)return;
  const list=currencies.length?currencies:["EUR","USD","GBP","RUB","BDT","ALL"];
  let dn;
  try{
    dn=new Intl.DisplayNames([currentLanguage||"en"],{type:"currency"});
  }catch{
    try{dn=new Intl.DisplayNames(["en"],{type:"currency"});}catch{}
  }

  select.innerHTML=list.map(code=>
    `<option value="${code}">${code}${dn?` — ${esc(dn.of(code)||code)}`:""}</option>`
  ).join("");

  const wanted=selected&&list.includes(selected)?selected:"EUR";
  select.value=wanted;
}
function applyTheme(theme=currentTheme){
  currentTheme=theme;
  localStorage.setItem("nomad_theme",theme);
  const resolved=theme==="system"
    ?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")
    :theme;

  document.documentElement.dataset.theme=resolved;

  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.content=resolved==="dark"?"#07111f":"#0f766e";

  const toggle=document.querySelector("#theme-toggle");
  if(toggle){
    toggle.textContent=resolved==="dark"?"☀":"◐";
    toggle.title=resolved==="dark"?"Use light mode":"Use dark mode";
  }
}
function applyLanguage(lang=currentLanguage){
  if(!window.NOMAD_WEALTH_I18N?.[lang])lang="en";
  currentLanguage=lang;
  localStorage.setItem("nomad_language",lang);
  document.documentElement.lang=lang;
  document.documentElement.dir=lang==="ar"?"rtl":"ltr";

  const dict=window.NOMAD_WEALTH_I18N[lang];
  document.querySelectorAll("[data-i18n]").forEach(el=>{
    const text=dict[el.dataset.i18n];
    if(text)el.textContent=text;
  });

  if(state)render();
  populateAllCountryCurrencyControls();
}
function populateAllCountryCurrencyControls(){
  populateCountrySelect(
    document.querySelector("#profile-country"),
    state?.currentCountry||currentUser?.user_metadata?.country||"AL"
  );
  populateCountrySelect(
    document.querySelector("#onboarding-country"),
    currentUser?.user_metadata?.country||"AL"
  );
  populateCountrySelect(
    document.querySelector("#account-country"),
    state?.currentCountry||"AL"
  );
  populateCountrySelect(
    document.querySelector("#transaction-country"),
    state?.currentCountry||"AL"
  );
  populateCountrySelect(
    document.querySelector("#travel-country"),
    state?.currentCountry||"AL"
  );
  populateCountrySelect(
    document.querySelector("#budget-country"),
    state?.currentCountry||"AL"
  );

  populateCurrencySelect(
    document.querySelector("#profile-currency"),
    state?.mainCurrency||"EUR"
  );
  populateCurrencySelect(
    document.querySelector("#onboarding-currency"),
    state?.mainCurrency||"EUR"
  );
}
function initializeAuthControls(){
  // Signup no longer needs country or currency controls.
}
function userDisplayName(user){
  return user?.user_metadata?.full_name
    ||user?.user_metadata?.name
    ||user?.email?.split("@")[0]
    ||"User";
}
function updateUserInterface(user){
  if(!state)return;

  const name=userDisplayName(user);
  const email=user?.email||"Signed in";
  const initial=name.trim().charAt(0).toUpperCase()||"U";

  const sidebarName=document.querySelector("#sidebar-user-name");
  const sidebarEmail=document.querySelector("#sidebar-user-email");
  const userAvatar=document.querySelector("#user-avatar");
  const headerAvatar=document.querySelector("#header-avatar");
  const headerName=document.querySelector("#header-user-name");

  if(sidebarName){
    sidebarName.textContent=name;
    sidebarName.title=name;
  }
  if(sidebarEmail){
    sidebarEmail.textContent=email;
    sidebarEmail.title=email;
  }
  if(userAvatar)userAvatar.textContent=initial;
  if(headerAvatar)headerAvatar.textContent=initial;
  if(headerName)headerName.textContent=name;

  const metadata=user?.user_metadata||{};

  if(metadata.country){
    state.currentCountry=normalizeCountryCode(metadata.country);
  }
  if(metadata.main_currency&&currencies.includes(metadata.main_currency)){
    state.mainCurrency=metadata.main_currency;
  }
  if(metadata.language)currentLanguage=metadata.language;
  if(metadata.theme)currentTheme=metadata.theme;

  const pName=document.querySelector("#profile-name-input");
  const pDisplay=document.querySelector("#profile-display-name");
  const pEmail=document.querySelector("#profile-display-email");
  const pAvatar=document.querySelector("#profile-avatar");

  if(pName)pName.value=name;
  if(pDisplay)pDisplay.textContent=name;
  if(pEmail)pEmail.textContent=email;
  if(pAvatar)pAvatar.textContent=initial;

  applyTheme(currentTheme);
  applyLanguage(currentLanguage);
}
function showApp(user){
  currentUser=user;
  KEY=`nomad-wealth-${user.id}`;
  state=load();

  updateUserInterface(user);

  authScreen?.classList.add("hidden");
  appRoot?.classList.remove("hidden");

  initializeFinanceApp();
  render();

  const metadata=user?.user_metadata||{};
  if(!metadata.onboarding_complete){
    const form=document.querySelector("#onboarding-form");
    const dialog=document.querySelector("#onboarding-dialog");

    if(form&&dialog){
      form.elements.name.value=userDisplayName(user);
      populateCountrySelect(form.elements.country,metadata.country||"AL");
      populateCurrencySelect(form.elements.currency,metadata.main_currency||"EUR");
      dialog.showModal();
    }
  }
}
function showAuth(){
  currentUser=null;
  state=null;
  appRoot?.classList.add("hidden");
  authScreen?.classList.remove("hidden");
  setAuthView("login-view");
}

document.querySelector("#show-signup")?.addEventListener("click",()=>{
  setAuthView("signup-view");
});
document.querySelector("#show-login")?.addEventListener("click",()=>{
  setAuthView("login-view");
});
document.querySelector("#show-forgot")?.addEventListener("click",()=>{
  setAuthView("forgot-view");
});
document.querySelector("#back-to-login")?.addEventListener("click",()=>{
  setAuthView("login-view");
});

document.querySelectorAll(".password-toggle").forEach(button=>{
  button.addEventListener("click",()=>{
    const input=button.parentElement.querySelector("input");
    if(!input)return;
    const show=input.type==="password";
    input.type=show?"text":"password";
    button.textContent=show?"Hide":"Show";
  });
});

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
    email:form.elements.email.value.trim().toLowerCase(),
    password:form.elements.password.value
  };

  try{
    submit.disabled=true;
    submit.textContent="Creating account…";

    const {data,error}=await authRequest(
      supabase.auth.signUp({
        email:payload.email,
        password:payload.password,
        options:{
          data:{
            full_name:payload.name,
            country:"AL",
            main_currency:"EUR",
            user_type:"Other",
            language:currentLanguage,
            theme:currentTheme,
            onboarding_complete:true
          },
          emailRedirectTo:window.location.origin+window.location.pathname
        }
      }),
      "Signup"
    );

    if(error)throw error;

    if(data?.session&&data?.user){
      authToast("Account created successfully.");
      showApp(data.user);
      return;
    }

    form.reset();
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

    button.disabled=true;
    button.textContent="Logging in…";
    setAuthMessage("");

    const {data,error}=await authRequest(
      supabase.auth.signInWithPassword({
        email:form.elements.email.value.trim().toLowerCase(),
        password:form.elements.password.value
      }),
      "Login"
    );

    if(error)throw error;
    if(!data?.user){
      throw new Error("Login succeeded but no user session was returned.");
    }

    showApp(data.user);
  }catch(error){
    authToast(friendlyAuthError(error),true);
  }finally{
    button.disabled=false;
    button.textContent="Log in";
  }
});

document.querySelector("#forgot-form")?.addEventListener("submit",async event=>{
  event.preventDefault();
  if(!requireConfigured())return;

  const email=event.currentTarget.elements.email.value.trim().toLowerCase();

  try{
    const {error}=await authRequest(
      supabase.auth.resetPasswordForEmail(email,{
        redirectTo:window.location.origin+window.location.pathname
      }),
      "Password reset"
    );

    if(error)throw error;

    authToast("Password reset email sent.");
    setAuthView("login-view");
  }catch(error){
    authToast(friendlyAuthError(error),true);
  }
});

document.querySelector("#reset-form")?.addEventListener("submit",async event=>{
  event.preventDefault();

  const form=event.currentTarget;

  if(form.elements.password.value!==form.elements.confirm_password.value){
    authToast("Passwords do not match.",true);
    return;
  }

  try{
    const {data,error}=await authRequest(
      supabase.auth.updateUser({
        password:form.elements.password.value
      }),
      "Password update"
    );

    if(error)throw error;

    authToast("Password updated.");

    if(data?.user){
      showApp(data.user);
    }else{
      setAuthView("login-view");
    }
  }catch(error){
    authToast(friendlyAuthError(error),true);
  }
});

document.querySelector("#logout-button")?.addEventListener("click",async()=>{
  try{
    if(supabase)await supabase.auth.signOut();
  }catch(error){
    console.error(error);
  }

  showAuth();
  authToast("You have been logged out.");
});

async function initializeAuthentication(){
  if(!isConfigured||!supabase){
    showAuth();
    return;
  }

  try{
    const {data,error}=await authRequest(
      supabase.auth.getSession(),
      "Session check"
    );

    if(error)throw error;

    if(data?.session?.user){
      showApp(data.session.user);
    }else{
      showAuth();
    }
  }catch(error){
    console.error(error);
    showAuth();
    setAuthMessage(friendlyAuthError(error),"error");
  }

  supabase.auth.onAuthStateChange((event,session)=>{
    if(event==="PASSWORD_RECOVERY"){
      setAuthView("reset-view");
      authScreen?.classList.remove("hidden");
      appRoot?.classList.add("hidden");
    }else if(event==="SIGNED_OUT"){
      showAuth();
    }else if(session?.user&&!currentUser){
      showApp(session.user);
    }
  });
}

const demo={
  mainCurrency:"EUR",
  currentCountry:"AL",
  rates:{
    EUR:1,
    USD:1.09,
    GBP:.85,
    RUB:96,
    BDT:128,
    ALL:100
  },
  accounts:[],
  transactions:[],
  budgets:[],
  investments:[],
  goals:[],
  netWorthSnapshots:[],
  travel:{
    country:"AL",
    budget:0,
    spent:0,
    days:1
  }
};

function seed(data){
  data.accounts=[];
  data.transactions=[];
  data.budgets=[];
  data.investments=[];
  data.goals=[];
  data.netWorthSnapshots=[];
  data.currentCountry=data.currentCountry||"AL";
  data.mainCurrency=data.mainCurrency||"EUR";
  data.travel={
    country:data.currentCountry,
    budget:0,
    spent:0,
    days:1
  };
  return data;
}
function normalizeState(data){
  const normalized=data&&typeof data==="object"
    ?data
    :structuredClone(demo);

  normalized.accounts=Array.isArray(normalized.accounts)
    ?normalized.accounts
    :[];

  normalized.transactions=Array.isArray(normalized.transactions)
    ?normalized.transactions
    :[];

  normalized.budgets=Array.isArray(normalized.budgets)
    ?normalized.budgets
    :[];

  normalized.investments=Array.isArray(normalized.investments)
    ?normalized.investments
    :[];

  normalized.goals=Array.isArray(normalized.goals)
    ?normalized.goals
    :[];

  normalized.netWorthSnapshots=Array.isArray(normalized.netWorthSnapshots)
    ?normalized.netWorthSnapshots
    :[];

  normalized.rates={
    ...demo.rates,
    ...(normalized.rates||{})
  };

  normalized.transactions=normalized.transactions.map((transaction,index)=>({
    ...transaction,
    country:normalizeCountryCode(
      transaction.country||normalized.currentCountry||"US"
    ),
    frequency:transaction.frequency||"once",
    createdAt:transaction.createdAt
      ||`${transaction.date||"1970-01-01"}T${String(23-Math.min(index,23)).padStart(2,"0")}:00:00.000Z`
  }));

  normalized.budgets=normalized.budgets.map(budget=>({
    ...budget,
    currency:budget.currency||"EUR",
    country:normalizeCountryCode(
      budget.country||normalized.currentCountry||"US"
    )
  }));

  return normalized;
}
function load(){
  try{
    const raw=localStorage.getItem(KEY);
    if(raw)return normalizeState(JSON.parse(raw));
  }catch(error){
    console.error("Could not load saved data:",error);
  }

  const fresh=normalizeState(seed(structuredClone(demo)));
  localStorage.setItem(KEY,JSON.stringify(fresh));
  return fresh;
}
function save(message){
  if(!state)return;

  localStorage.setItem(KEY,JSON.stringify(state));
  render();

  window.dispatchEvent(
    new CustomEvent("nomad:state-saved",{
      detail:{state:structuredClone(state)}
    })
  );

  if(message)toast(message);
}
function toast(message){
  const el=document.querySelector("#toast");
  if(!el)return;

  el.textContent=message;
  el.classList.add("show");

  clearTimeout(window.__toast);
  window.__toast=setTimeout(()=>el.classList.remove("show"),2200);
}
function toEUR(amount,currency){
  return Number(amount)/(state?.rates?.[currency]||1);
}
function fromEUR(amount,currency){
  return Number(amount)*(state?.rates?.[currency]||1);
}
function convert(amount,from,to){
  return fromEUR(toEUR(amount,from),to);
}
function inMain(amount,currency){
  return convert(amount,currency,state?.mainCurrency||"EUR");
}
function money(value,currency=state?.mainCurrency||"EUR"){
  return new Intl.NumberFormat(undefined,{
    style:"currency",
    currency,
    maximumFractionDigits:2
  }).format(Number(value)||0);
}
function accountBalance(account){
  if(!state)return Number(account.openingBalance)||0;

  return Number(account.openingBalance||0)
    +state.transactions
      .filter(transaction=>transaction.accountId===account.id)
      .reduce(
        (sum,transaction)=>
          sum+(transaction.type==="income"
            ?Number(transaction.amount)
            :-Number(transaction.amount)),
        0
      );
}
function isThisMonth(date){
  const d=new Date(date+"T00:00:00");
  const now=new Date();

  return d.getFullYear()===now.getFullYear()
    &&d.getMonth()===now.getMonth();
}
function categorySpent(category){
  if(!state)return 0;

  return state.transactions
    .filter(transaction=>
      transaction.type==="expense"
      &&isThisMonth(transaction.date)
      &&String(transaction.category).toLowerCase()===String(category).toLowerCase()
    )
    .reduce(
      (sum,transaction)=>
        sum+inMain(transaction.amount,transaction.currency),
      0
    );
}
function esc(value){
  return String(value??"").replace(
    /[&<>"']/g,
    character=>({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#039;"
    })[character]
  );
}
function empty(message="No data yet.",action=""){
  return `
    <div class="empty-state">
      <div class="empty-state-icon">◇</div>
      <h3>${esc(message)}</h3>
      <p>Add your first item to start building a useful financial overview.</p>
      ${action?`<span>${esc(action)}</span>`:""}
    </div>
  `;
}
function render(){
  if(!state)return;

  const mainCurrency=document.querySelector("#main-currency");
  if(mainCurrency)mainCurrency.value=state.mainCurrency;

  const currentLocation=document.querySelector("#current-location");
  if(currentLocation){
    currentLocation.textContent=
      `Current country: ${countryName(state.currentCountry)}`;
  }

  const income=state.transactions
    .filter(transaction=>
      transaction.type==="income"
      &&isThisMonth(transaction.date)
    )
    .reduce(
      (sum,transaction)=>
        sum+inMain(transaction.amount,transaction.currency),
      0
    );

  const expenses=state.transactions
    .filter(transaction=>
      transaction.type==="expense"
      &&isThisMonth(transaction.date)
    )
    .reduce(
      (sum,transaction)=>
        sum+inMain(transaction.amount,transaction.currency),
      0
    );

  const budgetTotal=state.budgets.reduce(
    (sum,budget)=>
      sum+inMain(
        budget.limit,
        budget.currency||state.mainCurrency
      ),
    0
  );

  const homeExpenses=document.querySelector("#home-month-expenses");
  const homeIncome=document.querySelector("#home-month-income");
  const homeBalance=document.querySelector("#home-month-balance");

  if(homeExpenses)homeExpenses.textContent=money(expenses);
  if(homeIncome)homeIncome.textContent=money(income);
  if(homeBalance)homeBalance.textContent=money(income-expenses);

  renderAccounts();
  renderTransactions();
  renderBudgets(expenses,budgetTotal);
  renderInvestments();
  populateSelects();
  renderCurrencyConverter();

  window.dispatchEvent(
    new CustomEvent("nomad:state-rendered",{
      detail:{
        income,
        expenses,
        balance:income-expenses,
        budgetTotal
      }
    })
  );
}
function renderAccounts(){
  if(!state)return;

  const groups={};

  state.accounts.forEach(account=>{
    const country=normalizeCountryCode(account.country);
    (groups[country]??=[]).push(account);
  });

  const countryAccounts=document.querySelector("#country-accounts");

  if(countryAccounts){
    countryAccounts.innerHTML=
      Object.entries(groups).map(([country,items])=>{
        const original=items
          .map(account=>
            `${money(accountBalance(account),account.currency)} ${account.currency}`
          )
          .join(" · ");

        const converted=items.reduce(
          (sum,account)=>
            sum+inMain(
              accountBalance(account),
              account.currency
            ),
          0
        );

        return `
          <div class="country-row">
            <div>
              <strong>${esc(countryName(country))}</strong>
              <small>
                ${items.length} account${items.length===1?"":"s"}
              </small>
            </div>
            <div>${esc(original)}</div>
            <div><strong>${money(converted)}</strong></div>
          </div>
        `;
      }).join("")
      ||empty("No accounts yet.","Add your first account");
  }

  const accountList=document.querySelector("#account-list");

  if(accountList){
    accountList.innerHTML=
      state.accounts.map(account=>`
        <article class="mini-card" data-id="${account.id}">
          <small>
            ${esc(countryName(account.country))} · ${esc(account.type)}
          </small>
          <strong>
            ${money(accountBalance(account),account.currency)}
          </strong>
          <span>${esc(account.name)}</span>
          <div class="row-subtitle">
            ${esc(account.institution||"No bank specified")} ·
            ${money(
              inMain(accountBalance(account),account.currency)
            )}
          </div>
        </article>
      `).join("")
      ||empty("No accounts yet.","Add your first account");
  }
}
function filteredTransactions(){
  if(!state)return [];

  const query=
    (document.querySelector("#transaction-search")?.value||"")
      .trim()
      .toLowerCase();

  const type=
    document.querySelector("#transaction-filter")?.value||"all";

  const category=
    document.querySelector("#transaction-category-filter")?.value||"all";

  const country=
    document.querySelector("#transaction-country-filter")?.value||"all";

  const dateFrom=
    document.querySelector("#transaction-date-from")?.value||"";

  const dateTo=
    document.querySelector("#transaction-date-to")?.value||"";

  const minRaw=
    document.querySelector("#transaction-min-amount")?.value;

  const maxRaw=
    document.querySelector("#transaction-max-amount")?.value;

  const min=
    minRaw===""||minRaw==null
      ?null
      :Number(minRaw);

  const max=
    maxRaw===""||maxRaw==null
      ?null
      :Number(maxRaw);

  const sort=
    document.querySelector("#transaction-sort")?.value||"newest";

  const filtered=state.transactions.filter(transaction=>{
    const account=
      state.accounts.find(item=>item.id===transaction.accountId);

    const searchable=`
      ${transaction.category}
      ${transaction.note||""}
      ${countryName(transaction.country)}
      ${account?.name||""}
    `.toLowerCase();

    const mainAmount=
      Math.abs(
        inMain(transaction.amount,transaction.currency)
      );

    return (
      (type==="all"||transaction.type===type)
      &&(category==="all"||transaction.category===category)
      &&(
        country==="all"
        ||normalizeCountryCode(transaction.country)===country
      )
      &&(!query||searchable.includes(query))
      &&(!dateFrom||transaction.date>=dateFrom)
      &&(!dateTo||transaction.date<=dateTo)
      &&(min===null||mainAmount>=min)
      &&(max===null||mainAmount<=max)
    );
  });

  return filtered.sort((a,b)=>{
    const dateA=
      new Date(a.createdAt||`${a.date}T00:00:00`);

    const dateB=
      new Date(b.createdAt||`${b.date}T00:00:00`);

    if(sort==="oldest")return dateA-dateB;

    if(sort==="largest"){
      return Math.abs(inMain(b.amount,b.currency))
        -Math.abs(inMain(a.amount,a.currency));
    }

    if(sort==="smallest"){
      return Math.abs(inMain(a.amount,a.currency))
        -Math.abs(inMain(b.amount,b.currency));
    }

    if(sort==="category"){
      return String(a.category).localeCompare(String(b.category));
    }

    return dateB-dateA;
  });
}
function transactionHTML(items,deletable=false){
  if(!items.length){
    return empty("No matching transactions.");
  }

  return items.map(transaction=>{
    const account=
      state.accounts.find(
        item=>item.id===transaction.accountId
      );

    const sign=
      transaction.type==="income"
        ?"+"
        :"-";

    return `
      <article class="transaction-item">
        <div class="transaction-main">
          <div class="transaction-icon ${transaction.type}">
            ${transaction.type==="income"?"↙":"↗"}
          </div>

          <div class="transaction-copy">
            <div class="row-title">
              ${esc(transaction.category)}
              ${
                transaction.frequency
                &&transaction.frequency!=="once"
                  ?`<span class="recurring-badge">
                      ↻ ${esc(transaction.frequency)}
                    </span>`
                  :""
              }
            </div>

            <div class="row-subtitle">
              ${esc(countryName(transaction.country))}
              · ${esc(account?.name||"Unknown")}
              · ${esc(transaction.date)}
              ${
                transaction.note
                  ?` · ${esc(transaction.note)}`
                  :""
              }
            </div>
          </div>
        </div>

        <div class="transaction-value">
          <strong class="amount ${transaction.type}">
            ${sign}${money(transaction.amount,transaction.currency)}
          </strong>
          <small>
            ${money(
              inMain(
                transaction.amount,
                transaction.currency
              )
            )}
          </small>
        </div>

        ${
          deletable
            ?`<button
                class="delete-transaction delete-tx"
                data-id="${transaction.id}"
                aria-label="Delete transaction"
                title="Delete transaction"
              >×</button>`
            :""
        }
      </article>
    `;
  }).join("");
}
function renderTransactions(){
  if(!state)return;

  const all=[...state.transactions].sort((a,b)=>{
    const dateA=
      new Date(a.createdAt||`${a.date}T00:00:00`);

    const dateB=
      new Date(b.createdAt||`${b.date}T00:00:00`);

    return dateB-dateA;
  });

  const homeRecent=
    document.querySelector("#home-recent-transactions");

  if(homeRecent){
    homeRecent.innerHTML=
      all.length
        ?transactionHTML(all.slice(0,5))
        :empty(
          "No transactions yet.",
          "Add your first expense or income"
        );
  }

  const filtered=filteredTransactions();

  const transactionList=
    document.querySelector("#transaction-list");

  if(transactionList){
    transactionList.innerHTML=
      transactionHTML(filtered,true);
  }

  const count=
    document.querySelector("#transaction-result-count");

  if(count){
    count.textContent=
      `${filtered.length} transaction${filtered.length===1?"":"s"}`;
  }

  window.dispatchEvent(
    new CustomEvent("nomad:transactions-rendered")
  );
}
function renderBudgets(expenses,budgetTotal){
  if(!state)return;

  const budgetMarkup=
    state.budgets.map(budget=>{
      const currency=
        budget.currency||state.mainCurrency;

      const spentMain=
        categorySpent(budget.category);

      const spentInBudget=
        convert(
          spentMain,
          state.mainCurrency,
          currency
        );

      const limit=
        Number(budget.limit)||0;

      const percentage=
        limit>0
          ?Math.min(100,spentInBudget/limit*100)
          :0;

      const over=
        spentInBudget>limit;

      return `
        <article class="budget-item ${over?"is-over":""}">
          <div class="budget-item-head">
            <div>
              <strong>
                ${esc(budget.group)} · ${esc(budget.category)}
              </strong>
              <small>
                ${esc(
                  countryName(
                    budget.country||state.currentCountry
                  )
                )} · ${currency}
              </small>
            </div>

            <span>
              ${money(spentInBudget,currency)}
              /
              ${money(limit,currency)}
            </span>
          </div>

          <div class="progress ${over?"over":""}">
            <span style="width:${percentage}%"></span>
          </div>
        </article>
      `;
    }).join("")
    ||empty(
      "No budgets yet.",
      "Create your first monthly budget"
    );

  const budgetList=
    document.querySelector("#budget-list");

  if(budgetList){
    budgetList.innerHTML=budgetMarkup;
  }

  const budgetExplanation=
    document.querySelector("#budget-explanation");

  if(budgetExplanation){
    const remaining=
      Math.max(0,budgetTotal-expenses);

    budgetExplanation.innerHTML=`
      <div class="budget-total">${money(remaining)}</div>
      <p>Estimated budget remaining this month.</p>

      <div class="budget-summary-list">
        <div>
          <span>Planned budget</span>
          <strong>${money(budgetTotal)}</strong>
        </div>

        <div>
          <span>Spent so far</span>
          <strong>${money(expenses)}</strong>
        </div>

        <div>
          <span>Remaining</span>
          <strong>${money(remaining)}</strong>
        </div>
      </div>
    `;
  }
}
function renderInvestments(){
  if(!state)return;

  const investmentList=
    document.querySelector("#investment-list");

  if(!investmentList)return;

  investmentList.innerHTML=
    state.investments.map(investment=>{
      const gain=
        Number(investment.value)-Number(investment.cost);

      const percentage=
        investment.cost
          ?gain/Number(investment.cost)*100
          :0;

      return `
        <article class="mini-card">
          <small>
            ${esc(investment.type)}
            ·
            ${esc(investment.currency)}
          </small>

          <strong>
            ${money(
              investment.value,
              investment.currency
            )}
          </strong>

          <span>${esc(investment.name)}</span>

          <div class="${gain>=0?"gain":"loss"}">
            ${gain>=0?"+":""}
            ${money(gain,investment.currency)}
            (${percentage.toFixed(1)}%)
          </div>
        </article>
      `;
    }).join("")
    ||empty(
      "No investments yet.",
      "Add your first investment"
    );
}
function renderCurrencyConverter(){
  const from=document.querySelector("#converter-from");
  const to=document.querySelector("#converter-to");

  if(!from||!to||!state)return;

  const previousFrom=
    from.value||state.mainCurrency||"USD";

  const previousTo=
    to.value||(state.mainCurrency==="RUB"?"BDT":"RUB");

  populateCurrencySelect(from,previousFrom);
  populateCurrencySelect(to,previousTo);

  from.value=
    currencies.includes(previousFrom)
      ?previousFrom
      :"USD";

  to.value=
    currencies.includes(previousTo)
      ?previousTo
      :"RUB";

  calculateCurrencyConversion();
}
function calculateCurrencyConversion(){
  const form=
    document.querySelector("#currency-converter-form");

  const result=
    document.querySelector("#converter-result");

  if(!form||!result||!state)return;

  const data=new FormData(form);
  const amount=Number(data.get("amount"))||0;
  const from=data.get("from");
  const to=data.get("to");

  const converted=
    convert(amount,from,to);

  result.innerHTML=`
    <span>${money(amount,from)}</span>
    <strong>${money(converted,to)}</strong>
    <small>
      1 ${from}
      ≈
      ${Number(convert(1,from,to)).toLocaleString(
        undefined,
        {maximumFractionDigits:6}
      )}
      ${to}
    </small>
  `;
}
function populateSelects(){
  if(!state)return;

  [
    "main-currency",
    "transaction-currency",
    "account-currency",
    "investment-currency",
    "budget-currency",
    "goal-currency"
  ].forEach(id=>{
    const select=document.querySelector(`#${id}`);

    if(select){
      populateCurrencySelect(
        select,
        id==="main-currency"
          ?state.mainCurrency
          :select.value||state.mainCurrency
      );
    }
  });

  const mainCurrency=
    document.querySelector("#main-currency");

  if(mainCurrency){
    mainCurrency.value=state.mainCurrency;
  }

  const transactionAccount=
    document.querySelector("#transaction-account");

  if(transactionAccount){
    transactionAccount.innerHTML=
      state.accounts
        .filter(account=>account.type!=="Debt")
        .map(account=>
          `<option value="${account.id}">
            ${esc(account.name)} (${account.currency})
          </option>`
        )
        .join("");
  }

  populateAllCountryCurrencyControls();

  const languageSelect=
    document.querySelector("#language-select");

  if(languageSelect){
    languageSelect.value=currentLanguage;
  }

  const themeSelect=
    document.querySelector("#theme-select");

  if(themeSelect){
    themeSelect.value=currentTheme;
  }
}
function showPage(id){
  document
    .querySelectorAll(".page,.nav-item,.mobile-nav button")
    .forEach(element=>element.classList.remove("active"));

  document.querySelector("#"+id)?.classList.add("active");

  document
    .querySelectorAll(`[data-page="${id}"]`)
    .forEach(element=>element.classList.add("active"));

  const title=
    document.querySelector(`.nav-item[data-page="${id}"]`)
      ?.textContent
      .trim()
    ||id;

  const pageTitle=document.querySelector("#page-title");
  if(pageTitle)pageTitle.textContent=title;

  window.scrollTo({
    top:0,
    behavior:"smooth"
  });
}
function openDialog(id){
  const dialog=document.querySelector("#"+id);
  if(!dialog||!state)return;

  if(id==="transaction-dialog"){
    const form=document.querySelector("#transaction-form");

    if(form){
      form.elements.date.value=
        new Date().toISOString().slice(0,10);

      populateCountrySelect(
        form.elements.country,
        state.currentCountry||"AL"
      );

      const account=
        state.accounts.find(item=>item.type!=="Debt");

      if(account){
        form.elements.accountId.value=account.id;
        form.elements.currency.value=account.currency;
      }

      setTimeout(()=>{
        form.elements.amount?.focus();
      },50);
    }
  }

  if(id==="account-dialog"){
    populateCountryBankSelects();
  }

  if(id==="budget-dialog"){
    const form=document.querySelector("#budget-form");

    if(form){
      populateCountrySelect(
        form.elements.country,
        state.currentCountry||"AL"
      );

      populateCurrencySelect(
        form.elements.currency,
        state.mainCurrency||"EUR"
      );

      form.elements.currency.value=
        state.mainCurrency||"EUR";
    }
  }

  dialog.showModal();
}
function populateCountryBankSelects(){
  const countrySelect=
    document.querySelector("#account-country");

  if(!countrySelect||!state)return;

  populateCountrySelect(
    countrySelect,
    state.currentCountry||"AL"
  );

  updateBankOptions(countrySelect.value);

  const currency=
    countryByCode.get(countrySelect.value)?.currency;

  const accountCurrency=
    document.querySelector("#account-currency");

  if(
    accountCurrency
    &&currency
    &&currencies.includes(currency)
  ){
    accountCurrency.value=currency;
  }
}
function updateBankOptions(country){
  const list=document.querySelector("#bank-options");
  if(!list)return;

  const code=normalizeCountryCode(country);

  const banks=[
    ...(window.NOMAD_WEALTH_BANKS?.[code]||[]),
    ...(window.NOMAD_WEALTH_UNIVERSAL_BANKS||[])
  ];

  list.innerHTML=
    [...new Set(banks)]
      .map(bank=>`<option value="${esc(bank)}"></option>`)
      .join("");
}

document.addEventListener("change",event=>{
  if(event.target?.id==="account-country"){
    updateBankOptions(event.target.value);

    const currency=
      countryByCode.get(event.target.value)?.currency;

    const accountCurrency=
      document.querySelector("#account-currency");

    if(
      accountCurrency
      &&currency
      &&currencies.includes(currency)
    ){
      accountCurrency.value=currency;
    }
  }

  if(event.target?.id==="language-select"){
    applyLanguage(event.target.value);
    authToast("Language updated.");
  }
});

function closeDialog(dialog){
  if(dialog?.open)dialog.close();
}

const todayLabel=document.querySelector("#today-label");
if(todayLabel){
  todayLabel.textContent=
    new Intl.DateTimeFormat(
      undefined,
      {dateStyle:"full"}
    ).format(new Date());
}

const greeting=document.querySelector("#greeting");
if(greeting){
  const hour=new Date().getHours();
  greeting.textContent=
    hour<12
      ?"Good morning"
      :hour<18
        ?"Good afternoon"
        :"Good evening";
}

document.querySelectorAll("[data-page]").forEach(element=>{
  element.addEventListener("click",()=>{
    showPage(element.dataset.page);
  });
});

document.querySelectorAll("[data-page-link]").forEach(element=>{
  element.addEventListener("click",event=>{
    event.preventDefault();
    showPage(element.dataset.pageLink);
  });
});

document.querySelectorAll("[data-open-dialog]").forEach(element=>{
  element.addEventListener("click",()=>{
    openDialog(element.dataset.openDialog);
  });
});

const quickAdd=document.querySelector("#quick-add");
if(quickAdd){
  quickAdd.onclick=()=>{
    openDialog("transaction-dialog");
  };
}

document.querySelectorAll("[data-close-dialog]").forEach(button=>{
  button.addEventListener("click",()=>{
    closeDialog(button.closest("dialog"));
  });
});

document.querySelectorAll("dialog").forEach(dialog=>{
  dialog.addEventListener("click",event=>{
    const rect=dialog.getBoundingClientRect();

    const inside=
      event.clientX>=rect.left
      &&event.clientX<=rect.right
      &&event.clientY>=rect.top
      &&event.clientY<=rect.bottom;

    if(!inside)closeDialog(dialog);
  });
});

document.querySelectorAll("[data-open-calc]").forEach(button=>{
  button.addEventListener("click",()=>{
    showPage("calculators");
    openCalc(button.dataset.openCalc);
  });
});

document.querySelectorAll(".calc-tab").forEach(button=>{
  button.addEventListener("click",()=>{
    openCalc(button.dataset.calc);
  });
});

function openCalc(name){
  document
    .querySelectorAll(".calc-tab,.calculator-panel")
    .forEach(element=>element.classList.remove("active"));

  document
    .querySelector(`.calc-tab[data-calc="${name}"]`)
    ?.classList.add("active");

  document
    .querySelector("#calc-"+name)
    ?.classList.add("active");
}

document.querySelector("#transaction-account")?.addEventListener("change",event=>{
  if(!state)return;

  const account=
    state.accounts.find(item=>item.id===event.target.value);

  if(account){
    const transactionCurrency=
      document.querySelector("#transaction-currency");

    if(transactionCurrency){
      transactionCurrency.value=account.currency;
    }

    const country=
      document.querySelector("#transaction-country");

    if(country){
      country.value=normalizeCountryCode(account.country);
    }
  }
});

document.querySelector("#main-currency")?.addEventListener("change",event=>{
  if(!state)return;
  state.mainCurrency=event.target.value;
  save("Main currency updated");
});

document.querySelectorAll(".transaction-filter-control").forEach(control=>{
  control.addEventListener(
    control.type==="search"||control.type==="number"
      ?"input"
      :"change",
    renderTransactions
  );
});

document.querySelector("#clear-transaction-filters")?.addEventListener("click",()=>{
  [
    "transaction-search",
    "transaction-date-from",
    "transaction-date-to",
    "transaction-min-amount",
    "transaction-max-amount"
  ].forEach(id=>{
    const element=document.querySelector("#"+id);
    if(element)element.value="";
  });

  [
    "transaction-filter",
    "transaction-category-filter",
    "transaction-country-filter"
  ].forEach(id=>{
    const element=document.querySelector("#"+id);
    if(element)element.value="all";
  });

  const sort=document.querySelector("#transaction-sort");
  if(sort)sort.value="newest";

  renderTransactions();
});

document.querySelector("#transaction-form")?.addEventListener("submit",event=>{
  event.preventDefault();
  if(!state)return;

  const form=event.currentTarget;
  const data=new FormData(form);

  const category=
    data.get("category")==="Custom"
      ?String(data.get("custom_category")||"Other").trim()
      :String(data.get("category")||"Other").trim();

  state.transactions.push({
    id:crypto.randomUUID(),
    type:data.get("type"),
    amount:Number(data.get("amount")),
    currency:data.get("currency"),
    category,
    country:normalizeCountryCode(data.get("country")),
    accountId:data.get("accountId")||null,
    date:data.get("date"),
    createdAt:new Date().toISOString(),
    frequency:data.get("frequency")||"once",
    note:String(data.get("note")||"").trim()
  });

  form.reset();
  closeDialog(document.querySelector("#transaction-dialog"));
  save("Transaction saved");
});

document.querySelector("#account-form")?.addEventListener("submit",event=>{
  event.preventDefault();
  if(!state)return;

  const form=event.currentTarget;
  const data=new FormData(form);

  state.accounts.push({
    id:crypto.randomUUID(),
    name:String(data.get("name")||"").trim(),
    institution:String(data.get("institution")||"").trim(),
    country:normalizeCountryCode(data.get("country")),
    currency:data.get("currency"),
    type:data.get("type"),
    openingBalance:Number(data.get("balance"))||0
  });

  form.reset();
  closeDialog(document.querySelector("#account-dialog"));
  save("Account added");
});

document.querySelector("#budget-form")?.addEventListener("submit",event=>{
  event.preventDefault();
  if(!state)return;

  const form=event.currentTarget;
  const data=new FormData(form);

  state.budgets.push({
    id:crypto.randomUUID(),
    group:data.get("group"),
    category:String(data.get("category")||"").trim(),
    currency:data.get("currency"),
    country:normalizeCountryCode(data.get("country")),
    limit:Number(data.get("limit"))||0
  });

  form.reset();
  closeDialog(document.querySelector("#budget-dialog"));
  save("Budget added");
});

document.querySelector("#investment-form-dialog")?.addEventListener("submit",event=>{
  event.preventDefault();
  if(!state)return;

  const form=event.currentTarget;
  const data=new FormData(form);

  state.investments.push({
    id:crypto.randomUUID(),
    name:String(data.get("name")||"").trim(),
    type:String(data.get("type")||"").trim(),
    currency:data.get("currency"),
    cost:Number(data.get("cost"))||0,
    value:Number(data.get("value"))||0
  });

  form.reset();
  closeDialog(document.querySelector("#investment-dialog"));
  save("Investment added");
});

document.addEventListener("click",event=>{
  const button=event.target.closest(".delete-tx");

  if(
    button
    &&state
    &&confirm("Delete this transaction?")
  ){
    state.transactions=
      state.transactions.filter(
        transaction=>transaction.id!==button.dataset.id
      );

    save("Transaction deleted");
  }
});

document.querySelector("#currency-converter-form")?.addEventListener("submit",event=>{
  event.preventDefault();
  calculateCurrencyConversion();
});

document.querySelector("#swap-currencies")?.addEventListener("click",()=>{
  const from=document.querySelector("#converter-from");
  const to=document.querySelector("#converter-to");

  if(!from||!to)return;

  [from.value,to.value]=[to.value,from.value];
  calculateCurrencyConversion();
});

document.querySelector("#converter-from")?.addEventListener(
  "change",
  calculateCurrencyConversion
);

document.querySelector("#converter-to")?.addEventListener(
  "change",
  calculateCurrencyConversion
);

document.querySelector("#refresh-rates")?.addEventListener("click",async()=>{
  if(!state)return;

  const button=document.querySelector("#refresh-rates");
  const status=document.querySelector("#rate-status");

  button.disabled=true;
  button.textContent="Refreshing…";

  try{
    const response=await fetch(
      "https://open.er-api.com/v6/latest/EUR",
      {cache:"no-store"}
    );

    if(!response.ok){
      throw new Error("Rate service unavailable");
    }

    const data=await response.json();

    if(data.result!=="success"||!data.rates){
      throw new Error("Invalid rate response");
    }

    currencies.forEach(code=>{
      if(Number(data.rates[code])){
        state.rates[code]=Number(data.rates[code]);
      }
    });

    state.rates.EUR=1;

    save();
    calculateCurrencyConversion();

    if(status){
      status.textContent=
        `Rates refreshed ${new Date().toLocaleString()}.`;
    }

    toast("Currency rates refreshed");
  }catch(error){
    if(status){
      status.textContent=
        "Could not refresh rates. Saved reference rates are still available.";
    }

    toast("Could not refresh exchange rates");
  }finally{
    button.disabled=false;
    button.textContent="Refresh rates";
  }
});

function setResult(selector,title,main,rows){
  const element=document.querySelector(selector);
  if(!element)return;

  element.innerHTML=`
    <h3>${title}</h3>
    <div class="result-main">${main}</div>
    <div class="result-grid">
      ${rows.map(([key,value])=>`
        <div>
          <span>${key}</span>
          <strong>${value}</strong>
        </div>
      `).join("")}
    </div>
    <p>Estimate only. Actual results may differ.</p>
  `;
}

function calculateLoan(){
  const form=document.querySelector("#loan-form");
  if(!form||!state)return;

  const data=new FormData(form);

  const principal=Number(data.get("principal"));
  const annual=Number(data.get("rate"))/100;
  const numberOfPayments=Number(data.get("years"))*12;
  const monthlyRate=annual/12;

  const monthly=
    monthlyRate===0
      ?principal/numberOfPayments
      :principal
        *monthlyRate
        *(1+monthlyRate)**numberOfPayments
        /((1+monthlyRate)**numberOfPayments-1);

  const total=monthly*numberOfPayments;
  const interest=total-principal;

  setResult(
    "#loan-result",
    "Monthly installment",
    money(monthly),
    [
      ["Total payment",money(total)],
      ["Total interest",money(interest)],
      ["Number of payments",numberOfPayments]
    ]
  );
}

function calculateGrowth(formSelector,resultSelector,fee=0){
  const form=document.querySelector(formSelector);
  if(!form||!state)return;

  const data=new FormData(form);

  const principal=Number(data.get("principal"));
  const monthly=Number(data.get("monthly"))||0;
  const years=Number(data.get("years"));
  const annual=(Number(data.get("rate"))-fee)/100;
  const monthlyRate=annual/12;
  const numberOfMonths=years*12;

  const finalValue=
    principal*(1+monthlyRate)**numberOfMonths
    +(
      monthlyRate===0
        ?monthly*numberOfMonths
        :monthly
          *((1+monthlyRate)**numberOfMonths-1)
          /monthlyRate
    );

  const contributed=
    principal+monthly*numberOfMonths;

  const profit=
    finalValue-contributed;

  setResult(
    resultSelector,
    "Estimated final value",
    money(finalValue),
    [
      ["Total contributed",money(contributed)],
      ["Estimated profit",money(profit)],
      ["Effective annual return",`${(annual*100).toFixed(2)}%`]
    ]
  );
}

document.querySelector("#loan-form")?.addEventListener("submit",event=>{
  event.preventDefault();
  calculateLoan();
});

document.querySelector("#investment-form")?.addEventListener("submit",event=>{
  event.preventDefault();
  calculateGrowth(
    "#investment-form",
    "#investment-result"
  );
});

document.querySelector("#fund-form")?.addEventListener("submit",event=>{
  event.preventDefault();

  const data=new FormData(event.currentTarget);

  calculateGrowth(
    "#fund-form",
    "#fund-result",
    Number(data.get("fee"))||0
  );
});

document.querySelector("#stock-form")?.addEventListener("submit",event=>{
  event.preventDefault();
  if(!state)return;

  const data=new FormData(event.currentTarget);

  const buy=Number(data.get("buy"));
  const sell=Number(data.get("sell"));
  const shares=Number(data.get("shares"));
  const fees=Number(data.get("fees"))||0;

  const cost=buy*shares+fees;
  const sale=sell*shares;
  const profit=sale-cost;
  const returnPercentage=
    cost
      ?profit/cost*100
      :0;

  const breakEven=
    shares
      ?(buy*shares+fees)/shares
      :0;

  setResult(
    "#stock-result",
    "Net profit / loss",
    money(profit),
    [
      ["Total cost",money(cost)],
      ["Sale value",money(sale)],
      ["Return",`${returnPercentage.toFixed(2)}%`],
      ["Break-even price",money(breakEven)]
    ]
  );
});

document.querySelector("#travel-form")?.addEventListener("submit",event=>{
  event.preventDefault();
  if(!state)return;

  const data=new FormData(event.currentTarget);

  const country=
    normalizeCountryCode(data.get("country"));

  const budget=
    Number(data.get("budget"))||0;

  const spent=
    Number(data.get("spent"))||0;

  const days=
    Math.max(1,Number(data.get("days"))||1);

  const left=
    Math.max(0,budget-spent);

  state.currentCountry=country;
  state.travel={
    country,
    budget,
    spent,
    days
  };

  save("Travel plan updated");

  setResult(
    "#travel-result",
    `${countryName(country)} travel plan`,
    money(left),
    [
      ["Trip budget",money(budget)],
      ["Spent",money(spent)],
      ["Days remaining",days],
      ["Safe daily spending",money(left/days)]
    ]
  );
});

document.querySelector("#theme-toggle")?.addEventListener("click",()=>{
  applyTheme(
    document.documentElement.dataset.theme==="dark"
      ?"light"
      :"dark"
  );
});

document.querySelector("#theme-select")?.addEventListener("change",event=>{
  applyTheme(event.target.value);
});

matchMedia("(prefers-color-scheme: dark)")
  .addEventListener?.("change",()=>{
    if(currentTheme==="system"){
      applyTheme("system");
    }
  });

document.querySelector("#profile-form")?.addEventListener("submit",async event=>{
  event.preventDefault();

  if(!state||!supabase)return;

  const form=event.currentTarget;

  const updates={
    full_name:form.elements.name.value.trim(),
    country:normalizeCountryCode(
      form.elements.country.value
    ),
    main_currency:form.elements.currency.value,
    language:form.elements.language.value,
    theme:form.elements.theme.value,
    onboarding_complete:true
  };

  try{
    const {data,error}=await authRequest(
      supabase.auth.updateUser({
        data:updates
      }),
      "Profile update"
    );

    if(error)throw error;

    currentUser=data.user;
    state.currentCountry=updates.country;
    state.mainCurrency=updates.main_currency;
    currentLanguage=updates.language;
    currentTheme=updates.theme;

    updateUserInterface(data.user);
    save("Profile updated");
  }catch(error){
    authToast(friendlyAuthError(error),true);
  }
});

document.querySelector("#profile-password-reset")?.addEventListener("click",async()=>{
  if(!supabase||!currentUser?.email)return;

  try{
    const {error}=await authRequest(
      supabase.auth.resetPasswordForEmail(
        currentUser.email,
        {
          redirectTo:
            window.location.origin+window.location.pathname
        }
      ),
      "Password reset"
    );

    if(error)throw error;

    authToast("Password reset email sent.");
  }catch(error){
    authToast(friendlyAuthError(error),true);
  }
});

document.querySelector("#onboarding-form")?.addEventListener("submit",async event=>{
  event.preventDefault();

  if(!supabase||!state)return;

  const data=new FormData(event.currentTarget);

  const updates={
    full_name:String(data.get("name")||"").trim(),
    country:normalizeCountryCode(data.get("country")),
    main_currency:data.get("currency"),
    user_type:data.get("user_type"),
    language:currentLanguage,
    theme:currentTheme,
    onboarding_complete:true
  };

  try{
    const {data:userData,error}=await authRequest(
      supabase.auth.updateUser({
        data:updates
      }),
      "Profile setup"
    );

    if(error)throw error;

    currentUser=userData.user;
    state.currentCountry=updates.country;
    state.mainCurrency=updates.main_currency;

    document.querySelector("#onboarding-dialog")?.close();

    updateUserInterface(userData.user);
    save("Profile setup complete");
  }catch(error){
    authToast(friendlyAuthError(error),true);
  }
});

document.querySelector("#export-data")?.addEventListener("click",()=>{
  if(!state)return;

  const blob=new Blob(
    [JSON.stringify(state,null,2)],
    {type:"application/json"}
  );

  const link=document.createElement("a");

  link.href=URL.createObjectURL(blob);
  link.download="nomad-wealth-backup.json";
  link.click();

  URL.revokeObjectURL(link.href);
});

document.querySelector("#import-data")?.addEventListener("change",async event=>{
  try{
    const file=event.target.files?.[0];
    if(!file)return;

    const incoming=
      JSON.parse(await file.text());

    if(!incoming.accounts||!incoming.transactions){
      throw new Error("Invalid backup");
    }

    state=normalizeState(incoming);
    save("Backup imported");
  }catch(error){
    alert("Invalid Nomad Wealth backup file.");
  }
});

document.querySelector("#reset-data")?.addEventListener("click",()=>{
  if(
    state
    &&confirm("Reset all prototype data?")
  ){
    state=seed(structuredClone(demo));
    save("Data reset");
  }
});

function initializeFinanceApp(){
  if(window.__financeInitialized)return;
  window.__financeInitialized=true;

  render();

  calculateLoan();

  calculateGrowth(
    "#investment-form",
    "#investment-result"
  );

  calculateGrowth(
    "#fund-form",
    "#fund-result",
    1
  );

  document
    .querySelector("#stock-form")
    ?.dispatchEvent(
      new Event("submit",{
        cancelable:true,
        bubbles:true
      })
    );

  populateCountrySelect(
    document.querySelector("#travel-country"),
    state?.currentCountry||"AL"
  );
}

if("serviceWorker" in navigator){
  navigator.serviceWorker
    .getRegistrations()
    .then(registrations=>{
      registrations.forEach(registration=>{
        registration.unregister();
      });
    })
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

  replaceState(next,{
    persist=true,
    message=""
  }={}){
    state=normalizeState(next);

    if(persist){
      localStorage.setItem(
        KEY,
        JSON.stringify(state)
      );
    }

    render();

    window.dispatchEvent(
      new CustomEvent("nomad:state-replaced",{
        detail:{
          state:structuredClone(state)
        }
      })
    );

    if(message)toast(message);
  },

  save,
  render,
  renderTransactions,
  toast
};

applyTheme(currentTheme);
applyLanguage(currentLanguage);
initializeAuthentication();
