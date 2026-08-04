const App=window.NomadApp;
const expenseCategories=["Housing","Food","Groceries","Transport","Utilities","Health","Education","Shopping","Entertainment","Travel","Insurance","Loan payment","Family support","Subscription","Other expense","Custom"];
const incomeCategories=["Salary","Freelance","Business","Bonus","Commission","Investment income","Rental income","Gift","Refund","Interest","Government benefit","Other income","Custom"];
let editingAccountId=null;
const state=()=>App?.getState();
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

function setCategories(type){
  const select=document.querySelector("#transaction-category-select");
  if(!select)return;
  const list=type==="income"?incomeCategories:expenseCategories;
  select.innerHTML=list.map(item=>`<option value="${esc(item)}">${esc(item)}</option>`).join("");
  document.querySelector("#custom-category-wrap")?.classList.add("hidden");
}

function updateCopy(type){
  const income=type==="income";
  const title=document.querySelector("#transaction-dialog-title");
  const label=document.querySelector("#transaction-account-label");
  const save=document.querySelector("#save-transaction-button");
  if(title)title.textContent=income?"Add income":"Add expense";
  if(label?.firstChild)label.firstChild.nodeValue=income
    ?"Which account should receive this income? "
    :"Which account did you pay from? ";
  if(save){
    save.textContent=income?"Save income":"Save expense";
    save.classList.toggle("income-save-button",income);
    save.classList.toggle("expense-save-button",!income);
  }
}

function setType(type){
  const radio=document.querySelector(`.transaction-type-tabs input[value="${type}"]`);
  if(radio)radio.checked=true;
  setCategories(type);
  updateCopy(type);
}

function setMode(mode="all"){
  const tabs=document.querySelector(".transaction-type-tabs");
  const radios=tabs?.querySelectorAll('input[name="type"]');
  if(!tabs||!radios)return;
  const locked=mode==="income"||mode==="expense";
  tabs.classList.toggle("single-mode",locked);
  radios.forEach(radio=>{
    const hide=locked&&radio.value!==mode;
    radio.disabled=hide;
    radio.closest(".transaction-type-tab")?.classList.toggle("hidden",hide);
  });
  setType(locked?mode:"expense");
}

function syncAccount(){
  const form=document.querySelector("#transaction-form");
  const summary=document.querySelector("#transaction-account-summary");
  if(!form||!state())return;

  const account=state().accounts?.find(
    item=>item.id===form.elements.accountId?.value
  );

  if(!account){
    if(form.elements.currency)form.elements.currency.value="";
    if(form.elements.country)form.elements.country.value="";
    summary?.classList.add("hidden");
    return;
  }

  form.elements.currency.value=account.currency;
  form.elements.country.value=App.normalizeCountryCode(account.country);

  const accountText=document.querySelector("#transaction-selected-account");
  const currencyText=document.querySelector("#transaction-selected-currency");
  const countryText=document.querySelector("#transaction-selected-country");

  if(accountText)accountText.textContent=`${account.name} · ${account.institution||account.type}`;
  if(currencyText)currencyText.textContent=account.currency;
  if(countryText)countryText.textContent=App.countryName(account.country);

  summary?.classList.remove("hidden");
}

function openEntry(mode="all"){
  const form=document.querySelector("#transaction-form");
  const dialog=document.querySelector("#transaction-dialog");
  const appState=state();
  if(!form||!dialog||!appState)return;

  if(!appState.accounts?.length){
    App.toast("Add an account before recording a transaction");
    document.querySelector('[data-page="accounts"]')?.click();
    return;
  }

  // Rebuild the account dropdown every time so new accounts are always available.
  form.elements.accountId.innerHTML=appState.accounts
    .filter(account=>account.type!=="Debt")
    .map(account=>`<option value="${account.id}">${esc(account.name)} · ${esc(account.currency)}</option>`)
    .join("");

  form.reset();
  form.dataset.entryMode=mode;
  form.elements.date.value=new Date().toISOString().slice(0,10);
  setMode(mode);

  if(form.elements.accountId?.options?.length){
    form.elements.accountId.selectedIndex=0;
  }

  syncAccount();
  dialog.showModal();
  setTimeout(()=>form.elements.amount?.focus(),50);
}

function balance(account){
  return Number(account.openingBalance||0)+(state()?.transactions||[])
    .filter(transaction=>transaction.accountId===account.id)
    .reduce((sum,transaction)=>sum+(transaction.type==="income"?Number(transaction.amount):-Number(transaction.amount)),0);
}

function renderAccountActions(){
  document.querySelectorAll("#account-list article[data-id]").forEach(card=>{
    if(card.querySelector(".account-manage-actions"))return;
    const id=card.dataset.id;
    if(!id)return;
    const actions=document.createElement("div");
    actions.className="account-manage-actions";
    actions.innerHTML=`
      <button type="button" class="secondary account-action" data-edit-account="${id}">Edit account</button>
      <button type="button" class="primary account-action" data-adjust-account="${id}">Adjust balance</button>
      <button type="button" class="account-more-button" data-account-more="${id}">⋮</button>`;
    card.appendChild(actions);
  });
}

const findAccount=id=>state()?.accounts?.find(account=>account.id===id);

function openEdit(id){
  const account=findAccount(id);
  const form=document.querySelector("#edit-account-form");
  if(!account||!form)return;
  editingAccountId=id;
  form.elements.id.value=id;
  form.elements.name.value=account.name;
  form.elements.institution.value=account.institution||"";
  form.elements.type.value=account.type;
  App.populateCurrencySelect(form.elements.currency,account.currency);
  form.elements.currency.value=account.currency;
  App.populateCountrySelect(form.elements.country,account.country);
  form.elements.country.value=App.normalizeCountryCode(account.country);
  document.querySelector("#edit-account-dialog")?.showModal();
}

function openAdjust(id,mode="correction"){
  const account=findAccount(id);
  const form=document.querySelector("#adjust-balance-form");
  if(!account||!form)return;
  form.reset();
  form.elements.account_id.value=id;
  form.elements.adjustment_type.value=mode;
  form.elements.amount.value=mode==="correction"?balance(account).toFixed(2):"";
  document.querySelector("#adjust-balance-dialog")?.showModal();
}

document.querySelector("#profile-shortcut")?.addEventListener("click",()=>{
  document.querySelector('[data-page="settings"]')?.click();
});

document.querySelector("#transaction-account")?.addEventListener("change",syncAccount);

document.querySelectorAll('.transaction-type-tabs input[name="type"]').forEach(input=>{
  input.addEventListener("change",()=>{
    if(input.checked){
      setCategories(input.value);
      updateCopy(input.value);
    }
  });
});

document.querySelector("#transaction-category-select")?.addEventListener("change",event=>{
  document.querySelector("#custom-category-wrap")?.classList.toggle("hidden",event.target.value!=="Custom");
});

document.addEventListener("click",event=>{
  const explicitExpense=event.target.closest(
    "#quick-add-expense, .add-expense-button, [data-transaction-type='expense']"
  );
  if(explicitExpense){
    event.preventDefault();
    event.stopPropagation();
    openEntry("expense");
    return;
  }

  const explicitIncome=event.target.closest(
    "#quick-add-income, .add-income-button, [data-transaction-type='income']"
  );
  if(explicitIncome){
    event.preventDefault();
    event.stopPropagation();
    openEntry("income");
    return;
  }

  const entry=event.target.closest("[data-open-entry]");
  if(entry){
    event.preventDefault();
    event.stopPropagation();
    openEntry(entry.dataset.openEntry||"all");
    return;
  }

  const page=event.target.closest("[data-page-target]");
  if(page){
    event.preventDefault();
    document.querySelector(`[data-page="${page.dataset.pageTarget}"]`)?.click();
    return;
  }

  const edit=event.target.closest("[data-edit-account]");
  if(edit){
    event.preventDefault();
    openEdit(edit.dataset.editAccount);
    return;
  }

  const adjust=event.target.closest("[data-adjust-account]");
  if(adjust){
    event.preventDefault();
    openAdjust(adjust.dataset.adjustAccount,adjust.dataset.adjustMode||"correction");
    return;
  }

  const more=event.target.closest("[data-account-more]");
  document.querySelectorAll(".account-popover").forEach(pop=>pop.remove());

  if(more){
    event.preventDefault();
    event.stopPropagation();
    const id=more.dataset.accountMore;
    const pop=document.createElement("div");
    pop.className="account-popover";
    pop.innerHTML=`
      <button type="button" data-adjust-account="${id}" data-adjust-mode="correction">Correction</button>
      <button type="button" data-adjust-account="${id}" data-adjust-mode="deposit">Deposit</button>
      <button type="button" data-adjust-account="${id}" data-adjust-mode="withdrawal">Withdrawal</button>`;
    more.closest(".mini-card")?.appendChild(pop);
  }
});

document.querySelector("#transaction-form")?.addEventListener("submit",event=>{
  const form=event.currentTarget;
  if(form.elements.category?.value==="Custom"&&form.elements.custom_category?.value.trim()){
    form.elements.category.value=form.elements.custom_category.value.trim();
  }
},true);

document.querySelector("#edit-account-form")?.addEventListener("submit",event=>{
  event.preventDefault();
  const data=new FormData(event.currentTarget);
  const account=findAccount(data.get("id"));
  if(!account)return;
  account.name=String(data.get("name")||"").trim();
  account.institution=String(data.get("institution")||"").trim();
  account.type=data.get("type");
  account.currency=data.get("currency");
  account.country=data.get("country");
  event.currentTarget.closest("dialog")?.close();
  App.save("Account updated");
});

document.querySelector("#delete-account-button")?.addEventListener("click",()=>{
  if(!editingAccountId||!confirm("Delete this account?"))return;
  state().accounts=state().accounts.filter(account=>account.id!==editingAccountId);
  state().transactions.forEach(transaction=>{
    if(transaction.accountId===editingAccountId)transaction.accountId=null;
  });
  document.querySelector("#edit-account-dialog")?.close();
  App.save("Account deleted");
});

document.querySelector("#adjust-balance-form")?.addEventListener("submit",event=>{
  event.preventDefault();
  const data=new FormData(event.currentTarget);
  const account=findAccount(data.get("account_id"));
  if(!account)return;

  const type=data.get("adjustment_type");
  const amount=Number(data.get("amount"));
  const note=String(data.get("note")||"").trim();

  if(!Number.isFinite(amount)||amount<0){
    App.toast("Enter a valid amount");
    return;
  }

  if(type==="correction"){
    account.openingBalance=Number(account.openingBalance||0)+(amount-balance(account));
  }else{
    state().transactions.push({
      id:crypto.randomUUID(),
      type:type==="deposit"?"income":"expense",
      amount,
      currency:account.currency,
      category:type==="deposit"?"Account deposit":"Account withdrawal",
      country:App.normalizeCountryCode(account.country),
      accountId:account.id,
      date:new Date().toISOString().slice(0,10),
      createdAt:new Date().toISOString(),
      frequency:"once",
      note:note||"Balance adjustment"
    });
  }

  event.currentTarget.closest("dialog")?.close();
  App.save("Balance updated");
});

["nomad:user-ready","nomad:state-saved","nomad:state-replaced","nomad:transactions-rendered","nomad:state-rendered"]
  .forEach(name=>window.addEventListener(name,()=>setTimeout(renderAccountActions,60)));

window.NomadTransactionUI={setMode,syncAccount,setCategories,openEntry};

setCategories("expense");
updateCopy("expense");
setTimeout(renderAccountActions,150);
