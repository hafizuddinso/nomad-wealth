(function(){
  const App=()=>window.NomadApp;
  const byId=id=>document.getElementById(id);
  const clone=value=>structuredClone(value);
  const num=value=>Number(value)||0;
  const uid=()=>crypto.randomUUID();
  const paymentsPerYear={monthly:12,weekly:52,biweekly:26,quarterly:4};
  const intervals={monthly:{months:1},weekly:{days:7},biweekly:{days:14},quarterly:{months:3}};

  function paymentCount(termMonths,frequency){
    const months=Math.max(1,num(termMonths));
    const perYear=paymentsPerYear[frequency]||12;
    return Math.max(1,Math.round(months/12*perYear));
  }

  function calculatedInstallment(principal,annualRate,termMonths,frequency){
    const p=Math.max(0,num(principal));
    const count=paymentCount(termMonths,frequency);
    const periodsPerYear=paymentsPerYear[frequency]||12;
    const periodicRate=Math.max(0,num(annualRate))/100/periodsPerYear;

    if(!p||!count)return 0;
    if(periodicRate===0)return p/count;

    const factor=Math.pow(1+periodicRate,count);
    return p*periodicRate*factor/(factor-1);
  }

  function updateLoanEstimate(){
    const form=byId('loan-tracker-form');
    if(!form)return;

    const principal=num(form.elements.principal?.value);
    const rate=num(form.elements.rate?.value);
    const termMonths=num(form.elements.termMonths?.value);
    const frequency=form.elements.frequency?.value||'monthly';
    const count=paymentCount(termMonths,frequency);
    const installment=calculatedInstallment(principal,rate,termMonths,frequency);
    const total=installment*count;
    const interest=Math.max(0,total-principal);
    const currency=form.elements.currency?.value||state()?.mainCurrency||'EUR';
    const override=byId('loan-installment-override')?.checked;

    if(form.elements.installment&&!override){
      form.elements.installment.value=installment>0?installment.toFixed(2):'';
    }

    const shownInstallment=override
      ?num(form.elements.installment?.value)
      :installment;

    if(byId('loan-summary-installment')){
      byId('loan-summary-installment').textContent=
        shownInstallment>0?money(shownInstallment,currency):'—';
    }
    if(byId('loan-summary-total')){
      byId('loan-summary-total').textContent=
        total>0?money(total,currency):'—';
    }
    if(byId('loan-summary-interest')){
      byId('loan-summary-interest').textContent=
        total>0?money(interest,currency):'—';
    }
    if(byId('loan-summary-count')){
      byId('loan-summary-count').textContent=
        count>0?String(count):'—';
    }
  }

  function money(value,currency){return App()?.money(value,currency)||`${currency||''} ${num(value).toFixed(2)}`}
  function state(){return App()?.getState()}
  function ensure(){
    const s=state(); if(!s)return null;
    if(!Array.isArray(s.loans))s.loans=[];
    s.loans.forEach(l=>{if(!Array.isArray(l.payments))l.payments=[]});
    return s;
  }
  function totals(loan){
    const original=num(loan.principal);
    const paid=loan.payments.reduce((x,p)=>x+num(p.amount),0);
    const principalPaid=loan.payments.reduce((x,p)=>x+num(p.principal),0);
    const interestPaid=loan.payments.reduce((x,p)=>x+num(p.interest),0);
    const remainingPrincipal=Math.max(0,original-principalPaid);
    const ppy=paymentsPerYear[loan.frequency]||12;
    const periodic=num(loan.rate)/100/ppy;
    const expectedPayments=Math.max(1,num(loan.termMonths)/12*ppy);
    const totalScheduled=num(loan.installment)*expectedPayments;
    const expectedInterest=Math.max(0,totalScheduled-original);
    const remainingInterest=Math.max(0,expectedInterest-interestPaid);
    const totalRemaining=remainingPrincipal+remainingInterest;
    const progress=original?Math.min(100,principalPaid/original*100):0;
    return {original,paid,principalPaid,interestPaid,remainingPrincipal,expectedInterest,remainingInterest,totalRemaining,progress,periodic};
  }
  function nextDate(date,frequency){
    const d=new Date(`${date}T12:00:00`); const step=intervals[frequency]||intervals.monthly;
    if(step.days)d.setDate(d.getDate()+step.days); if(step.months)d.setMonth(d.getMonth()+step.months);
    return d.toISOString().slice(0,10);
  }
  function populateAccounts(select,selected=''){
    const s=ensure(); if(!select||!s)return;
    select.innerHTML='<option value="">No linked account</option>'+s.accounts.filter(a=>a.type!=='Debt').map(a=>`<option value="${a.id}">${a.name} (${a.currency})</option>`).join('');
    select.value=selected||'';
  }
  function render(){
    const s=ensure(); if(!s)return;
    const all=s.loans.map(l=>({loan:l,t:totals(l)}));
    const currency=s.mainCurrency;
    const inMain=(v,c)=>App().convert(v,c,currency);
    const borrowed=all.reduce((x,i)=>x+inMain(i.t.original,i.loan.currency),0);
    const paid=all.reduce((x,i)=>x+inMain(i.t.paid,i.loan.currency),0);
    const remaining=all.reduce((x,i)=>x+inMain(i.t.remainingPrincipal,i.loan.currency),0);
    const next=all.filter(i=>i.t.remainingPrincipal>0).sort((a,b)=>String(a.loan.nextPaymentDate).localeCompare(String(b.loan.nextPaymentDate)))[0];
    if(byId('loans-total-borrowed'))byId('loans-total-borrowed').textContent=money(borrowed,currency);
    if(byId('loans-total-paid'))byId('loans-total-paid').textContent=money(paid,currency);
    if(byId('loans-principal-remaining'))byId('loans-principal-remaining').textContent=money(remaining,currency);
    if(byId('loans-next-payment'))byId('loans-next-payment').textContent=next?money(next.loan.installment,next.loan.currency):money(0,currency);
    if(byId('loans-next-date'))byId('loans-next-date').textContent=next?`Due ${next.loan.nextPaymentDate}`:'No upcoming payment';
    const list=byId('loan-list'); if(!list)return;
    list.innerHTML=all.length?all.map(({loan,t})=>`
      <article class="loan-card" data-loan-id="${loan.id}">
        <div class="loan-card-header"><div class="loan-title-wrap"><span class="loan-icon">▥</span><div><h3>${escapeHtml(loan.name)}</h3><p>${escapeHtml(loan.lender)} · ${loan.currency} · ${escapeHtml(loan.frequency)}</p></div></div><span class="loan-status">${t.remainingPrincipal<=0?'Paid off':'Active'}</span></div>
        <div class="loan-metrics">
          <div class="loan-metric"><span>Original principal</span><strong>${money(t.original,loan.currency)}</strong><small>Borrowed amount</small></div>
          <div class="loan-metric"><span>Installment</span><strong>${money(loan.installment,loan.currency)}</strong><small>${escapeHtml(loan.frequency)}</small></div>
          <div class="loan-metric"><span>Principal left</span><strong>${money(t.remainingPrincipal,loan.currency)}</strong><small>Excludes future interest</small></div>
          <div class="loan-metric"><span>Total remaining</span><strong>${money(t.totalRemaining,loan.currency)}</strong><small>Principal + estimated interest</small></div>
        </div>
        <div class="loan-progress-head"><span>Principal repayment progress</span><strong>${t.progress.toFixed(1)}%</strong></div><div class="loan-progress"><span style="width:${t.progress}%"></span></div>
        <div class="loan-payment-breakdown">
          <div class="loan-breakdown-item"><span>Total paid</span><strong>${money(t.paid,loan.currency)}</strong></div>
          <div class="loan-breakdown-item"><span>Principal paid</span><strong>${money(t.principalPaid,loan.currency)}</strong></div>
          <div class="loan-breakdown-item"><span>Interest paid</span><strong>${money(t.interestPaid,loan.currency)}</strong></div>
        </div>
        <div class="loan-card-actions"><button class="primary" type="button" data-record-loan-payment="${loan.id}">Record installment</button><button class="secondary" type="button" data-view-loan="${loan.id}">Payment history</button><button class="secondary" type="button" data-edit-loan="${loan.id}">Edit loan</button><button class="text-button danger-text" type="button" data-delete-loan="${loan.id}">Delete</button></div>
      </article>`).join(''):`<div class="empty-state"><div class="empty-state-icon">▥</div><h3>No loans yet</h3><p>Add a real loan to track installments, principal and interest.</p></div>`;
  }
  function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  function openNew(loan=null){
    const form=byId('loan-tracker-form'); if(!form)return;
    form.reset(); form.dataset.editing=loan?.id||'';
    const today=new Date().toISOString().slice(0,10);
    form.elements.startDate.value=loan?.startDate||today;
    form.elements.nextPaymentDate.value=loan?.nextPaymentDate||today;
    ['name','lender','principal','rate','termMonths','installment','frequency','note'].forEach(k=>{if(loan&&form.elements[k])form.elements[k].value=loan[k]??''});
    App().populateCurrencySelect(form.elements.currency,loan?.currency||state().mainCurrency);
    populateAccounts(form.elements.accountId,loan?.accountId||'');
    const override=byId('loan-installment-override');
    if(override)override.checked=Boolean(loan?.manualInstallment);
    if(form.elements.installment){
      form.elements.installment.readOnly=!override?.checked;
      if(loan?.installment)form.elements.installment.value=loan.installment;
    }
    updateLoanEstimate();
    byId('loan-tracker-dialog').showModal();
  }
  function openPayment(id){
    const s=ensure(),loan=s.loans.find(l=>l.id===id); if(!loan)return;
    const form=byId('loan-payment-form'),t=totals(loan); form.reset();
    form.elements.loanId.value=id; form.elements.amount.value=Math.min(num(loan.installment),t.totalRemaining||num(loan.installment)).toFixed(2); form.elements.date.value=loan.nextPaymentDate||new Date().toISOString().slice(0,10);
    populateAccounts(form.elements.accountId,loan.accountId||'');
    byId('loan-payment-context').innerHTML=`<strong>${escapeHtml(loan.name)}</strong><p>Principal remaining: ${money(t.remainingPrincipal,loan.currency)} · Interest paid: ${money(t.interestPaid,loan.currency)}</p>`;
    byId('loan-payment-dialog').showModal();
  }
  function openDetails(id){
    const s=ensure(),loan=s.loans.find(l=>l.id===id); if(!loan)return; const t=totals(loan);
    byId('loan-details-title').textContent=loan.name;
    byId('loan-details-content').innerHTML=`<div class="loan-details-grid">
      <div class="loan-detail-item"><span>Lender</span><strong>${escapeHtml(loan.lender)}</strong></div><div class="loan-detail-item"><span>Interest rate</span><strong>${num(loan.rate).toFixed(2)}%</strong></div>
      <div class="loan-detail-item"><span>Original principal</span><strong>${money(t.original,loan.currency)}</strong></div><div class="loan-detail-item"><span>Estimated total interest</span><strong>${money(t.expectedInterest,loan.currency)}</strong></div>
      <div class="loan-detail-item"><span>Principal paid</span><strong>${money(t.principalPaid,loan.currency)}</strong></div><div class="loan-detail-item"><span>Interest paid</span><strong>${money(t.interestPaid,loan.currency)}</strong></div>
      <div class="loan-detail-item"><span>Principal remaining</span><strong>${money(t.remainingPrincipal,loan.currency)}</strong></div><div class="loan-detail-item"><span>Estimated interest remaining</span><strong>${money(t.remainingInterest,loan.currency)}</strong></div>
    </div><h3>Payment history</h3><div class="loan-history">${loan.payments.length?[...loan.payments].reverse().map(p=>`<div class="loan-history-row"><div><strong>${p.date}</strong><small>${escapeHtml(p.note||'Installment')}</small></div><span>${money(p.amount,loan.currency)}</span><span class="history-extra">Principal ${money(p.principal,loan.currency)}</span><span class="history-extra">Interest ${money(p.interest,loan.currency)}</span></div>`).join(''):'<p class="muted">No installments recorded yet.</p>'}</div>`;
    byId('loan-details-dialog').showModal();
  }
  document.addEventListener('click',e=>{
    const add=e.target.closest('[data-open-dialog="loan-tracker-dialog"]'); if(add){e.preventDefault();openNew();return}
    const pay=e.target.closest('[data-record-loan-payment]'); if(pay){openPayment(pay.dataset.recordLoanPayment);return}
    const view=e.target.closest('[data-view-loan]'); if(view){openDetails(view.dataset.viewLoan);return}
    const edit=e.target.closest('[data-edit-loan]'); if(edit){const l=ensure().loans.find(x=>x.id===edit.dataset.editLoan);openNew(l);return}
    const del=e.target.closest('[data-delete-loan]'); if(del&&confirm('Delete this loan and its payment history?')){const s=ensure();s.loans=s.loans.filter(x=>x.id!==del.dataset.deleteLoan);App().save('Loan deleted');render()}
  });
  byId('loan-tracker-form')?.addEventListener('submit',e=>{
    e.preventDefault(); const s=ensure(),f=e.currentTarget,d=new FormData(f),id=f.dataset.editing;
    const record={id:id||uid(),name:String(d.get('name')).trim(),lender:String(d.get('lender')).trim(),principal:num(d.get('principal')),currency:d.get('currency'),rate:num(d.get('rate')),termMonths:num(d.get('termMonths')),installment:num(d.get('installment')),manualInstallment:Boolean(byId('loan-installment-override')?.checked),frequency:d.get('frequency'),startDate:d.get('startDate'),nextPaymentDate:d.get('nextPaymentDate'),accountId:d.get('accountId')||'',note:String(d.get('note')||'').trim(),payments:id?(s.loans.find(x=>x.id===id)?.payments||[]):[]};
    if(id)s.loans=s.loans.map(x=>x.id===id?record:x);else s.loans.push(record);
    byId('loan-tracker-dialog').close(); App().save(id?'Loan updated':'Loan added'); render();
  });
  byId('loan-payment-form')?.addEventListener('submit',e=>{
    e.preventDefault(); const s=ensure(),d=new FormData(e.currentTarget),loan=s.loans.find(x=>x.id===d.get('loanId')); if(!loan)return;
    const t=totals(loan),amount=num(d.get('amount')),interest=Math.min(amount,t.remainingPrincipal*t.periodic),principal=Math.min(t.remainingPrincipal,Math.max(0,amount-interest));
    loan.payments.push({id:uid(),amount,date:d.get('date'),accountId:d.get('accountId')||'',principal,interest,note:String(d.get('note')||'').trim(),createdAt:new Date().toISOString()});
    loan.nextPaymentDate=nextDate(d.get('date'),loan.frequency);
    if(d.get('createTransaction')==='on')s.transactions.push({id:uid(),type:'expense',amount,currency:loan.currency,category:'Loan Payment',country:s.currentCountry,accountId:d.get('accountId')||loan.accountId||null,date:d.get('date'),createdAt:new Date().toISOString(),frequency:'once',note:`${loan.name} installment`});
    byId('loan-payment-dialog').close(); App().save('Loan installment recorded'); render();
  });

  const loanForm=byId('loan-tracker-form');
  ['principal','rate','termMonths','frequency','currency'].forEach(name=>{
    loanForm?.elements[name]?.addEventListener('input',updateLoanEstimate);
    loanForm?.elements[name]?.addEventListener('change',updateLoanEstimate);
  });

  byId('loan-installment')?.addEventListener('input',updateLoanEstimate);

  byId('loan-installment-override')?.addEventListener('change',event=>{
    const input=byId('loan-installment');
    if(input){
      input.readOnly=!event.target.checked;
      if(event.target.checked)input.focus();
    }
    updateLoanEstimate();
  });

  window.addEventListener('nomad:state-rendered',render); window.addEventListener('nomad:state-replaced',render); window.addEventListener('nomad:state-saved',render);
  document.addEventListener('DOMContentLoaded',()=>setTimeout(render,100)); setTimeout(render,700);
})();
