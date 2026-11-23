const CACHE="sarina-shell-v9";
const SHELL=[
 "/",
 "/manifest.webmanifest",
 "/sarina-logo.svg",
 "/sarina-icon-192.webp",
 "/sarina-icon-512.svg",
 "/sarina-icon-maskable.svg",
 "/apple-touch-icon.png"
];

self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
});

self.addEventListener("activate",event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith("sarina-shell-")&&key!==CACHE).map(key=>caches.delete(key)));
  await self.clients.claim();
  const clients=await self.clients.matchAll({type:"window",includeUncontrolled:true});
  clients.forEach(client=>client.postMessage({type:"SARINA_UPDATE_READY"}));
 })());
});

self.addEventListener("message",event=>{
 if(event.data?.type==="SKIP_WAITING")void self.skipWaiting();
});

self.addEventListener("fetch",event=>{
 const request=event.request;
 const url=new URL(request.url);
 if(request.method!=="GET"||url.origin!==self.location.origin)return;
 if(url.pathname.startsWith("/rest/")||url.pathname.startsWith("/auth/")||url.pathname.startsWith("/storage/"))return;

 if(request.mode==="navigate"){
  event.respondWith((async()=>{
   try{
    const response=await fetch(request,{cache:"no-store"});
    if(response.ok){const copy=response.clone();void caches.open(CACHE).then(cache=>cache.put("/",copy));}
    return response;
   }catch{return (await caches.match("/"))||Response.error();}
  })());
  return;
 }

 const hashedAsset=url.pathname.startsWith("/assets/")&&/[-.][a-zA-Z0-9_-]{8,}\.(js|css|woff2?|png|svg|webp|jpg)$/.test(url.pathname);
 if(hashedAsset){
  event.respondWith((async()=>{
   const cached=await caches.match(request);
   if(cached)return cached;
   const response=await fetch(request);
   if(response.ok){const copy=response.clone();void caches.open(CACHE).then(cache=>cache.put(request,copy));}
   return response;
  })());
  return;
 }

 if(["script","style","image","font"].includes(request.destination)){
  event.respondWith((async()=>{
   try{
    const response=await fetch(request);
    if(response.ok){const copy=response.clone();void caches.open(CACHE).then(cache=>cache.put(request,copy));}
    return response;
   }catch{return (await caches.match(request))||Response.error();}
  })());
 }
});
