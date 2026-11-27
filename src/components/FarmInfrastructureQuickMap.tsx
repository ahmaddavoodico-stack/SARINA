import {useEffect,useRef,useState} from "react";
import {Home,Warehouse,Beef,Route,Save,Undo2} from "lucide-react";
import {supabase} from "../lib/supabase";

type Field={id:string;field_name:string;boundary:any};
type Tool="house"|"warehouse"|"livestock"|"road";
type QuickAsset={id:string;asset_name:string;location:any;metadata:Record<string,any>;status:string};
type QuickRoute={id:string;geometry:any;attributes:Record<string,any>;status:string};
declare global{interface Window{L?:any}}
const db=supabase as any;
const labels:Record<Exclude<Tool,"road">,string>={house:"خانه",warehouse:"انبار",livestock:"دامداری"};
const icons:Record<Tool,string>={house:"🏠",warehouse:"🏚️",livestock:"🐄",road:"🛣️"};
const parse=(v:any)=>{try{return typeof v==="string"?JSON.parse(v):v;}catch{return null;}};
function fieldCoordinates(fields:Field[]){const all:any[]=[];for(const f of fields){const g=parse(f.boundary);if(!g?.type)continue;const polys=g.type==="Polygon"?[g.coordinates]:g.type==="MultiPolygon"?g.coordinates:[];for(const p of polys)for(const ring of p)for(const xy of ring)all.push([Number(xy[1]),Number(xy[0])]);}return all;}
export default function FarmInfrastructureQuickMap({farmId,fields,userId}:{farmId:string;fields:Field[];userId:string}){
 const host=useRef<HTMLDivElement>(null),mapRef=useRef<any>(null),layerRef=useRef<any>(null);
 const[tool,setTool]=useState<Tool>("house"),[scale,setScale]=useState(1),[assets,setAssets]=useState<QuickAsset[]>([]),[routes,setRoutes]=useState<QuickRoute[]>([]),[vertices,setVertices]=useState<[number,number][]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(""),[ready,setReady]=useState(false);
 const load=async()=>{const [a,r]=await Promise.all([db.from("farm_assets").select("id,asset_name,location,metadata,status").eq("farm_id",farmId).eq("status","active").limit(500),db.from("farm_map_features").select("id,geometry,attributes,status").eq("farm_id",farmId).eq("feature_type","farm_route").eq("status","active").limit(200)]);if(a.error||r.error){setError("دریافت زیرساخت‌های نقشه انجام نشد.");return;}setAssets(((a.data??[]) as QuickAsset[]).filter(x=>x.metadata?.quick_map_asset===true));setRoutes((r.data??[]) as QuickRoute[]);};
 useEffect(()=>{void load();},[farmId]);
 useEffect(()=>{
  if(!host.current||!window.L||mapRef.current)return;const L=window.L;let map:any;
  try{map=L.map(host.current,{zoomControl:true,scrollWheelZoom:false}).setView([0,0],2);L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19,attribution:"Tiles © Esri"}).addTo(map);const layer=L.layerGroup().addTo(map);mapRef.current=map;layerRef.current=layer;
   for(const f of fields){const g=parse(f.boundary);if(g?.type)L.geoJSON(g,{style:{color:"#f6fff5",weight:2,fillOpacity:.025,dashArray:"5 4"}}).addTo(layer);}
   const bounds=fieldCoordinates(fields);if(bounds.length)map.fitBounds(L.latLngBounds(bounds),{padding:[24,24],maxZoom:18});
   map.on("click",async(e:any)=>{const point:[number,number]=[e.latlng.lng,e.latlng.lat];if(tool==="road"){setVertices(v=>[...v,[e.latlng.lat,e.latlng.lng]]);return;}setBusy(true);setError("");const subtype=tool;const payload={farm_id:farmId,asset_type:"other",asset_name:labels[subtype],location:{type:"Point",coordinates:point},location_source:"farmer_pin",position_accuracy_m:null,is_location_confirmed:false,location_confirmed_at:null,status:"active",metadata:{quick_map_asset:true,asset_subtype:subtype,icon_scale:scale,location_precision:"approximate",registration_phase:1},created_by_auth_user_id:userId};const saved=await db.from("farm_assets").insert(payload).select("id,asset_name,location,metadata,status").single();if(saved.error)setError("ثبت موقعیت انجام نشد: "+saved.error.message);else setAssets(v=>[saved.data,...v]);setBusy(false);});
   setReady(true);
  }catch{setError("نقشه ثبت زیرساخت بارگذاری نشد.");}
  return()=>{if(mapRef.current){mapRef.current.remove();mapRef.current=null;layerRef.current=null;}};
 },[farmId,fields,tool,scale,userId]);
 useEffect(()=>{const L=window.L,layer=layerRef.current;if(!L||!layer)return;layer.clearLayers();for(const f of fields){const g=parse(f.boundary);if(g?.type)L.geoJSON(g,{style:{color:"#f6fff5",weight:2,fillOpacity:.025,dashArray:"5 4"}}).addTo(layer);}
  for(const a of assets){const g=parse(a.location),xy=g?.type==="Point"?g.coordinates:null;if(!Array.isArray(xy)||xy.length<2)continue;const subtype=a.metadata?.asset_subtype as Tool;const size=Math.round(30*Math.max(.7,Math.min(1.6,Number(a.metadata?.icon_scale)||1)));const marker=L.marker([Number(xy[1]),Number(xy[0])],{icon:L.divIcon({className:"sarina-quick-map-icon",html:'<span style="width:'+size+'px;height:'+size+'px;font-size:'+Math.round(size*.72)+'px">'+(icons[subtype]||"📍")+'</span>',iconSize:[size,size],iconAnchor:[size/2,size/2]})}).addTo(layer);marker.bindTooltip(a.asset_name+" · موقعیت تقریبی");}
  for(const r of routes){const g=parse(r.geometry);if(g?.type)L.geoJSON(g,{style:{color:"#f1a72e",weight:5,dashArray:"8 5"}}).bindTooltip(r.attributes?.name||"مسیر دسترسی تقریبی").addTo(layer);}
  if(vertices.length){L.polyline(vertices,{color:"#f1a72e",weight:5,dashArray:"8 5"}).addTo(layer);vertices.forEach(v=>L.circleMarker(v,{radius:4,color:"#fff",fillColor:"#f1a72e",fillOpacity:1}).addTo(layer));}
 },[fields,assets,routes,vertices]);
 const saveRoute=async()=>{if(vertices.length<2){setError("برای ثبت مسیر، حداقل دو نقطه روی نقشه انتخاب کن.");return;}setBusy(true);setError("");const geometry={type:"LineString",coordinates:vertices.map(([lat,lng])=>[lng,lat])};const r=await db.from("farm_map_features").insert({farm_id:farmId,feature_type:"farm_route",geometry,geometry_source:"farmer_drawn",position_accuracy_m:null,is_geometry_confirmed:false,geometry_confirmed_at:null,status:"active",attributes:{name:"مسیر دسترسی",route_type:"access_road",location_precision:"approximate",registration_phase:1},created_by_auth_user_id:userId}).select("id").single();if(r.error)setError("ذخیره مسیر انجام نشد: "+r.error.message);else{setVertices([]);await load();}setBusy(false);};
 return <section className="myfarm-quick-infrastructure" aria-label="ثبت سریع خانه، انبار، دامداری و جاده">
  <div className="myfarm-quick-infrastructure-head"><div><b>ثبت سریع زیرساخت‌های مزرعه</b><small>بدون فرم و پرسش اضافه؛ فقط ابزار را انتخاب کن و روی نقشه بزن.</small></div><span>{assets.length.toLocaleString("fa-IR")} نشانگر</span></div>
  <div className="myfarm-quick-tools" role="group" aria-label="ابزارهای ثابت نقشه">
   <button type="button" className={tool==="house"?"active":""} onClick={()=>{setTool("house");setVertices([]);}}><Home size={17}/>خانه</button>
   <button type="button" className={tool==="warehouse"?"active":""} onClick={()=>{setTool("warehouse");setVertices([]);}}><Warehouse size={17}/>انبار</button>
   <button type="button" className={tool==="livestock"?"active":""} onClick={()=>{setTool("livestock");setVertices([]);}}><Beef size={17}/>دامداری</button>
   <button type="button" className={tool==="road"?"active":""} onClick={()=>{setTool("road");setVertices([]);}}><Route size={17}/>جاده</button>
  </div>
  {tool!=="road"&&<label className="myfarm-quick-scale">اندازه آیکون <input type="range" min=".7" max="1.6" step=".1" value={scale} onChange={e=>setScale(Number(e.target.value))}/><b>{Math.round(scale*100)}٪</b></label>}
  <div className="myfarm-quick-map" ref={host} aria-label="نقشه ماهواره‌ای ثبت سریع زیرساخت‌ها"/>
  <p className="myfarm-quick-hint">{tool==="road"?"برای ترسیم مسیر دسترسی، نقاط مسیر را روی نقشه انتخاب کن و سپس ذخیره را بزن.":"ابزار انتخاب‌شده را روی محل تقریبی آن در نقشه لمس کن. اندازه آیکون فقط نمایشی است و ابعاد واقعی را تغییر نمی‌دهد."}</p>
  {tool==="road"&&<div className="myfarm-quick-actions"><span>{vertices.length.toLocaleString("fa-IR")} نقطه مسیر</span><button type="button" onClick={()=>setVertices([])} disabled={!vertices.length||busy}><Undo2 size={14}/> پاک‌کردن مسیر</button><button type="button" onClick={saveRoute} disabled={busy||vertices.length<2}><Save size={14}/> ذخیره مسیر</button></div>}
  {error&&<p className="myfarm-quick-error" role="alert">{error}</p>}
  {busy&&<p className="myfarm-quick-hint">در حال ذخیره…</p>}
  <p className="myfarm-quick-footnote">تمام موارد این بخش با برچسب «موقعیت تقریبی ـ فاز اول» ذخیره می‌شوند و برای اندازه‌گیری یا تحلیل دقیق زیرساخت به کار نمی‌روند تا در فاز دوم بازبینی و تأیید شوند.</p>
 </section>;
}
