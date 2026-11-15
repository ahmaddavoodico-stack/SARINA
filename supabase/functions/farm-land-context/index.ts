import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
function reply(status:number,payload:Record<string,unknown>){return new Response(JSON.stringify(payload),{status,headers:corsHeaders});}
function isRecord(value:unknown):value is Record<string,unknown>{return typeof value==="object"&&value!==null&&!Array.isArray(value);}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST")return reply(405,{ok:false,code:"METHOD_NOT_ALLOWED"});
 const authorization=req.headers.get("Authorization");
 if(!authorization?.startsWith("Bearer "))return reply(401,{ok:false,code:"AUTHORIZATION_REQUIRED"});
 let body:unknown;try{body=await req.json();}catch{return reply(400,{ok:false,code:"INVALID_JSON"});}
 if(!isRecord(body)||typeof body.farm_id!=="string")return reply(422,{ok:false,code:"FARM_ID_REQUIRED"});
 const farmId=body.farm_id.trim();
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(farmId))return reply(422,{ok:false,code:"INVALID_FARM_ID"});
 const url=Deno.env.get("SUPABASE_URL");const key=Deno.env.get("SUPABASE_ANON_KEY")??Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
 if(!url||!key)return reply(500,{ok:false,code:"SERVER_CONFIGURATION_ERROR"});
 const client=createClient(url,key,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:auth,error:authError}=await client.auth.getUser();
 if(authError||!auth.user)return reply(401,{ok:false,code:"INVALID_SESSION"});
 try{
  const [farmResult,locationResult,fieldsResult,soilResult,waterResult,observationResult,weatherResult]=await Promise.all([
   client.from("farms").select("id,farm_name,total_area,area_unit,status").eq("id",farmId).maybeSingle(),
   client.from("farm_locations").select("latitude,longitude,elevation_m,location_source,confirmed_by_user,captured_at,is_primary").eq("farm_id",farmId).eq("is_primary",true).limit(1).maybeSingle(),
   client.from("farm_fields").select("id,field_name,area,area_unit,soil_description,created_at").eq("farm_id",farmId).order("created_at",{ascending:true}),
   client.from("soil_tests").select("id,field_id,sampled_at,laboratory_name,test_method,soil_texture,ph,ec_ds_m,organic_matter_pct,calcium_carbonate_pct,nitrogen_mg_kg,phosphorus_mg_kg,potassium_mg_kg,cec_cmol_kg,data_source,notes,report_file_ref").eq("farm_id",farmId).order("sampled_at",{ascending:false}).limit(10),
   client.from("water_tests").select("id,sampled_at,water_source,laboratory_name,test_method,ph,ec_ds_m,tds_mg_l,sodium_mg_l,calcium_mg_l,magnesium_mg_l,chloride_mg_l,bicarbonate_mg_l,sar,boron_mg_l,data_source,notes,report_file_ref").eq("farm_id",farmId).order("sampled_at",{ascending:false}).limit(10),
   client.from("farm_observations").select("id,observation_type,observed_at,description,severity,image_refs").eq("farm_id",farmId).in("observation_type",["soil_condition","crop_layout"]).order("observed_at",{ascending:false}).limit(40),
   client.from("weather_records").select("observed_at,temperature_c,feels_like_c,relative_humidity_pct,precipitation_mm,wind_speed_m_s,data_kind,raw_payload").eq("farm_id",farmId).order("observed_at",{ascending:false}).limit(8)
  ]);
  if(farmResult.error||!farmResult.data)return reply(404,{ok:false,code:"FARM_NOT_FOUND"});
  for(const result of [locationResult,fieldsResult,soilResult,waterResult,observationResult,weatherResult]){if(result.error){console.error("Farm context read failed",result.error);return reply(500,{ok:false,code:"FARM_CONTEXT_READ_FAILED"});}}
  const parsedObservations=(observationResult.data??[]).map((row:Record<string,unknown>)=>{
   const description=typeof row.description==="string"?row.description:"";
   const prefixes=["SARINA_FARM_PROFILE_V1:","SARINA_CROP_LAYOUT_V1:"];
   const prefix=prefixes.find((candidate)=>description.startsWith(candidate));let payload:unknown=null;
   if(prefix){try{payload=JSON.parse(description.slice(prefix.length));}catch{payload=null;}}
   return {id:row.id,observation_type:row.observation_type,observed_at:row.observed_at,source_type:"farmer_report",verification:"self_reported_not_verified",payload,raw_description:payload?undefined:description,images:row.image_refs??[]};
  });
  const farmerReports=parsedObservations.filter((row)=>row.observation_type==="soil_condition");
  const cropGroups=parsedObservations.filter((row)=>row.observation_type==="crop_layout");
  const location=locationResult.data??null;

  // Experimental SoilGrids adapter. One point request per farm-context refresh.
  // REST v2 is currently paused by ISRIC; the adapter records that failure as
  // unavailable rather than substituting invented or neighbouring values.
  let soilGrids: Record<string, unknown> = {
    provider: "ISRIC SoilGrids 2.0",
    status: "not_requested",
    resolution_m: 250,
    license: "CC BY 4.0",
    source_url: "https://soilgrids.org/",
    access_method: "REST API v2.0 experimental adapter",
    values: null,
    uncertainty: "Pixel-level model uncertainty must be retained when returned.",
  };
  const lat = location?.latitude == null ? NaN : Number(location.latitude);
  const lon = location?.longitude == null ? NaN : Number(location.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
    try {
      const endpoint = new URL("https://rest.isric.org/soilgrids/v2.0/properties/query");
      endpoint.searchParams.set("lat", String(lat));
      endpoint.searchParams.set("lon", String(lon));
      for (const property of ["phh2o", "clay", "sand", "silt", "soc", "cec", "nitrogen"]) endpoint.searchParams.append("property", property);
      for (const depth of ["0-5cm", "5-15cm", "15-30cm", "30-60cm"]) endpoint.searchParams.append("depth", depth);
      endpoint.searchParams.set("value", "mean");
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(12000), headers: { "Accept": "application/json" } });
      if (!response.ok) {
        soilGrids = { ...soilGrids, status: "provider_unavailable", http_status: response.status, checked_at: new Date().toISOString(), message: "ISRIC SoilGrids REST endpoint did not return a successful response. Retry later or use WCS/WebDAV ingestion." };
      } else {
        const raw = await response.json();
        soilGrids = { ...soilGrids, status: "available", checked_at: new Date().toISOString(), source_type: "regional_model_prediction", provenance: "ISRIC SoilGrids 2.0; modelled 250 m pixel, not a farm soil test", raw };
      }
    } catch (error) {
      soilGrids = { ...soilGrids, status: "provider_unavailable", checked_at: new Date().toISOString(), message: error instanceof Error ? error.message : "SoilGrids request failed" };
    }
  } else {
    soilGrids = { ...soilGrids, status: "waiting_for_confirmed_coordinates", message: "Add a primary farm location with valid latitude and longitude to query SoilGrids." };
  }

  const context={
   schema:"SARINA_FARM_LAND_CONTEXT_V1",farm:farmResult.data,location,fields:fieldsResult.data??[],farmer_reports:farmerReports,crop_groups:cropGroups,
   soil_tests:(soilResult.data??[]).map((row:Record<string,unknown>)=>({...row,provenance:row.data_source==="laboratory"?"laboratory_record":"recorded_source"})),
   water_tests:(waterResult.data??[]).map((row:Record<string,unknown>)=>({...row,provenance:row.data_source==="laboratory"?"laboratory_record":"recorded_source"})),
   weather_records:(weatherResult.data??[]).map((row:Record<string,unknown>)=>({...row,provenance:row.data_kind==="forecast"?"weather_provider_model_estimate":"stored_weather_record"})),
   regional_context:{status:soilGrids.status,provider:"ISRIC SoilGrids 2.0",soilgrids:soilGrids,values:soilGrids.status==="available"?soilGrids.raw:null,do_not_infer_farm_level_soil_measurements:true,do_not_use_as_lab_test:true},
   data_quality:{farmer_report_count:farmerReports.length,crop_group_count:cropGroups.length,soil_test_count:(soilResult.data??[]).length,water_test_count:(waterResult.data??[]).length,regional_dataset_available:soilGrids.status==="available",soilgrids_status:soilGrids.status,location_confirmed_by_farmer:location?.confirmed_by_user===true},
   retrieved_at:new Date().toISOString(),safety:{distinguish_farmer_report_from_lab_and_model_data:true,never_present_regional_estimates_as_farm_measurements:true,missing_values_must_remain_missing:true}
  };
  return reply(200,{ok:true,context});
 }catch(error){console.error("Farm land context failed",error);return reply(500,{ok:false,code:"FARM_LAND_CONTEXT_FAILED"});}
});