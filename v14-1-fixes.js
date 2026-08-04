(()=>{
'use strict';
const App=window.NomadApp;
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
}[char]));
const money=(value,currency)=>new Intl.NumberFormat(undefined,{
  style:'currency',
  currency:currency||App?.getMainCurrency?.()||'EUR'
}).format(Number(value)||0);

function updateGreeting(){
  const greeting=$('#greeting');
  if(!greeting)return;
  const hour=new Date().getHours();
  greeting.textContent=hour<12?'Good morning':hour<18?'Good afternoon':'Good evening';
}

function installInvestmentDialog(){
  if($('#edit-investment-dialog'))return;
  const dialog=document.createElement('dialog');
  dialog.id='edit-investment-dialog';
  dialog.innerHTML=`
    <form id="edit-investment-form">
      <input type="hidden" name="id">
      <div class="dialog-heading">
        <div><span class="eyebrow">INVESTMENT UPDATE</span><h2>Edit investment</h2></div>
        <button type="button" class="icon-button" data-close-dialog>×</button>
      </div>
      <label>Investment name<input name="name" placeholder="Enter investment name" required></label>
      <div class="form-grid">
        <label>Type<input name="type" placeholder="ETF, stock, property, crypto..." required></label>
        <label>Currency<select name="currency" required></select></label>
      </div>
      <div class="investment-value-comparison">
        <label>Previous amount invested<input name="cost" type="number" min="0" step="0.01" placeholder="Enter original amount" required></label>
        <label>Current value now<input name="value" type="number" min="0" step="0.01" placeholder="Enter current value" required></label>
      </div>
      <div id="edit-investment-preview" class="investment-edit-preview"></div>
      <div class="dialog-actions spread">
        <button type="button" class="danger-button" id="delete-investment-button">Delete investment</button>
        <div>
          <button type="button" class="secondary" data-close-dialog>Cancel</button>
          <button type="submit" class="primary">Save changes</button>
        </div>
      </div>
    </form>`;
  document.body.appendChild(dialog);
  const form=$('#edit-investment-form');
  App.populateCurrencySelect(form.elements.currency,'');

  const preview=()=>{
    const previous=Number(form.elements.cost.value)||0;
    const current=Number(form.elements.value.value)||0;
    const gain=current-previous;
    const percentage=previous?gain/previous*100:0;
    $('#edit-investment-preview').innerHTML=`
      <div><small>Previous</small><strong>${money(previous,form.elements.currency.value)}</strong></div>
      <div><small>Now</small><strong>${money(current,form.elements.currency.value)}</strong></div>
      <div class="${gain>=0?'gain':'loss'}"><small>Change</small><strong>${gain>=0?'+':''}${money(gain,form.elements.currency.value)} (${percentage.toFixed(1)}%)</strong></div>`;
  };
  ['cost','value','currency'].forEach(name=>form.elements[name].addEventListener('input',preview));
  form.elements.currency.addEventListener('change',preview);

  form.addEventListener('submit',event=>{
    event.preventDefault();
    const state=App.getState();
    const investment=state.investments.find(item=>item.id===form.elements.id.value);
    if(!investment)return;
    investment.name=form.elements.name.value.trim();
    investment.type=form.elements.type.value.trim();
    investment.currency=form.elements.currency.value;
    investment.cost=Number(form.elements.cost.value)||0;
    investment.value=Number(form.elements.value.value)||0;
    dialog.close();
    App.save('Investment updated');
    renderInvestmentCards();
  });

  $('#delete-investment-button').addEventListener('click',()=>{
    const id=form.elements.id.value;
    if(!id||!confirm('Delete this investment?'))return;
    const state=App.getState();
    state.investments=state.investments.filter(item=>item.id!==id);
    dialog.close();
    App.save('Investment deleted');
    renderInvestmentCards();
  });
}

function openInvestmentEditor(id){
  const investment=App?.getState?.()?.investments?.find(item=>item.id===id);
  const dialog=$('#edit-investment-dialog');
  const form=$('#edit-investment-form');
  if(!investment||!dialog||!form)return;
  form.elements.id.value=investment.id;
  form.elements.name.value=investment.name||'';
  form.elements.type.value=investment.type||'';
  App.populateCurrencySelect(form.elements.currency,investment.currency||'');
  form.elements.currency.value=investment.currency||'';
  form.elements.cost.value=Number(investment.cost)||0;
  form.elements.value.value=Number(investment.value)||0;
  form.elements.value.dispatchEvent(new Event('input'));
  dialog.showModal();
}

function renderInvestmentCards(){
  const list=$('#investment-list');
  const investments=App?.getState?.()?.investments||[];
  if(!list)return;
  if(!investments.length){
    list.innerHTML='<div class="empty-state"><h3>No investments yet</h3><p>Add your first investment.</p></div>';
    return;
  }
  list.innerHTML=investments.map(investment=>{
    const previous=Number(investment.cost)||0;
    const current=Number(investment.value)||0;
    const gain=current-previous;
    const percentage=previous?gain/previous*100:0;
    return `<article class="investment-detail-card" data-edit-investment="${esc(investment.id)}" tabindex="0" role="button" aria-label="Edit ${esc(investment.name)}">
      <header><div><small>${esc(investment.type)} · ${esc(investment.currency)}</small><h3>${esc(investment.name)}</h3></div><button type="button" class="investment-edit-label" data-edit-investment-button="${esc(investment.id)}">Edit investment</button></header>
      <div class="investment-comparison-grid">
        <div><small>Previous invested</small><strong>${money(previous,investment.currency)}</strong></div>
        <div><small>Current value now</small><strong>${money(current,investment.currency)}</strong></div>
        <div class="${gain>=0?'gain':'loss'}"><small>Profit / loss</small><strong>${gain>=0?'+':''}${money(gain,investment.currency)} (${percentage.toFixed(1)}%)</strong></div>
      </div>
      <p class="investment-graph-note">The performance and allocation graphs above update after every change.</p>
    </article>`;
  }).join('');
}

function fixBudgetDialogEvents(){
  document.addEventListener('click',event=>{
    const opener=event.target.closest('[data-open-dialog="budget-dialog"]');
    if(opener){
      event.preventDefault();
      const dialog=$('#budget-dialog');
      if(dialog&&!dialog.open)dialog.showModal();
      return;
    }
    const close=event.target.closest('[data-close-dialog]');
    if(close){
      const dialog=close.closest('dialog');
      if(dialog?.open)dialog.close();
    }
  });
}

function init(){
  updateGreeting();
  setInterval(updateGreeting,60_000);
  installInvestmentDialog();
  renderInvestmentCards();
  fixBudgetDialogEvents();

  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-edit-investment-button]');
    if(button){
      event.preventDefault();
      event.stopPropagation();
      openInvestmentEditor(button.dataset.editInvestmentButton);
      return;
    }
    const card=event.target.closest('[data-edit-investment]');
    if(card)openInvestmentEditor(card.dataset.editInvestment);
  });
  document.addEventListener('keydown',event=>{
    const card=event.target.closest?.('[data-edit-investment]');
    if(card&&(event.key==='Enter'||event.key===' ')){
      event.preventDefault();
      openInvestmentEditor(card.dataset.editInvestment);
    }
  });
  window.addEventListener('nomad:state-rendered',renderInvestmentCards);
  window.addEventListener('nomad:state-saved',renderInvestmentCards);
  window.addEventListener('nomad:cloud-loaded',renderInvestmentCards);

  window.NomadV14RenderInvestments=renderInvestmentCards;
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-page="investments"],[data-page-target="investments"]')){
      setTimeout(renderInvestmentCards,0);
    }
  });
}

document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
