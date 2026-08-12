-- Keep the aggregate private from anonymous clients, but restore the execute
-- grant expected by authenticated map sessions if production privileges drift.
revoke all on function public.get_queue_statuses() from public, anon;
grant execute on function public.get_queue_statuses()
  to authenticated, service_role;
