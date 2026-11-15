const copy = {
 fa: {
  title: "ثبت سازمان و نهاد پشتیبان", intro: "شرکت، مؤسسه، تعاونی، انجمن یا مجموعه پشتیبان کشاورزی خود را معرفی کنید. درخواست ابتدا بررسی می‌شود و تا پیش از تأیید، پروفایل عمومی یا دسترسی سازمانی فعال نخواهد شد.",
  identity: "مشخصات سازمان", legal: "نام رسمی / ثبتی", display: "نام نمایشی", type: "نوع مجموعه", reg: "شناسه یا شماره ثبت (اختیاری)",
  country: "کشور", city: "شهر / استان", address: "نشانی", contact: "راه ارتباطی سازمان", email: "ایمیل کاری", phone: "تلفن تماس",
  website: "وب‌سایت", description: "معرفی کوتاه و مأموریت سازمان", support: "حوزه‌های پشتیبانی و خدمات", regions: "مناطق تحت پوشش (با ویرگول جدا کنید)",
  submit: "ارسال درخواست بررسی", loading: "در حال بارگذاری…", submitting: "در حال ارسال…", saved: "درخواست ثبت شد و در انتظار بررسی است.",
  error: "ثبت درخواست انجام نشد. لطفاً دوباره تلاش کنید.", contactRequired: "حداقل یک راه ارتباطی، ایمیل یا تلفن، وارد کنید.",
  applications: "درخواست‌های من", noApplications: "هنوز درخواستی ثبت نکرده‌اید.", pending: "در انتظار بررسی", under_review: "در حال بررسی",
  approved: "تأیید شده", rejected: "نیازمند اصلاح / رد شده", withdrawn: "پس‌گرفته‌شده",
  reviewNote: "پس از بررسی مدارک و اطلاعات، نتیجه در همین بخش نمایش داده می‌شود.",
  types: {government:"نهاد دولتی",company:"شرکت",cooperative:"تعاونی",laboratory:"آزمایشگاه",bank:"بانک / تأمین مالی",insurer:"بیمه‌گر",research:"مؤسسه پژوهشی",university:"دانشگاه",ngo:"سازمان مردم‌نهاد",support_association:"انجمن حمایتی کشاورزی",professional_association:"انجمن صنفی / تخصصی",foundation:"بنیاد",charity:"خیریه",supplier:"تأمین‌کننده نهاده و تجهیزات",buyer:"خریدار محصولات",other:"سایر"},
  areas: {technical_advice:"مشاوره فنی و ترویج",training:"آموزش و توانمندسازی",finance:"تسهیلات و تأمین مالی",insurance:"بیمه و مدیریت ریسک",inputs:"نهاده و تجهیزات",machinery:"ماشین‌آلات و خدمات مکانیزه",water:"آب، آبیاری و زیرساخت",testing:"آزمایش خاک، آب و محصول",research:"پژوهش و نوآوری",market:"بازاریابی و دسترسی به بازار",grants:"کمک‌هزینه و حمایت مالی",community:"تشکل‌یابی و حمایت اجتماعی"}
 },
 en: {
  title: "Register an institution or support organization", intro: "Introduce your company, institution, cooperative, association or agricultural support organization. Applications are reviewed before any public listing or organization access is activated.",
  identity: "Organization details", legal: "Registered legal name", display: "Display name", type: "Organization type", reg: "Registration number (optional)",
  country: "Country", city: "City / region", address: "Address", contact: "Organization contact", email: "Work email", phone: "Phone",
  website: "Website", description: "Short description and mission", support: "Support and service areas", regions: "Service regions (comma-separated)",
  submit: "Submit for review", loading: "Loading…", submitting: "Submitting…", saved: "Application submitted and awaiting review.",
  error: "Could not submit the application. Please try again.", contactRequired: "Enter at least one contact method: email or phone.",
  applications: "My applications", noApplications: "You have not submitted an application yet.", pending: "Pending review", under_review: "Under review",
  approved: "Approved", rejected: "Needs revision / rejected", withdrawn: "Withdrawn",
  reviewNote: "The review result will appear here after the information is checked.",
  types: {government:"Government agency",company:"Company",cooperative:"Cooperative",laboratory:"Laboratory",bank:"Bank / finance",insurer:"Insurer",research:"Research institute",university:"University",ngo:"Non-governmental organization",support_association:"Agricultural support association",professional_association:"Professional / trade association",foundation:"Foundation",charity:"Charity",supplier:"Input and equipment supplier",buyer:"Agricultural buyer",other:"Other"},
  areas: {technical_advice:"Technical advice and extension",training:"Training and capacity building",finance:"Finance and credit",insurance:"Insurance and risk management",inputs:"Inputs and equipment",machinery:"Machinery and mechanization",water:"Water, irrigation and infrastructure",testing:"Soil, water and product testing",research:"Research and innovation",market:"Marketing and market access",grants:"Grants and financial support",community:"Farmer organizations and community support"}
 }
};
const types = ["government","company","cooperative","laboratory","bank","insurer","research","university","ngo","support_association","professional_association","foundation","charity","supplier","buyer","other"];
const areas = ["technical_advice","training","finance","insurance","inputs","machinery","water","testing","research","market","grants","community"];
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export function renderOrganizationWorkspace(language = "fa") {
 const t = copy[language] || copy.en;
 const typeOptions = types.map(v => '<option value="'+v+'">'+esc(t.types[v])+'</option>').join("");
 const areaOptions = areas.map(v => '<label class="org-area-option"><input type="checkbox" name="support_areas" value="'+v+'"><span>'+esc(t.areas[v])+'</span></label>').join("");
 return '<section class="org-workspace">'+
  '<div class="org-intro"><span class="eyebrow">SARINA · ORGANIZATIONS</span><h2>'+esc(t.title)+'</h2><p>'+esc(t.intro)+'</p></div>'+
  '<section class="panel org-panel"><h3>'+esc(t.identity)+'</h3><form class="org-registration-form">'+
  '<label><span>'+esc(t.legal)+'</span><input name="legal_name" maxlength="200" required></label>'+
  '<label><span>'+esc(t.display)+'</span><input name="display_name" maxlength="160" required></label>'+
  '<label><span>'+esc(t.type)+'</span><select name="organization_type" required><option value="">—</option>'+typeOptions+'</select></label>'+
  '<label><span>'+esc(t.reg)+'</span><input name="registration_number" maxlength="120"></label>'+
  '<label><span>'+esc(t.country)+'</span><input name="country_name" maxlength="120"></label>'+
  '<label><span>'+esc(t.city)+'</span><input name="city" maxlength="120"></label>'+
  '<label class="org-wide"><span>'+esc(t.address)+'</span><input name="address" maxlength="1500"></label>'+
  '<div class="org-subheading">'+esc(t.contact)+'</div>'+
  '<label><span>'+esc(t.email)+'</span><input name="contact_email" type="email" maxlength="254"></label>'+
  '<label><span>'+esc(t.phone)+'</span><input name="contact_phone" type="tel" maxlength="32"></label>'+
  '<label class="org-wide"><span>'+esc(t.website)+'</span><input name="website_url" type="url" maxlength="500" placeholder="https://"></label>'+
  '<label class="org-wide"><span>'+esc(t.description)+'</span><textarea name="description" maxlength="2000" rows="4"></textarea></label>'+
  '<div class="org-subheading">'+esc(t.support)+'</div><div class="org-area-grid">'+areaOptions+'</div>'+
  '<label class="org-wide"><span>'+esc(t.regions)+'</span><input name="service_regions" maxlength="1000" placeholder="'+(language==="fa"?"مثلاً خوزستان، فارس، سراسر کشور":"e.g. Khuzestan, Fars, nationwide")+'"></label>'+
  '<p class="org-review-note">'+esc(t.reviewNote)+'</p>'+
  '<button class="primary-btn org-submit" type="submit">'+esc(t.submit)+'</button><p class="message org-message" role="status"></p></form></section>'+
  '<section class="panel org-panel"><h3>'+esc(t.applications)+'</h3><div class="org-application-list"><p class="message">'+esc(t.loading)+'</p></div></section></section>';
}
export function bindOrganizationWorkspace({root,supabase,getLanguage}) {
 if (!root || root.dataset.orgBound === "1") return;
 root.dataset.orgBound = "1";
 const t = () => copy[getLanguage()] || copy.en;
 const list = root.querySelector(".org-application-list");
 const message = root.querySelector(".org-message");
 async function loadApplications() {
  list.innerHTML = '<p class="message">'+esc(t().loading)+'</p>';
  const {data,error} = await supabase.functions.invoke("organization-registration",{body:{action:"status"}});
  if(error || !data?.ok) { list.innerHTML='<p class="message">'+esc(t().error)+'</p>'; return; }
  if(!data.applications?.length) { list.innerHTML='<p class="message">'+esc(t().noApplications)+'</p>'; return; }
  list.innerHTML = data.applications.map(a => '<article class="org-application-card"><div><strong>'+esc(a.display_name)+'</strong><small>'+esc(a.legal_name)+' · '+esc(t().types[a.organization_type]||a.organization_type)+'</small></div><span class="org-status org-status-'+esc(a.status)+'">'+esc(t()[a.status]||a.status)+'</span></article>').join("");
 }
 root.querySelector(".org-registration-form").addEventListener("submit",async event=>{
  event.preventDefault();
  const form=event.currentTarget, button=form.querySelector("button[type=submit]");
  const values=Object.fromEntries(new FormData(form).entries());
  values.support_areas=[...form.querySelectorAll('input[name="support_areas"]:checked')].map(x=>x.value);
  values.service_regions=String(values.service_regions||"").split(",").map(x=>x.trim()).filter(Boolean).slice(0,12);
  if(!values.contact_email?.trim()&&!values.contact_phone?.trim()){message.textContent=t().contactRequired;return;}
  button.disabled=true;button.textContent=t().submitting;message.textContent="";
  const {data,error}=await supabase.functions.invoke("organization-registration",{body:{action:"submit",...values}});
  button.disabled=false;button.textContent=t().submit;
  if(error || !data?.ok) {
   console.error("Organization application submission failed",error||data);
   message.textContent=data?.code==="ACTIVE_APPLICATION_EXISTS" ? (getLanguage()==="fa"?"یک درخواست فعال دارید؛ وضعیت آن را در پایین ببینید.":"You already have an active application; see its status below.") : t().error;
   await loadApplications();return;
  }
  message.textContent=t().saved;form.reset();await loadApplications();
 });
 loadApplications();
}
