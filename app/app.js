import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';


const SUPABASE_URL = 'https://wwgkiclcpgpdktneovrx.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_TZ8Gjb1daRR7GWmff1bOTg_z9r1DyKr';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const $ = (id) => document.getElementById(id);
let mode = 'login';
let profile = null;
let language = 'fa';
// Canonical, farm-specific weather payloads retained for the analysis orchestration layer.
const farmWeatherContexts = new Map();
const farmLandContexts = new Map();
const landWords = {
 fa:{landButton:'شناخت خاک و زمین',landIntro:'چند گزینه ساده انتخاب کنید؛ اگر نمی‌دانید، همان گزینه «نمی‌دانم» را بگذارید.',soilTexture:'خاک زمین بیشتر چه حالتی دارد؟',clayey:'چسبنده و رسی',sandy:'دانه‌دانه و شنی',loamy:'نرم و مخلوط',cracked:'سفت و ترک‌خورده',mixed:'ترکیبی',calcareous:'رسوب یا آهک سفید دیده می‌شود؟',yes:'بله',no:'خیر',unsure:'مطمئن نیستم',salinity:'نشانه‌ای از شوری می‌بینید؟',salinityNone:'خیر، نشانه‌ای ندیده‌ام',whiteCrust:'سفیدی روی خاک',leafBurn:'سوختگی یا زردی گیاه',some:'گاهی / کم',drainage:'بعد از آبیاری آب چه مدت روی زمین می‌ماند؟',fast:'زود خارج می‌شود',sameDay:'چند ساعت تا همان روز',nextDay:'تا روز بعد',longer:'بیشتر از یک روز',slope:'زمین چه شیبی دارد؟',flat:'تقریباً صاف',slight:'شیب کم',moderate:'شیب متوسط',steep:'شیب زیاد',waterSource:'آب آبیاری از کجا می‌آید؟',canal:'کانال یا نهر',river:'رودخانه',well:'چاه',dam:'سد یا مخزن',rainfed:'فقط باران',other:'منبع دیگر',irrigation:'روش آبیاری چیست؟',flood:'غرقابی',furrow:'جوی و پشته',drip:'قطره‌ای',sprinkler:'بارانی',saveLand:'ذخیره پاسخ‌ها',landSaved:'اطلاعات زمین ثبت شد.',landSaveError:'ذخیره اطلاعات انجام نشد؛ دوباره تلاش کنید.',farmerReported:'اظهار کشاورز · نه آزمایش خاک',unknown:'نمی‌دانم'},
 en:{landButton:'Soil & land profile',landIntro:'Choose a few simple options. If you are unsure, leave “I don’t know”.',soilTexture:'What does your soil feel like?',clayey:'Sticky and clayey',sandy:'Loose and sandy',loamy:'Soft and mixed',cracked:'Hard and cracked',mixed:'Mixed',calcareous:'Do you see white lime-like deposits?',yes:'Yes',no:'No',unsure:'Not sure',salinity:'Do you notice signs of salinity?',salinityNone:'No visible signs',whiteCrust:'White crust on soil',leafBurn:'Leaf burn or yellowing',some:'Sometimes / mild',drainage:'How long does water remain after irrigation?',fast:'Drains quickly',sameDay:'A few hours / same day',nextDay:'Until the next day',longer:'More than one day',slope:'How steep is the land?',flat:'Almost flat',slight:'Slight slope',moderate:'Moderate slope',steep:'Steep',waterSource:'Where does irrigation water come from?',canal:'Canal / ditch',river:'River',well:'Well',dam:'Reservoir',rainfed:'Rain only',other:'Other source',irrigation:'How do you irrigate?',flood:'Flood',furrow:'Furrow',drip:'Drip',sprinkler:'Sprinkler',saveLand:'Save answers',landSaved:'Land information saved.',landSaveError:'Could not save the information. Please try again.',farmerReported:'Farmer report · not a soil test',unknown:'I don’t know'}
};
function lw(key){return landWords[language][key]||key;}


const words = {
 fa:{signOut:'خروج',eyebrow:'همراه هوشمند مزرعه شما',headline:'مزرعه‌تان را بهتر بشناسید.',intro:'اطلاعات مزرعه را یک‌بار ثبت کنید؛ سارینا کمک می‌کند وضعیت، فعالیت‌ها و تصمیم‌های کشاورزی را منظم و قابل پیگیری نگه دارید.',feature1:'مدیریت مزرعه',feature2:'ثبت ساده اطلاعات',feature3:'پشتیبانی هوشمند',login:'ورود',signup:'ساخت حساب',email:'ایمیل',fullName:'نام شما',password:'رمز عبور',privacy:'اطلاعات هر کشاورز فقط برای حساب خودش قابل دسترسی است.',workspace:'فضای کاری کشاورز',hello:'سلام',dashboardIntro:'مزرعه‌ها و اطلاعات کشاورزی خود را از اینجا مدیریت کنید.',addFarm:'＋ افزودن مزرعه',farmCount:'مزرعه‌های من',registered:'ثبت‌شده در سارینا',dataStatus:'وضعیت اطلاعات',starting:'در حال شروع',dataStatusHint:'با تکمیل اطلاعات دقیق‌تر می‌شود',nextStep:'گام بعدی',completeFarm:'تکمیل مزرعه',nextStepHint:'ثبت زمین و محصولات',myFarms:'مزرعه‌های من',myFarmsHint:'هر مزرعه فضای اطلاعاتی مستقل خود را دارد.',newFarm:'ثبت مزرعه جدید',farmFormHint:'فعلاً فقط اطلاعات ضروری را وارد کنید؛ جزئیات را بعداً می‌توانید تکمیل کنید.',farmName:'نام مزرعه',farmArea:'مساحت کل',unit:'واحد مساحت',hectare:'هکتار',acre:'ایکر',sqm:'متر مربع',saveFarm:'ذخیره مزرعه',footer:'پیچیدگی در هسته مرکزی؛ سادگی برای کشاورز.',emptyTitle:'هنوز مزرعه‌ای ثبت نکرده‌اید',emptyText:'اولین مزرعه را ثبت کنید تا فضای مدیریت آن ساخته شود.',farmCreated:'مزرعه با موفقیت ثبت شد.',confirmEmail:'حساب ساخته شد. برای فعال‌سازی، ایمیل خود را تأیید کنید و سپس وارد شوید.',profileMissing:'ساخت پروفایل کامل نشد. دوباره وارد شوید.',loading:'در حال بارگذاری…',loginError:'ورود انجام نشد. ایمیل و رمز عبور را بررسی کنید.',signupError:'ساخت حساب انجام نشد.',farmError:'ذخیره مزرعه انجام نشد.',weatherTitle:'وضعیت آب‌وهوا',weatherLoading:'دریافت داده‌های هواشناسی…',weatherUnavailable:'داده آب‌وهوا فعلاً در دسترس نیست.',weatherMissingLocation:'برای دریافت آب‌وهوا مختصات مزرعه را ثبت کنید.',weatherCurrent:'دمای فعلی',apparent:'دمای احساسی',humidity:'رطوبت',wind:'باد',forecast:'پیش‌بینی ۳ روز آینده',high:'بیشینه',low:'کمینه',weatherUpdated:'به‌روزرسانی',latitude:'عرض جغرافیایی',longitude:'طول جغرافیایی',coordHint:'مختصات را از نقشه یا GPS وارد کنید؛ هر دو مقدار لازم‌اند.',locationSaved:'مزرعه و موقعیت آن ثبت شد.',locationError:'مزرعه ثبت شد، اما ذخیره موقعیت انجام نشد.',coordsPairError:'برای ثبت موقعیت، هر دو مختصات را وارد کنید.',authRequired:'برای ادامه ابتدا وارد حساب شوید.'},
 en:{signOut:'Sign out',eyebrow:'Your intelligent farm companion',headline:'Know your farm better.',intro:'Record your farm once. SARINA helps keep its condition, activities and agricultural decisions organized and traceable.',feature1:'Farm management',feature2:'Simple data entry',feature3:'Intelligent support',login:'Sign in',signup:'Create account',email:'Email',fullName:'Your name',password:'Password',privacy:'Each farmer can access only their own account data.',workspace:'Farmer workspace',hello:'Hello',dashboardIntro:'Manage your farms and agricultural records here.',addFarm:'＋ Add farm',farmCount:'My farms',registered:'Registered in SARINA',dataStatus:'Data status',starting:'Getting started',dataStatusHint:'Improves as you add information',nextStep:'Next step',completeFarm:'Complete farm',nextStepHint:'Add fields and crops',myFarms:'My farms',myFarmsHint:'Each farm has its own separate information space.',newFarm:'Add a new farm',farmFormHint:'Start with essential details. You can complete the rest later.',farmName:'Farm name',farmArea:'Total area',unit:'Area unit',hectare:'Hectare',acre:'Acre',sqm:'Square metre',saveFarm:'Save farm',footer:'Complexity in the core; simplicity for farmers.',emptyTitle:'No farms registered yet',emptyText:'Add your first farm to create its management workspace.',farmCreated:'Farm saved successfully.',confirmEmail:'Account created. Confirm your email, then sign in.',profileMissing:'Could not finish your profile. Please sign in again.',loading:'Loading…',loginError:'Sign-in failed. Check your email and password.',signupError:'Could not create account.',farmError:'Could not save the farm.',weatherTitle:'Local weather',weatherLoading:'Loading weather data…',weatherUnavailable:'Weather data is temporarily unavailable.',weatherMissingLocation:'Add farm coordinates to retrieve local weather.',weatherCurrent:'Current temperature',apparent:'Feels like',humidity:'Humidity',wind:'Wind',forecast:'3-day forecast',high:'High',low:'Low',weatherUpdated:'Updated',latitude:'Latitude',longitude:'Longitude',coordHint:'Enter coordinates from a map or GPS; both values are required.',locationSaved:'Farm and location saved.',locationError:'Farm saved, but its location could not be saved.',coordsPairError:'Enter both coordinates to save a location.',authRequired:'Please sign in to continue.'}
};
function t(key){return words[language][key]||key}
function say(message, target='globalMessage'){const el=$(target);el.textContent=message; if(target==='globalMessage'){el.classList.add('show');setTimeout(()=>el.classList.remove('show'),3200)}}
function setLanguage(next){language=next;document.documentElement.lang=next;document.documentElement.dir=next==='fa'?'rtl':'ltr';$('langToggle').textContent=next==='fa'?'EN':'فا';document.querySelectorAll('[data-i18n]').forEach(el=>{const key=el.dataset.i18n;if(words[language][key])el.textContent=t(key)});renderAuthMode()}
function renderAuthMode(){const signup=mode==='signup';$('nameWrap').classList.toggle('hidden',!signup);$('fullName').required=signup;$('loginTab').classList.toggle('active',!signup);$('signupTab').classList.toggle('active',signup);$('authSubmit').textContent=t(signup?'signup':'login');$('password').autocomplete=signup?'new-password':'current-password'}
function showApp(){ $('authView').classList.add('hidden');$('appView').classList.remove('hidden');$('signOut').classList.remove('hidden');$('farmerName').textContent=profile?.full_name||profile?.email?.split('@')[0]||t('hello');}
function showAuth(){ $('authView').classList.remove('hidden');$('appView').classList.add('hidden');$('signOut').classList.add('hidden');}
async function ensureProfile(user){
  const payload={auth_user_id:user.id,email:user.email||null,full_name:user.user_metadata?.full_name||user.email?.split('@')[0]||'Farmer',preferred_language:language,account_status:'active'};
  const {data,error}=await supabase.from('users').upsert(payload,{onConflict:'auth_user_id'}).select('id,email,full_name,preferred_language').single();
  if(error)throw error;profile=data;return data;
}
async function loadFarms(){
  $('farmList').innerHTML='<div class="empty-state">'+t('loading')+'</div>';
  const {data,error}=await supabase.from('farms').select('id,farm_name,total_area,area_unit,status,created_at').order('created_at',{ascending:false});
  if(error){say(error.message);return}
  $('farmCount').textContent=new Intl.NumberFormat(language==='fa'?'fa-IR':'en').format(data.length);
  if(!data.length){$('farmList').innerHTML='<div class="empty-state"><div class="farm-icon" style="margin:0 auto">🌱</div><strong>'+t('emptyTitle')+'</strong><p>'+t('emptyText')+'</p><button class="primary-btn" id="emptyAdd">'+t('addFarm')+'</button></div>';$('emptyAdd').addEventListener('click',openFarmForm);return}
  const {data:locations}=await supabase.from('farm_locations').select('farm_id,latitude,longitude,is_primary').in('farm_id',data.map(f=>f.id)).eq('is_primary',true);
  const locationByFarm=new Map((locations||[]).map(x=>[x.farm_id,x]));
  const cards=await Promise.all(data.map(async f=>{
    const loc=locationByFarm.get(f.id);
    let weatherMarkup='';
    if(loc?.latitude!=null&&loc?.longitude!=null){
      try{
        const {data:context,error:weatherError}=await supabase.functions.invoke('farm-weather-context',{body:{farm_id:f.id}});
        if(weatherError)throw weatherError;
        if(!context?.current||context.farm_id!==f.id)throw new Error('Invalid farm weather context');
        farmWeatherContexts.set(f.id,context);
        weatherMarkup=renderWeather(context);
      }catch(error){console.warn('Farm weather unavailable',f.id,error);weatherMarkup='<div class="weather-note">'+t('weatherUnavailable')+'</div>'}
    }else { farmWeatherContexts.delete(f.id); weatherMarkup='<div class="weather-note">'+t('weatherMissingLocation')+'</div>'; }
    return '<article class="farm-card" data-farm-card="'+f.id+'"><div class="farm-icon">🌿</div><h3>'+escapeHtml(f.farm_name)+'</h3><p>'+ (f.total_area?escapeHtml(String(f.total_area))+' '+escapeHtml(f.area_unit):'—') +' · '+escapeHtml(f.status)+'</p>'+weatherMarkup+'<button type="button" class="quiet-btn land-toggle" data-land-toggle="'+f.id+'">🌱 '+lw('landButton')+'</button><div class="land-panel hidden" id="land-'+f.id+'">'+renderLandForm(f.id)+'</div></article>';
  }));
  $('farmList').innerHTML=cards.join('');
}
function landOption(value,label,selected='unknown'){return '<option value="'+value+'"'+(value===selected?' selected':'')+'>'+lw(label)+'</option>';}
function renderLandForm(farmId){
 const select=(name,label,options)=>'<label><span>'+lw(label)+'</span><select name="'+name+'">'+options.map(([v,k])=>landOption(v,k)).join('')+'</select></label>';
 return '<div class="land-form-head"><p>'+lw('landIntro')+'</p><small>📝 '+lw('farmerReported')+'</small></div><form class="land-form" data-farm-id="'+farmId+'">'+
 select('soil_texture','soilTexture',[['unknown','unknown'],['clayey','clayey'],['sandy','sandy'],['loamy','loamy'],['cracked_hard','cracked'],['mixed','mixed']])+ 
 select('calcareous_signs','calcareous',[['unknown','unknown'],['yes','yes'],['no','no']])+ 
 select('salinity_signs','salinity',[['unknown','unknown'],['none','salinityNone'],['white_crust','whiteCrust'],['leaf_burn','leafBurn'],['some','some']])+ 
 select('water_retention','drainage',[['unknown','unknown'],['drains_fast','fast'],['same_day','sameDay'],['next_day','nextDay'],['more_than_day','longer']])+ 
 select('slope','slope',[['unknown','unknown'],['flat','flat'],['slight','slight'],['moderate','moderate'],['steep','steep']])+ 
 select('water_source','waterSource',[['unknown','unknown'],['canal','canal'],['river','river'],['well','well'],['dam','dam'],['rainfed','rainfed'],['other','other']])+ 
 select('irrigation_method','irrigation',[['unknown','unknown'],['flood','flood'],['furrow','furrow'],['drip','drip'],['sprinkler','sprinkler'],['rainfed','rainfed'],['other','other']])+ 
 '<button class="primary-btn land-save" type="submit">'+lw('saveLand')+'</button><p class="message land-message" role="status"></p></form>';
}
function renderSoilGridResult(context){
 const regional=context?.regional_context?.soilgrids||{};const status=regional.status||'not_requested';
 const fa=status==='available'?'داده SoilGrids دریافت شد':status==='waiting_for_confirmed_coordinates'?'برای دریافت داده، موقعیت مزرعه لازم است':status==='provider_unavailable'?'سرویس SoilGrids فعلاً پاسخ‌گو نیست':'داده SoilGrids هنوز دریافت نشده';
 const en=status==='available'?'SoilGrids data received':status==='waiting_for_confirmed_coordinates'?'A farm location is required':'SoilGrids is temporarily unavailable';
 const label=language==='fa'?fa:en;
 const note=language==='fa'?'مدل منطقه‌ای با تفکیک مکانی حدود ۲۵۰ متر؛ نتیجه آزمایش خاک مزرعه نیست.':'Regional model at about 250 m resolution; not a farm soil test.';
 return '<section class="soilgrid-result"><strong>🌍 ISRIC SoilGrids 2.0</strong><p>'+escapeHtml(label)+'</p><small>'+escapeHtml(note)+'</small><small class="soilgrid-meta">'+escapeHtml(String(regional.access_method||'REST API v2.0 experimental adapter'))+' · '+escapeHtml(String(regional.license||'CC BY 4.0'))+'</small></section>';
}
function renderWeather(context){
  const c=context.current,d=context.forecast.slice(0,3);
  const number=(v)=>v==null?'—':new Intl.NumberFormat(language==='fa'?'fa-IR':'en',{maximumFractionDigits:1}).format(v);
  const days=d.map(day=>'<div class="weather-day"><b>'+escapeHtml(day.date)+'</b><span>'+t('high')+' '+number(day.max_c)+'°</span><span>'+t('low')+' '+number(day.min_c)+'°</span></div>').join('');
  return '<section class="weather-panel"><div class="weather-title">☀ '+t('weatherTitle')+'</div><div class="weather-current"><strong>'+number(c.temperature_c)+'°C</strong><span>'+t('weatherCurrent')+'</span></div><div class="weather-metrics"><span>'+t('apparent')+': '+number(c.apparent_temperature_c)+'°</span><span>'+t('humidity')+': '+number(c.relative_humidity_pct)+'%</span><span>'+t('wind')+': '+number(c.wind_speed_m_s)+' m/s</span></div><div class="weather-forecast-title">'+t('forecast')+'</div><div class="weather-days">'+days+'</div><small class="weather-source">Open-Meteo · '+t('weatherUpdated')+': '+escapeHtml(new Date(context.retrieved_at).toLocaleString(language==='fa'?'fa-IR':'en'))+' · '+(language==='fa'?'داده مدل هواشناسی، نه حسگر محلی':'Modelled weather, not a local sensor')</small></section>';
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function openFarmForm(){$('farmFormPanel').classList.remove('hidden');$('farmName').focus()}
function closeFarmForm(){$('farmFormPanel').classList.add('hidden');$('farmForm').reset();$('farmMessage').textContent=''}
async function enterWorkspace(user){
  try{await ensureProfile(user);showApp();await loadFarms()}
  catch(error){console.error(error);showAuth();say(t('profileMissing'),'authMessage')}
}
$('loginTab').addEventListener('click',()=>{mode='login';renderAuthMode()});
$('signupTab').addEventListener('click',()=>{mode='signup';renderAuthMode()});
$('langToggle').addEventListener('click',()=>{setLanguage(language==='fa'?'en':'fa');if(profile&&!$('appView').classList.contains('hidden'))loadFarms()});
$('authForm').addEventListener('submit',async e=>{
 e.preventDefault();$('authSubmit').disabled=true;$('authMessage').textContent=t('loading');
 const email=$('email').value.trim();const password=$('password').value;
 try{
  if(mode==='signup'){
   const {data,error}=await supabase.auth.signUp({email,password,options:{data:{full_name:$('fullName').value.trim()}}});
   if(error)throw error;
   if(!data.session){$('authMessage').textContent=t('confirmEmail');return}
   await enterWorkspace(data.user);
  }else{
   const {data,error}=await supabase.auth.signInWithPassword({email,password});
   if(error)throw error;await enterWorkspace(data.user);
  }
 }catch(error){console.error(error);$('authMessage').textContent=t(mode==='signup'?'signupError':'loginError')}
 finally{$('authSubmit').disabled=false}
});
$('addFarmTop').addEventListener('click',openFarmForm);
$('closeFarmForm').addEventListener('click',closeFarmForm);
$('farmForm').addEventListener('submit',async e=>{
 e.preventDefault();if(!profile){say(t('authRequired'),'farmMessage');return}
 const latRaw=$('farmLatitude').value.trim(),lonRaw=$('farmLongitude').value.trim();
 if(Boolean(latRaw)!==Boolean(lonRaw)){say(t('coordsPairError'),'farmMessage');return}
 const latitude=latRaw===''?null:Number(latRaw),longitude=lonRaw===''?null:Number(lonRaw);
 if(latitude!==null&&(!Number.isFinite(latitude)||latitude < -90||latitude > 90)){say('Latitude must be between -90 and 90.','farmMessage');return}
 if(longitude!==null&&(!Number.isFinite(longitude)||longitude < -180||longitude > 180)){say('Longitude must be between -180 and 180.','farmMessage');return}
 const area=$('farmArea').value;
 const payload={owner_user_id:profile.id,farm_name:$('farmName').value.trim(),area_unit:$('farmUnit').value};
 if(area!=='')payload.total_area=Number(area);
 const {data:created,error}=await supabase.from('farms').insert(payload).select('id').single();
 if(error){console.error(error);say(t('farmError'),'farmMessage');return}
 if(latitude!==null){
   const {error:locationError}=await supabase.from('farm_locations').insert({farm_id:created.id,latitude,longitude,location_source:'user_pin',is_primary:true,confirmed_by_user:true,captured_at:new Date().toISOString()});
   if(locationError){console.error(locationError);say(t('locationError'),'farmMessage');closeFarmForm();await loadFarms();return}
 }
 say(latitude===null?t('farmCreated'):t('locationSaved'),'farmMessage');closeFarmForm();await loadFarms();
});
$('farmList').addEventListener('click',e=>{const toggle=e.target.closest('[data-land-toggle]');if(!toggle)return;const panel=$('land-'+toggle.dataset.landToggle);panel?.classList.toggle('hidden');});
$('farmList').addEventListener('submit',async e=>{
 const form=e.target.closest('.land-form');if(!form)return;e.preventDefault();
 const button=form.querySelector('button[type="submit"]');const message=form.querySelector('.land-message');button.disabled=true;message.textContent=t('loading');
 const answers=Object.fromEntries(new FormData(form).entries());
 const payload={schema:'SARINA_FARM_PROFILE_V1',answers,source_type:'farmer_report',reported_at:new Date().toISOString(),confidence:'self_reported_not_verified'};
 const {error}=await supabase.from('farm_observations').insert({farm_id:form.dataset.farmId,observation_type:'soil_condition',observed_at:payload.reported_at,description:'SARINA_FARM_PROFILE_V1:'+JSON.stringify(payload),severity:'unknown',image_refs:[],reported_by:profile?.id||null});
 button.disabled=false;if(error){message.textContent=lw('landSaveError');console.error('Farm profile save failed',error);return;}
 const {data:landResult,error:landError}=await supabase.functions.invoke('farm-land-context',{body:{farm_id:form.dataset.farmId}});
 if(!landError&&landResult?.ok&&landResult.context?.farm?.id===form.dataset.farmId){farmLandContexts.set(form.dataset.farmId,landResult.context);message.textContent=lw('landSaved');form.insertAdjacentHTML('beforeend',renderSoilGridResult(landResult.context));}
 else{console.warn('Farm land context refresh failed',landError||landResult);message.textContent=lw('landSaved')+' · '+(language==='fa'?'بازیابی پرونده نیازمند تلاش دوباره است':'Profile refresh can be retried');}
});
$('signOut').addEventListener('click',async()=>{await supabase.auth.signOut();profile=null;showAuth()});
supabase.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){profile=null;showAuth()}});
const {data:{session}}=await supabase.auth.getSession();
if(session?.user)await enterWorkspace(session.user);else showAuth();
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
setLanguage('fa');
