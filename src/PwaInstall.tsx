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
  if(window.matchMedia("(display-mode: standalone)").matches)setInstalled(true);
  return()=>{window.removeEventListener("beforeinstallprompt",onBefore);window.removeEventListener("appinstalled",onInstalled);};
 },[]);
 async function install(){
  if(!promptEvent){setShowHelp(true);return;}
  await promptEvent.prompt();
  const choice=await promptEvent.userChoice;
  if(choice.outcome==="accepted")setPromptEvent(null);
 }
 if(installed)return null;
 return <div className="pwa-install-wrap">
  {showHelp&&<div className="pwa-help" role="dialog" aria-label="راهنمای نصب سارینا">
   <button className="pwa-help-close" onClick={()=>setShowHelp(false)} aria-label="بستن"><X size={16}/></button>
   <strong>نصب سارینا روی گوشی</strong>
   <p>در مرورگر Chrome، منوی سه‌نقطه را باز کن و گزینه «Install app» یا «افزودن به صفحه اصلی» را بزن.</p>
   <p>در iPhone و Safari، دکمه Share را بزن و سپس «Add to Home Screen» را انتخاب کن.</p>
  </div>}
  <button className="pwa-install-button" onClick={install}>
   {promptEvent?<Download size={17}/>:<Share2 size={17}/>}
   <span>نصب اپلیکیشن سارینا</span>
  </button>
 </div>;
}
