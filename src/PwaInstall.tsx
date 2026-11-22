import {useEffect,useState} from "react";
import {Download,Share2,X} from "lucide-react";

type InstallPromptEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:"accepted"|"dismissed"}>};

export default function PwaInstall(){
 const[promptEvent,setPromptEvent]=useState<InstallPromptEvent|null>(null);
 const[showHelp,setShowHelp]=useState(false);
 const[installed,setInstalled]=useState(false);
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
  if(!promptEvent){setShowHelp(true);return;}
  try{
   await promptEvent.prompt();
   const choice=await promptEvent.userChoice;
   if(choice.outcome==="accepted"){setPromptEvent(null);setShowHelp(false);}
  }catch{setShowHelp(true);}
 }
 if(installed)return null;
 return <div className="pwa-install-wrap">
  {showHelp&&<div className="pwa-help" role="dialog" aria-label="راهنمای نصب سارینا">
   <button className="pwa-help-close" onClick={()=>setShowHelp(false)} aria-label="بستن"><X size={16}/></button>
   <strong>نصب سارینا روی گوشی</strong>
   <p>در Android و مرورگرهای Chrome یا Edge، منوی مرورگر را باز کن و گزینه «Install app» یا «افزودن به صفحه اصلی» را انتخاب کن.</p>
   <p>در iPhone و Safari، دکمه Share را بزن و سپس «Add to Home Screen» را انتخاب کن.</p>
  </div>}
  <button className="pwa-install-button" onClick={install}>
   {promptEvent?<Download size={17}/>:<Share2 size={17}/>}
   <span>نصب اپلیکیشن سارینا</span>
  </button>
 </div>;
}
