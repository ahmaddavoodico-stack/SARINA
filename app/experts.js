const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fa = (lang) => lang === 'fa';
const VOICE_BUCKET = 'expert-voice-notes';
const VOICE_MAX_BYTES = 20 * 1024 * 1024;
const VOICE_MIME_TYPES = ['audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav','audio/x-wav','audio/aac','audio/3gpp','audio/3gpp2','audio/flac'];
const voiceFormMarkup = (consultationId, isFa, role) => `<form class="${role}-voice-form" data-consultation-id="${esc(consultationId)}"><label>${isFa?'انتخاب فایل صوتی':'Choose audio file'} <input type="file" name="voice_file" accept="audio/*" required></label><button type="button" class="quiet-btn" data-voice-record>${isFa?'ضبط پیام صوتی':'Record voice note'}</button><button class="quiet-btn" type="submit">${isFa?'ارسال صدا':'Send audio'}</button><small class="fineprint">${isFa?'حداکثر ۲۰ مگابایت؛ فایل صوتی خصوصی است.':'Up to 20 MB; audio is private.'}</small><p class="message" role="status"></p></form>`;
const callPanelMarkup = (id,isFa) => '<section class="expert-call-panel" data-call-panel="'+esc(id)+'"><div class="section-head"><b>'+(isFa?'تماس صوتی زنده':'Live voice call')+'</b><span class="expert-status call-status" role="status">'+(isFa?'آماده تماس':'Ready to call')+'</span></div><div class="expert-call-actions"><button type="button" class="quiet-btn" data-call-start>'+(isFa?'شروع تماس':'Start call')+'</button><button type="button" class="quiet-btn" data-call-accept hidden>'+(isFa?'پاسخ به تماس':'Accept call')+'</button><button type="button" class="quiet-btn" data-call-reject hidden>'+(isFa?'رد تماس':'Decline')+'</button><button type="button" class="quiet-btn" data-call-end hidden>'+(isFa?'پایان تماس':'End call')+'</button></div><audio data-call-audio autoplay playsinline></audio></section>';
function bindVoiceRecorder(root,isFa) {
 if (root.dataset.voiceRecorderBound) return;
 root.dataset.voiceRecorderBound = '1';
 root.addEventListener('click', async e => {
  const button = e.target.closest('[data-voice-record]');
  if (!button) return;
  e.preventDefault();
  const form = button.closest('form');
  const status = form?.querySelector('.message');
  const input = form?.elements.voice_file;
  if (!form || !input) return;
  const active = form._voiceRecorder;
  if (active) {
   button.disabled = true;
   active.recorder.stop();
   return;
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
   if (status) status.textContent = isFa ? 'ضبط مستقیم در این مرورگر پشتیبانی نمی‌شود؛ فایل صوتی را انتخاب کنید.' : 'Recording is not supported here; choose an audio file instead.';
   return;
  }
  button.disabled = true;
  let stream;
  try {
   stream = await navigator.mediaDevices.getUserMedia({audio:true});
   const candidates = ['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4','audio/webm'];
   const preferred = candidates.find(type => MediaRecorder.isTypeSupported(type));
   const recorder = preferred ? new MediaRecorder(stream,{mimeType:preferred}) : new MediaRecorder(stream);
   const chunks = [];
   recorder.addEventListener('dataavailable', event => { if (event.data?.size) chunks.push(event.data); });
   recorder.addEventListener('stop', () => {
    stream.getTracks().forEach(track => track.stop());
    const mime = (recorder.mimeType || 'audio/webm').split(';')[0].toLowerCase();
    const extension = {'audio/webm':'webm','audio/ogg':'ogg','audio/mp4':'m4a'}[mime] || 'webm';
    const blob = new Blob(chunks,{type:recorder.mimeType || mime});
    const file = new File([blob],'voice-note-'+Date.now()+'.'+extension,{type:recorder.mimeType || mime});
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    form._voiceRecorder = null;
    button.dataset.recording = 'false';
    button.disabled = false;
    button.textContent = isFa ? 'ضبط دوباره' : 'Record again';
    if (status) status.textContent = isFa ? 'ضبط پایان یافت؛ برای ارسال، دکمه ارسال صدا را بزنید.' : 'Recording ready; press Send audio to upload it.';
   });
   form._voiceRecorder = {recorder,stream};
   recorder.start();
   button.dataset.recording = 'true';
   button.textContent = isFa ? 'پایان ضبط' : 'Stop recording';
   button.disabled = false;
   if (status) status.textContent = isFa ? 'در حال ضبط…' : 'Recording…';
  } catch (error) {
   stream?.getTracks().forEach(track => track.stop());
   button.disabled = false;
   if (status) status.textContent = (isFa ? 'دسترسی به میکروفون ممکن نشد: ' : 'Microphone unavailable: ') + error.message;
  }
 });
}
function bindConsultationCalls(root,{supabase,viewerId,isFa}) {
 if(root.dataset.callHandlersBound)return;
 root.dataset.callHandlersBound='1';
 const channels=new Map(),states=new Map(),pending=new Map();
 const iceServers=Array.isArray(globalThis.SARINA_WEBRTC_ICE_SERVERS)?globalThis.SARINA_WEBRTC_ICE_SERVERS:[{urls:'stun:stun.l.google.com:19302'}];
 const panel=id=>root.querySelector('[data-call-panel="'+CSS.escape(id)+'"]');
 const say=(id,msg)=>{const el=panel(id)?.querySelector('.call-status');if(el)el.textContent=msg;};
 const show=(id,flags)=>{const p=panel(id);if(!p)return;for(const [key,selector] of Object.entries({start:'[data-call-start]',accept:'[data-call-accept]',reject:'[data-call-reject]',end:'[data-call-end]'}))p.querySelector(selector).hidden=!flags[key];};
 const send=async(id,event,payload)=>{const item=await ensure(id);if(!item.ready)throw new Error('Call signaling unavailable');const result=await item.channel.send({type:'broadcast',event,payload});if(result!=='ok')throw new Error('Signaling send failed: '+result);};
 const update=async(sessionId,values)=>{const {error}=await supabase.from('expert_audio_sessions').update(values).eq('id',sessionId);if(error)console.warn(error);};
 const cleanup=id=>{const st=states.get(id);if(st){st.stream?.getTracks().forEach(t=>t.stop());st.pc?.close();const a=panel(id)?.querySelector('[data-call-audio]');if(a){a.pause();a.srcObject=null;}states.delete(id);}pending.delete(id);show(id,{start:true});say(id,isFa?'تماس پایان یافت':'Call ended');};
 const peer=(id,sessionId,stream)=>{const pc=new RTCPeerConnection({iceServers});stream.getTracks().forEach(t=>pc.addTrack(t,stream));pc.onicecandidate=e=>{if(e.candidate)send(id,'call-ice',{sessionId,senderId:viewerId,candidate:e.candidate}).catch(err=>say(id,err.message));};pc.ontrack=e=>{const a=panel(id)?.querySelector('[data-call-audio]');if(a){a.srcObject=e.streams[0];a.play().catch(()=>say(id,isFa?'برای شنیدن صدا پخش را بزنید':'Tap play to hear audio'));}};pc.onconnectionstatechange=()=>{if(pc.connectionState==='connected')say(id,isFa?'تماس برقرار است':'Call connected');if(['failed','disconnected'].includes(pc.connectionState))say(id,isFa?'شبکه ناپایدار است؛ ممکن است TURN لازم باشد':'Network path failed; TURN may be required');};return pc;};
 async function ensure(id){
  if(channels.has(id))return channels.get(id);
  const channel=supabase.channel('consultation:'+id+':call',{config:{private:true}}),item={channel,ready:false};
  const on=(event,fn)=>channel.on('broadcast',{event},({payload})=>fn(payload||{}));
  on('call-invite',async p=>{if(p.senderId===viewerId||!p.sessionId||!p.offer)return;const {data,error}=await supabase.from('expert_audio_sessions').select('id,initiated_by,status,expires_at').eq('id',p.sessionId).maybeSingle();if(error||!data||data.initiated_by!==p.senderId||data.status!=='ringing'||new Date(data.expires_at).getTime()<Date.now())return;pending.set(id,p);show(id,{accept:true,reject:true});say(id,isFa?'تماس ورودی؛ برای پاسخ اجازه میکروفون بدهید':'Incoming call; accept to enable microphone');});
  on('call-answer',async p=>{const st=states.get(id);if(!st||p.sessionId!==st.sessionId||!p.answer)return;try{await st.pc.setRemoteDescription(new RTCSessionDescription(p.answer));for(const c of st.queued.splice(0))await st.pc.addIceCandidate(new RTCIceCandidate(c));await update(st.sessionId,{status:'accepted',started_at:new Date().toISOString()});say(id,isFa?'در حال اتصال…':'Connecting…');}catch(e){say(id,e.message);}});
  on('call-ice',async p=>{const st=states.get(id);if(!st||p.sessionId!==st.sessionId||!p.candidate)return;try{if(st.pc.remoteDescription)await st.pc.addIceCandidate(new RTCIceCandidate(p.candidate));else st.queued.push(p.candidate);}catch(e){console.warn(e);}});
  on('call-reject',p=>{const st=states.get(id);if(st&&p.sessionId===st.sessionId){update(st.sessionId,{status:'rejected',ended_at:new Date().toISOString()});cleanup(id);}});
  on('call-end',p=>{const st=states.get(id),inc=pending.get(id);if((st&&p.sessionId===st.sessionId)||(inc&&p.sessionId===inc.sessionId)){if(st)update(st.sessionId,{status:'ended',ended_at:new Date().toISOString()});cleanup(id);}});
  item.promise=new Promise(resolve=>channel.subscribe(status=>{if(status==='SUBSCRIBED'){item.ready=true;resolve(true);}else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){item.ready=false;resolve(false);}}));
  channels.set(id,item);item.ready=await item.promise;return item;
 }
 const begin=async id=>{if(states.has(id)||pending.has(id))return;show(id,{});say(id,isFa?'در حال آماده‌سازی تماس…':'Preparing call…');let stream;try{const ch=await ensure(id);if(!ch.ready)throw new Error('Could not join private call channel');if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microphone requires HTTPS and browser support');stream=await navigator.mediaDevices.getUserMedia({audio:true});const {data:session,error}=await supabase.from('expert_audio_sessions').insert({consultation_id:id,initiated_by:viewerId,status:'ringing'}).select('id').single();if(error)throw error;const pc=peer(id,session.id,stream),st={sessionId:session.id,pc,stream,queued:[]};states.set(id,st);const offer=await pc.createOffer();await pc.setLocalDescription(offer);await send(id,'call-invite',{sessionId:session.id,senderId:viewerId,offer:pc.localDescription});show(id,{end:true});say(id,isFa?'در انتظار پاسخ…':'Ringing; waiting for answer…');}catch(e){stream?.getTracks().forEach(t=>t.stop());show(id,{start:true});say(id,(isFa?'شروع تماس ناموفق بود: ':'Could not start call: ')+e.message);}};
 const accept=async id=>{const inc=pending.get(id);if(!inc)return;show(id,{});say(id,isFa?'در حال اتصال…':'Connecting…');let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:true});const pc=peer(id,inc.sessionId,stream),st={sessionId:inc.sessionId,pc,stream,queued:[]};states.set(id,st);await pc.setRemoteDescription(new RTCSessionDescription(inc.offer));for(const c of st.queued.splice(0))await pc.addIceCandidate(new RTCIceCandidate(c));const answer=await pc.createAnswer();await pc.setLocalDescription(answer);await update(inc.sessionId,{status:'accepted',started_at:new Date().toISOString()});await send(id,'call-answer',{sessionId:inc.sessionId,senderId:viewerId,answer:pc.localDescription});pending.delete(id);show(id,{end:true});say(id,isFa?'تماس در حال اتصال…':'Call connecting…');}catch(e){stream?.getTracks().forEach(t=>t.stop());states.delete(id);show(id,{start:true});say(id,(isFa?'پاسخ ناموفق بود: ':'Could not accept call: ')+e.message);}};
 const reject=async id=>{const inc=pending.get(id);if(!inc)return;try{await send(id,'call-reject',{sessionId:inc.sessionId,senderId:viewerId});await update(inc.sessionId,{status:'rejected',ended_at:new Date().toISOString()});}catch(e){console.warn(e);}cleanup(id);};
 const end=async id=>{const st=states.get(id);if(!st)return;try{await send(id,'call-end',{sessionId:st.sessionId,senderId:viewerId});await update(st.sessionId,{status:'ended',ended_at:new Date().toISOString()});}catch(e){console.warn(e);}cleanup(id);};
 root.addEventListener('click',e=>{const b=e.target.closest('[data-call-start]');if(b){begin(b.closest('[data-call-panel]').dataset.callPanel);return;}const a=e.target.closest('[data-call-accept]');if(a){accept(a.closest('[data-call-panel]').dataset.callPanel);return;}const r=e.target.closest('[data-call-reject]');if(r){reject(r.closest('[data-call-panel]').dataset.callPanel);return;}const h=e.target.closest('[data-call-end]');if(h)end(h.closest('[data-call-panel]').dataset.callPanel);});
 root._sarinaEnsureCallChannel=id=>ensure(id);
}

async function renderConsultationMessages({supabase,messages,viewerId,isFa}) {
 const items = await Promise.all((messages||[]).map(async m => {
  const voice = Array.isArray(m.content_parts) ? m.content_parts.find(p => p?.type === 'audio' && p.storage_path) : null;
  let audio = '';
  if (voice) {
   const {data,error} = await supabase.storage.from(VOICE_BUCKET).createSignedUrl(voice.storage_path, 3600);
   if (!error && data?.signedUrl) audio = '<audio controls preload="none" src="'+esc(data.signedUrl)+'"></audio>';
  }
  return '<div class="expert-message-item"><b>'+(m.sender_user_id===viewerId?(isFa?'شما':'You'):(isFa?'طرف مقابل':'Other participant'))+':</b> '+esc(m.message_text||'')+audio+'</div>';
 }));
 return items.join('') || '<p class="fineprint">'+(isFa?'هنوز پیامی وجود ندارد.':'No messages yet.')+'</p>';
}
async function uploadConsultationVoice({supabase,consultationId,userId,file}) {
 if (!file) throw new Error('Choose an audio file.');
 const mimeType = String(file.type||'').split(';')[0].toLowerCase();
 if (!VOICE_MIME_TYPES.includes(mimeType)) throw new Error('Unsupported audio format.');
 if (!file.size || file.size > VOICE_MAX_BYTES) throw new Error('Audio file must be 20 MB or smaller.');
 const extByMime = {'audio/webm':'webm','audio/ogg':'ogg','audio/mp4':'m4a','audio/mpeg':'mp3','audio/wav':'wav','audio/x-wav':'wav','audio/aac':'aac','audio/3gpp':'3gp','audio/3gpp2':'3g2','audio/flac':'flac'};
 const objectId = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : (Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
 const objectPath = consultationId+'/'+userId+'/'+objectId+'.'+extByMime[mimeType];
 const {error:uploadError} = await supabase.storage.from(VOICE_BUCKET).upload(objectPath,file,{contentType:mimeType,upsert:false});
 if (uploadError) throw uploadError;
 const {error:messageError} = await supabase.from('expert_consultation_messages').insert({
  consultation_id:consultationId,sender_user_id:userId,message_text:null,
  content_parts:[{type:'audio',storage_path:objectPath,mime_type:mimeType,size_bytes:file.size}]
 });
 if (messageError) {
  await supabase.storage.from(VOICE_BUCKET).remove([objectPath]);
  throw messageError;
 }
}
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
  <section class="panel expert-portfolio">
   <div class="section-head"><div><h3>${isFa?'رزومه و دستاوردهای حرفه‌ای':'Professional portfolio & achievements'}</h3><p>${isFa?'سوابق، نتایج مستند، نوآوری‌ها و افتخارات خود را در یک پرونده حرفه‌ای جمع کنید.':'Bring your credentials, documented outcomes, innovations and recognition into one professional record.'}</p></div><button type="button" class="quiet-btn" id="downloadExpertCv">${isFa?'دانلود رزومه (HTML)':'Download CV (HTML)'}</button></div>
   <div class="expert-portfolio-grid">
    <section class="expert-portfolio-block"><h4>${isFa?'مدارک و صلاحیت‌ها':'Credentials'}</h4><div id="expertCredentialsList"><p class="fineprint">${isFa?'در حال بارگذاری…':'Loading…'}</p></div></section>
    <section class="expert-portfolio-block"><h4>${isFa?'تقدیرنامه‌ها و نشان‌ها':'Awards & recognition'}</h4><div id="expertAwardsList"><p class="fineprint">${isFa?'در حال بارگذاری…':'Loading…'}</p></div></section>
   </div>
   <section class="expert-portfolio-block"><div class="section-head"><div><h4>${isFa?'پرونده‌های اثرگذاری و نوآوری':'Impact & innovation records'}</h4><p>${isFa?'نتایج واقعی را همراه با وضعیت اولیه، نتیجه پس از اقدام و سهم خود ثبت کنید.':'Record real outcomes with baseline, follow-up and your own contribution.'}</p></div></div><div id="expertImpactList"><p class="fineprint">${isFa?'برای مشاهده سوابق، ابتدا پروفایل را ذخیره کنید.':'Save your profile to view your records.'}</p></div></section>
   <form id="expertImpactForm" class="expert-impact-form">
    <h4>${isFa?'ثبت دستاورد یا نوآوری جدید':'Add an impact or innovation record'}</h4>
    <label>${isFa?'نوع دستاورد':'Record type'}<select name="record_kind" required><option value="case_outcome">${isFa?'نتیجه یک پرونده یا اقدام':'Case outcome'}</option><option value="innovation">${isFa?'نوآوری و راهکار خلاقانه':'Innovation'}</option></select></label>
    <label>${isFa?'عنوان':'Title'}<input name="title" required minlength="3" maxlength="180"></label>
    <label>${isFa?'شرح مسئله و نتیجه':'Problem and outcome summary'}<textarea name="summary" required minlength="10" maxlength="5000" rows="3"></textarea></label>
    <label>${isFa?'وضعیت اولیه (JSON اختیاری)':'Baseline metrics (optional JSON)'}<textarea name="baseline_metrics" rows="2" placeholder='{"yield_t_per_ha": 2.1}'></textarea></label>
    <label>${isFa?'نتیجه پس از اقدام (JSON اختیاری)':'Outcome metrics (optional JSON)'}<textarea name="outcome_metrics" rows="2" placeholder='{"yield_t_per_ha": 2.8}'></textarea></label>
    <label>${isFa?'سهم و اقدام مشخص شما':'Your specific contribution'}<textarea name="expert_contribution" rows="2" maxlength="3000"></textarea></label>
    <label>${isFa?'جزئیات نوآوری (JSON اختیاری)':'Innovation details (optional JSON)'}<textarea name="innovation_details" rows="2" placeholder='{"method":"...","novelty":"..."}'></textarea></label>
    <label>${isFa?'ارجاع شواهد (هر مورد در یک خط؛ فعلاً شناسه یا نشانی متنی)':'Evidence references (one per line; text references for now)'}<textarea name="evidence_refs" rows="2" maxlength="2000"></textarea></label>
    <label class="consent-row"><input type="checkbox" name="beneficiary_consent"><span>${isFa?'رضایت بهره‌بردار برای استفاده از این دستاورد در رزومه عمومی را دریافت کرده‌ام.':'I have obtained beneficiary consent for using this achievement in a public portfolio.'}</span></label>
    <p class="fineprint">${isFa?'این ثبت فعلاً پیش‌نویس خصوصی است. فایل شواهد و ارسال برای ارزیابی انسانی در مرحله بعد اضافه می‌شود. اطلاعات هویتی کشاورز را در متن یا شواهد وارد نکنید.':'This is a private draft for now. Evidence uploads and human-review submission will follow. Do not include identifying farmer details.'}</p>
    <button class="primary-btn" type="submit">${isFa?'ذخیره پیش‌نویس دستاورد':'Save impact draft'}</button><p class="message" id="expertImpactMessage" role="status"></p>
   </form>
  </section>
  <section class="panel expert-cases"><h3>${isFa?'پرونده‌های ارجاع‌شده':'Assigned cases'}</h3><div id="expertCasesList"><p class="fineprint">${isFa?'برای بارگذاری پرونده‌ها، پروفایل خود را ذخیره کنید.':'Save your profile to load assigned cases.'}</p></div></section>
  <section class="panel expert-contracts"><h3>${isFa?'پیشنهادهای همکاری و قرارداد':'Service contract offers'}</h3><div id="expertContractsList"><p class="fineprint">${isFa?'پس از تأیید پروفایل، پیشنهادهای قرارداد نمایش داده می‌شوند.':'Contract offers appear after your expert profile is verified.'}</p></div></section>
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
   const {data:landResult,error:landError}=await supabase.functions.invoke('farm-land-context',{body:{farm_id:form.dataset.farmId}});
   if(landError||!landResult?.ok||landResult.context?.farm?.id!==form.dataset.farmId)throw new Error(isFa?'بازیابی پرونده مزرعه برای اشتراک‌گذاری امن انجام نشد.':'Could not retrieve the farm context for consented sharing.');
   const ctx=landResult.context;
   const consentedSnapshot={schema:ctx.schema,retrieved_at:ctx.retrieved_at,farm:ctx.farm,location:ctx.location,fields:ctx.fields,soil_tests:ctx.soil_tests,water_tests:ctx.water_tests,farmer_reports:ctx.farmer_reports,crop_groups:ctx.crop_groups,pond_assets:ctx.pond_assets,data_quality:ctx.data_quality,safety:ctx.safety};
   const now=new Date().toISOString();
   const {data:req,error}=await supabase.from('expert_requests').insert({
    requester_user_id:currentProfile.id,farm_id:form.dataset.farmId,assigned_expert_profile_id:v.expert_profile_id,
    subject:v.subject.trim(),problem_description:v.problem_description.trim(),request_type:'general',
    priority:'normal',status:'submitted',preferred_language:language,requested_mode:'in_app_message',
    consent_at:now,consent_scope:{farm_profile:true,soil_water_crop_context:true,case_messages:true,limited_to_selected_expert:true},consented_context_snapshot:consentedSnapshot
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
export async function bindExpertWorkspace({root,supabase,profile,language}) {
 const isFa=fa(language), profileForm=root.querySelector('#expertProfileForm'), credForm=root.querySelector('#expertCredentialForm');
 bindVoiceRecorder(root,isFa);
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
   await loadPortfolio();await loadCases();await loadContracts();
  }else root.querySelector('#expertStatus').textContent=isFa?'هنوز پروفایل متخصص ندارید':'No expert profile yet';
 }
 async function loadPortfolio(){
  const credentials=root.querySelector('#expertCredentialsList'), impacts=root.querySelector('#expertImpactList'), awards=root.querySelector('#expertAwardsList');
  if(!expert){const note=isFa?'پس از ذخیره پروفایل متخصص، این بخش فعال می‌شود.':'Save your expert profile to activate this section.';credentials.textContent=note;impacts.textContent=note;awards.textContent=note;return;}
  const [cr,ir,ar]=await Promise.all([
   supabase.from('expert_credentials').select('credential_type,issuing_body,credential_ref,issued_on,expires_on,verification_status,created_at').eq('expert_profile_id',expert.id).order('created_at',{ascending:false}),
   supabase.from('expert_impact_records').select('id,record_kind,title,summary,baseline_metrics,outcome_metrics,expert_contribution,innovation_details,evidence_refs,status,created_at').eq('expert_profile_id',expert.id).order('created_at',{ascending:false}),
   supabase.from('expert_recognition_awards').select('award_code,award_level,title,citation,issuer_type,issuer_name,status,issued_at,public_verification_token').eq('expert_profile_id',expert.id).order('created_at',{ascending:false})
  ]);
  credentials.innerHTML=cr.error?'<p class="message">'+esc(cr.error.message)+'</p>':(cr.data||[]).map(x=>'<article class="portfolio-item"><b>'+esc(x.credential_type)+'</b><span class="expert-status">'+esc(x.verification_status)+'</span><p>'+esc(x.issuing_body||'—')+' · '+esc(x.credential_ref||'—')+'</p><small>'+esc(x.issued_on||'')+'</small></article>').join('')||'<p class="fineprint">'+(isFa?'هنوز مدرکی ثبت نشده است.':'No credentials submitted yet.')+'</p>';
  impacts.innerHTML=ir.error?'<p class="message">'+esc(ir.error.message)+'</p>':(ir.data||[]).map(x=>'<article class="portfolio-item"><div class="section-head"><b>'+esc(x.title)+'</b><span class="expert-status">'+esc(x.status)+'</span></div><small>'+esc(x.record_kind==='innovation'?(isFa?'نوآوری':'Innovation'):(isFa?'نتیجه پرونده':'Case outcome'))+'</small><p>'+esc(x.summary)+'</p><details><summary>'+(isFa?'جزئیات و شواهد':'Metrics & evidence')+'</summary><pre>'+esc(JSON.stringify({baseline:x.baseline_metrics,outcome:x.outcome_metrics,contribution:x.expert_contribution,evidence_refs:x.evidence_refs},null,2))+'</pre></details></article>').join('')||'<p class="fineprint">'+(isFa?'هنوز دستاوردی ثبت نشده است.':'No impact records yet.')+'</p>';
  awards.innerHTML=ar.error?'<p class="message">'+esc(ar.error.message)+'</p>':(ar.data||[]).map(x=>'<article class="portfolio-item"><div class="section-head"><b>'+esc(x.title)+'</b><span class="expert-status">'+esc(x.status)+'</span></div><p>'+esc(x.citation)+'</p><small>'+esc(x.issuer_name)+' · '+esc(x.award_code)+'</small></article>').join('')||'<p class="fineprint">'+(isFa?'هنوز تقدیرنامه‌ای صادر نشده است.':'No awards issued yet.')+'</p>';
  root.dataset.cvCredentials=JSON.stringify(cr.data||[]);root.dataset.cvImpacts=JSON.stringify(ir.data||[]);root.dataset.cvAwards=JSON.stringify((ar.data||[]).filter(x=>x.status==='issued'));
 }
 async function loadContracts(){
  const list=root.querySelector('#expertContractsList');
  if(!expert||expert.verification_status!=='verified'){list.textContent=isFa?'برای پذیرش قرارداد، پروفایل باید تأیید شده باشد.':'Your profile must be verified to accept contracts.';return;}
  const {data,error}=await supabase.from('service_contracts').select('id,contract_code,title,description,status,pricing_model,base_amount,currency_code,farmer_accepted_at,expert_accepted_at,created_at').eq('expert_profile_id',expert.id).in('status',['proposed','accepted']).order('created_at',{ascending:false}).limit(30);
  if(error){list.textContent=error.message;return;}
  if(!data?.length){list.textContent=isFa?'فعلاً پیشنهاد قراردادی ندارید.':'No contract offers yet.';return;}
  list.innerHTML=data.map(c=>'<article class="expert-case-card"><div class="section-head"><b>'+esc(c.title)+'</b><span class="expert-status">'+esc(c.status)+'</span></div><p>'+esc(c.description||'')+'</p><p>'+esc(c.base_amount)+' '+esc(c.currency_code)+' · '+esc(c.pricing_model)+'</p>'+(c.status==='proposed'&&!c.expert_accepted_at?'<button type="button" class="primary-btn" data-expert-contract-action="accept" data-contract-id="'+esc(c.id)+'">'+(isFa?'پذیرش قرارداد':'Accept contract')+'</button><button type="button" class="quiet-btn" data-expert-contract-action="cancel" data-contract-id="'+esc(c.id)+'">'+(isFa?'رد / لغو پیشنهاد':'Decline offer')+'</button>':c.status==='accepted'?'<p>'+(isFa?'قرارداد با تأیید هر دو طرف پذیرفته شده است.':'Both parties accepted this contract.')+'</p>':'<p>'+(isFa?'در انتظار تأیید کشاورز':'Waiting for farmer acceptance')+'</p>')+'</article>').join('');
  const contractIds=data.map(c=>c.id);
  const {data:invoices, error:invoiceError}=await supabase.from('contract_invoices').select('id,contract_id,invoice_number,status,currency_code,total_amount,tax_status').in('contract_id',contractIds).order('created_at',{ascending:false});
  if(!invoiceError&&invoices?.length){
   list.insertAdjacentHTML('beforeend','<section class="expert-case-card"><b>'+(isFa?'پیش‌نویس صورتحساب‌ها':'Invoice drafts')+'</b>'+invoices.map(i=>'<p>'+esc(i.invoice_number)+' · '+esc(i.total_amount)+' '+esc(i.currency_code)+' · '+esc(i.status)+'</p><small>'+(isFa?'وضعیت مالیات هنوز بررسی نشده است.':'Tax treatment has not been reviewed.')+'</small>').join('')+'</section>');
  }
 }
 root.addEventListener('click',async e=>{
  const button=e.target.closest('[data-expert-contract-action]');if(!button)return;
  button.disabled=true;
  const {data,error}=await supabase.functions.invoke('sarina-contract-workflow',{body:{contract_id:button.dataset.contractId,action:button.dataset.expertContractAction}});
  if(error||!data?.ok){console.error('Expert contract action failed',error||data);button.disabled=false;button.textContent=isFa?'عملیات ناموفق بود':'Action failed';return;}
  await loadContracts();
 });
 async function loadCases(){
  const list=root.querySelector('#expertCasesList');
  const {data:requests,error}=await supabase.from('expert_requests').select('id,subject,problem_description,status,created_at,requester_user_id,assigned_expert_profile_id,consented_context_snapshot').eq('assigned_expert_profile_id',expert.id).order('created_at',{ascending:false}).limit(30);
  if(error){list.textContent=error.message;return;}
  if(!requests?.length){list.innerHTML='<p class="fineprint">'+(isFa?'هنوز پرونده‌ای به شما ارجاع نشده است.':'No cases assigned yet.')+'</p>';return;}
  const cards=[];
  for(const r of requests){
   const {data:assignment}=await supabase.from('expert_request_assignments').select('id,assignment_status').eq('request_id',r.id).eq('expert_profile_id',expert.id).maybeSingle();
   const {data:consult}=await supabase.from('expert_consultations').select('id').eq('request_id',r.id).maybeSingle();
   const {data:messages}=consult?.id?await supabase.from('expert_consultation_messages').select('id,sender_user_id,message_text,content_parts,created_at').eq('consultation_id',consult.id).order('created_at').limit(30):{data:[]};
   const messageHtml = await renderConsultationMessages({supabase,messages,viewerId:profile.id,isFa});
   cards.push(`<article class="expert-case-card" data-case="${esc(r.id)}"><div class="section-head"><div><h4>${esc(r.subject)}</h4><p>${esc(r.problem_description)}</p></div><span class="expert-status">${esc(assignment?.assignment_status||r.status)}</span></div>
   <details class="expert-context"><summary>${isFa?'پرونده مزرعه‌ای که کشاورز با رضایت به اشتراک گذاشته':'Farm context shared with consent'}</summary><pre>${esc(JSON.stringify(r.consented_context_snapshot||{},null,2))}</pre></details><div class="expert-case-actions">${assignment?.assignment_status==='offered'?'<button type="button" class="quiet-btn" data-assignment-action="accepted" data-assignment-id="'+esc(assignment.id)+'">'+(isFa?'پذیرش':'Accept')+'</button><button type="button" class="quiet-btn" data-assignment-action="declined" data-assignment-id="'+esc(assignment.id)+'">'+(isFa?'رد درخواست':'Decline')+'</button>':''}</div>
   <div class="expert-messages">${messageHtml}</div>
   ${consult?.id&&assignment?.assignment_status==='accepted'?'<form class="expert-message-form" data-consultation-id="'+esc(consult.id)+'"><textarea name="message_text" rows="2" maxlength="6000" required placeholder="'+(isFa?'پاسخ شما…':'Your reply…')+'"></textarea><button class="primary-btn" type="submit">'+(isFa?'ارسال پیام':'Send message')+'</button></form>${voiceFormMarkup(consult.id,isFa,'expert')}<form class="expert-report-form" data-request-id="'+esc(r.id)+'" data-consultation-id="'+esc(consult.id)+'"><h5>'+(isFa?'گزارش کارشناسی':'Expert report')+'</h5><textarea name="summary" rows="3" minlength="10" maxlength="12000" required placeholder="'+(isFa?'خلاصه ارزیابی کارشناسی':'Assessment summary')+'"></textarea><textarea name="recommendations" rows="2" placeholder="'+(isFa?'پیشنهادها':'Recommendations')+'"></textarea><textarea name="limitations" rows="2" placeholder="'+(isFa?'محدودیت‌ها و موارد نیازمند بررسی':'Limitations / follow-up')+'"></textarea><button class="quiet-btn" type="submit">'+(isFa?'ثبت گزارش':'Submit report')+'</button><p class="message"></p></form>' :'<p class="fineprint">'+(isFa?'پس از پذیرش ارجاع، گفت‌وگو و ثبت گزارش فعال می‌شود.':'Accept the assignment to start messaging and submit a report.')+'</p>'}</article>`);
  }
  list.innerHTML=cards.join('');
 }
 root.querySelector('#expertImpactForm').addEventListener('submit',async e=>{
  e.preventDefault();const form=e.currentTarget,button=form.querySelector('button[type=submit]'),v=Object.fromEntries(new FormData(form).entries());
  if(!expert){say('expertImpactMessage',isFa?'ابتدا پروفایل متخصص را ذخیره کنید.':'Save your expert profile first.');return;}
  const parseObject=(raw,label)=>{if(!raw.trim())return {};let value;try{value=JSON.parse(raw);}catch{throw new Error((isFa?'ساختار JSON نامعتبر در بخش ':'Invalid JSON in ')+label);}if(!value||Array.isArray(value)||typeof value!=='object')throw new Error((isFa?'مقدار باید یک شیء JSON باشد: ':'Expected a JSON object: ')+label);return value;};
  let baseline,outcome,innovation;
  try{baseline=parseObject(v.baseline_metrics,isFa?'وضعیت اولیه':'baseline');outcome=parseObject(v.outcome_metrics,isFa?'نتیجه':'outcome');innovation=parseObject(v.innovation_details,isFa?'نوآوری':'innovation details');}catch(err){say('expertImpactMessage',err.message);return;}
  button.disabled=true;say('expertImpactMessage',isFa?'در حال ذخیره…':'Saving…');
  const payload={expert_profile_id:expert.id,record_kind:v.record_kind,title:v.title.trim(),summary:v.summary.trim(),baseline_metrics:baseline,outcome_metrics:outcome,expert_contribution:v.expert_contribution.trim()||null,innovation_details:innovation,evidence_refs:v.evidence_refs.split('\n').map(x=>x.trim()).filter(Boolean),beneficiary_consent_at:v.beneficiary_consent?'now':null,status:'draft'};
  if(payload.beneficiary_consent_at==='now')payload.beneficiary_consent_at=new Date().toISOString();
  const {error}=await supabase.from('expert_impact_records').insert(payload);
  button.disabled=false;
  if(error){console.error(error);say('expertImpactMessage',(isFa?'ذخیره انجام نشد: ':'Could not save: ')+error.message);return;}
  form.reset();say('expertImpactMessage',isFa?'پیش‌نویس خصوصی دستاورد ذخیره شد.':'Private impact draft saved.');await loadPortfolio();
 });
 root.querySelector('#downloadExpertCv').addEventListener('click',()=>{
  if(!expert){say('expertProfileMessage',isFa?'ابتدا پروفایل را ذخیره کنید.':'Save your profile first.');return;}
  const creds=JSON.parse(root.dataset.cvCredentials||'[]'),items=JSON.parse(root.dataset.cvImpacts||'[]'),awards=JSON.parse(root.dataset.cvAwards||'[]');
  const specialty=root.querySelector('#expertCategory').selectedOptions[0]?.textContent||'';
  const status=expert.verification_status==='verified'?(isFa?'تأییدشده':'Verified'):expert.verification_status==='pending'?(isFa?'در انتظار بررسی':'Pending review'):(isFa?'وضعیت: ':'Status: ')+expert.verification_status;
  const escCv=esc;
  const html='<!doctype html><html lang="'+(isFa?'fa':'en')+'" dir="'+(isFa?'rtl':'ltr')+'"><meta charset="utf-8"><title>SARINA Expert CV</title><style>body{font-family:Arial,sans-serif;max-width:850px;margin:40px auto;padding:0 24px;line-height:1.8;color:#18372f}h1,h2{color:#17483b}small{color:#64766d}.item{border-bottom:1px solid #ddd;padding:10px 0}</style><h1>'+escCv(expert.public_name)+'</h1><p>'+escCv(specialty)+' · '+escCv(status)+'</p><p>'+escCv(expert.biography||'')+'</p><p>'+(isFa?'سابقه: ':'Experience: ')+escCv(expert.years_experience??'—')+'</p><p>'+(isFa?'زبان‌ها: ':'Languages: ')+escCv((expert.languages||[]).join(', '))+'</p><h2>'+(isFa?'مدارک':'Credentials')+'</h2>'+creds.map(x=>'<div class="item"><b>'+escCv(x.credential_type)+'</b> · '+escCv(x.issuing_body||'')+' · '+escCv(x.verification_status)+'</div>').join('')+'<h2>'+(isFa?'دستاوردهای ثبت‌شده':'Recorded achievements')+'</h2>'+items.map(x=>'<div class="item"><b>'+escCv(x.title)+'</b> <small>('+escCv(x.status)+')</small><p>'+escCv(x.summary)+'</p></div>').join('')+'<h2>'+(isFa?'افتخارات صادرشده':'Issued recognition')+'</h2>'+awards.map(x=>'<div class="item"><b>'+escCv(x.title)+'</b><p>'+escCv(x.citation)+'</p><small>'+escCv(x.issuer_name)+' · '+escCv(x.award_code)+'</small></div>').join('')+'<footer><small>SARINA · '+(isFa?'این خروجی شامل وضعیت فعلی مدارک و سوابق ثبت‌شده است؛ پیش‌نویس‌ها به‌عنوان دستاورد تأییدشده معرفی نشده‌اند.':'This export reflects current credential and record statuses; drafts are not represented as verified achievements.')+'</small></footer></html>';
  const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='SARINA-Expert-CV.html';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
 });
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
  const voiceForm=e.target.closest('.expert-voice-form');if(voiceForm){e.preventDefault();const button=voiceForm.querySelector('button[type=submit]'),status=voiceForm.querySelector('.message'),file=voiceForm.elements.voice_file.files?.[0];button.disabled=true;status.textContent=isFa?'در حال ارسال فایل صوتی…':'Uploading voice note…';try{await uploadConsultationVoice({supabase,consultationId:voiceForm.dataset.consultationId,userId:profile.id,file});voiceForm.reset();status.textContent=isFa?'پیام صوتی ارسال شد.':'Voice note sent.';await loadCases();}catch(err){status.textContent=(isFa?'ارسال ناموفق بود: ':'Upload failed: ')+err.message;}finally{button.disabled=false;}return;}
  const msgForm=e.target.closest('.expert-message-form');if(msgForm){e.preventDefault();const v=Object.fromEntries(new FormData(msgForm).entries());const {error}=await supabase.from('expert_consultation_messages').insert({consultation_id:msgForm.dataset.consultationId,sender_user_id:profile.id,message_text:v.message_text.trim(),content_parts:[]});if(error)alert(error.message);else await loadCases();return;}
  const report=e.target.closest('.expert-report-form');if(report){e.preventDefault();const v=Object.fromEntries(new FormData(report).entries()),button=report.querySelector('button[type=submit]');button.disabled=true;const {error}=await supabase.from('expert_request_reports').insert({request_id:report.dataset.requestId,consultation_id:report.dataset.consultationId,author_user_id:profile.id,summary:v.summary.trim(),recommendations:v.recommendations||null,limitations:v.limitations||null,evidence_notes:[]});report.querySelector('.message').textContent=error?error.message:(isFa?'گزارش ثبت شد.':'Report submitted.');button.disabled=false;}
 });
 await load();
 if(profile?.id && !root.dataset.expertMessageRealtime){
  root.dataset.expertMessageRealtime='1';
  supabase.channel('sarina-expert-messages-'+profile.id)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'expert_consultation_messages'},()=>loadCases())
   .subscribe();
 }
}

export function renderFarmerCasesSection(lang='fa') {
 const isFa=fa(lang);
 return `<section id="farmerExpertCases" class="panel farmer-expert-cases"><div class="section-head"><div><h2>${isFa?'درخواست‌های مشاوره من':'My expert consultations'}</h2><p>${isFa?'پیام‌ها و گزارش‌های متخصصان را از اینجا پیگیری کنید.':'Track expert messages and reports here.'}</p></div><button type="button" class="quiet-btn" id="refreshFarmerCases">${isFa?'به‌روزرسانی':'Refresh'}</button></div><div id="farmerExpertCasesList"><p class="fineprint">${isFa?'در حال بارگذاری…':'Loading…'}</p></div></section>`;
}
export function bindFarmerCases({root,supabase,getProfile,language}) {
 const isFa=fa(language), list=root.querySelector('#farmerExpertCasesList');
 bindVoiceRecorder(root,isFa);
 async function load(){
  const current=getProfile();if(!current){list.textContent=isFa?'ابتدا وارد شوید.':'Sign in first.';return;}
  const {data:requests,error}=await supabase.from('expert_requests').select('id,subject,problem_description,status,created_at,assigned_expert_profile_id').eq('requester_user_id',current.id).order('created_at',{ascending:false}).limit(30);
  if(error){list.textContent=error.message;return;}
  if(!requests?.length){list.innerHTML='<p class="fineprint">'+(isFa?'هنوز درخواست مشاوره‌ای ثبت نکرده‌اید.':'You have not submitted an expert request yet.')+'</p>';return;}
  const cards=[];
  for(const r of requests){
   const {data:consult}=await supabase.from('expert_consultations').select('id').eq('request_id',r.id).maybeSingle();
   const {data:expert}=await supabase.from('expert_profiles').select('public_name').eq('id',r.assigned_expert_profile_id).maybeSingle();
   const {data:messages}=consult?.id?await supabase.from('expert_consultation_messages').select('sender_user_id,message_text,content_parts,created_at').eq('consultation_id',consult.id).order('created_at').limit(30):{data:[]};
   const {data:reports}=await supabase.from('expert_request_reports').select('summary,recommendations,limitations,created_at').eq('request_id',r.id).order('created_at',{ascending:false});
   const messageHtml = await renderConsultationMessages({supabase,messages,viewerId:current.id,isFa});
   cards.push(`<article class="expert-case-card"><div class="section-head"><div><h4>${esc(r.subject)}</h4><p>${esc(r.problem_description)}</p><small>${isFa?'متخصص: ':'Expert: '}${esc(expert?.public_name||'—')}</small></div><span class="expert-status">${esc(r.status)}</span></div>
   <div class="expert-messages">${messageHtml}</div>
   ${consult?.id?'<form class="farmer-case-message-form" data-consultation-id="'+esc(consult.id)+'"><textarea name="message_text" rows="2" maxlength="6000" required placeholder="'+(isFa?'پیام شما به متخصص…':'Message the expert…')+'"></textarea><button class="quiet-btn" type="submit">'+(isFa?'ارسال پیام':'Send message')+'</button></form>'+voiceFormMarkup(consult.id,isFa,'farmer'):''}
   ${(reports||[]).map(x=>'<details class="expert-report-view"><summary>'+(isFa?'گزارش کارشناسی':'Expert report')+'</summary><p><b>'+(isFa?'خلاصه: ':'Summary: ')+'</b>'+esc(x.summary)+'</p>'+(x.recommendations?'<p><b>'+(isFa?'پیشنهادها: ':'Recommendations: ')+'</b>'+esc(x.recommendations)+'</p>':'')+(x.limitations?'<p><b>'+(isFa?'محدودیت‌ها: ':'Limitations: ')+'</b>'+esc(x.limitations)+'</p>':'')+'</details>').join('')||'<p class="fineprint">'+(isFa?'گزارش نهایی هنوز ثبت نشده است.':'No expert report yet.')+'</p>'}
   </article>`);
  }
  list.innerHTML=cards.join('');
 }
 root.querySelector('#refreshFarmerCases')?.addEventListener('click',load);
 root.addEventListener('submit',async e=>{
  const voiceForm=e.target.closest('.farmer-voice-form');if(voiceForm){e.preventDefault();const current=getProfile(),button=voiceForm.querySelector('button[type=submit]'),status=voiceForm.querySelector('.message'),file=voiceForm.elements.voice_file.files?.[0];button.disabled=true;status.textContent=isFa?'در حال ارسال فایل صوتی…':'Uploading voice note…';try{await uploadConsultationVoice({supabase,consultationId:voiceForm.dataset.consultationId,userId:current.id,file});voiceForm.reset();status.textContent=isFa?'پیام صوتی ارسال شد.':'Voice note sent.';await load();}catch(err){status.textContent=(isFa?'ارسال ناموفق بود: ':'Upload failed: ')+err.message;}finally{button.disabled=false;}return;}
  const form=e.target.closest('.farmer-case-message-form');if(!form)return;e.preventDefault();
  const current=getProfile(),v=Object.fromEntries(new FormData(form).entries());
  const {error}=await supabase.from('expert_consultation_messages').insert({consultation_id:form.dataset.consultationId,sender_user_id:current.id,message_text:v.message_text.trim(),content_parts:[]});
  if(error)alert(error.message);else await load();
 });
 const initialProfile=getProfile();
 if(initialProfile?.id && !root.dataset.farmerMessageRealtime){
  root.dataset.farmerMessageRealtime='1';
  supabase.channel('sarina-farmer-messages-'+initialProfile.id)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'expert_consultation_messages'},()=>load())
   .subscribe();
 }
 load();
}
