-- Require baseline observations themselves to meet minimum evidence quality.
do $$
declare
 v_definition text;
 v_old text := $old$if v_base is null or v_base='null'::jsonb or nullif(v_base->>'value','') is null then
       continue;
     end if;$old$;
 v_new text := $new$if v_base is null or v_base='null'::jsonb or nullif(v_base->>'value','') is null then
       continue;
     end if;
     if coalesce(v_base->>'quality','unknown') not in ('high','medium') then
       continue;
     end if;
     if nullif(v_base->>'confidence','') is not null and (v_base->>'confidence')::numeric < 0.60 then
       continue;
     end if;$new$;
begin
 v_definition:=pg_get_functiondef('public.run_farm_productivity_evaluation(uuid)'::regprocedure);
 if position(v_old in v_definition)=0 then
  raise exception 'Expected evaluator source fragment was not found; refusing to modify function.';
 end if;
 v_definition:=replace(v_definition,v_old,v_new);
 execute v_definition;
end $$;