import {supabase} from "./supabase";

export type FarmAssistantLanguage="fa"|"en";
export type FarmAssistantValidationReceipt={
 ok:true;
 request_id:string;
 status:"accepted_for_validation";
 next_step:string;
 farm_access:"verified_under_caller_jwt_and_rls";
 model_invoked:false;
 provider_selected:false;
 physical_action_authorized:false;
};

/**
 * Sends a farm-scoped question to SARINA's current validation boundary.
 * This endpoint currently verifies the caller and farm access only; it does
 * not invoke an AI model, persist a conversation, or return an answer.
 */
export async function submitFarmQuestionForValidation(input:{
 farmId:string;
 question:string;
 language?:FarmAssistantLanguage;
 references?:string[];
}):Promise<FarmAssistantValidationReceipt>{
 if(!supabase)throw new Error("اتصال SARINA در دسترس نیست.");
 const farmId=input.farmId.trim();
 const question=input.question.trim();
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(farmId)){
  throw new Error("برای ارسال پرسش، شناسه معتبر مزرعه لازم است.");
 }
 if(!question)throw new Error("متن پرسش خالی است.");
 if(question.length>4000)throw new Error("متن پرسش نباید بیشتر از ۴۰۰۰ نویسه باشد.");
 const references=(input.references??[]).map(value=>value.trim()).filter(Boolean);
 if(references.length>10||references.some(value=>value.length>200)){
  throw new Error("تعداد یا طول ارجاع‌های همراه پرسش معتبر نیست.");
 }
 const {data,error}=await supabase.functions.invoke("sarina-central-intelligence",{
  body:{farm_id:farmId,question,language:input.language??"fa",references}
 });
 if(error)throw new Error("ارسال پرسش برای اعتبارسنجی انجام نشد: "+error.message);
 if(!data||data.ok!==true||data.status!=="accepted_for_validation"||data.model_invoked!==false){
  throw new Error("پاسخ هسته مرکزی سارینا با قرارداد فعلی مطابقت ندارد.");
 }
 return data as FarmAssistantValidationReceipt;
}
