const P='SARINA_FARM_OPERATION_V1:';
const T={
fa:{button:'برنامه کاری و آموزش مزرعه',intro:'کارها را زمان‌بندی و به افراد مسئول واگذار کنید. در این نسخه برنامه با تأیید کشاورز ثبت می‌شود و هنوز زمان‌بندی خودکار هوشمند نیست.',task:'عنوان کار',date:'تاریخ',start:'شروع',end:'پایان',assignee:'مسئول اجرا',name:'نام کارگر یا سرپرست',role:'نقش',farmer:'کشاورز',supervisor:'سرپرست',worker:'کارگر',trainee:'کارآموز',priority:'اولویت',normal:'عادی',high:'بالا',urgent:'ضروری',notes:'روش اجرا و نکات آموزشی',save:'ثبت برنامه',list:'کارهای ثبت‌شده',loading:'در حال بارگذاری…',none:'هنوز کاری ثبت نشده است.',planned:'برنامه‌ریزی‌شده',progress:'در حال انجام',done:'انجام‌شده',blocked:'دارای مانع',startTask:'شروع',finish:'اتمام',block:'مانع',saved:'برنامه ثبت شد.',failed:'ذخیره انجام نشد.',timeError:'ساعت پایان باید بعد از شروع باشد.',learn:'آموزش متناسب با مزرعه',farmerLearn:'کشاورز: شناخت خاک و آب، تغذیه، آفات، هزینه و عملکرد.',workerLearn:'کارگر: روش استاندارد اجرا، ترتیب مراحل، ابزار، کنترل کیفیت و ایمنی.',youthLearn:'فرزندان کشاورزان: مشاهده رشد، حشرات مفید و آزمایش ساده؛ متناسب با سن و زیر نظر بزرگسال.',compost:'کمپوست و کود آلی',compostText:'مواد ناشناخته، پلاستیک، چوب رنگ‌شده، روغن و پسماند آلوده را وارد توده نکنید. مواد خشک کربنی و بقایای تر گیاهی را متعادل ترکیب کنید؛ رطوبت و هوادهی را مدیریت و دما را در چند نقطه ثبت کنید. کمپوست نارس، داغ یا ناپایدار را مصرف نکنید. برای محصولات خوراکی، خطر آلودگی و شوری و نیاز به آزمون را بررسی کنید. این راهنمای مقدماتی است، نه نسخه ثابت ترکیب مواد.',efficiency:'بهره‌وری: مصرف آب و نهاده را ثبت کنید، نشتی و یکنواختی آبیاری را بررسی کنید، ضایعات را کم کنید و فقط دوره‌های قابل مقایسه را با هم بسنجید.',safety:'ایمنی: سم، کود، ابزار برنده، پمپ و ماشین‌آلات فقط برای افراد آموزش‌دیده و مجاز است. مواد ناشناخته را مخلوط نکنید. کود را مستقیم داخل استخر ذخیره آب نریزید. کودسازی و کار با تجهیزات برای کودکان ممنوع است.',source:'این برنامه خوداظهاری و تأییدشده توسط کاربر است؛ توصیه کارشناسی یا دستور خودکار SARINA محسوب نمی‌شود.'},
en:{button:'Farm work plan & learning',intro:'Schedule work and assign responsibility. Plans are farmer-confirmed in this release; automatic intelligent scheduling is not enabled.',task:'Task title',date:'Date',start:'Start',end:'End',assignee:'Assigned to',name:'Worker or supervisor name',role:'Role',farmer:'Farmer',supervisor:'Supervisor',worker:'Worker',trainee:'Trainee',priority:'Priority',normal:'Normal',high:'High',urgent:'Urgent',notes:'Work method and learning notes',save:'Save plan',list:'Saved tasks',loading:'Loading…',none:'No tasks recorded yet.',planned:'Planned',progress:'In progress',done:'Completed',blocked:'Blocked',startTask:'Start',finish:'Complete',block:'Blocked',saved:'Plan saved.',failed:'Could not save.',timeError:'End time must be later than start.',learn:'Learning for this farm',farmerLearn:'Farmer: soil and water, nutrition, pests, costs and yield.',workerLearn:'Worker: standard procedures, task sequence, tools, quality checks and safety.',youthLearn:'Farmers’ children: plant observation, beneficial insects and simple experiments; age-appropriate and supervised.',compost:'Compost and organic fertilizer',compostText:'Exclude unknown waste, plastics, painted wood, oils and contaminated material. Balance dry carbon-rich material with moist plant residues. Manage moisture and aeration and record temperature at several points. Do not use immature, hot or unstable compost. For food crops, assess contamination and salinity risks and whether testing is needed. This is introductory guidance, not a fixed recipe.',efficiency:'Productivity: track water and input use, inspect leaks and irrigation uniformity, reduce waste and compare only equivalent periods.',safety:'Safety: pesticides, fertilizers, sharp tools, pumps and machinery are for trained, authorized people only. Do not mix unknown materials or add fertilizer directly to storage ponds. Children must not handle composting equipment or machinery.',source:'This plan is farmer-entered and confirmed; it is not an expert-validated recommendation or an autonomous SARINA instruction.'}
};
const tr=(l,k)=>T[l]?.[k]||T.en[k]||k, esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
export function renderOperationsPanel(id,lang='fa'){
 const x=k=>tr(lang,k);
 return '<button type="button" class="quiet-btn operations-toggle" data-operations-toggle="'+esc(id)+'">📋 '+x('button')+'</button><section class="operations-panel hidden" id="operations-'+esc(id)+'"><p>'+x('intro')+'</p><form class="operations-form" data-farm-id="'+esc(id)+'">'+
 '<label>'+x('task')+'<input name="task_title" maxlength="160" required></label><label>'+x('date')+'<input name="work_date" type="date" required value="'+today()+'"></label>'+
 '<label>'+x('start')+'<input name="start_time" type="time" required></label><label>'+x('end')+'<input name="end_time" type="time" required></label>'+
 '<label>'+x('assignee')+'<input name="assignee_name" maxlength="120" placeholder="'+x('name')+'" required></label>'+
 '<label>'+x('role')+'<select name="assignee_role"><option value="farmer">'+x('farmer')+'</option><option value="supervisor">'+x('supervisor')+'</option><option value="worker">'+x('worker')+'</option><option value="trainee">'+x('trainee')+'</option></select></label>'+
 '<label>'+x('priority')+'<select name="priority"><option value="normal">'+x('normal')+'</option><option value="high">'+x('high')+'</option><option value="urgent">'+x('urgent')+'</option></select></label>'+
 '<label class="operations-wide">'+x('notes')+'<textarea name="instructions" maxlength="1600" rows="3"></textarea></label><button class="primary-btn operations-wide" type="submit">'+x('save')+'</button><p class="message operations-message operations-wide" role="status"></p></form>'+
 '<div data-operations-tasks="'+esc(id)+'"><h4>'+x('list')+'</h4><p>'+x('loading')+'</p></div><h4>'+x('learn')+'</h4><div class="learning-grid">'+
 '<article><b>👩‍🌾</b><p>'+x('farmerLearn')+'</p></article><article><b>🧑‍🌾</b><p>'+x('workerLearn')+'</p></article><article><b>🌱</b><p>'+x('youthLearn')+'</p></article>'+
 '<article class="learning-wide"><b>♻️ '+x('compost')+'</b><p>'+x('compostText')+'</p></article><article class="learning-wide"><p>'+x('efficiency')+'</p></article></div><p class="operations-safety">'+x('safety')+'</p><p class="operations-source">'+x('source')+'</p></section>';
}
export function bindFarmOperations({root,supabase,getProfile,getLanguage}){
 if(!root||root.dataset.opsBound)return;root.dataset.opsBound='1';
 const load=async farmId=>{
  const area=root.querySelector('[data-operations-tasks="'+CSS.escape(farmId)+'"]');if(!area)return;
  const l=k=>tr(getLanguage(),k);area.innerHTML='<p>'+l('loading')+'</p>';
  const {data,error}=await supabase.from('farm_observations').select('id,description').eq('farm_id',farmId).eq('observation_type','general').like('description',P+'%').order('observed_at',{ascending:false}).limit(40);
  if(error){area.textContent=l('failed');console.error(error);return}
  const tasks=(data||[]).map(row=>{try{return{id:row.id,...JSON.parse(row.description.slice(P.length))}}catch{return null}}).filter(Boolean).sort((a,b)=>(a.work_date+a.start_time).localeCompare(b.work_date+b.start_time));
  area.innerHTML='<h4>'+l('list')+'</h4>'+(tasks.length?tasks.map(t=>{
   const st=({planned:l('planned'),in_progress:l('progress'),completed:l('done'),blocked:l('blocked')})[t.status]||l('planned');
   const buttons=t.status==='completed'?'':'<div class="operations-actions"><button class="quiet-btn" data-op-status="in_progress" data-id="'+esc(t.id)+'" data-farm="'+esc(farmId)+'">'+l('startTask')+'</button><button class="quiet-btn" data-op-status="completed" data-id="'+esc(t.id)+'" data-farm="'+esc(farmId)+'">'+l('finish')+'</button><button class="quiet-btn" data-op-status="blocked" data-id="'+esc(t.id)+'" data-farm="'+esc(farmId)+'">'+l('block')+'</button></div>';
   return '<article class="operations-task"><b>'+esc(t.task_title)+'</b> · '+st+'<p>'+esc(t.work_date)+' · '+esc(t.start_time)+'–'+esc(t.end_time)+' · '+esc(t.assignee_name)+'</p>'+(t.instructions?'<p>'+esc(t.instructions)+'</p>':'')+buttons+'</article>'
  }).join(''):'<p>'+l('none')+'</p>');
 };
 root.addEventListener('click',async e=>{
  const toggle=e.target.closest('[data-operations-toggle]');if(toggle){const id=toggle.dataset.operationsToggle,p=root.querySelector('#operations-'+CSS.escape(id));p?.classList.toggle('hidden');if(p&&!p.classList.contains('hidden'))await load(id);return}
  const b=e.target.closest('[data-op-status]');if(!b)return;b.disabled=true;
  const {data:r,error:readErr}=await supabase.from('farm_observations').select('description').eq('id',b.dataset.id).eq('farm_id',b.dataset.farm).eq('observation_type','general').single();
  if(readErr||!r?.description?.startsWith(P)){b.disabled=false;console.error(readErr);return}
  let v;try{v=JSON.parse(r.description.slice(P.length))}catch{b.disabled=false;return}
  v.status=b.dataset.opStatus;v.status_updated_at=new Date().toISOString();
  const {error}=await supabase.from('farm_observations').update({description:P+JSON.stringify(v),observed_at:v.status_updated_at}).eq('id',b.dataset.id).eq('farm_id',b.dataset.farm);
  b.disabled=false;if(error)console.error(error);else await load(b.dataset.farm);
 });
 root.addEventListener('submit',async e=>{
  const f=e.target.closest('.operations-form');if(!f)return;e.preventDefault();
  const v=Object.fromEntries(new FormData(f).entries()),msg=f.querySelector('.operations-message'),btn=f.querySelector('button[type=submit]'),l=k=>tr(getLanguage(),k);
  if(!v.task_title?.trim()||!v.work_date||!v.start_time||!v.end_time||!v.assignee_name?.trim()){msg.textContent=l('failed');return}
  if(v.end_time<=v.start_time){msg.textContent=l('timeError');return}
  btn.disabled=true;const now=new Date().toISOString();
  const payload={schema:'SARINA_FARM_OPERATION_V1',...v,status:'planned',source_type:'farmer_entered',confidence:'user_confirmed_schedule_not_verified',created_at:now,created_by:getProfile()?.id||null};
  const {error}=await supabase.from('farm_observations').insert({farm_id:f.dataset.farmId,observation_type:'general',observed_at:now,description:P+JSON.stringify(payload),severity:'unknown',image_refs:[],reported_by:getProfile()?.id||null});
  btn.disabled=false;if(error){msg.textContent=l('failed');console.error(error);return}
  msg.textContent=l('saved');f.reset();f.querySelector('[name=work_date]').value=today();await load(f.dataset.farmId);
 });
}
