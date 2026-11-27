import {useEffect,useRef,useState} from "react";
import {Check,MapPin,Plus,Save,X} from "lucide-react";
import {supabase} from "../lib/supabase";

type Field={id:string;field_name:string;boundary:any};
type PondStatus="active"|"inactive"|"retired"|"removed";
type PondFeature={id:string;farm_id:string;field_id:string|null;feature_type:"pond"|"reservoir";geometry:any;is_geometry_confirmed:boolean;status:PondStatus;width_m:number|null;depth_m:number|null;length_m:number|null;capacity_value:number|null;capacity_unit:string|null;attributes:Record<string,any>};
declare global{interface Window{L?:any}}
const db=supabase as any;
function parseGeometry(value:any){try{return typeof value==="string"?JSON.parse(value):value;}catch{return null;}}
const statusLabel=(s:PondStatus)=>({active:"فعال",inactive:"غیرفعال",retired:"از رده خارج",removed:"جمع‌آوری‌شده"}[s]);
const purposeLabel=(s:string)=>(({irrigation:"ذخیره آب آبیاری",emergency:"ذخیره اضطراری",settling:"ته‌نشینی و رسوب‌گیری",treatment:"تصفیه و آماده‌سازی",aquaculture:"آبزی‌پروری",rainwater:"جمع‌آوری آب باران",fertigation:"آب کودآبیاری",mixed:"کاربری ترکیبی",other:"سایر"} as Record<string,string>)[s]||"ثبت نشده");
export default function FarmPondsManager({farmId,fields,userId}:{farmId:string;fields:Field[];userId:string}){
 const[items,setItems]=useState<PondFeature[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const[open,setOpen]=useState(false),[drawing,setDrawing]=useState(false),[vertices,setVertices]=useState<[number,number][]>([]),[busy,setBusy]=useState(false);
 const[name,setName]=useState(""),[kind,setKind]=useState<"pond"|"reservoir">("pond"),[status,setStatus]=useState<PondStatus>("active"),[fieldId,setFieldId]=useState("");
 const[purpose,setPurpose]=useState("irrigation"),[construction,setConstruction]=useState("unknown"),[waterSource,setWaterSource]=useState(""),[width,setWidth]=useState(""),[length,setLength]=useState(""),[depth,setDepth]=useState(""),[capacity,setCapacity]=useState(""),[capacitySource,setCapacitySource]=useState("farmer_reported"),[notes,setNotes]=useState("");
 const mapHost=useRef<HTMLDivElement>(null),mapRef=useRef<any>(null),layerRef=useRef<any>(null),drawingRef=useRef(false),verticesRef=useRef<[number,number][]>([]);
 const load=async()=>{setLoading(true);const r=await db.from("farm_map_features").select("id,farm_id,field_id,feature_type,geometry,is_geometry_confirmed,status,width_m,depth_m,length_m,capacity_value,capacity_unit,attributes").eq("farm_id",farmId).in("feature_type",["pond","reservoir"]).order("created_at",{ascending:false}).limit(500);if(r.error){setError("دریافت استخرها انجام نشد: "+r.error.message);setItems([]);}else{setItems((r.data??[]) as PondFeature[]);setError("");}setLoading(false);};
 useEffect(()=>{void load();},[farmId]);
 useEffect(()=>{
  if(!mapHost.current||!window.L||mapRef.current)return;
  const L=window.L;let map:any;
  try{
   map=L.map(mapHost.current,{zoomControl:true,scrollWheelZoom:false,doubleClickZoom:false}).setView([0,0],2);
   L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19,attribution:"Tiles © Esri"}).addTo(map);
   const layer=L.layerGroup().addTo(map);mapRef.current=map;layerRef.current=layer;
   map.on("click",(e:any)=>{if(!drawingRef.current)return;const next:[number,number]=[e.latlng.lat,e.latlng.lng];verticesRef.current=[...verticesRef.current,next];setVertices(verticesRef.current);});
   const all:any[]=[];for(const f of fields){const g=parseGeometry(f.boundary);if(g?.type==="Polygon"||g?.type==="MultiPolygon"){const polygons=g.type==="Polygon"?[g.coordinates]:g.coordinates;for(const polygon of polygons)for(const ring of polygon)for(const xy of ring)all.push([Number(xy[1]),Number(xy[0])]);}}
   if(all.length)map.fitBounds(L.latLngBounds(all),{padding:[20,20],maxZoom:18});
  }catch{setError("نقشه ترسیم استخر بارگذاری نشد.");}
  return()=>{if(mapRef.current){mapRef.current.remove();mapRef.current=null;layerRef.current=null;}};
 },[farmId,open]);
 useEffect(()=>{
  const L=window.L,layer=layerRef.current,map=mapRef.current;if(!L||!layer||!map)return;layer.clearLayers();
  for(const f of fields){const g=parseGeometry(f.boundary);if(g?.type)try{L.geoJSON(g,{style:{color:"#f5f7f3",weight:2,fillOpacity:0.02,dashArray:"5 4"}}).addTo(layer);}catch{}}
  for(const p of items){const g=parseGeometry(p.geometry);if(!g?.type)continue;try{const poly=L.geoJSON(g,{style:{color:p.status==="active"?"#2d9a60":"#a0a7a1",weight:3,fillColor:p.status==="active"?"#36ad73":"#9ba39e",fillOpacity:p.status==="active"?.32:.16,dashArray:p.status==="active"?"":"6 5"}}).addTo(layer);poly.bindTooltip((p.attributes?.name||"استخر")+" · "+statusLabel(p.status));}catch{}}
  if(vertices.length){const line=L.polyline(vertices,{color:"#f2b544",weight:3,dashArray:"5 4"}).addTo(layer);vertices.forEach(v=>L.circleMarker(v,{radius:4,color:"#fff",fillColor:"#d9902f",fillOpacity:1}).addTo(layer));if(vertices.length>=3)L.polygon(vertices,{color:"#e7a43a",weight:2,fillOpacity:.12}).addTo(layer);if(vertices.length>1)map.fitBounds(line.getBounds(),{padding:[35,35],maxZoom:19});}
 },[fields,items,vertices,open]);
 const reset=()=>{setOpen(false);setDrawing(false);drawingRef.current=false;verticesRef.current=[];setVertices([]);setName("");setKind("pond");setStatus("active");setFieldId("");setPurpose("irrigation");setConstruction("unknown");setWaterSource("");setWidth("");setLength("");setDepth("");setCapacity("");setCapacitySource("farmer_reported");setNotes("");setError("");};
 const startDrawing=()=>{verticesRef.current=[];setVertices([]);drawingRef.current=true;setDrawing(true);setError("روی تصویر ماهواره‌ای حداقل سه نقطه از گوشه‌های استخر را انتخاب کن؛ سپس «پایان ترسیم» را بزن.");};
 const finishDrawing=()=>{drawingRef.current=false;setDrawing(false);if(verticesRef.current.length<3){setError("برای ثبت محدوده استخر حداقل سه نقطه لازم است.");return;}setError("");};
 const save=async()=>{if(!name.trim()||vertices.length<3)return;const L=window.L;if(!L){setError("کتابخانه نقشه در دسترس نیست.");return;}setBusy(true);setError("");const geometry=L.polygon(vertices).toGeoJSON().geometry;const number=(v:string)=>v.trim()===""?null:Number(v);const numeric=[width,length,depth,capacity].map(number);if(numeric.some(v=>v!==null&&(!Number.isFinite(v)||v<0))){setError("ابعاد و ظرفیت باید عددی مثبت یا صفر باشند.");setBusy(false);return;}
  const payload={farm_id:farmId,field_id:fieldId||null,feature_type:kind,geometry,geometry_source:"farmer_drawn",is_geometry_confirmed:true,geometry_confirmed_at:new Date().toISOString(),status,width_m:numeric[0],length_m:numeric[1],depth_m:numeric[2],capacity_value:numeric[3],capacity_unit:numeric[3]===null?null:"m3",attributes:{name:name.trim(),purpose,construction,water_source:waterSource.trim()||null,capacity_source:numeric[3]===null?null:capacitySource,notes:notes.trim()||null,created_by_auth_user_id:userId}};
  const r=await db.from("farm_map_features").insert(payload).select("id").single();if(r.error){setError("ثبت استخر انجام نشد: "+r.error.message);setBusy(false);return;}await load();setBusy(false);reset();
 };
 const updateStatus=async(item:PondFeature,next:PondStatus)=>{setBusy(true);const r=await db.from("farm_map_features").update({status:next}).eq("id",item.id).eq("farm_id",farmId);if(r.error)setError("تغییر وضعیت ذخیره نشد: "+r.error.message);else await load();setBusy(false);};
 const activeCount=items.filter(x=>x.status==="active").length;
 return <section className="myfarm-ponds" aria-label="ثبت و مدیریت استخرهای مزرعه">
  <div className="myfarm-ponds-head"><div><b>استخرها و مخازن روباز</b><small>هر استخر یک محدوده و وضعیت مستقل دارد؛ استخر غیرفعال از پرونده حذف نمی‌شود.</small></div><button type="button" onClick={()=>{setOpen(true);setError("");}}><Plus size={15}/> افزودن استخر</button></div>
  <div className="myfarm-ponds-summary"><span>مجموع ثبت‌شده: <b>{items.length.toLocaleString("fa-IR")}</b></span><span>فعال: <b>{activeCount.toLocaleString("fa-IR")}</b></span><span>غیرفعال و سایر: <b>{(items.length-activeCount).toLocaleString("fa-IR")}</b></span></div>
  {error&&<p className="myfarm-ponds-error" role="alert">{error}</p>}
  {open&&<div className="myfarm-pond-form">
   <div className="myfarm-pond-form-head"><b>ثبت استخر جدید</b><button type="button" onClick={reset} aria-label="بستن"><X size={17}/></button></div>
   <label>نام استخر<input value={name} onChange={e=>setName(e.target.value)} placeholder="مثلاً استخر ذخیره آب شماره ۱" maxLength={120}/></label>
   <div className="myfarm-pond-grid">
    <label>نوع<select value={kind} onChange={e=>setKind(e.target.value as "pond"|"reservoir")}><option value="pond">استخر</option><option value="reservoir">مخزن ذخیره روباز</option></select></label>
    <label>وضعیت فعلی<select value={status} onChange={e=>setStatus(e.target.value as PondStatus)}><option value="active">فعال</option><option value="inactive">غیرفعال</option><option value="retired">از رده خارج</option></select></label>
    <label>قطعه مربوط (اختیاری)<select value={fieldId} onChange={e=>setFieldId(e.target.value)}><option value="">بدون تعیین قطعه</option>{fields.map(f=><option key={f.id} value={f.id}>{f.field_name}</option>)}</select></label>
    <label>کاربری<select value={purpose} onChange={e=>setPurpose(e.target.value)}><option value="irrigation">ذخیره آب آبیاری</option><option value="emergency">ذخیره اضطراری</option><option value="settling">ته‌نشینی و رسوب‌گیری</option><option value="treatment">تصفیه و آماده‌سازی</option><option value="aquaculture">آبزی‌پروری</option><option value="rainwater">جمع‌آوری آب باران</option><option value="fertigation">آب کودآبیاری</option><option value="mixed">کاربری ترکیبی</option><option value="other">سایر</option></select></label>
    <label>نوع سازه<select value={construction} onChange={e=>setConstruction(e.target.value)}><option value="unknown">نامشخص</option><option value="earth">خاکی</option><option value="concrete">بتنی</option><option value="geomembrane">ژئوممبران</option><option value="lined">دارای پوشش</option><option value="other">سایر</option></select></label>
    <label>منبع تأمین آب<input value={waterSource} onChange={e=>setWaterSource(e.target.value)} placeholder="مثلاً کانال یا چاه"/></label>
   </div>
   <div className="myfarm-pond-grid myfarm-pond-numbers">
    <label>طول (متر)<input inputMode="decimal" value={length} onChange={e=>setLength(e.target.value)} placeholder="اختیاری"/></label><label>عرض (متر)<input inputMode="decimal" value={width} onChange={e=>setWidth(e.target.value)} placeholder="اختیاری"/></label><label>عمق (متر)<input inputMode="decimal" value={depth} onChange={e=>setDepth(e.target.value)} placeholder="اختیاری"/></label><label>ظرفیت (مترمکعب)<input inputMode="decimal" value={capacity} onChange={e=>setCapacity(e.target.value)} placeholder="اختیاری"/></label>
   </div>
   {capacity.trim()!==""&&<label>منبع ظرفیت<select value={capacitySource} onChange={e=>setCapacitySource(e.target.value)}><option value="farmer_reported">اعلام کشاورز</option><option value="measured">اندازه‌گیری‌شده</option><option value="calculated">محاسبه‌شده از ابعاد</option></select></label>}
   <label>یادداشت<textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="توضیحات تکمیلی، وضعیت تعمیرات و…"/></label>
   <div className="myfarm-pond-draw"><div><b>محدوده واقعی استخر روی نقشه</b><small>{vertices.length.toLocaleString("fa-IR")} نقطه ثبت شده</small></div><div><button type="button" onClick={startDrawing}><MapPin size={14}/> {drawing?"ترسیم دوباره":"شروع ترسیم محدوده"}</button>{drawing&&<button type="button" onClick={finishDrawing}><Check size={14}/> پایان ترسیم</button>}</div></div>
   <div className="myfarm-pond-map" ref={mapHost}/>
   <p className="myfarm-pond-hint">برای ثبت محدوده، گوشه‌های استخر را روی تصویر ماهواره‌ای لمس کن. حداقل سه نقطه لازم است. فقط پس از ترسیم و تأیید محدوده، اطلاعات ذخیره می‌شود.</p>
   <div className="myfarm-pond-actions"><button type="button" onClick={reset}>انصراف</button><button type="button" disabled={busy||drawing||vertices.length<3||!name.trim()} onClick={save}><Save size={14}/> تأیید و ذخیره استخر</button></div>
  </div>}
  {loading?<p className="myfarm-pond-hint">در حال دریافت استخرهای مزرعه…</p>:items.length===0?<p className="myfarm-pond-hint">هنوز استخری برای این مزرعه ثبت نشده است.</p>:<div className="myfarm-pond-list">{items.map(item=><article key={item.id}><div className="myfarm-pond-info"><span className={"myfarm-pond-status "+item.status}/><div><b>{item.attributes?.name|| (item.feature_type==="pond"?"استخر":"مخزن روباز")}</b><small>{item.feature_type==="pond"?"استخر":"مخزن روباز"} · {purposeLabel(item.attributes?.purpose)} · {statusLabel(item.status)}</small><small>{item.capacity_value!==null?"ظرفیت ثبت‌شده: "+item.capacity_value+" "+(item.capacity_unit==="m3"?"مترمکعب":item.capacity_unit||""):"ظرفیت ثبت نشده"}{item.is_geometry_confirmed?" · محدوده تأییدشده":" · محدوده تأییدنشده"}</small></div></div><label className="myfarm-pond-status-select">وضعیت<select value={item.status} disabled={busy} onChange={e=>updateStatus(item,e.target.value as PondStatus)}><option value="active">فعال</option><option value="inactive">غیرفعال</option><option value="retired">از رده خارج</option><option value="removed">جمع‌آوری‌شده</option></select></label></article>)}</div>}
 </section>;
}
