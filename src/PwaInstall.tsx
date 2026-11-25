import {useEffect,useState} from "react";
import {Download,Share2,X} from "lucide-react";

type InstallPromptEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:"accepted"|"dismissed"}>};

export default function PwaInstall(){
 const[promptEvent,setPromptEvent]=useState<InstallPromptEvent|null>(null);
 const[showHelp,setShowHelp]=useState(false);
 const[installed,setInstalled]=useState(false);
 const[shareStatus,setShareStatus]=useState("");
 useEffect(()=>{
  const onBefore=(event:Event)=>{event.preventDefault();setPromptEvent(event as InstallPromptEvent);};
  const onInstalled=()=>{setInstalled(true);setPromptEvent(null);setShowHelp(false);};
  window.addEventListener("beforeinstallprompt",onBefore);
  window.addEventListener("appinstalled",onInstalled);
  const isStandalone=window.matchMedia("(display-mode: standalone)").matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;
  if(isStandalone)setInstalled(true);
  const displayMode=window.matchMedia("(display-mode: standalone)");
  const onDisplayMode=()=>{if(displayMode.matches)setInstalled(true);};
  displayMode.addEventListener?.("change",onDisplayMode);
  return()=>{window.removeEventListener("beforeinstallprompt",onBefore);window.removeEventListener("appinstalled",onInstalled);displayMode.removeEventListener?.("change",onDisplayMode);};
 },[]);
 async function install(){
  if(!promptEvent){setShowHelp(value=>!value);return;}
  try{await promptEvent.prompt();const choice=await promptEvent.userChoice;if(choice.outcome==="accepted"){setPromptEvent(null);setShowHelp(false);}}
  catch{setShowHelp(true);}
 }
 async function share(){
  const shareData={title:"SARINA",text:"همراه هوشمند کشاورزی؛ هیچ کشاورزی تنها نیست.",url:window.location.origin};
  try{
   if(navigator.share){await navigator.share(shareData);setShareStatus("اشتراک‌گذاری انجام شد.");}
   else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(shareData.url);setShareStatus("پیوند SARINA کپی شد.");}
   else setShareStatus("برای اشتراک‌گذاری، پیوند سامانه را از نوار نشانی مرورگر کپی کنید.");
  }catch(error){if(error instanceof Error&&error.name!=="AbortError")setShareStatus("اشتراک‌گذاری انجام نشد؛ دوباره تلاش کنید.");}
 }
 return <div className="pwa-install-wrap pwa-install-embedded" dir="rtl">
  {showHelp&&<div className="pwa-help" role="dialog" aria-label="راهنمای نصب سارینا">
   <button className="pwa-help-close" onClick={()=>setShowHelp(false)} aria-label="بستن"><X size={15}/></button>
   <strong>نصب SARINA روی گوشی</strong>
   <p>در Android و مرورگرهای Chrome یا Edge، منوی مرورگر را باز کنید و گزینه «Install app» یا «افزودن به صفحه اصلی» را انتخاب کنید.</p>
   <p>در iPhone و Safari، دکمه Share را بزنید و سپس «Add to Home Screen» را انتخاب کنید.</p>
  </div>}
  <div className="pwa-install-actions">
   {!installed&&<button className="pwa-install-button" onClick={install}><Download size={16}/><span>نصب اپلیکیشن</span></button>}
   <button className="pwa-share-button" onClick={share}><Share2 size={16}/><span>اشتراک‌گذاری SARINA</span></button>
  </div>
  {shareStatus&&<div className="pwa-share-status" role="status"><span>{shareStatus}</span><button onClick={()=>setShareStatus("")} aria-label="بستن پیام"><X size={13}/></button></div>}
 </div>;
}
