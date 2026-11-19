-- Prevent mixing incompatible units or numeric and categorical observations in context averages.
do $$
declare v_definition text;
begin
 v_definition:=pg_get_functiondef('public.run_farm_productivity_context_analysis(uuid)'::regprocedure);
 if position(E'group by o.factor_code\n   order by o.factor_code' in v_definition)=0 then
  raise exception 'Expected factor grouping clause not found; refusing to alter contextual analysis.';
 end if;
 v_definition:=replace(v_definition,E'group by o.factor_code\n   order by o.factor_code',E'group by o.factor_code,o.unit_code,(o.numeric_value is not null)\n   order by o.factor_code,o.unit_code');
 execute v_definition;
end $$;