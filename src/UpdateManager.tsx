import {useEffect,useRef,useState} from "react";
import {RefreshCw,X} from "lucide-react";

export default function UpdateManager(){
 const[waiting,setWaiting]=useState<ServiceWorker|null>(null);
 const[dismissed,setDismissed]=useState(false);
 const reloading=useRef(false);

 useEffect(()=>{
  if(!("serviceWorker" in navigator)||!import.meta.env.PROD)return;
  let active=true;
  let registration:ServiceWorkerRegistration|undefined;
  const inspect=()=>{if(active&&registration?.waiting&&navigator.serviceWorker.controller)setWaiting(registration.waiting);};
  const onControllerChange=()=>{if(!reloading.current){reloading.current=true;window.location.reload();}};
  const onVisibility=()=>{if(document.visibilityState==="visible")void registration?.update().catch(()=>{});};
  const onMessage=(event:MessageEvent)=>{if(event.data?.type==="SARINA_UPDATE_READY")inspect();};

  navigator.serviceWorker.addEventListener("controllerchange",onControllerChange);
  navigator.serviceWorker.addEventListener("message",onMessage);
  document.addEventListener("visibilitychange",onVisibility);

  navigator.serviceWorker.register("/sw.js",{updateViaCache:"none"}).then(reg=>{
   if(!active)return;
   registration=reg;
   inspect();
   void reg.update().catch(()=>{});
   reg.addEventListener("updatefound",()=>{
    const installing=reg.installing;
    if(!installing)return;
    installing.addEventListener("statechange",()=>{
     if(installing.state==="installed"&&navigator.serviceWorker.controller)inspect();
    });
   });
  }).catch(error=>console.error("SARINA service worker registration failed:",error));

  const interval=window.setInterval(()=>{void registration?.update().catch(()=>{});},60*60*1000);
  return()=>{
   active=false;
   window.clearInterval(interval);
   navigator.serviceWorker.removeEventListener("controllerchange",onControllerChange);
   navigator.serviceWorker.removeEventListener("message",onMessage);
   document.removeEventListener("visibilitychange",onVisibility);
  };
 },[]);

 function applyUpdate(){
  if(!waiting)return;
  waiting.postMessage({type:"SKIP_WAITING"});
 }
 if(!waiting||dismissed)return null;
 return <aside className="sarina-update-banner" role="status" aria-live="polite" dir="rtl">
  <div className="sarina-update-copy"><strong>نسخه جدید سارینا آماده است</strong><span>به‌روزرسانی دریافت شده؛ هر زمان آماده بودید، برنامه را تازه کنید.</span></div>
  <button type="button" className="sarina-update-action" onClick={applyUpdate}><RefreshCw size={16}/> به‌روزرسانی</button>
  <button type="button" className="sarina-update-dismiss" onClick={()=>setDismissed(true)} aria-label="بعداً"><X size={16}/></button>
 </aside>;
}
