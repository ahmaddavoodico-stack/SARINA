import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { renderAdminWorkspace, bindAdminWorkspace } from './admin.js';
import { renderMarketplaceWorkspace, bindMarketplaceWorkspace } from './marketplace.js';
import { renderOperationsPanel, bindFarmOperations } from './operations.js';
import { renderExpertWorkspace, renderFarmerExpertButton, bindFarmerExpertRequests, bindExpertWorkspace, renderFarmerCasesSection, bindFarmerCases } from './experts.js';
import { renderFarmContracts, bindFarmContracts } from './contracts.js';


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
const cropWords = {
 fa:{cropButton:'ثبت گروه کشت و الگوی کاشت',unsure:'نمی‌دانم',cropIntro:'هر گروه از گیاهان مشابه را جداگانه ثبت کنید؛ مثلاً خرمای برحی یا موز. اگر مقداری را نمی‌دانید خالی بگذارید.',cropName:'نام درخت یا گیاه',cropNameHint:'مثلاً خرما، موز، مرکبات',cultivar:'رقم یا نوع محصول',cultivarHint:'مثلاً برحی، استعمران؛ اختیاری',treeCount:'تعداد درختان / گیاهان',age:'سن تقریبی (سال)',treeSpacing:'فاصله روی ردیف (متر)',rowSpacing:'فاصله بین ردیف‌ها (متر)',plantingPattern:'الگوی کاشت',regular:'منظم',irregular:'نامنظم',mixedPattern:'ترکیبی',plantPosition:'محل استقرار نسبت به جوی و پشته',ridgeTop:'بالای پشته',furrow:'داخل جوی',furrowEdge:'کنار جوی / لبه پشته',awayFromFurrow:'با فاصله از جوی',flatGround:'زمین مسطح / بدون جوی',furrowDistance:'فاصله از لبه جوی (متر)',furrowDistanceHint:'برای کنار جوی یا با فاصله از جوی؛ اختیاری',saveCrop:'ذخیره گروه کشت',cropSaved:'گروه کشت ثبت شد.',cropSaveError:'ثبت گروه کشت انجام نشد؛ دوباره تلاش کنید.',requiredCrop:'نام درخت و تعداد را وارد کنید.',rainfed:'دیم',irrigated:'آبی',mixedWater:'ترکیبی؛ بخشی دیم و بخشی آبی',waterRegime:'نوع کشت از نظر تأمین آب',irrigationType:'روش آبیاری این گروه کشت',notApplicable:'قابل اعمال نیست / دیم',floodIrrigation:'غرقابی',furrowIrrigation:'جوی و پشته',dripIrrigation:'قطره‌ای',sprinklerIrrigation:'بارانی',microSprinkler:'میکروجت / میکروبارانی',subsurfaceDrip:'قطره‌ای زیرسطحی',otherIrrigation:'سایر روش‌ها',irrigationEquipment:'تجهیزات آبیاری موجود',noEquipment:'بدون تجهیزات اختصاصی',pumpEquipment:'پمپ',filterEquipment:'فیلتر',dripLines:'لوله و نوار قطره‌ای',sprinklerHeads:'آبپاش / میکروجت',pipesValves:'لوله و شیرآلات',flowMeter:'دبی‌سنج / کنتور',equipmentOther:'سایر / ترکیبی',equipmentDetails:'توضیح تجهیزات (اختیاری)',yieldAmount:'مقدار تقریبی محصول در یک سال یا فصل',yieldValue:'مقدار برداشت',yieldUnit:'واحد مقدار محصول',kgUnit:'کیلوگرم',tonneUnit:'تن',crateUnit:'جعبه / سبد',pieceUnit:'عدد',yieldPeriod:'دوره مربوط به مقدار محصول',annual:'سالانه',perHarvest:'هر نوبت برداشت',seasonalYield:'کل فصل برداشت',quality:'کیفیت معمول محصول',qualityExcellent:'عالی / درجه یک',qualityGood:'خوب',qualityAverage:'متوسط',qualityLow:'ضعیف',qualityMixed:'متغیر / مخلوط',qualityUnknown:'ارزیابی نشده / نمی‌دانم',qualityDetails:'توضیح کیفیت (اختیاری)',productionIntro:'روش تأمین آب، تجهیزات، مقدار برداشت و کیفیت را برای همین گروه کشت ثبت کنید. مقادیر تولید تقریبی و خوداظهاری هستند.',productionSaved:'اطلاعات تولید و آبیاری ذخیره شد.',productionError:'ثبت اطلاعات تولید انجام نشد.',invalidYield:'مقدار محصول باید عددی و صفر یا بیشتر باشد.',},
 en:{cropButton:'Add crop group & planting layout',unsure:'I don’t know',cropIntro:'Record each group of similar plants separately, e.g. Barhi date palms or banana. Leave unknown measurements blank.',cropName:'Tree or plant name',cropNameHint:'e.g. date palm, banana, citrus',cultivar:'Cultivar / product type',cultivarHint:'e.g. Barhi, Sayer; optional',treeCount:'Number of trees / plants',age:'Approximate age (years)',treeSpacing:'Spacing within row (m)',rowSpacing:'Spacing between rows (m)',plantingPattern:'Planting pattern',regular:'Regular',irregular:'Irregular',mixedPattern:'Mixed',plantPosition:'Position relative to ridge and furrow',ridgeTop:'Top of ridge',furrow:'Inside furrow',furrowEdge:'Furrow edge / ridge side',awayFromFurrow:'Offset from furrow',flatGround:'Flat ground / no furrows',furrowDistance:'Distance from furrow edge (m)',furrowDistanceHint:'For furrow edge or offset positions; optional',saveCrop:'Save crop group',cropSaved:'Crop group saved.',cropSaveError:'Could not save crop group. Please try again.',requiredCrop:'Enter the plant name and count.',rainfed:'Rainfed',irrigated:'Irrigated',mixedWater:'Mixed: partly rainfed and irrigated',waterRegime:'Water supply / cultivation type',irrigationType:'Irrigation method for this crop group',notApplicable:'Not applicable / rainfed',floodIrrigation:'Flood irrigation',furrowIrrigation:'Furrow / ridge irrigation',dripIrrigation:'Drip irrigation',sprinklerIrrigation:'Sprinkler irrigation',microSprinkler:'Micro-sprinkler',subsurfaceDrip:'Subsurface drip',otherIrrigation:'Other methods',irrigationEquipment:'Available irrigation equipment',noEquipment:'No dedicated equipment',pumpEquipment:'Pump',filterEquipment:'Filter',dripLines:'Drip pipes / tapes',sprinklerHeads:'Sprinkler / micro-sprinkler heads',pipesValves:'Pipes and valves',flowMeter:'Flow meter',equipmentOther:'Other / mixed',equipmentDetails:'Equipment notes (optional)',yieldAmount:'Approximate production per year or season',yieldValue:'Harvest quantity',yieldUnit:'Production unit',kgUnit:'Kilograms',tonneUnit:'Tonnes',crateUnit:'Crates / baskets',pieceUnit:'Pieces',yieldPeriod:'Period covered by quantity',annual:'Annual',perHarvest:'Per harvest round',seasonalYield:'Whole harvest season',quality:'Typical product quality',qualityExcellent:'Excellent / premium',qualityGood:'Good',qualityAverage:'Average',qualityLow:'Low',qualityMixed:'Variable / mixed',qualityUnknown:'Not assessed / unknown',qualityDetails:'Quality notes (optional)',productionIntro:'Record water supply, irrigation equipment, harvest quantity and quality for this crop group. Production figures are approximate and farmer-reported.',productionSaved:'Production and irrigation details saved.',productionError:'Could not save production details.',invalidYield:'Production quantity must be a non-negative number.',}
};
function cw(key){return cropWords[language][key]||key;}
const pondWords={fa:{pondButton:'ثبت استخر و مخزن آب',pondIntro:'هر استخر یا مخزن را جداگانه ثبت کنید.',pondName:'نام یا شناسه استخر',pondType:'نوع سازه',earthen:'خاکی',concrete:'بتنی',geomembrane:'ژئوممبران',metal:'فلزی',fiberglass:'فایبرگلاس',natural:'طبیعی',other:'سایر',pondUse:'کاربری فعلی',irrigationStorage:'ذخیره آب آبیاری',livestock:'آب دام',aquaculture:'پرورش آبزیان',rainwater:'ذخیره باران',multiPurpose:'چندمنظوره',unused:'بدون استفاده',condition:'وضعیت استخر',active:'فعال',seasonal:'فصلی',damaged:'نیازمند تعمیر',waterSource:'منبع آب',canal:'کانال',river:'رودخانه',well:'چاه',rain:'باران',runoff:'رواناب',mixed:'چند منبع',availability:'دسترسی به آب',permanent:'دائمی',intermittent:'متناوب',unknown:'نمی‌دانم',length:'طول (متر)',width:'عرض (متر)',depth:'عمق متوسط (متر)',capacity:'ظرفیت (مترمکعب)',connection:'روش انتقال آب',gravity:'ثقلی',pump:'پمپاژ',both:'هر دو',none:'ندارد',fish:'وجود آبزی',yes:'بله',no:'خیر',waterTest:'آزمایش کیفیت آب',tested:'آزمایش شده',notTested:'آزمایش نشده',ec:'EC آب',ph:'pH آب',tds:'TDS آب',testedAt:'تاریخ آزمایش',fertigation:'تجهیزات کودآبیاری',noSetup:'ندارد',separateTank:'مخزن جداگانه',injector:'تزریق‌کننده',futureInterest:'کاربرد توسعه‌ای',irrigationReserve:'ذخیره آب آبیاری',fertigationEquipment:'تجهیزات کودآبیاری',aquaculturePotential:'پرورش آبزیان',waterEfficiency:'بهره‌وری آب',noPlan:'فعلاً ندارد',pondSafety:'آب استخر را بدون آزمایش مناسب فرض نکنید. کود را مستقیماً داخل استخر ذخیره آب نریزید؛ کودآبیاری به مخزن و تجهیزات مستقل نیاز دارد.',savePond:'ذخیره استخر',pondSaved:'اطلاعات استخر ثبت شد.',pondSaveError:'ثبت اطلاعات استخر انجام نشد.',requiredPond:'نام و نوع استخر را وارد کنید.'},en:{pondButton:'Add pond / reservoir',pondIntro:'Record each pond separately.',pondName:'Pond name or ID',pondType:'Structure type',earthen:'Earthen',concrete:'Concrete',geomembrane:'Geomembrane',metal:'Metal',fiberglass:'Fiberglass',natural:'Natural',other:'Other',pondUse:'Current use',irrigationStorage:'Irrigation storage',livestock:'Livestock water',aquaculture:'Aquaculture',rainwater:'Rainwater storage',multiPurpose:'Multiple uses',unused:'Unused',condition:'Condition',active:'Active',seasonal:'Seasonal',damaged:'Needs repair',waterSource:'Water source',canal:'Canal',river:'River',well:'Well',rain:'Rain',runoff:'Runoff',mixed:'Multiple sources',availability:'Availability',permanent:'Permanent',intermittent:'Intermittent',unknown:'I don’t know',length:'Length (m)',width:'Width (m)',depth:'Average depth (m)',capacity:'Capacity (m³)',connection:'Water transfer',gravity:'Gravity',pump:'Pumped',both:'Both',none:'None',fish:'Aquatic stock present',yes:'Yes',no:'No',waterTest:'Water-quality test',tested:'Tested',notTested:'Not tested',ec:'Water EC',ph:'Water pH',tds:'Water TDS',testedAt:'Last test date',fertigation:'Fertigation equipment',noSetup:'None',separateTank:'Separate mixing tank',injector:'Injector',futureInterest:'Future interest',irrigationReserve:'Irrigation reserve',fertigationEquipment:'Fertigation equipment',aquaculturePotential:'Aquaculture',waterEfficiency:'Water efficiency',noPlan:'No current plan',pondSafety:'Do not assume water is suitable without testing. Never add fertilizer directly to a storage pond; fertigation requires separate suitable equipment.',savePond:'Save pond',pondSaved:'Pond details saved.',pondSaveError:'Could not save pond details.',requiredPond:'Enter pond name and type.'}};
function pw(key){return pondWords[language][key]||key;}

const greenhouseWords={fa:{button:'ثبت گلخانه و سازه کشت',intro:'وجود گلخانه یا سازه کشت محافظت‌شده را ثبت کنید. هر سازه را جداگانه وارد کنید؛ حتی اگر کوچک و فقط برای تولید نشا باشد.',name:'نام یا شناسه گلخانه',status:'وضعیت',active:'فعال',seasonal:'فصلی',underConstruction:'در حال احداث',inactive:'غیرفعال',structure:'نوع سازه',plastic:'پلاستیکی',glass:'شیشه‌ای',polycarbonate:'پلی‌کربنات',tunnel:'تونل یا سازه کوچک',shade:'سایه‌بان / توری',other:'سایر',system:'سیستم کشت',soil:'کشت در خاک',substrate:'بستر کشت',hydroponic:'هیدروپونیک',aquaponic:'آکواپونیک',mixed:'ترکیبی',unknown:'نمی‌دانم',area:'مساحت تقریبی (مترمربع)',crop:'محصول یا کاربرد فعلی',nursery:'تولید نشا / تکثیر گیاه',purpose:'کاربرد',production:'تولید محصول',propagation:'تولید نشا و تکثیر',research:'آزمایش و پژوهش',multi:'چندمنظوره',save:'ذخیره اطلاعات گلخانه',saved:'اطلاعات گلخانه ثبت شد.',error:'ثبت اطلاعات گلخانه انجام نشد.',required:'نام گلخانه را وارد کنید.'},en:{button:'Add greenhouse / protected structure',intro:'Record each greenhouse or protected growing structure separately, including a small structure used only for seedlings.',name:'Greenhouse name or ID',status:'Status',active:'Active',seasonal:'Seasonal',underConstruction:'Under construction',inactive:'Inactive',structure:'Structure type',plastic:'Plastic',glass:'Glass',polycarbonate:'Polycarbonate',tunnel:'Tunnel / small structure',shade:'Shade net / structure',other:'Other',system:'Growing system',soil:'Soil',substrate:'Growing substrate',hydroponic:'Hydroponic',aquaponic:'Aquaponic',mixed:'Mixed',unknown:'I don’t know',area:'Approximate area (m²)',crop:'Current crop or use',nursery:'Seedling production / propagation',purpose:'Purpose',production:'Crop production',propagation:'Seedling production / propagation',research:'Trial / research',multi:'Multiple purposes',save:'Save greenhouse details',saved:'Greenhouse details saved.',error:'Could not save greenhouse details.',required:'Enter a greenhouse name.'}};
function gw(key){return greenhouseWords[language][key]||key;}
function renderGreenhouseForm(farmId){
 const select=(name,label,options)=>'<label><span>'+gw(label)+'</span><select name="'+name+'">'+options.map(([v,k])=>'<option value="'+v+'">'+gw(k)+'</option>').join('')+'</select></label>';
 return '<div class="greenhouse-form-head"><p>'+gw('intro')+'</p></div><form class="greenhouse-form" data-farm-id="'+farmId+'">'+
 '<label><span>'+gw('name')+'</span><input name="greenhouse_name" maxlength="120" required></label>'+
 select('status','status',[['unknown','unknown'],['active','active'],['seasonal','seasonal'],['under_construction','underConstruction'],['inactive','inactive']])+
 select('structure_type','structure',[['unknown','unknown'],['plastic','plastic'],['glass','glass'],['polycarbonate','polycarbonate'],['tunnel','tunnel'],['shade_net','shade'],['other','other']])+
 select('growing_system','system',[['unknown','unknown'],['soil','soil'],['substrate','substrate'],['hydroponic','hydroponic'],['aquaponic','aquaponic'],['mixed','mixed']])+
 select('purpose','purpose',[['unknown','unknown'],['production','production'],['seedling_propagation','propagation'],['research','research'],['multiple','multi']])+
 '<label><span>'+gw('area')+'</span><input name="area_m2" type="number" min="0" step="0.1"></label>'+
 '<label><span>'+gw('crop')+'</span><input name="crop_or_use" maxlength="200" placeholder="'+gw('nursery')+'"></label>'+
 '<button class="primary-btn greenhouse-save" type="submit">'+gw('save')+'</button><p class="message greenhouse-message" role="status"></p></form>';
}




const words = {
 fa:{signOut:'خروج',eyebrow:'همراه هوشمند فعالیت‌های شما',headline:'همه فعالیت‌ها، یک حساب در سارینا.',intro:'برای مدیریت فعالیت‌های کشاورزی، دامداری، تخصصی یا سازمانی خود وارد شوید. نوع فعالیت را پس از ورود انتخاب می‌کنید.',feature1:'مدیریت مزرعه',feature2:'ثبت ساده اطلاعات',feature3:'پشتیبانی هوشمند',login:'ورود',signup:'ساخت حساب',email:'ایمیل',fullName:'نام شما',password:'رمز عبور',privacy:'اطلاعات حساب و فعالیت‌های شما با دسترسی کنترل‌شده نگهداری می‌شود.',workspace:'فضای کاری من',hello:'سلام',dashboardIntro:'از اینجا به فضاهای کاری و اطلاعات فعالیت‌های خود دسترسی دارید.',addFarm:'＋ افزودن مزرعه',farmCount:'مزرعه‌های من',registered:'ثبت‌شده در سارینا',dataStatus:'وضعیت اطلاعات',starting:'در حال شروع',dataStatusHint:'با تکمیل اطلاعات دقیق‌تر می‌شود',nextStep:'گام بعدی',completeFarm:'تکمیل مزرعه',nextStepHint:'ثبت زمین و محصولات',myFarms:'مزرعه‌های من',myFarmsHint:'هر مزرعه فضای اطلاعاتی مستقل خود را دارد.',newFarm:'ثبت مزرعه جدید',farmFormHint:'فعلاً فقط اطلاعات ضروری را وارد کنید؛ جزئیات را بعداً می‌توانید تکمیل کنید.',farmName:'نام مزرعه',farmArea:'مساحت کل',unit:'واحد مساحت',hectare:'هکتار',acre:'ایکر',sqm:'متر مربع',saveFarm:'ذخیره مزرعه',footer:'پیچیدگی در هسته مرکزی؛ سادگی در تجربه کاربر.',emptyTitle:'هنوز مزرعه‌ای ثبت نکرده‌اید',emptyText:'اولین مزرعه را ثبت کنید تا فضای مدیریت آن ساخته شود.',farmCreated:'مزرعه با موفقیت ثبت شد.',confirmEmail:'حساب ساخته شد. برای فعال‌سازی، ایمیل خود را تأیید کنید و سپس وارد شوید.',profileMissing:'ساخت پروفایل کامل نشد. دوباره وارد شوید.',loading:'در حال بارگذاری…',loginError:'ورود انجام نشد. ایمیل و رمز عبور را بررسی کنید.',signupError:'ساخت حساب انجام نشد.',farmError:'ذخیره مزرعه انجام نشد.',weatherTitle:'وضعیت آب‌وهوا',weatherLoading:'دریافت داده‌های هواشناسی…',weatherUnavailable:'داده آب‌وهوا فعلاً در دسترس نیست.',weatherMissingLocation:'برای دریافت آب‌وهوا مختصات مزرعه را ثبت کنید.',weatherCurrent:'دمای فعلی',apparent:'دمای احساسی',humidity:'رطوبت',wind:'باد',forecast:'پیش‌بینی ۳ روز آینده',high:'بیشینه',low:'کمینه',weatherUpdated:'به‌روزرسانی',latitude:'عرض جغرافیایی',longitude:'طول جغرافیایی',coordHint:'مختصات را از نقشه یا GPS وارد کنید؛ هر دو مقدار لازم‌اند.',locationSaved:'مزرعه و موقعیت آن ثبت شد.',locationError:'مزرعه ثبت شد، اما ذخیره موقعیت انجام نشد.',coordsPairError:'برای ثبت موقعیت، هر دو مختصات را وارد کنید.',authRequired:'برای ادامه ابتدا وارد حساب شوید.'},
 en:{signOut:'Sign out',eyebrow:'Your intelligent activity companion',headline:'One SARINA account for all your work.',intro:'Sign in to manage agricultural, livestock, professional or organizational activities. Choose your workspace after signing in.',feature1:'Farm management',feature2:'Simple data entry',feature3:'Intelligent support',login:'Sign in',signup:'Create account',email:'Email',fullName:'Your name',password:'Password',privacy:'Your account and activity data are protected by access controls.',workspace:'My workspace',hello:'Hello',dashboardIntro:'Access your activity workspaces and records from here.',addFarm:'＋ Add farm',farmCount:'My farms',registered:'Registered in SARINA',dataStatus:'Data status',starting:'Getting started',dataStatusHint:'Improves as you add information',nextStep:'Next step',completeFarm:'Complete farm',nextStepHint:'Add fields and crops',myFarms:'My farms',myFarmsHint:'Each farm has its own separate information space.',newFarm:'Add a new farm',farmFormHint:'Start with essential details. You can complete the rest later.',farmName:'Farm name',farmArea:'Total area',unit:'Area unit',hectare:'Hectare',acre:'Acre',sqm:'Square metre',saveFarm:'Save farm',footer:'Complexity in the core; simplicity in the user experience.',emptyTitle:'No farms registered yet',emptyText:'Add your first farm to create its management workspace.',farmCreated:'Farm saved successfully.',confirmEmail:'Account created. Confirm your email, then sign in.',profileMissing:'Could not finish your profile. Please sign in again.',loading:'Loading…',loginError:'Sign-in failed. Check your email and password.',signupError:'Could not create account.',farmError:'Could not save the farm.',weatherTitle:'Local weather',weatherLoading:'Loading weather data…',weatherUnavailable:'Weather data is temporarily unavailable.',weatherMissingLocation:'Add farm coordinates to retrieve local weather.',weatherCurrent:'Current temperature',apparent:'Feels like',humidity:'Humidity',wind:'Wind',forecast:'3-day forecast',high:'High',low:'Low',weatherUpdated:'Updated',latitude:'Latitude',longitude:'Longitude',coordHint:'Enter coordinates from a map or GPS; both values are required.',locationSaved:'Farm and location saved.',locationError:'Farm saved, but its location could not be saved.',coordsPairError:'Enter both coordinates to save a location.',authRequired:'Please sign in to continue.'}
};
function t(key){return words[language][key]||key}

const roleLabels={fa:{farmer:'کشاورز',livestock_keeper:'دامدار',expert:'متخصص',organization:'شرکت / مؤسسه',chooseTitle:'فعالیت‌های خود را انتخاب کنید',chooseHint:'می‌توانید چند گزینه را هم‌زمان انتخاب کنید و هر زمان خواستید فعالیتی اضافه یا ویرایش کنید.',saveRoles:'ذخیره و ورود به فضای کاری',editRoles:'مدیریت فعالیت‌ها',rolesError:'ذخیره فعالیت‌ها انجام نشد؛ دوباره تلاش کنید.',selectOne:'حداقل یک فعالیت را انتخاب کنید.',livestockTitle:'فضای کاری دامداری',livestockText:'زیرساخت نقش دامدار ایجاد شده است. پرونده دام، گله، تولید و سلامت دام در گام‌های بعدی اضافه می‌شود.',orgTitle:'فضای کاری شرکت و مؤسسه',orgText:'نقش سازمانی ثبت شده است. پروفایل سازمان، اعضا و سطح دسترسی در مرحله بعد تکمیل می‌شود.',farmerTitle:'فضای کاری کشاورزی'},en:{farmer:'Farmer',livestock_keeper:'Livestock keeper',expert:'Expert',organization:'Company / Institution',chooseTitle:'Choose your activities',chooseHint:'You can select more than one and add or edit activities at any time.',saveRoles:'Save and continue',editRoles:'Manage activities',rolesError:'Could not save activities. Please try again.',selectOne:'Select at least one activity.',livestockTitle:'Livestock workspace',livestockText:'The livestock role foundation is in place. Animal, herd, production and health records will be added incrementally.',orgTitle:'Company and institution workspace',orgText:'Your organization role is saved. Organization profiles, members and access levels will be added later.',farmerTitle:'Agriculture workspace'}};
let currentRoleCodes=[];
let activeWorkspaceCode='';
function roleText(k){return roleLabels[language][k]||k;}
function renderRoleOnboarding(selected=currentRoleCodes){const items=['farmer','livestock_keeper','expert','organization'];$('roleOnboarding').innerHTML='<div class="role-card"><span class="eyebrow">SARINA</span><h2>'+roleText('chooseTitle')+'</h2><p>'+roleText('chooseHint')+'</p><div class="role-choice-grid">'+items.map(c=>'<label class="role-choice"><input type="checkbox" name="sarinaRole" value="'+c+'" '+(selected.includes(c)?'checked':'')+'><span class="role-choice-icon">'+({farmer:'🌱',livestock_keeper:'🐄',expert:'🧑‍🔬',organization:'🏢'}[c])+'</span><span><b>'+roleText(c)+'</b><small>'+({farmer:language==='fa'?'مدیریت زمین، کشت و محصول':'Farm, crops and production',livestock_keeper:language==='fa'?'مدیریت دام و گله':'Animals and herd management',expert:language==='fa'?'ارائه خدمات و مشاوره تخصصی':'Professional services and advice',organization:language==='fa'?'فعالیت شرکتی و سازمانی':'Company and institutional activity'}[c])+'</small></span></label>').join('')+'</div><button id="saveRolesButton" class="primary-btn" type="button">'+roleText('saveRoles')+'</button><p id="roleMessage" class="message" role="status"></p></div>';}
async function loadRoleCodes(){const {data,error}=await supabase.from('user_roles').select('roles(code)').eq('scope_type','global').is('scope_id',null);if(error)throw error;currentRoleCodes=[...new Set((data||[]).map(x=>x.roles?.code).filter(Boolean))].filter(c=>['admin','farmer','livestock_keeper','expert','organization'].includes(c));return currentRoleCodes;}
function setFarmerVisibility(v){['farmList','farmerCasesMount','farmSectionHead'].forEach(id=>$(id).classList.toggle('hidden',!v));document.querySelector('.stat-grid').classList.toggle('hidden',!v);$('addFarmTop').classList.toggle('hidden',!v);$('farmFormPanel').classList.add('hidden');}
function renderRoleNavigation(){$('roleNavigation').innerHTML='<div class="role-nav-list">'+currentRoleCodes.map(c=>'<button type="button" class="role-nav-btn '+(activeWorkspaceCode===c?'active':'')+'" data-role="'+c+'">'+({farmer:'🌱',livestock_keeper:'🐄',expert:'🧑‍🔬',organization:'🏢'}[c])+' '+roleText(c)+'</button>').join('')+'<button type="button" class="role-nav-btn '+(activeWorkspaceCode==='marketplace'?'active':'')+'" data-marketplace-nav>🛒 '+(language==='fa'?'بازارگاه':'Marketplace')+'</button></div><button type="button" id="editRolesButton" class="quiet-btn role-edit-btn">＋ '+roleText('editRoles')+'</button>'; }
async function activateWorkspace(c){if(!currentRoleCodes.includes(c))return;activeWorkspaceCode=c;$('marketplaceWorkspace').classList.add('hidden');$('roleNavigation').querySelectorAll('[data-role]').forEach(b=>b.classList.toggle('active',b.dataset.role===c));$('roleNavigation').querySelector('[data-marketplace-nav]')?.classList.remove('active');const farmer=c==='farmer',expert=c==='expert';setFarmerVisibility(farmer);$('expertWorkspace').classList.toggle('hidden',!expert);$('livestockWorkspace').innerHTML='<h2>'+roleText('livestockTitle')+'</h2><p>'+roleText('livestockText')+'</p>';$('organizationWorkspace').innerHTML='<h2>'+roleText('orgTitle')+'</h2><p>'+roleText('orgText')+'</p>';$('livestockWorkspace').classList.toggle('hidden',c!=='livestock_keeper');$('organizationWorkspace').classList.toggle('hidden',c!=='organization');$('expertWorkspaceToggle').classList.add('hidden');$('farmSectionHead').querySelector('h2').textContent=roleText('farmerTitle');if(farmer)await loadFarms();if(expert&&!$('expertWorkspace').dataset.ready){$('expertWorkspace').innerHTML=renderExpertWorkspace(language);bindExpertWorkspace({root:$('expertWorkspace'),supabase,profile,language});$('expertWorkspace').dataset.ready='1';}}
async function activateMarketplaceWorkspace(){activeWorkspaceCode='marketplace';setFarmerVisibility(false);$('expertWorkspace').classList.add('hidden');$('livestockWorkspace').classList.add('hidden');$('organizationWorkspace').classList.add('hidden');$('marketplaceWorkspace').classList.remove('hidden');$('expertWorkspaceToggle').classList.add('hidden');document.querySelector('.stat-grid').classList.add('hidden');$('addFarmTop').classList.add('hidden');$('roleNavigation').querySelectorAll('[data-role]').forEach(b=>b.classList.remove('active'));$('roleNavigation').querySelector('[data-marketplace-nav]')?.classList.add('active');if(!$('marketplaceWorkspace').dataset.marketReady){$('marketplaceWorkspace').innerHTML=renderMarketplaceWorkspace(language);bindMarketplaceWorkspace({root:$('marketplaceWorkspace'),supabase,getProfile:()=>profile,getLanguage:()=>language});$('marketplaceWorkspace').dataset.marketReady='1';}}
async function saveSelectedRoles(){const selected=[...document.querySelectorAll('input[name="sarinaRole"]:checked')].map(x=>x.value),msg=$('roleMessage');if(!selected.length){msg.textContent=roleText('selectOne');return;}const btn=$('saveRolesButton');btn.disabled=true;msg.textContent=t('loading');const {data,error}=await supabase.rpc('set_my_sarina_roles',{p_role_codes:selected});btn.disabled=false;if(error){console.error(error);msg.textContent=roleText('rolesError');return;}currentRoleCodes=(data||[]).map(x=>x.role_code).filter(c=>['farmer','livestock_keeper','expert','organization'].includes(c));$('roleOnboarding').classList.add('hidden');$('mainWorkspace').classList.remove('hidden');renderRoleNavigation();const first=['farmer','livestock_keeper','expert','organization'].find(c=>currentRoleCodes.includes(c));if(first)await activateWorkspace(first);}
async function openRoleEditor(){$('mainWorkspace').classList.add('hidden');$('roleOnboarding').classList.remove('hidden');renderRoleOnboarding(currentRoleCodes);}

function say(message, target='globalMessage'){const el=$(target);el.textContent=message; if(target==='globalMessage'){el.classList.add('show');setTimeout(()=>el.classList.remove('show'),3200)}}
function setLanguage(next){language=next;document.documentElement.lang=next;document.documentElement.dir=next==='fa'?'rtl':'ltr';$('langToggle').textContent=next==='fa'?'EN':'فا';document.querySelectorAll('[data-i18n]').forEach(el=>{const key=el.dataset.i18n;if(words[language][key])el.textContent=t(key)});renderAuthMode();if($('roleNavigation')?.children.length)renderRoleNavigation();if(activeWorkspaceCode==='marketplace'&&!$('marketplaceWorkspace').classList.contains('hidden')){$('marketplaceWorkspace').dataset.marketReady='';$('marketplaceWorkspace').innerHTML=renderMarketplaceWorkspace(language);bindMarketplaceWorkspace({root:$('marketplaceWorkspace'),supabase,getProfile:()=>profile,getLanguage:()=>language});$('marketplaceWorkspace').dataset.marketReady='1';}if(!$('roleOnboarding').classList.contains('hidden'))renderRoleOnboarding(currentRoleCodes);if(!$('adminWorkspace').classList.contains('hidden')){$('adminWorkspace').dataset.adminBound='';$('adminWorkspace').innerHTML=renderAdminWorkspace(language,profile);bindAdminWorkspace({root:$('adminWorkspace'),supabase,getProfile:()=>profile,getLanguage:()=>language});}}
function renderAuthMode(){const signup=mode==='signup';$('nameWrap').classList.toggle('hidden',!signup);$('fullName').required=signup;$('loginTab').classList.toggle('active',!signup);$('signupTab').classList.toggle('active',signup);$('authSubmit').textContent=t(signup?'signup':'login');$('password').autocomplete=signup?'new-password':'current-password'}
function showApp(){ $('authView').classList.add('hidden');$('appView').classList.remove('hidden');$('signOut').classList.remove('hidden');$('farmerName').textContent=profile?.full_name||profile?.email?.split('@')[0]||t('hello');}
function showAuth(){ $('authView').classList.remove('hidden');$('appView').classList.add('hidden');$('signOut').classList.add('hidden');$('adminWorkspace').classList.add('hidden');}
async function ensureProfile(user){
  const payload={auth_user_id:user.id,email:user.email||null,full_name:user.user_metadata?.full_name||user.email?.split('@')[0]||'SARINA User',preferred_language:language,account_status:'active'};
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
    return '<article class="farm-card" data-farm-card="'+f.id+'"><div class="farm-icon">🌿</div><h3>'+escapeHtml(f.farm_name)+'</h3><p>'+ (f.total_area?escapeHtml(String(f.total_area))+' '+escapeHtml(f.area_unit):'—') +' · '+escapeHtml(f.status)+'</p>'+weatherMarkup+'<button type="button" class="quiet-btn land-toggle" data-land-toggle="'+f.id+'">🌱 '+lw('landButton')+'</button><div class="land-panel hidden" id="land-'+f.id+'">'+renderLandForm(f.id)+'</div><button type="button" class="quiet-btn crop-toggle" data-crop-toggle="'+f.id+'">🌳 '+cw('cropButton')+'</button><div class="crop-panel hidden" id="crop-'+f.id+'">'+renderCropForm(f.id)+'</div><button type="button" class="quiet-btn pond-toggle" data-pond-toggle="'+f.id+'">💧 '+pw('pondButton')+'</button><div class="pond-panel hidden" id="pond-'+f.id+'">'+renderPondForm(f.id)+'</div><button type="button" class="quiet-btn greenhouse-toggle" data-greenhouse-toggle="'+f.id+'">🏡 '+gw('button')+'</button><div class="greenhouse-panel hidden" id="greenhouse-'+f.id+'">'+renderGreenhouseForm(f.id)+'</div>'+renderFarmerExpertButton(f.id,language)+renderFarmContracts(f.id,language)+renderOperationsPanel(f.id,language)+'</article>';
  }));
  $('farmList').innerHTML=cards.join('');
  if(!$('farmerCasesMount').dataset.ready){$('farmerCasesMount').innerHTML=renderFarmerCasesSection(language);bindFarmerCases({root:$('farmerCasesMount'),supabase,getProfile:()=>profile,language});$('farmerCasesMount').dataset.ready='1';}else{$('refreshFarmerCases')?.click();}
  bindFarmOperations({root:$('farmList'),supabase,getProfile:()=>profile,getLanguage:()=>language});
  bindFarmContracts({root:$('farmList'),supabase,getProfile:()=>profile,getLanguage:()=>language});
  if(!$('farmList').dataset.expertRequestsBound){bindFarmerExpertRequests({root:$('farmList'),supabase,getProfile:()=>profile,language});$('farmList').dataset.expertRequestsBound='1';}
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
function renderCropForm(farmId){
 const select=(name,label,options)=>'<label><span>'+cw(label)+'</span><select name="'+name+'">'+options.map(([v,k])=>'<option value="'+v+'">'+cw(k)+'</option>').join('')+'</select></label>';
 return '<div class="crop-form-head"><p>'+cw('cropIntro')+'</p></div><form class="crop-form" data-farm-id="'+farmId+'">'+
 '<label><span>'+cw('cropName')+'</span><input name="plant_name" maxlength="120" required placeholder="'+cw('cropNameHint')+'"></label>'+
 '<label><span>'+cw('cultivar')+'</span><input name="cultivar" maxlength="120" placeholder="'+cw('cultivarHint')+'"></label>'+
 '<label><span>'+cw('treeCount')+'</span><input name="plant_count" type="number" min="1" step="1" required></label>'+
 '<label><span>'+cw('age')+'</span><input name="age_years" type="number" min="0" max="200" step="0.5"></label>'+
 '<label><span>'+cw('treeSpacing')+'</span><input name="in_row_spacing_m" type="number" min="0" max="100" step="0.01"></label>'+
 '<label><span>'+cw('rowSpacing')+'</span><input name="between_row_spacing_m" type="number" min="0" max="100" step="0.01"></label>'+
 select('planting_pattern','plantingPattern',[['unknown','unsure'],['regular','regular'],['irregular','irregular'],['mixed','mixedPattern']])+ 
 select('plant_position','plantPosition',[['unknown','unsure'],['ridge_top','ridgeTop'],['inside_furrow','furrow'],['furrow_edge','furrowEdge'],['offset_from_furrow','awayFromFurrow'],['flat_ground','flatGround']])+ 
 '<label class="crop-distance"><span>'+cw('furrowDistance')+'</span><input name="furrow_distance_m" type="number" min="0" max="100" step="0.01" placeholder="0.5"></label><p class="crop-hint">'+cw('furrowDistanceHint')+'</p>'+
 '<div class="crop-production-section"><p class="crop-production-intro">'+cw('productionIntro')+'</p></div>'+
 select('water_regime','waterRegime',[['unknown','unsure'],['rainfed','rainfed'],['irrigated','irrigated'],['mixed','mixedWater']])+
 select('irrigation_method','irrigationType',[['unknown','unsure'],['not_applicable','notApplicable'],['flood','floodIrrigation'],['furrow','furrowIrrigation'],['drip','dripIrrigation'],['sprinkler','sprinklerIrrigation'],['micro_sprinkler','microSprinkler'],['subsurface_drip','subsurfaceDrip'],['other','otherIrrigation']])+
 select('irrigation_equipment','irrigationEquipment',[['unknown','unsure'],['none','noEquipment'],['pump','pumpEquipment'],['filter','filterEquipment'],['drip_lines','dripLines'],['sprinkler_heads','sprinklerHeads'],['pipes_valves','pipesValves'],['flow_meter','flowMeter'],['other_mixed','equipmentOther']])+
 '<label><span>'+cw('equipmentDetails')+'</span><input name="irrigation_equipment_details" maxlength="300"></label>'+
 '<label><span>'+cw('yieldValue')+'</span><input name="yield_amount" type="number" min="0" step="0.1"></label>'+
 select('yield_unit','yieldUnit',[['unknown','unsure'],['kg','kgUnit'],['tonne','tonneUnit'],['crate','crateUnit'],['piece','pieceUnit']])+
 select('yield_period','yieldPeriod',[['unknown','unsure'],['annual','annual'],['harvest_round','perHarvest'],['harvest_season','seasonalYield']])+
 select('product_quality','quality',[['unknown','qualityUnknown'],['excellent','qualityExcellent'],['good','qualityGood'],['average','qualityAverage'],['low','qualityLow'],['mixed','qualityMixed']])+
 '<label><span>'+cw('qualityDetails')+'</span><input name="quality_details" maxlength="500"></label>'+
 '<button class="primary-btn crop-save" type="submit">'+cw('saveCrop')+'</button><p class="message crop-message" role="status"></p></form>';
}
function renderPondForm(farmId){
 const select=(name,label,options)=>'<label><span>'+pw(label)+'</span><select name="'+name+'">'+options.map(([v,k])=>'<option value="'+v+'">'+pw(k)+'</option>').join('')+'</select></label>';
 return '<div class="pond-form-head"><p>'+pw('pondIntro')+'</p></div><form class="pond-form" data-farm-id="'+farmId+'">'+
 '<label><span>'+pw('pondName')+'</span><input name="pond_name" maxlength="120" required></label>'+
 select('pond_type','pondType',[['unknown','unknown'],['earthen','earthen'],['concrete','concrete'],['geomembrane','geomembrane'],['metal','metal'],['fiberglass','fiberglass'],['natural','natural'],['other','other']])+
 select('current_use','pondUse',[['unknown','unknown'],['irrigation_storage','irrigationStorage'],['livestock','livestock'],['aquaculture','aquaculture'],['rainwater','rainwater'],['multi_purpose','multiPurpose'],['unused','unused'],['other','other']])+
 select('condition','condition',[['unknown','unknown'],['active','active'],['seasonal','seasonal'],['damaged','damaged'],['unused','unused']])+
 select('water_source','waterSource',[['unknown','unknown'],['canal','canal'],['river','river'],['well','well'],['rainfall','rain'],['runoff','runoff'],['mixed','mixed'],['other','other']])+
 select('water_availability','availability',[['unknown','unknown'],['permanent','permanent'],['seasonal','seasonal'],['intermittent','intermittent']])+
 '<label><span>'+pw('length')+'</span><input name="length_m" type="number" min="0" step="0.1"></label>'+
 '<label><span>'+pw('width')+'</span><input name="width_m" type="number" min="0" step="0.1"></label>'+
 '<label><span>'+pw('depth')+'</span><input name="average_depth_m" type="number" min="0" step="0.1"></label>'+
 '<label><span>'+pw('capacity')+'</span><input name="capacity_m3" type="number" min="0" step="0.1"></label>'+
 select('farm_connection','connection',[['unknown','unknown'],['gravity','gravity'],['pump','pump'],['both','both'],['none','none']])+
 select('aquatic_stock_present','fish',[['unknown','unknown'],['yes','yes'],['no','no']])+
 select('water_test_status','waterTest',[['unknown','unknown'],['tested','tested'],['not_tested','notTested']])+
 '<label><span>'+pw('ec')+'</span><input name="water_ec_ds_m" type="number" min="0" step="0.01"></label>'+
 '<label><span>'+pw('ph')+'</span><input name="water_ph" type="number" min="0" max="14" step="0.1"></label>'+
 '<label><span>'+pw('tds')+'</span><input name="water_tds_mg_l" type="number" min="0" step="1"></label>'+
 '<label><span>'+pw('testedAt')+'</span><input name="water_tested_at" type="date"></label>'+
 select('fertigation_setup','fertigation',[['unknown','unknown'],['none','noSetup'],['separate_tank','separateTank'],['injector','injector']])+
 select('future_interest','futureInterest',[['unknown','unknown'],['irrigation_reserve','irrigationReserve'],['fertigation_equipment','fertigationEquipment'],['aquaculture_assessment','aquaculturePotential'],['water_efficiency','waterEfficiency'],['none','noPlan']])+
 '<p class="pond-safety">'+pw('pondSafety')+'</p>'+
 '<button class="primary-btn pond-save" type="submit">'+pw('savePond')+'</button><p class="message pond-message" role="status"></p></form>';
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
  return '<section class="weather-panel"><div class="weather-title">☀ '+t('weatherTitle')+'</div><div class="weather-current"><strong>'+number(c.temperature_c)+'°C</strong><span>'+t('weatherCurrent')+'</span></div><div class="weather-metrics"><span>'+t('apparent')+': '+number(c.apparent_temperature_c)+'°</span><span>'+t('humidity')+': '+number(c.relative_humidity_pct)+'%</span><span>'+t('wind')+': '+number(c.wind_speed_m_s)+' m/s</span></div><div class="weather-forecast-title">'+t('forecast')+'</div><div class="weather-days">'+days+'</div><small class="weather-source">Open-Meteo · '+t('weatherUpdated')+': '+escapeHtml(new Date(context.retrieved_at).toLocaleString(language==='fa'?'fa-IR':'en'))+' · '+(language==='fa'?'داده مدل هواشناسی، نه حسگر محلی':'Modelled weather, not a local sensor')+'</small></section>';
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function openFarmForm(){$('farmFormPanel').classList.remove('hidden');$('farmName').focus()}
function closeFarmForm(){$('farmFormPanel').classList.add('hidden');$('farmForm').reset();$('farmMessage').textContent=''}
async function enterWorkspace(user){try{$('expertWorkspace').innerHTML='';$('expertWorkspace').dataset.ready='';$('farmerCasesMount').dataset.ready='';$('farmerCasesMount').innerHTML='';$('expertWorkspace').classList.add('hidden');$('livestockWorkspace').classList.add('hidden');$('organizationWorkspace').classList.add('hidden');await ensureProfile(user);await loadRoleCodes();showApp();if(currentRoleCodes.includes('admin')){$('roleOnboarding').classList.add('hidden');$('mainWorkspace').classList.add('hidden');const adminRoot=$('adminWorkspace');adminRoot.classList.remove('hidden');adminRoot.innerHTML=renderAdminWorkspace(language,profile);bindAdminWorkspace({root:adminRoot,supabase,getProfile:()=>profile,getLanguage:()=>language});}else if(!currentRoleCodes.length){$('mainWorkspace').classList.add('hidden');$('roleOnboarding').classList.remove('hidden');renderRoleOnboarding([]);}else{$('roleOnboarding').classList.add('hidden');$('mainWorkspace').classList.remove('hidden');renderRoleNavigation();const first=['farmer','livestock_keeper','expert','organization'].find(c=>currentRoleCodes.includes(c));if(first)await activateWorkspace(first);}}catch(error){console.error(error);showAuth();say(t('profileMissing'),'authMessage')}}
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
$('roleOnboarding').addEventListener('click',e=>{if(e.target.closest('#saveRolesButton'))saveSelectedRoles()});
$('roleNavigation').addEventListener('click',e=>{const b=e.target.closest('[data-role]');if(b)activateWorkspace(b.dataset.role);if(e.target.closest('[data-marketplace-nav]'))activateMarketplaceWorkspace();if(e.target.closest('#editRolesButton'))openRoleEditor();});

$('expertWorkspaceToggle').addEventListener('click',()=>{
 const panel=$('expertWorkspace'),opening=panel.classList.contains('hidden');
 panel.classList.toggle('hidden',!opening);
 $('farmList').classList.toggle('hidden',opening);
 $('farmerCasesMount').classList.toggle('hidden',opening);
 $('farmSectionHead').classList.toggle('hidden',opening);
 document.querySelector('.stat-grid').classList.toggle('hidden',opening);
 $('farmFormPanel').classList.add('hidden');
 $('addFarmTop').classList.toggle('hidden',opening);
 $('expertWorkspaceToggle').textContent=opening?'← بازگشت به فضای کشاورز':'🧑‍🌾 پنل متخصصان';
 if(opening&&!panel.dataset.ready){
  panel.innerHTML=renderExpertWorkspace(language);
  bindExpertWorkspace({root:panel,supabase,profile,language});
  panel.dataset.ready='1';
 }
});

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
$('farmList').addEventListener('click',e=>{const toggle=e.target.closest('[data-land-toggle],[data-crop-toggle],[data-pond-toggle],[data-greenhouse-toggle]');if(!toggle)return;const farmId=toggle.dataset.landToggle||toggle.dataset.cropToggle||toggle.dataset.pondToggle||toggle.dataset.greenhouseToggle;const panel=$(toggle.hasAttribute('data-land-toggle')?'land-'+farmId:toggle.hasAttribute('data-crop-toggle')?'crop-'+farmId:toggle.hasAttribute('data-pond-toggle')?'pond-'+farmId:'greenhouse-'+farmId);panel?.classList.toggle('hidden');});
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
$('farmList').addEventListener('submit',async e=>{
 const form=e.target.closest('.crop-form');if(!form)return;e.preventDefault();
 const button=form.querySelector('button[type="submit"]');const message=form.querySelector('.crop-message');
 const values=Object.fromEntries(new FormData(form).entries());
 if(!values.plant_name?.trim()||!Number.isInteger(Number(values.plant_count))||Number(values.plant_count)<1){message.textContent=cw('requiredCrop');return;}
 const numericFields=['plant_count','age_years','in_row_spacing_m','between_row_spacing_m','furrow_distance_m','yield_amount'];
 for(const key of numericFields){if(values[key]===''){delete values[key];continue;}values[key]=Number(values[key]);if(!Number.isFinite(values[key])||values[key]<0){message.textContent=cw('requiredCrop');return;}}
 button.disabled=true;message.textContent=t('loading');
 const reportedAt=new Date().toISOString();
 const payload={schema:'SARINA_CROP_LAYOUT_V2',answers:values,source_type:'farmer_report',reported_at:reportedAt,confidence:'self_reported_not_verified',production_data_status:'farmer_estimate_not_verified'};
 const {error}=await supabase.from('farm_observations').insert({farm_id:form.dataset.farmId,observation_type:'crop_layout',observed_at:reportedAt,description:'SARINA_CROP_LAYOUT_V1:'+JSON.stringify(payload),severity:'unknown',image_refs:[],reported_by:profile?.id||null});
 button.disabled=false;if(error){console.error('Crop layout save failed',error);message.textContent=cw('cropSaveError');return;}
 const {data:landResult,error:landError}=await supabase.functions.invoke('farm-land-context',{body:{farm_id:form.dataset.farmId}});
 if(!landError&&landResult?.ok&&landResult.context?.farm?.id===form.dataset.farmId){farmLandContexts.set(form.dataset.farmId,landResult.context);message.textContent=cw('cropSaved');}
 else{console.warn('Farm context refresh after crop save failed',landError||landResult);message.textContent=cw('cropSaved')+' · '+(language==='fa'?'به‌روزرسانی پرونده نیازمند تلاش دوباره است':'Context refresh can be retried');}
});
$('signOut').addEventListener('click',async()=>{await supabase.auth.signOut();profile=null;showAuth()});
supabase.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){profile=null;showAuth()}});
const {data:{session}}=await supabase.auth.getSession();
if(session?.user)await enterWorkspace(session.user);else showAuth();
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
setLanguage('fa');

$('farmList').addEventListener('submit',async e=>{
 const form=e.target.closest('.greenhouse-form');if(!form)return;e.preventDefault();
 const button=form.querySelector('button[type="submit"]');const message=form.querySelector('.greenhouse-message');
 const values=Object.fromEntries(new FormData(form).entries());
 if(!values.greenhouse_name?.trim()){message.textContent=gw('required');return;}
 if(values.area_m2==='')delete values.area_m2;else{values.area_m2=Number(values.area_m2);if(!Number.isFinite(values.area_m2)||values.area_m2<0){message.textContent=gw('error');return;}}
 button.disabled=true;message.textContent=t('loading');
 const reportedAt=new Date().toISOString();
 const payload={schema:'SARINA_GREENHOUSE_ASSET_V1',answers:values,source_type:'farmer_report',reported_at:reportedAt,confidence:'self_reported_not_verified',specialist_analysis:'on_demand_only'};
 const {error}=await supabase.from('farm_observations').insert({farm_id:form.dataset.farmId,observation_type:'greenhouse_asset',observed_at:reportedAt,description:'SARINA_GREENHOUSE_ASSET_V1:'+JSON.stringify(payload),severity:'unknown',image_refs:[],reported_by:profile?.id||null});
 button.disabled=false;if(error){console.error('Greenhouse asset save failed',error);message.textContent=gw('error');return;}
 message.textContent=gw('saved');form.reset();
});
$('farmList').addEventListener('submit',async e=>{
 const form=e.target.closest('.pond-form');if(!form)return;e.preventDefault();
 const button=form.querySelector('button[type="submit"]');const message=form.querySelector('.pond-message');
 const values=Object.fromEntries(new FormData(form).entries());
 if(!values.pond_name?.trim()||!values.pond_type||values.pond_type==='unknown'){message.textContent=pw('requiredPond');return;}
 const numericFields=['length_m','width_m','average_depth_m','capacity_m3','water_ec_ds_m','water_ph','water_tds_mg_l'];
 for(const key of numericFields){if(values[key]===''){delete values[key];continue;}values[key]=Number(values[key]);if(!Number.isFinite(values[key])||values[key]<0||(key==='water_ph'&&values[key]>14)){message.textContent=pw('requiredPond');return;}}
 if(values.water_tested_at==='')delete values.water_tested_at;
 button.disabled=true;message.textContent=t('loading');
 const reportedAt=new Date().toISOString();
 const payload={schema:'SARINA_POND_ASSET_V1',answers:values,source_type:'farmer_report',reported_at:reportedAt,confidence:'self_reported_not_verified',safety:{water_suitability_not_assumed:true,fertilizer_direct_dosing_into_storage_pond_not_recommended:true}};
 const {error}=await supabase.from('farm_observations').insert({farm_id:form.dataset.farmId,observation_type:'pond_asset',observed_at:reportedAt,description:'SARINA_POND_ASSET_V1:'+JSON.stringify(payload),severity:'unknown',image_refs:[],reported_by:profile?.id||null});
 button.disabled=false;if(error){console.error('Pond asset save failed',error);message.textContent=pw('pondSaveError');return;}
 const {data:landResult,error:landError}=await supabase.functions.invoke('farm-land-context',{body:{farm_id:form.dataset.farmId}});
 if(!landError&&landResult?.ok&&landResult.context?.farm?.id===form.dataset.farmId){farmLandContexts.set(form.dataset.farmId,landResult.context);message.textContent=pw('pondSaved');}
 else{console.warn('Farm context refresh after pond save failed',landError||landResult);message.textContent=pw('pondSaved')+' · '+(language==='fa'?'به‌روزرسانی پرونده نیازمند تلاش دوباره است':'Context refresh can be retried');}
});
