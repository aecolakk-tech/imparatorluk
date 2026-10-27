-- NPC chat lines are stored without a user account
alter table public.messages alter column from_user drop not null;
