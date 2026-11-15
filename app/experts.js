const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fa = (lang) => lang === 'fa';
export function renderExpertWorkspace(lang='fa') {
 const isFa=fa(lang);
 return `
 <section class="expert-workspace">
  <div class="section-head"><div><h2>${isFa?'فضای کاری متخصص':'Expert workspace'}</h2><p>${isFa?'پروفایل تخصصی، درخواست‌های ارجاع‌شده و پاسخ کارشناسی':'Your professional profile, assigned cases and expert responses'}</p></div><span class="expert-status" id="expertStatus">${isFa?'در حال بررسی وضعیت…':'Checking status…'}</span></div>
  <div class="expert-columns">
   <form id="expertProfileForm" class="panel expert-form">
    <h3>${isFa?'پروفایل متخصص':'Expert profile'}</h3>
    <label>${isFa?'نام نمایشی':'Public name'}<input name="public_name" maxlength="180" required></label>
    <label>${isFa?'معرفی کوتاه و سوابق':'Biography'}<textarea name="biography" rows="3" maxlength="4000"></textarea></label>
    <label>${isFa?'سال‌های تجربه':'Years of experience'}<input name="years_experience" type="number" min="0" max="70"></label>
    <label>${isFa?'زبان‌های مشاوره (با ویرگول جدا کنید)':'Languages (comma separated)'}<input name="languages" placeholder="fa, en"></label>
    <label>${isFa?'حوزه تخصصی':'Specialty'}<select name="expertise_category_id" id="expertCategory" required><option value="">${isFa?'در حال بارگذاری…':'Loading…'}</option></select></label>
    <button class="primary-btn" type="submit">${isFa?'ذخیره پروفایل':'Save profile'}</button><p class="message" id="expertProfileMessage"></p>
   </form>
   <form id="expertCredentialForm" class="panel expert-form">
    <h3>${isFa?'ثبت مشخصات مدرک':'Submit credential details'}</h3>
    <label>${isFa?'نوع مدرک':'Credential type'}<input name="credential_type" required maxlength="100"></label>
    <label>${isFa?'مرجع صادرکننده':'Issuing body'}<input name="issuing_body" maxlength="180"></label>
    <label>${isFa?'شماره یا شناسه مدرک':'Credential reference'}<input name="credential_ref" maxlength="180"></label>
    <label>${isFa?'تاریخ صدور':'Issue date'}<input name="issued_on" type="date"></label>
    <label>${isFa?'تاریخ انقضا':'Expiry date'}<input name="expires_on" type="date"></label>
    <p class="fineprint">${isFa?'در این نسخه فقط مشخصات مدرک ثبت می‌شود؛ بارگذاری فایل و بررسی دستی مدارک در مرحله بعد فعال می‌شود.':'This pilot stores credential metadata only. Private document upload and manual review tools are a later step.'}</p>
    <button class="primary-btn" type="submit">${isFa?'ثبت مدرک برای بررسی':'Submit for review'}</button><p class="message" id="expertCredentialMessage"></p>
   </form>
  </div>
  <section class="panel expert-cases"><h3>${isFa?'پرونده‌های ارجاع‌شده':'Assigned cases'}</h3><div id="expertCasesList"><p class="fineprint">${isFa?'برای بارگذاری پرونده‌ها، پروفایل خود را ذخیره کنید.':'Save your profile to load assigned cases.'}</p></div></section>
 </section>`;
}
export function renderFarmerExpertButton(farmId,lang='fa') {
 return `<div class="farmer-expert-entry"><button type="button" class="quiet-btn" data-expert-request-toggle="${esc(farmId)}">🧑‍🌾 ${fa(lang)?'درخواست مشاوره از متخصص':'Request an expert'}</button><div class="expert-request-panel hidden" id="expert-request-${esc(farmId)}"><form class="expert-request-form" data-farm-id="${esc(farmId)}">
 <label>${fa(lang)?'متخصص تأییدشده':'Verified expert'}<select name="expert_profile_id" required><option value="">${fa(lang)?'در حال بارگذاری متخصصان…':'Loading experts…'}</option></select></label>
 <label>${fa(lang)?'موضوع درخواست':'Subject'}<input name="subject" maxlength="180" required></label>
 <label>${fa(lang)?'شرح مسئله':'Problem description'}<textarea name="problem_description" rows="3" maxlength="5000" required></textarea></label>
 <label class="consent-row"><input type="checkbox" name="consent" required><span>${fa(lang)?'اجازه می‌دهم اطلاعات لازم این مزرعه برای بررسی این درخواست در اختیار متخصص انتخاب‌شده قرار گیرد.':'I consent to sharing the relevant farm information with the selected expert for this case.'}</span></label>
 <button class="primary-btn" type="submit">${fa(lang)?'ثبت درخواست':'Submit request'}</button><p class="message"></p>
 </form></div></div>`;
}
export function bindFarmerExpertRequests({root,supabase,getProfile,language}) {
 const isFa=fa(language);
 root.addEventListener('click',async e=>{
  const btn=e.target.closest('[data-expert-request-toggle]'); if(!btn)return;
  const farmId=btn.dataset.expertRequestToggle, panel=root.querySelector('#expert-request-'+CSS.escape(farmId));
  panel?.classList.toggle('hidden');
  const select=panel?.querySelector('select[name="expert_profile_id"]');
  if(select&&!select.dataset.loaded){
   const {data,error}=await supabase.from('expert_profiles').select('id,public_name').eq('verification_status','verified').in('profile_visibility',['directory','public']).order('public_name');
   select.dataset.loaded='1';select.innerHTML='<option value="">'+(isFa?'انتخاب متخصص':'Choose an expert')+'</option>';
   (data||[]).forEach(x=>select.add(new Option(x.public_name,x.id)));
   if(error||!data?.length)select.innerHTML='<option value="">'+(isFa?'فعلاً متخصص تأییدشده‌ای در فهرست نیست':'No verified experts listed yet')+'</option>';
  }
 });
 root.addEventListener('submit',async e=>{
  const form=e.target.closest('.expert-request-form');if(!form)return;e.preventDefault();
  const msg=form.querySelector('.message'),button=form.querySelector('button[type="submit"]');
  const v=Object.fromEntries(new FormData(form).entries());
  if(!v.consent){msg.textContent=isFa?'برای ثبت درخواست، رضایت لازم است.':'Consent is required.';return;}
  button.disabled=true;msg.textContent=isFa?'در حال ثبت…':'Submitting…';
  try{
   const currentProfile=getProfile();
   if(!currentProfile){throw new Error('Authentication required');}
   const now=new Date().toISOString();
   const {data:req,error}=await supabase.from('expert_requests').insert({
    requester_user_id:currentProfile.id,farm_id:form.dataset.farmId,assigned_expert_profile_id:v.expert_profile_id,
    subject:v.subject.trim(),problem_description:v.problem_description.trim(),request_type:'general',
    priority:'normal',status:'submitted',preferred_language:language,requested_mode:'in_app_message',
    consent_at:now,consent_scope:{farm_profile:true,soil_water_crop_context:true,case_messages:true,limited_to_selected_expert:true}
   }).select('id').single();
   if(error)throw error;
   const {error:assignmentError}=await supabase.from('expert_request_assignments').insert({request_id:req.id,expert_profile_id:v.expert_profile_id,assignment_status:'offered'});
   if(assignmentError)throw assignmentError;
   const {error:consultError}=await supabase.from('expert_consultations').insert({request_id:req.id,consultation_mode:'in_app_message',status:'scheduled'});
   if(consultError)throw consultError;
   msg.textContent=isFa?'درخواست ثبت شد و برای متخصص ارسال شد.':'Request submitted to the expert.';
   form.reset();
  }catch(err){console.error('Expert request failed',err);msg.textContent=(isFa?'ثبت درخواست کامل نشد: ':'Request failed: ')+err.message;}
  finally{button.disabled=false;}
 });
}
export function bindExpertWorkspace({root,supabase,profile,language}) {
 const isFa=fa(language), profileForm=root.querySelector('#expertProfileForm'), credForm=root.querySelector('#expertCredentialForm');
 let expert=null;
 const say=(id,msg)=>{const el=root.querySelector('#'+id);if(el)el.textContent=msg;};
 async function load(){
  const [{data:cats,error:catErr},{data:existing,error:profileErr}]=await Promise.all([
   supabase.from('expertise_categories').select('id,display_name').eq('is_active',true).order('display_name'),
   supabase.from('expert_profiles').select('*').eq('user_id',profile.id).maybeSingle()
  ]);
  if(catErr)console.warn(catErr);
  const cat=root.querySelector('#expertCategory');cat.innerHTML='<option value="">'+(isFa?'انتخاب تخصص':'Choose specialty')+'</option>';
  (cats||[]).forEach(c=>cat.add(new Option(c.display_name,c.id)));
  if(profileErr)console.warn(profileErr);
  expert=existing||null;
  if(expert){
   for(const [k,v] of Object.entries({public_name:expert.public_name,biography:expert.biography||'',years_experience:expert.years_experience??'',languages:Array.isArray(expert.languages)?expert.languages.join(', '):''})){
    if(profileForm.elements[k])profileForm.elements[k].value=v;
   }
   root.querySelector('#expertStatus').textContent=({pending:isFa?'در انتظار تأیید':'Pending review',verified:isFa?'تأییدشده':'Verified',rejected:isFa?'نیازمند اصلاح':'Changes requested',suspended:isFa?'تعلیق‌شده':'Suspended'})[expert.verification_status]||expert.verification_status;
   const {data:sp}=await supabase.from('expert_specialties').select('expertise_category_id').eq('expert_profile_id',expert.id).maybeSingle();
   if(sp)cat.value=sp.expertise_category_id;
   await loadCases();
  }else root.querySelector('#expertStatus').textContent=isFa?'هنوز پروفایل متخصص ندارید':'No expert profile yet';
 }
 async function loadCases(){
  const list=root.querySelector('#expertCasesList');
  const {data:requests,error}=await supabase.from('expert_requests').select('id,subject,problem_description,status,created_at,requester_user_id,assigned_expert_profile_id').eq('assigned_expert_profile_id',expert.id).order('created_at',{ascending:false}).limit(30);
  if(error){list.textContent=error.message;return;}
  if(!requests?.length){list.innerHTML='<p class="fineprint">'+(isFa?'هنوز پرونده‌ای به شما ارجاع نشده است.':'No cases assigned yet.')+'</p>';return;}
  const cards=[];
  for(const r of requests){
   const {data:assignment}=await supabase.from('expert_request_assignments').select('id,assignment_status').eq('request_id',r.id).eq('expert_profile_id',expert.id).maybeSingle();
   const {data:consult}=await supabase.from('expert_consultations').select('id').eq('request_id',r.id).maybeSingle();
   const {data:messages}=consult?.id?await supabase.from('expert_consultation_messages').select('id,sender_user_id,message_text,created_at').eq('consultation_id',consult.id).order('created_at').limit(30):{data:[]};
   cards.push(`<article class="expert-case-card" data-case="${esc(r.id)}"><div class="section-head"><div><h4>${esc(r.subject)}</h4><p>${esc(r.problem_description)}</p></div><span class="expert-status">${esc(assignment?.assignment_status||r.status)}</span></div>
   <div class="expert-case-actions">${assignment?.assignment_status==='offered'?'<button type="button" class="quiet-btn" data-assignment-action="accepted" data-assignment-id="'+esc(assignment.id)+'">'+(isFa?'پذیرش':'Accept')+'</button><button type="button" class="quiet-btn" data-assignment-action="declined" data-assignment-id="'+esc(assignment.id)+'">'+(isFa?'رد درخواست':'Decline')+'</button>':''}</div>
   <div class="expert-messages">${(messages||[]).map(m=>'<p><b>'+(m.sender_user_id===profile.id?(isFa?'شما':'You'):(isFa?'کشاورز':'Farmer'))+':</b> '+esc(m.message_text||'')+'</p>').join('')||'<p class="fineprint">'+(isFa?'هنوز پیامی ثبت نشده است.':'No messages yet.')+'</p>'}</div>
   ${consult?.id?'<form class="expert-message-form" data-consultation-id="'+esc(consult.id)+'"><textarea name="message_text" rows="2" maxlength="6000" required placeholder="'+(isFa?'پاسخ شما…':'Your reply…')+'"></textarea><button class="primary-btn" type="submit">'+(isFa?'ارسال پیام':'Send message')+'</button></form><form class="expert-report-form" data-request-id="'+esc(r.id)+'" data-consultation-id="'+esc(consult.id)+'"><h5>'+(isFa?'گزارش کارشناسی':'Expert report')+'</h5><textarea name="summary" rows="3" minlength="10" maxlength="12000" required placeholder="'+(isFa?'خلاصه ارزیابی کارشناسی':'Assessment summary')+'"></textarea><textarea name="recommendations" rows="2" placeholder="'+(isFa?'پیشنهادها':'Recommendations')+'"></textarea><textarea name="limitations" rows="2" placeholder="'+(isFa?'محدودیت‌ها و موارد نیازمند بررسی':'Limitations / follow-up')+'"></textarea><button class="quiet-btn" type="submit">'+(isFa?'ثبت گزارش':'Submit report')+'</button><p class="message"></p></form>':'<p class="fineprint">'+(isFa?'گفت‌وگو هنوز ایجاد نشده است.':'Conversation is not available yet.')+'</p>'}</article>`);
  }
  list.innerHTML=cards.join('');
 }
 profileForm.addEventListener('submit',async e=>{
  e.preventDefault();const v=Object.fromEntries(new FormData(profileForm).entries()),button=profileForm.querySelector('button[type=submit]');button.disabled=true;
  try{
   const payload={public_name:v.public_name.trim(),biography:v.biography.trim()||null,years_experience:v.years_experience?Number(v.years_experience):null,languages:v.languages.split(',').map(x=>x.trim()).filter(Boolean),consultation_modes:['in_app_message'],profile_visibility:'private'};
   if(expert){const {error}=await supabase.from('expert_profiles').update(payload).eq('id',expert.id);if(error)throw error;}
   else {const {data,error}=await supabase.from('expert_profiles').insert({...payload,user_id:profile.id}).select('*').single();if(error)throw error;expert=data;}
   const {error:deleteSpecialtyError}=await supabase.from('expert_specialties').delete().eq('expert_profile_id',expert.id);
   if(deleteSpecialtyError)throw deleteSpecialtyError;
   const {error:specErr}=await supabase.from('expert_specialties').insert({expert_profile_id:expert.id,expertise_category_id:v.expertise_category_id});
   if(specErr)throw specErr;
   say('expertProfileMessage',isFa?'پروفایل ذخیره شد و برای بررسی آماده است.':'Profile saved and ready for review.');await load();
  }catch(err){console.error(err);say('expertProfileMessage',(isFa?'خطا: ':'Error: ')+err.message);}
  finally{button.disabled=false;}
 });
 credForm.addEventListener('submit',async e=>{
  e.preventDefault();if(!expert){say('expertCredentialMessage',isFa?'ابتدا پروفایل متخصص را ذخیره کنید.':'Save your expert profile first.');return;}
  const v=Object.fromEntries(new FormData(credForm).entries()),payload={expert_profile_id:expert.id,credential_type:v.credential_type.trim(),issuing_body:v.issuing_body||null,credential_ref:v.credential_ref||null,issued_on:v.issued_on||null,expires_on:v.expires_on||null};
  const {error}=await supabase.from('expert_credentials').insert(payload);
  say('expertCredentialMessage',error?error.message:(isFa?'مشخصات مدرک برای بررسی ثبت شد.':'Credential details submitted.'));
  if(!error)credForm.reset();
 });
 root.addEventListener('click',async e=>{
  const b=e.target.closest('[data-assignment-action]');if(!b)return;
  b.disabled=true;const {error}=await supabase.from('expert_request_assignments').update({assignment_status:b.dataset.assignmentAction,responded_at:new Date().toISOString()}).eq('id',b.dataset.assignmentId);
  if(error){say('expertStatus',error.message);b.disabled=false;}else await loadCases();
 });
 root.addEventListener('submit',async e=>{
  const msgForm=e.target.closest('.expert-message-form');if(msgForm){e.preventDefault();const v=Object.fromEntries(new FormData(msgForm).entries());const {error}=await supabase.from('expert_consultation_messages').insert({consultation_id:msgForm.dataset.consultationId,sender_user_id:profile.id,message_text:v.message_text.trim(),content_parts:[]});if(error)alert(error.message);else await loadCases();return;}
  const report=e.target.closest('.expert-report-form');if(report){e.preventDefault();const v=Object.fromEntries(new FormData(report).entries()),button=report.querySelector('button[type=submit]');button.disabled=true;const {error}=await supabase.from('expert_request_reports').insert({request_id:report.dataset.requestId,consultation_id:report.dataset.consultationId,author_user_id:profile.id,summary:v.summary.trim(),recommendations:v.recommendations||null,limitations:v.limitations||null,evidence_notes:[]});report.querySelector('.message').textContent=error?error.message:(isFa?'گزارش ثبت شد.':'Report submitted.');button.disabled=false;}
 });
 await load();
}
