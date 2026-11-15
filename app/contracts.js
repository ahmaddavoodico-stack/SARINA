const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const W={
 fa:{button:'قراردادها و خدمات مالی',intro:'پیش‌نویس قرارداد خدمت برای این مزرعه بسازید. راهنمایی هوشمند سارینا در مرحله آغازین رایگان است؛ در قراردادهای ترکیبی فقط هزینه خدمت متخصص انسانی محاسبه می‌شود. تا زمان تأیید مالیات، صورتحساب صرفاً پیش‌نویس است.',type:'نوع خدمت',human:'متخصص انسانی',ai:'خدمات هوش مصنوعی سارینا',hybrid:'خدمت ترکیبی (متخصص + هوش مصنوعی)',expert:'متخصص تأییدشده',choose:'انتخاب متخصص',title:'عنوان قرارداد',desc:'شرح خدمت و تعهدات',price:'مدل درآمد و پرداخت',fixed:'مبلغ ثابت',milestone:'مرحله‌ای',subscription:'اشتراکی',per_use:'به‌ازای استفاده',result_based:'مبتنی بر نتیجه',hybrid_price:'ترکیبی',amount:'مبلغ پایه',currency:'ارز',share:'سهم متخصص از نتیجه (%)؛ اختیاری',result:'تعریف نتیجه و خط مبنا (برای مدل نتیجه‌محور)',save:'ذخیره پیش‌نویس',saved:'پیش‌نویس قرارداد ذخیره شد.',failed:'ذخیره پیش‌نویس انجام نشد.',loading:'در حال بارگذاری…',none:'هنوز قراردادی برای این مزرعه ثبت نشده است.',list:'قراردادهای این مزرعه',draft:'پیش‌نویس',human_expert:'متخصص انسانی',ai_service:'خدمات هوش مصنوعی',hybrid:'ترکیبی',field_service:'خدمت میدانی',organization:'سازمانی',fixed_fee:'مبلغ ثابت',milestone:'مرحله‌ای',subscription:'اشتراکی',per_use:'به‌ازای استفاده',result_based:'مبتنی بر نتیجه',hybrid_price:'ترکیبی',code:'کد',status:'وضعیت',proposed:'در انتظار پذیرش',accepted:'پذیرفته‌شده',cancelled:'لغوشده',propose:'ارسال پیشنهاد برای متخصص',accept:'تأیید قرارداد',cancel:'لغو قرارداد',accepted_note:'قرارداد با تأیید دو طرف پذیرفته شد.',waiting:'در انتظار تأیید متخصص',actionFailed:'انجام عملیات ممکن نشد.',invoices:'صورتحساب‌های قرارداد',invoiceDraft:'پیش‌نویس صورتحساب',taxPending:'وضعیت مالیات هنوز بررسی نشده است.'},
 en:{button:'Contracts & service billing',intro:'Create a service-contract draft for this farm. SARINA AI guidance is free at launch. For hybrid services, only the agreed human-expert fee is billable. Invoices remain drafts until tax treatment is reviewed.',type:'Service type',human:'Human expert',ai:'SARINA AI service',hybrid:'Hybrid (expert + AI)',expert:'Verified expert',choose:'Choose an expert',title:'Contract title',desc:'Service scope and obligations',price:'Pricing model',fixed:'Fixed fee',milestone:'Milestone-based',subscription:'Subscription',per_use:'Per use',result_based:'Result-based',hybrid_price:'Hybrid',amount:'Base amount',currency:'Currency',share:'Expert result share (%) · optional',result:'Outcome definition and baseline (for result-based pricing)',save:'Save draft',saved:'Contract draft saved.',failed:'Could not save the draft.',loading:'Loading…',none:'No contracts recorded for this farm yet.',list:'Contracts for this farm',draft:'Draft',human_expert:'Human expert',ai_service:'AI service',hybrid:'Hybrid',field_service:'Field service',organization:'Organization',fixed_fee:'Fixed fee',milestone:'Milestone-based',subscription:'Subscription',per_use:'Per use',result_based:'Result-based',hybrid_price:'Hybrid',code:'Code',status:'Status',proposed:'Awaiting acceptance',accepted:'Accepted',cancelled:'Cancelled',propose:'Send offer to expert',accept:'Accept contract',cancel:'Cancel contract',accepted_note:'Both parties accepted this contract.',waiting:'Waiting for expert acceptance',actionFailed:'The action could not be completed.',invoices:'Contract invoices',invoiceDraft:'Invoice draft',taxPending:'Tax treatment has not been reviewed yet.'}
};
const text=(l,k)=>W[l]?.[k]||k;
export function renderFarmContracts(farmId,lang='fa'){
 const x=k=>text(lang,k);
 return '<section class="farm-contracts"><button type="button" class="quiet-btn contract-toggle" data-contract-toggle="'+esc(farmId)+'">📄 '+x('button')+'</button><div class="contract-panel hidden" id="contracts-'+esc(farmId)+'"><p>'+x('intro')+'</p><form class="contract-draft-form" data-farm-id="'+esc(farmId)+'">'+
 '<label>'+x('type')+'<select name="service_type"><option value="human_expert">'+x('human')+'</option><option value="ai_service">'+x('ai')+'</option><option value="hybrid">'+x('hybrid')+'</option></select></label>'+
 '<label class="contract-expert-field">'+x('expert')+'<select name="expert_profile_id" required><option value="">'+x('choose')+'</option></select></label>'+
 '<label>'+x('title')+'<input name="title" maxlength="180" minlength="3" required></label>'+
 '<label class="contract-wide">'+x('desc')+'<textarea name="description" rows="2" maxlength="4000"></textarea></label>'+
 '<label>'+x('price')+'<select name="pricing_model"><option value="fixed_fee">'+x('fixed')+'</option><option value="milestone">'+x('milestone')+'</option><option value="subscription">'+x('subscription')+'</option><option value="per_use">'+x('per_use')+'</option><option value="result_based">'+x('result_based')+'</option><option value="hybrid">'+x('hybrid_price')+'</option></select></label>'+
 '<label>'+x('amount')+'<input name="base_amount" type="number" min="0" step="0.0001" value="0" required></label>'+
 '<label>'+x('currency')+'<select name="currency_code"><option>USD</option><option>EUR</option><option>IRR</option><option>AFN</option><option>PKR</option><option>INR</option><option>AED</option></select></label>'+
 '<label>'+x('share')+'<input name="expert_result_share_rate" type="number" min="0" max="100" step="0.01"></label>'+
 '<label class="contract-wide">'+x('result')+'<textarea name="result_definition" rows="2" maxlength="3000"></textarea></label>'+
 '<button class="primary-btn contract-wide" type="submit">'+x('save')+'</button><p class="message contract-message contract-wide" role="status"></p></form>'+
 '<div class="contract-list" data-contract-list="'+esc(farmId)+'"><p>'+x('loading')+'</p></div></div></section>';
}
export function bindFarmContracts({root,supabase,getProfile,getLanguage}){
 if(!root||root.dataset.contractsBound)return;root.dataset.contractsBound='1';
 const lang=()=>getLanguage(), load=async farmId=>{
  const area=root.querySelector('[data-contract-list="'+CSS.escape(farmId)+'"]');if(!area)return;
  const l=k=>text(lang(),k);area.innerHTML='<p>'+l('loading')+'</p>';
  const {data,error}=await supabase.from('service_contracts').select('id,contract_code,service_type,title,status,pricing_model,base_amount,currency_code,created_at,farmer_user_id,farmer_accepted_at,expert_accepted_at,expert_profile_id').eq('farm_id',farmId).order('created_at',{ascending:false}).limit(30);
  if(error){area.textContent=l('failed');console.error(error);return}
  area.innerHTML='<h4>'+l('list')+'</h4>'+((data||[]).length?(data||[]).map(c=>{const isFarmer=c.farmer_user_id===getProfile()?.id;let actions='';if(isFarmer&&c.status==='draft')actions='<button type="button" class="quiet-btn" data-contract-action="propose" data-contract-id="'+esc(c.id)+'">'+l('propose')+'</button><button type="button" class="quiet-btn" data-contract-action="cancel" data-contract-id="'+esc(c.id)+'">'+l('cancel')+'</button>';else if(isFarmer&&c.status==='proposed'){if(!c.farmer_accepted_at)actions+='<button type="button" class="primary-btn" data-contract-action="accept" data-contract-id="'+esc(c.id)+'">'+l('accept')+'</button>';if(c.expert_profile_id&&!c.expert_accepted_at)actions+='<p>'+l('waiting')+'</p>';actions+='<button type="button" class="quiet-btn" data-contract-action="cancel" data-contract-id="'+esc(c.id)+'">'+l('cancel')+'</button>';}else if(c.status==='accepted')actions='<p>'+l('accepted_note')+'</p>';return '<article class="contract-summary"><b>'+esc(c.title)+'</b><p>'+l('code')+': '+esc(c.contract_code)+' · '+esc(l(c.service_type))+' · '+esc(l(c.pricing_model))+'</p><p>'+esc(c.base_amount)+' '+esc(c.currency_code)+' · '+l('status')+': '+esc(l(c.status))+'</p>'+actions+'</article>';}).join(''):'<p>'+l('none')+'</p>');
  if((data||[]).length){
   const ids=data.map(c=>c.id);
   const {data:invoices, error:invoiceError}=await supabase.from('contract_invoices').select('id,contract_id,invoice_number,status,currency_code,subtotal,total_amount,tax_status,created_at').in('contract_id',ids).order('created_at',{ascending:false});
   if(!invoiceError&&invoices?.length){
    const items=invoices.map(i=>'<article class="contract-summary"><b>'+l('invoiceDraft')+' · '+esc(i.invoice_number)+'</b><p>'+esc(i.status)+' · '+esc(i.total_amount)+' '+esc(i.currency_code)+'</p><p>'+l('taxPending')+'</p></article>').join('');
    area.insertAdjacentHTML('beforeend','<h4>'+l('invoices')+'</h4>'+items);
   }
  }
 };
 root.addEventListener('click',async e=>{
  const btn=e.target.closest('[data-contract-toggle]');if(!btn)return;
  const farmId=btn.dataset.contractToggle,panel=root.querySelector('#contracts-'+CSS.escape(farmId));panel?.classList.toggle('hidden');
  if(panel&&!panel.classList.contains('hidden')){await load(farmId);const form=panel.querySelector('.contract-draft-form');await loadExperts(form);}
 });
 const loadExperts=async form=>{
  if(!form||form.dataset.expertsLoaded)return;
  const select=form.querySelector('[name="expert_profile_id"]'),l=k=>text(lang(),k);
  const {data,error}=await supabase.from('expert_profiles').select('id,public_name').eq('verification_status','verified').in('profile_visibility',['directory','public']).order('public_name');
  select.innerHTML='<option value="">'+l('choose')+'</option>'+(data||[]).map(e=>'<option value="'+esc(e.id)+'">'+esc(e.public_name)+'</option>').join('');
  if(error)console.error(error);form.dataset.expertsLoaded='1';
 };
 root.addEventListener('click',async e=>{const action=e.target.closest('[data-contract-action]');if(!action)return;const id=action.dataset.contractId,kind=action.dataset.contractAction;action.disabled=true;const {data,error}=await supabase.functions.invoke('sarina-contract-workflow',{body:{contract_id:id,action:kind}});if(error||!data?.ok){console.error('Contract workflow failed',error||data);action.disabled=false;const msg=action.closest('.contract-summary')?.querySelector('p:last-child');if(msg)msg.textContent=text(lang(),'actionFailed');return;}await load(action.closest('.contract-panel')?.id?.replace('contracts-','')||root.querySelector('.contract-draft-form')?.dataset.farmId);});
 root.addEventListener('change',e=>{
  const select=e.target.closest('.contract-draft-form [name="service_type"]');if(!select)return;
  const form=select.closest('form'),field=form.querySelector('.contract-expert-field'),needs=select.value!=='ai_service';
  field.classList.toggle('hidden',!needs);form.querySelector('[name="expert_profile_id"]').required=needs;const amount=form.querySelector('[name="base_amount"]');if(!needs){amount.value='0';amount.disabled=true;}else{amount.disabled=false;}
 });
 root.addEventListener('submit',async e=>{
  const form=e.target.closest('.contract-draft-form');if(!form)return;e.preventDefault();
  const l=k=>text(lang(),k),msg=form.querySelector('.contract-message'),btn=form.querySelector('button[type="submit"]'),v=Object.fromEntries(new FormData(form).entries());
  const current=getProfile();if(!current?.id){msg.textContent=l('failed');return}
  const service=v.service_type,needs=service!=='ai_service',amount=service==='ai_service'?0:Number(v.base_amount);
  if(needs&&!v.expert_profile_id){msg.textContent=l('failed');return}
  const resultText=(v.result_definition||'').trim();
  const payload={farmer_user_id:current.id,farm_id:form.dataset.farmId,expert_profile_id:needs?v.expert_profile_id:null,service_type:service,service_key:service==='ai_service'?'farmer_ai_service':service==='hybrid'?'human_ai_bundle':'expert_consultation',title:v.title.trim(),description:v.description||'',status:'draft',pricing_model:v.pricing_model,currency_code:v.currency_code,base_amount:amount,platform_fee_model:'none',platform_fee_rate:0,expert_result_share_rate:v.expert_result_share_rate===''?null:Number(v.expert_result_share_rate),result_definition:resultText?{description:resultText,requires_baseline:true,requires_follow_up:true}: {},payment_schedule:{collection:'invoice_after_offer_acceptance',method:'provider_dependent'},terms_snapshot:{schema:'SARINA_SERVICE_CONTRACT_V1',draft_only:true,created_by:'farmer',service_type:service,pricing_model:v.pricing_model,currency_code:v.currency_code,base_amount:amount,platform_fee_model:'none',platform_fee_rate:0,ai_service_free_at_launch:service==='ai_service'||service==='hybrid',result_share_rate:v.expert_result_share_rate===''?null:Number(v.expert_result_share_rate),acceptance_required:['farmer',...(needs?['expert']:[])]}};
  btn.disabled=true;msg.textContent=l('loading');
  const {error}=await supabase.from('service_contracts').insert(payload);
  btn.disabled=false;
  if(error){console.error(error);msg.textContent=l('failed');return}
  msg.textContent=l('saved');form.reset();form.querySelector('[name="base_amount"]').value='0';await load(form.dataset.farmId);
 });
}
