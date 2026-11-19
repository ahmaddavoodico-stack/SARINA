const CACHE="sarina-shell-v2";
const SHELL=["/","/manifest.webmanifest","/icon-192.svg","/icon-512.svg","/favicon.svg"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));self.skipWaiting();});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("sarina-shell-")&&key!==CACHE).map(key=>caches.delete(key)))));self.clients.claim();});
self.addEventListener("fetch",event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=="GET"||url.origin!==self.location.origin||url.pathname.startsWith("/rest/")||url.pathname.startsWith("/auth/")||url.pathname.startsWith("/storage/"))return;
 if(request.mode==="navigate"){
  event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put("/",copy));}return response;}).catch(()=>caches.match("/")));
  return;
 }
 if(["script","style","image","font"].includes(request.destination)){
  event.respondWith(caches.match(request).then(cached=>{
   const network=fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}return response;});
   return cached||network;
  }));
 }
});
