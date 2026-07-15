-- Replace the app-managed email/SMS OTP system with Supabase Auth email confirmation.
-- Run this migration once on existing projects after enabling Confirm email in Supabase.

drop table if exists public.otp_records;

-- Bring existing profile records in line with their already-confirmed Auth users.
update public.profiles as profile
set email = auth_user.email,
    email_verified = auth_user.email_confirmed_at is not null,
    updated_at = now()
from auth.users as auth_user
where profile.id = auth_user.id;

create or replace function public.handle_auth_user_profile()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, phone, full_name, telegram, email_verified)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'telegram', ''),
    new.email_confirmed_at is not null
  )
  on conflict (id) do update
  set email = excluded.email,
      email_verified = excluded.email_verified,
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_profile_created on auth.users;
create trigger on_auth_user_profile_created
  after insert on auth.users
  for each row execute function public.handle_auth_user_profile();

drop trigger if exists on_auth_user_profile_email_confirmed on auth.users;
create trigger on_auth_user_profile_email_confirmed
  after update of email_confirmed_at, email on auth.users
  for each row execute function public.handle_auth_user_profile();
