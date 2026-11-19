-- Include the requested missing information in the farmer's in-app notification.
create or replace function private.notify_expert_case_assistant_update()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_farmer_id uuid; v_preview text;
begin
  if old.assistant_status is distinct from new.assistant_status
     or old.completeness_status is distinct from new.completeness_status
     or old.missing_information is distinct from new.missing_information then
    select er.requester_user_id into v_farmer_id from public.expert_requests er where er.id=new.request_id;
    v_preview := case new.assistant_status
      when 'initial_review' then 'دستیار متخصص بررسی اولیه پرونده شما را آغاز کرده است.'
      when 'needs_information' then
        'برای ادامه بررسی پرونده، این اطلاعات تکمیلی لازم است: '
        || coalesce(array_to_string(new.missing_information, '، '), 'لطفاً شرح و مدارک پرونده را تکمیل کنید')
        || '. لطفاً پاسخ را در گفت‌وگوی پرونده ارسال کنید.'
      when 'awaiting_expert' then 'بررسی اولیه پرونده انجام شد و پرونده در انتظار نظر متخصص است.'
      when 'expert_reviewed' then 'متخصص بررسی پرونده شما را مشاهده و پیگیری آن را آغاز کرده است.'
      else 'وضعیت بررسی اولیه پرونده شما به‌روزرسانی شد.' end;
    insert into public.expert_case_notifications(recipient_user_id,actor_user_id,request_id,event_type,preview)
      values(v_farmer_id,public.current_sarina_user_id(),new.request_id,'case_assistant_update',v_preview);
  end if;
  return new;
end; $$;
