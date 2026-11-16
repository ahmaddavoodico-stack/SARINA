const P='SARINA_FARM_OPERATION_V1:';
const CROP='SARINA_CROP_LAYOUT_V1:';
const T={
 fa:{button:'برنامه هفتگی مزرعه',intro:'برنامه این هفته را با توجه به وضعیت محصول و کارهای ثبت‌شده مرور کنید. برنامه انعطاف‌پذیر است؛ کارهای غیرضروری را می‌توانید به هفته بعد منتقل کنید.',week:'برنامه این هفته',previous:'هفته قبل',next:'هفته بعد',crop:'محصولات و زمان برداشت',noCrops:'هنوز گروه کشتی ثبت نشده است. ابتدا محصول را در پرونده مزرعه ثبت کنید.',harvest:'برداشت پیش‌بینی‌شده',notSet:'زمان برداشت ثبت نشده',tasks:'کارهای برنامه‌ریزی‌شده',none:'برای این هفته کاری ثبت نشده است.',add:'افزودن کار',task:'عنوان کار',date:'تاریخ انجام',start:'ساعت شروع (اختیاری)',end:'ساعت پایان (اختیاری)',assignee:'مسئول (اختیاری)',priority:'اولویت',normal:'عادی',high:'مهم',urgent:'فوری',notes:'توضیح یا دلیل انتقال',save:'ثبت کار',planned:'برنامه‌ریزی‌شده',progress:'در حال انجام',done:'انجام‌شده',blocked:'دارای مانع',deferred:'منتقل‌شده به بعد',startTask:'شروع',finish:'اتمام',block:'ثبت مانع',defer:'انتقال',saved:'کار ثبت شد.',failed:'ذخیره انجام نشد؛ اتصال را بررسی کنید.',timeError:'اگر ساعت وارد می‌کنید، پایان باید بعد از شروع باشد.',progressLabel:'پیشرفت این هفته',remaining:'باقی‌مانده',flex:'زمانی برای کارهای شخصی و فوریت‌های پیش‌بینی‌نشده در نظر بگیرید. کارهای فوری و حساس به زمان را بدون ارزیابی به تعویق نیندازید.',review:'مرور هفتگی',reviewHint:'کارهای انجام‌نشده را بررسی کنید و در صورت نیاز تاریخ جدید بدهید.',reason:'دلیل یا یادداشت',learning:'یادگیری و ایمنی مزرعه',safety:'این فهرست، ثبت و پیگیری عملیات است؛ توصیه تخصصی خودکار نیست. برای تصمیم‌های حساس درباره آفت، بیماری، کود و سم، شرایط مزرعه و نظر متخصص را بررسی کنید.',farmerLearn:'کشاورز: وضعیت محصول، آب، خاک، هزینه‌ها و عملکرد را ثبت کنید.',workerLearn:'کارگر: روش اجرا، ابزار، کنترل کیفیت و نکات ایمنی را مرور کنید.',compost:'کمپوست و کود آلی',compostText:'مواد ناشناخته، پلاستیک، روغن و پسماند آلوده را وارد توده نکنید. رطوبت، هوادهی و دمای توده را کنترل کنید؛ کمپوست نارس یا آلوده را مصرف نکنید.'},
 en:{button:'Weekly farm plan',intro:'Review this week against recorded crops and tasks. The plan is flexible; non-urgent work can be moved to a later week.',week:'This week',previous:'Previous week',next:'Next week',crop:'Crops & harvest outlook',noCrops:'No crop groups recorded yet. Add crops to the farm profile first.',harvest:'Expected harvest',notSet:'Harvest timing not recorded',tasks:'Planned tasks',none:'No tasks recorded for this week.',add:'Add a task',task:'Task title',date:'Work date',start:'Start time (optional)',end:'End time (optional)',assignee:'Assignee (optional)',priority:'Priority',normal:'Normal',high:'Important',urgent:'Urgent',notes:'Instructions or reason for moving',save:'Save task',planned:'Planned',progress:'In progress',done:'Completed',blocked:'Blocked',deferred:'Deferred',startTask:'Start',finish:'Complete',block:'Mark blocked',defer:'Move later',saved:'Task saved.',failed:'Could not save. Check your connection.',timeError:'If times are entered, end must be after start.',progressLabel:'Weekly progress',remaining:'remaining',flex:'Leave room for personal commitments and unexpected urgent matters. Do not defer urgent or time-sensitive work without assessing the risk.',review:'Weekly review',reviewHint:'Review unfinished work and assign a new date when appropriate.',reason:'Reason or note',learning:'Farm learning & safety',safety:'This is an operations tracker, not an automated expert recommendation. For sensitive pest, disease, fertilizer or pesticide decisions, assess farm conditions and consult a qualified specialist.',farmerLearn:'Farmer: record crop condition, water, soil, costs and yield.',workerLearn:'Worker: review work methods, tools, quality checks and safety.',compost:'Compost and organic fertilizer',compostText:'Exclude unknown waste, plastics, oils and contaminated material. Monitor moisture, aeration and pile temperature; do not use immature or contaminated compost.'}
};
const tr=(l,k)=>T[l]?.[k]||T.en[k]||k, esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const dateKey=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parseDate=s=>{const [y,m,d]=String(s||'').split('-').map(Number);return y&&m&&d?new Date(y,m-1,d):null};
const weekStart=(d)=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-((x.getDay()+6)%7));return x};
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const today=()=>dateKey(new Date());
const fmt=(s,l)=>{const d=parseDate(s);return d?new Intl.DateTimeFormat(l==='fa'?'fa-IR':'en',{month:'short',day:'numeric'}).format(d):'—'};
export function renderOperationsPanel(id,lang='fa'){
 const x=k=>tr(lang,k),start=weekStart(new Date()),end=addDays(start,6);
 return '<button type="button" class="quiet-btn operations-toggle" data-operations-toggle="'+esc(id)+'">📋 '+x('button')+'</button><section class="operations-panel hidden" id="operations-'+esc(id)+'" data-week-offset="0"><p>'+x('intro')+'</p>'+
 '<div class="planner-week-nav"><button type="button" class="quiet-btn" data-week-shift="-1">‹ '+x('previous')+'</button><strong data-week-label>'+fmt(dateKey(start),lang)+' – '+fmt(dateKey(end),lang)+'</strong><button type="button" class="quiet-btn" data-week-shift="1">'+x('next')+' ›</button></div>'+
 '<section class="planner-crops"><h4>'+x('crop')+'</h4><div data-planner-crops><p>…</p></div></section>'+
 '<section class="planner-progress"><div class="planner-progress-head"><b>'+x('progressLabel')+'</b><span data-planner-progress-label>—</span></div><div class="planner-progress-track"><span data-planner-progress-bar></span></div><p>'+x('flex')+'</p></section>'+
 '<h4>'+x('tasks')+'</h4><div data-operations-tasks="'+esc(id)+'"><p>…</p></div>'+
 '<details class="planner-add"><summary>'+x('add')+'</summary><form class="operations-form" data-farm-id="'+esc(id)+'">'+
 '<label>'+x('task')+'<input name="task_title" maxlength="160" required></label><label>'+x('date')+'<input name="work_date" type="date" required value="'+today()+'"></label>'+
 '<label>'+x('start')+'<input name="start_time" type="time"></label><label>'+x('end')+'<input name="end_time" type="time"></label>'+
 '<label>'+x('assignee')+'<input name="assignee_name" maxlength="120"></label><label>'+x('priority')+'<select name="priority"><option value="normal">'+x('normal')+'</option><option value="high">'+x('high')+'</option><option value="urgent">'+x('urgent')+'</option></select></label>'+
 '<label class="operations-wide">'+x('notes')+'<textarea name="instructions" maxlength="1600" rows="2"></textarea></label><button class="primary-btn operations-wide" type="submit">'+x('save')+'</button><p class="message operations-message operations-wide" role="status"></p></form></details>'+
 '<h4>'+x('review')+'</h4><p class="planner-review-hint">'+x('reviewHint')+'</p><h4>'+x('learning')+'</h4><div class="learning-grid"><article><b>👩‍🌾</b><p>'+x('farmerLearn')+'</p></article><article><b>🧑‍🌾</b><p>'+x('workerLearn')+'</p></article><article class="learning-wide"><b>♻️ '+x('compost')+'</b><p>'+x('compostText')+'</p></article></div><p class="operations-safety">'+x('safety')+'</p></section>';
}
export function bindFarmOperations({root,supabase,getProfile,getLanguage}){
 if(!root||root.dataset.opsBound)return;root.dataset.opsBound='1';
 const state=new Map();
 const getState=id=>{if(!state.has(id))state.set(id,{offset:0,tasks:[],crops:[]});return state.get(id)};
 const fetchData=async farmId=>{
  const [ops,crops]=await Promise.all([
   supabase.from('farm_observations').select('id,description,observed_at').eq('farm_id',farmId).eq('observation_type','general').like('description',P+'%').order('observed_at',{ascending:false}).limit(100),
   supabase.from('farm_observations').select('id,description,observed_at').eq('farm_id',farmId).eq('observation_type','crop_layout').like('description',CROP+'%').order('observed_at',{ascending:false}).limit(100)
  ]);
  if(ops.error)throw ops.error;if(crops.error)throw crops.error;
  const parse=(rows,prefix)=> (rows||[]).map(row=>{try{return{id:row.id,...JSON.parse(row.description.slice(prefix.length))}}catch{return null}}).filter(Boolean);
  const st=getState(farmId);st.tasks=parse(ops.data,P);st.crops=parse(crops.data,CROP);return st;
 };
 const render=async farmId=>{
  const panel=root.querySelector('#operations-'+CSS.escape(farmId));if(!panel)return;
  const st=getState(farmId),l=k=>tr(getLanguage(),k),offset=st.offset,ws=addDays(weekStart(new Date()),offset*7),we=addDays(ws,6),from=dateKey(ws),to=dateKey(we);
  panel.querySelector('[data-week-label]').textContent=fmt(from,getLanguage())+' – '+fmt(to,getLanguage());
  const cropArea=panel.querySelector('[data-planner-crops]');
  cropArea.innerHTML=st.crops.length?st.crops.map(c=>{const a=c.answers||{};const name=a.plant_name||'—',harvest=a.expected_harvest_start||a.expected_harvest_date,end=a.expected_harvest_end;return '<article class="planner-crop-card"><b>'+esc(name)+(a.cultivar?' · '+esc(a.cultivar):'')+'</b><span>'+l('harvest')+': '+(harvest?esc(fmt(harvest,getLanguage())+(end?' – '+fmt(end,getLanguage()):'')):l('notSet'))+'</span></article>'}).join(''):'<p>'+l('noCrops')+'</p>';
  const weekTasks=st.tasks.filter(t=>t.work_date>=from&&t.work_date<=to).sort((a,b)=>(a.work_date||'').localeCompare(b.work_date||'')||(a.start_time||'').localeCompare(b.start_time||''));
  const completed=weekTasks.filter(t=>t.status==='completed').length,remaining=weekTasks.length-completed;
  panel.querySelector('[data-planner-progress-label]').textContent=completed+'/'+weekTasks.length+' · '+remaining+' '+l('remaining');
  panel.querySelector('[data-planner-progress-bar]').style.width=(weekTasks.length?completed/weekTasks.length*100:0)+'%';
  const area=panel.querySelector('[data-operations-tasks]');
  const statusLabel={planned:l('planned'),in_progress:l('progress'),completed:l('done'),blocked:l('blocked'),deferred:l('deferred')};
  area.innerHTML='<h4>'+l('tasks')+'</h4>'+(weekTasks.length?weekTasks.map(t=>{
   const stLabel=statusLabel[t.status]||l('planned'),when=fmt(t.work_date,getLanguage())+(t.start_time?' · '+esc(t.start_time)+(t.end_time?'–'+esc(t.end_time):''):'');
   const actions=t.status==='completed'?'':'<div class="operations-actions"><button class="quiet-btn" data-op-status="in_progress" data-id="'+esc(t.id)+'" data-farm="'+esc(farmId)+'">'+l('startTask')+'</button><button class="quiet-btn" data-op-status="completed" data-id="'+esc(t.id)+'" data-farm="'+esc(farmId)+'">'+l('finish')+'</button><button class="quiet-btn" data-op-status="blocked" data-id="'+esc(t.id)+'" data-farm="'+esc(farmId)+'">'+l('block')+'</button><button class="quiet-btn" data-op-status="deferred" data-id="'+esc(t.id)+'" data-farm="'+esc(farmId)+'">'+l('defer')+'</button></div>';
   return '<article class="operations-task"><div class="planner-task-head"><b>'+esc(t.task_title)+'</b><span class="planner-priority planner-priority-'+esc(t.priority||'normal')+'">'+esc(t.priority||'normal')+'</span></div><p>'+when+' · '+stLabel+(t.assignee_name?' · '+esc(t.assignee_name):'')+'</p>'+(t.instructions?'<p>'+esc(t.instructions)+'</p>':'')+actions+'</article>'
  }).join(''):'<p>'+l('none')+'</p>');
 };
 const refresh=async farmId=>{const l=k=>tr(getLanguage(),k);const panel=root.querySelector('#operations-'+CSS.escape(farmId));if(panel)panel.querySelector('[data-operations-tasks]').innerHTML='<p>…</p>';try{await fetchData(farmId);await render(farmId)}catch(error){console.error('Weekly planner load failed',error);if(panel)panel.querySelector('[data-operations-tasks]').textContent=l('failed')}};
 root.addEventListener('click',async e=>{
  const toggle=e.target.closest('[data-operations-toggle]');if(toggle){const id=toggle.dataset.operationsToggle,p=root.querySelector('#operations-'+CSS.escape(id));p?.classList.toggle('hidden');if(p&&!p.classList.contains('hidden'))await refresh(id);return}
  const shift=e.target.closest('[data-week-shift]');if(shift){const panel=shift.closest('.operations-panel'),id=panel?.id?.replace('operations-','');if(!id)return;getState(id).offset+=Number(shift.dataset.weekShift);await render(id);return}
  const b=e.target.closest('[data-op-status]');if(!b)return;b.disabled=true;
  const {data:r,error:readErr}=await supabase.from('farm_observations').select('description').eq('id',b.dataset.id).eq('farm_id',b.dataset.farm).eq('observation_type','general').single();
  if(readErr||!r?.description?.startsWith(P)){b.disabled=false;console.error(readErr);return}
  let v;try{v=JSON.parse(r.description.slice(P.length))}catch{b.disabled=false;return}
  v.status=b.dataset.opStatus;v.status_updated_at=new Date().toISOString();
  const {error}=await supabase.from('farm_observations').update({description:P+JSON.stringify(v),observed_at:v.status_updated_at}).eq('id',b.dataset.id).eq('farm_id',b.dataset.farm);
  b.disabled=false;if(error){console.error(error);return}await refresh(b.dataset.farm);
 });
 root.addEventListener('submit',async e=>{
  const f=e.target.closest('.operations-form');if(!f)return;e.preventDefault();
  const v=Object.fromEntries(new FormData(f).entries()),msg=f.querySelector('.operations-message'),btn=f.querySelector('button[type=submit]'),l=k=>tr(getLanguage(),k);
  if(!v.task_title?.trim()||!v.work_date){msg.textContent=l('failed');return}
  if(v.start_time&&v.end_time&&v.end_time<=v.start_time){msg.textContent=l('timeError');return}
  btn.disabled=true;const now=new Date().toISOString();
  const payload={schema:'SARINA_FARM_OPERATION_V2',...v,status:'planned',source_type:'farmer_entered',confidence:'user_confirmed_schedule_not_verified',created_at:now,created_by:getProfile()?.id||null};
  const {error}=await supabase.from('farm_observations').insert({farm_id:f.dataset.farmId,observation_type:'general',observed_at:now,description:P+JSON.stringify(payload),severity:'unknown',image_refs:[],reported_by:getProfile()?.id||null});
  btn.disabled=false;if(error){msg.textContent=l('failed');console.error(error);return}
  msg.textContent=l('saved');f.reset();f.querySelector('[name=work_date]').value=today();await refresh(f.dataset.farmId);
 });
}
