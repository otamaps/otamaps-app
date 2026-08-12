begin;

alter table public.rooms
  alter column bookable set default false;

update public.rooms
set bookable = false
where bookable is distinct from false;

commit;
