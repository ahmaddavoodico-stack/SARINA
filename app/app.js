import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const SUPABASE_URL = 'https://wwgkiclcpgpdktneovrx.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_TZ8Gjb1daRR7GWmff1bOTg_z9r1DyKr';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const $ = (id) => document.getElementById(id);
let mode = 'login';
let profile = null;
let language = 'fa';

const words = {
 fa:{signOut:'خروج',eyebrow:'همراه هوشمند مزرعه شما',headline:'مزرعه‌تان را بهتر بشناسید.',intro:'اطلاعات مزرعه را یک‌بار ثبت کنید؛ سارینا کمک می‌کند وضعیت، فعالیت‌ها و تصمیم‌های کشاورزی را منظم و قابل پیگیری نگه دارید.',feature1:'مدیریت مزرعه',feature2:'ثبت ساده اطلاعات',feature3:'پشتیبانی هوشمند',login:'ورود',signup:'ساخت حساب',email:'ایمیل',fullName:'نام شما',password:'رمز عبور',privacy:'اطلاعات هر کشاورز فقط برای حساب خودش قابل دسترسی است.',workspace:'فضای کاری کشاورز',hello:'سلام',dashboardIntro:'مزرعه‌ها و اطلاعات کشاورزی خود را از اینجا مدیریت کنید.',addFarm:'＋ افزودن مزرعه',farmCount:'مزرعه‌های من',registered:'ثبت‌شده در سارینا',dataStatus:'وضعیت اطلاعات',starting:'در حال شروع',dataStatusHint:'با تکمیل اطلاعات دقیق‌تر می‌شود',nextStep:'گام بعدی',completeFarm:'تکمیل مزرعه',nextStepHint:'ثبت زمین و محصولات',myFarms:'مزرعه‌های من',myFarmsHint:'هر مزرعه فضای اطلاعاتی مستقل خود را دارد.',newFarm:'ثبت مزرعه جدید',farmFormHint:'فعلاً فقط اطلاعات ضروری را وارد کنید؛ جزئیات را بعداً می‌توانید تکمیل کنید.',farmName:'نام مزرعه',farmArea:'مساحت کل',unit:'واحد مساحت',hectare:'هکتار',acre:'ایکر',sqm:'متر مربع',saveFarm:'ذخیره مزرعه',footer:'پیچیدگی در هسته مرکزی؛ سادگی برای کشاورز.',emptyTitle:'هنوز مزرعه‌ای ثبت نکرده‌اید',emptyText:'اولین مزرعه را ثبت کنید تا فضای مدیریت آن ساخته شود.',farmCreated:'مزرعه با موفقیت ثبت شد.',confirmEmail:'حساب ساخته شد. برای فعال‌سازی، ایمیل خود را تأیید کنید و سپس وارد شوید.',profileMissing:'ساخت پروفایل کامل نشد. دوباره وارد شوید.',loading:'در حال بارگذاری…',loginError:'ورود انجام نشد. ایمیل و رمز عبور را بررسی کنید.',signupError:'ساخت حساب انجام نشد.',farmError:'ذخیره مزرعه انجام نشد.',authRequired:'برای ادامه ابتدا وارد حساب شوید.'},
 en:{signOut:'Sign out',eyebrow:'Your intelligent farm companion',headline:'Know your farm better.',intro:'Record your farm once. SARINA helps keep its condition, activities and agricultural decisions organized and traceable.',feature1:'Farm management',feature2:'Simple data entry',feature3:'Intelligent support',login:'Sign in',signup:'Create account',email:'Email',fullName:'Your name',password:'Password',privacy:'Each farmer can access only their own account data.',workspace:'Farmer workspace',hello:'Hello',dashboardIntro:'Manage your farms and agricultural records here.',addFarm:'＋ Add farm',farmCount:'My farms',registered:'Registered in SARINA',dataStatus:'Data status',starting:'Getting started',dataStatusHint:'Improves as you add information',nextStep:'Next step',completeFarm:'Complete farm',nextStepHint:'Add fields and crops',myFarms:'My farms',myFarmsHint:'Each farm has its own separate information space.',newFarm:'Add a new farm',farmFormHint:'Start with essential details. You can complete the rest later.',farmName:'Farm name',farmArea:'Total area',unit:'Area unit',hectare:'Hectare',acre:'Acre',sqm:'Square metre',saveFarm:'Save farm',footer:'Complexity in the core; simplicity for farmers.',emptyTitle:'No farms registered yet',emptyText:'Add your first farm to create its management workspace.',farmCreated:'Farm saved successfully.',confirmEmail:'Account created. Confirm your email, then sign in.',profileMissing:'Could not finish your profile. Please sign in again.',loading:'Loading…',loginError:'Sign-in failed. Check your email and password.',signupError:'Could not create account.',farmError:'Could not save the farm.',authRequired:'Please sign in to continue.'}
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
  $('farmList').innerHTML=data.map(f=>'<article class="farm-card"><div class="farm-icon">🌿</div><h3>'+escapeHtml(f.farm_name)+'</h3><p>'+ (f.total_area?escapeHtml(String(f.total_area))+' '+escapeHtml(f.area_unit):'—') +' · '+escapeHtml(f.status)+'</p></article>').join('');
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
$('langToggle').addEventListener('click',()=>setLanguage(language==='fa'?'en':'fa'));
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
 const area=$('farmArea').value;
 const payload={owner_user_id:profile.id,farm_name:$('farmName').value.trim(),area_unit:$('farmUnit').value};
 if(area!=='')payload.total_area=Number(area);
 const {error}=await supabase.from('farms').insert(payload);
 if(error){console.error(error);say(t('farmError'),'farmMessage');return}
 say(t('farmCreated'),'farmMessage');closeFarmForm();await loadFarms();
});
$('signOut').addEventListener('click',async()=>{await supabase.auth.signOut();profile=null;showAuth()});
supabase.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_IN'&&session?.user&&$('appView').classList.contains('hidden'))enterWorkspace(session.user);if(event==='SIGNED_OUT'){profile=null;showAuth()}});
const {data:{session}}=await supabase.auth.getSession();
if(session?.user)await enterWorkspace(session.user);else showAuth();
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
setLanguage('fa');
