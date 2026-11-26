import {useEffect,useRef,useState} from "react";
import {LoaderCircle,Mic,Square} from "lucide-react";
import {supabase} from "../lib/supabase";
import "./voice-message-controls.css";

type VoicePayload={audio:Blob;mimeType:string};
type Props={
  onTranscription:(text:string)=>void;
  onVoiceMessage:(payload:VoicePayload)=>void|Promise<void>;
  textToSpeak?:string;
  speechLanguage?:"fa"|"ar";
  disabled?:boolean;
  autoGenerateAudio?:boolean;
  onVoiceReplyAudio:(payload:VoicePayload)=>void|Promise<void>;
  onAudioGenerationComplete:()=>void;
};

const apiBase=(import.meta.env.VITE_SARINA_VOICE_API_URL||"/api/voice").replace(/\/$/,"");

async function accessToken():Promise<string>{
  if(!supabase)throw new Error("نشست کاربری در دسترس نیست.");
  const {data,error}=await supabase.auth.getSession();
  if(error||!data.session?.access_token)throw new Error("برای استفاده از قابلیت صوتی باید دوباره وارد سارینا شوید.");
  return data.session.access_token;
}

export default function VoiceMessageControls({onTranscription,onVoiceMessage,textToSpeak,speechLanguage="fa",disabled=false,autoGenerateAudio=false,onVoiceReplyAudio,onAudioGenerationComplete}:Props){
  const [recording,setRecording]=useState(false);
  const [processing,setProcessing]=useState(false);
  const [notice,setNotice]=useState("");
  const recorderRef=useRef<MediaRecorder|null>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const chunksRef=useRef<BlobPart[]>([]);

  useEffect(()=>()=>{streamRef.current?.getTracks().forEach(track=>track.stop());},[]);

  async function transcribe(blob:Blob){
    if(!apiBase)throw new Error("نشانی سرویس صوتی SARINA هنوز تنظیم نشده است.");
    const token=await accessToken();
    const form=new FormData();
    const extension=blob.type.includes("ogg")?"ogg":blob.type.includes("mp4")?"m4a":blob.type.includes("wav")?"wav":"webm";
    form.append("file",blob,"sarina-voice."+extension);
    form.append("language","fa");
    const response=await fetch(apiBase+"/v1/transcribe",{method:"POST",headers:{Authorization:"Bearer "+token},body:form});
    if(!response.ok){const payload=await response.json().catch(()=>({}));throw new Error(payload.detail||"تبدیل صدا به متن انجام نشد.");}
    const payload=await response.json();
    if(!payload.ok||typeof payload.transcript!=="string"||!payload.transcript.trim())throw new Error("صدای دریافت‌شده قابل تشخیص نبود؛ می‌توانید دوباره ضبط کنید.");
    onTranscription(payload.transcript.trim());
    return payload.transcript.trim();
  }

  async function startRecording(){
    setNotice("");
    if(!onVoiceMessage){setNotice("ذخیره پیام صوتی در این گفتگو هنوز فعال نشده است.");return;}
    if(!apiBase){setNotice("سرویس صوتی SARINA هنوز به این محیط متصل نشده است.");return;}
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==="undefined"){setNotice("مرورگر این دستگاه امکان ضبط صدا را فراهم نمی‌کند.");return;}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      streamRef.current=stream;
      const mimeType=["audio/webm;codecs=opus","audio/ogg;codecs=opus","audio/webm"].find(type=>MediaRecorder.isTypeSupported(type));
      const recorder=new MediaRecorder(stream,mimeType?{mimeType}:undefined);
      chunksRef.current=[];
      recorder.ondataavailable=event=>{if(event.data.size>0)chunksRef.current.push(event.data);};
      recorder.onstop=async()=>{
        const blob=new Blob(chunksRef.current,{type:recorder.mimeType||"audio/webm"});
        stream.getTracks().forEach(track=>track.stop());
        streamRef.current=null;
        if(blob.size===0){setNotice("صدایی ضبط نشد؛ دوباره تلاش کنید.");return;}
        try{await onVoiceMessage({audio:blob,mimeType:blob.type});}catch{setNotice("ذخیره پیام صوتی انجام نشد.");return;}
        setProcessing(true);
        try{await transcribe(blob);setNotice("پیام صوتی دریافت و به متن تبدیل شد.");}
        catch(error){setNotice(error instanceof Error?error.message:"پردازش صدا ناموفق بود.");}
        finally{setProcessing(false);}
      };
      recorderRef.current=recorder;
      recorder.start(250);
      setRecording(true);
    }catch(error){setNotice(error instanceof Error?error.message:"دسترسی به میکروفون ممکن نشد.");}
  }

  function stopRecording(){
    if(recorderRef.current?.state==="recording"){recorderRef.current.stop();setRecording(false);}
  }

  async function generateReplyAudio(){
    const text=textToSpeak?.trim();
    if(!text||!apiBase||disabled||processing)return;
    setNotice("");
    setProcessing(true);
    try{
      const token=await accessToken();
      const response=await fetch(apiBase+"/v1/synthesize",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({text,language:speechLanguage})});
      if(!response.ok){const payload=await response.json().catch(()=>({}));throw new Error(payload.detail||"تولید فایل صوتی پاسخ انجام نشد.");}
      const blob=await response.blob();
      await onVoiceReplyAudio({audio:blob,mimeType:blob.type||"audio/wav"});
    }catch(error){setNotice(error instanceof Error?error.message:"تولید فایل صوتی پاسخ ناموفق بود.");}
    finally{setProcessing(false);onAudioGenerationComplete();}
  }

  const lastGeneratedRef=useRef<string>("");
  useEffect(()=>{
    const text=textToSpeak?.trim();
    if(autoGenerateAudio&&text&&text!==lastGeneratedRef.current){
      lastGeneratedRef.current=text;
      void generateReplyAudio();
    }
  },[autoGenerateAudio,textToSpeak]);

  return <div className="sarina-voice-controls" dir="rtl">
    <div className="sarina-voice-actions">
      <button type="button" className={"sarina-voice-button"+(recording?" is-recording":"")} onClick={recording?stopRecording:()=>void startRecording()} disabled={disabled||processing} aria-label={recording?"پایان ضبط":"ضبط پیام صوتی"} title={recording?"پایان ضبط":"ارسال پیام صوتی"}>
        {recording?<Square size={17}/>:<Mic size={19}/>}
        <span>{recording?"پایان ضبط":"پیام صوتی"}</span>
      </button>
      {processing&&<span className="sarina-voice-status"><LoaderCircle size={15} className="is-spinning"/> در حال پردازش پیام صوتی...</span>}
    </div>
    {notice&&<p className="sarina-voice-notice" role="status">{notice}</p>}
  </div>;
}
