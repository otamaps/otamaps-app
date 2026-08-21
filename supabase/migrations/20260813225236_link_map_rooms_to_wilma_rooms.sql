-- Link map rooms to their Wilma rooms so the room modal can show the day's
-- lessons. `rooms.wilma_id` is the Wilma room id the schedule query takes.
--
-- Every id below was checked against the live Wilma room list: the Wilma room
-- `code` equals this row's `room_number`, and all 39 previously linked rows
-- follow the same rule with no mismatches. The `wilma_id is null` guard keeps
-- the backfill safe to re-run and stops it from overwriting a newer link.

begin;

-- 1118 Kirjastoluokka -> Wilma 5364 Kirjasto luokka 1118
update public.rooms set wilma_id = '5364'
where id = 'd2840193-87c0-4fa8-ba8f-f1e11fc89d8d' and wilma_id is null;

-- 1518 Musiikki -> Wilma 5357 Musiikki 1518
update public.rooms set wilma_id = '5357'
where id = 'a66b558a-5fee-463b-a633-4e393555e657' and wilma_id is null;

-- 1525 Kuvataide -> Wilma 5360 Kuvataide 1525
update public.rooms set wilma_id = '5360'
where id = 'aeb904ca-e035-4b7b-88f7-7cd2b65d2dc0' and wilma_id is null;

-- 1530 Kuvataide -> Wilma 5361 Kuvataide 1530
update public.rooms set wilma_id = '5361'
where id = 'd5992f26-2233-4fb5-808d-1ce041b9969d' and wilma_id is null;

-- 2240 Maantieto -> Wilma 5373 Luokka Ge 2240
update public.rooms set wilma_id = '5373'
where id = '724ec0ef-0804-492e-ad3c-ef783eba75c5' and wilma_id is null;

-- 3128 Opetustila -> Wilma 5379 Luokka 3128
update public.rooms set wilma_id = '5379'
where id = '164310e2-5748-49e9-8945-4dbcd12df38b' and wilma_id is null;

-- 3142 Opetustila -> Wilma 5392 Luokka 3142
update public.rooms set wilma_id = '5392'
where id = '14dde73a-8250-48e5-98f3-54b9ed761176' and wilma_id is null;

-- 4265 Opetustila -> Wilma 6385 Luokka 4265
update public.rooms set wilma_id = '6385'
where id = '827de43e-956c-4976-9de8-fd7800e0e4bb' and wilma_id is null;

-- 4270 Opetustila -> Wilma 6384 Luokka 4270
update public.rooms set wilma_id = '6384'
where id = '1a3530af-ee61-4e4d-8777-e994194ab645' and wilma_id is null;

-- Piazza Piazza -> Wilma 5454 (nimetön Wilma-tila)
update public.rooms set wilma_id = '5454'
where id = '2193ae6f-b988-414f-961f-014ebf69a807' and wilma_id is null;

-- `2339 Biologia` is a transposed room number: Wilma has no room 2339, and the
-- biology lab on the same floor is `2239 Biologia (labra)`. Correct the number
-- and link it in one step.
update public.rooms
set room_number = '2239', wilma_id = '5372'
where id = '6e93d932-8eed-44d1-9e7a-bbb130b08173'
  and room_number = '2339';

commit;
