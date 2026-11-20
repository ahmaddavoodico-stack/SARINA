const CACHE_MS=15*60*1000;
const cache=new Map();

export async function fetchFarmWeather(latitude,longitude){
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude < -90||latitude > 90||longitude < -180||longitude > 180) throw new Error('Invalid farm coordinates');
  const key=latitude.toFixed(4)+','+longitude.toFixed(4),cached=cache.get(key);
  if(cached&&Date.now()-cached.at<CACHE_MS)return cached.data;
  const params=new URLSearchParams({
    latitude:String(latitude),longitude:String(longitude),
    current:'temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m',
    daily:'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,et0_fao_evapotranspiration',
    forecast_days:'7',timezone:'auto',temperature_unit:'celsius',wind_speed_unit:'ms',precipitation_unit:'mm'
  });
  const response=await fetch('https://api.open-meteo.com/v1/forecast?'+params.toString(),{headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error('Weather provider returned '+response.status);
  const raw=await response.json();
  if(!raw.current||!raw.daily)throw new Error('Weather response incomplete');
  const data={raw,source:'open-meteo',retrieved_at:new Date().toISOString(),timezone:raw.timezone||'UTC'};
  cache.set(key,{at:Date.now(),data});
  return data;
}

export function buildWeatherAnalysisContext(weather,{farmId,latitude,longitude}={}){
  const raw=weather.raw;
  return {
    farm_id:farmId||null,
    location:{latitude,longitude,timezone:weather.timezone},
    source:weather.source,
    data_kind:'forecast_model_current_and_daily_forecast',
    retrieved_at:weather.retrieved_at,
    current:{
      observed_at:raw.current.time,
      temperature_c:raw.current.temperature_2m??null,
      apparent_temperature_c:raw.current.apparent_temperature??null,
      relative_humidity_pct:raw.current.relative_humidity_2m??null,
      wind_speed_m_s:raw.current.wind_speed_10m??null,
      provenance:'provider_current_model_estimate_not_farm_sensor'
    },
    forecast:raw.daily.time.map((date,i)=>({
      date,
      max_c:raw.daily.temperature_2m_max?.[i]??null,
      min_c:raw.daily.temperature_2m_min?.[i]??null,
      precipitation_mm:raw.daily.precipitation_sum?.[i]??null,
      max_wind_speed_m_s:raw.daily.wind_speed_10m_max?.[i]??null,
      reference_evapotranspiration_mm:raw.daily.et0_fao_evapotranspiration?.[i]??null
    })),
    decision_guidance:{
      use_for_farm_analysis:true,
      distinguish_model_data_from_local_sensor:true,
      do_not_issue_chemical_or_fertilizer_rates_from_weather_alone:true,
      require_crop_stage_soil_water_and_product_label_context:true
    }
  };
}
