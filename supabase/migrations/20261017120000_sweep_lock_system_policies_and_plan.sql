-- Säkerhetssvep 2026-10-17 (redan tillämpad och testad i databasen).
-- "System can ..."-policyerna lät vem som helst (även anon) skapa quiz/frågor i andras quiz
-- och skriva över allas materialanalyser. Bara edge-funktionerna skriver dessa tabeller,
-- och de använder service role som går förbi RLS, så policyerna behövs inte.
drop policy if exists "System can create quizzes" on public.quizzes;
drop policy if exists "System can create questions" on public.questions;
drop policy if exists "System can create analysis" on public.material_analysis;
drop policy if exists "System can update analysis" on public.material_analysis;

-- Användare kunde sätta profiles.plan = 'pro' på sig själva via "Users can update own profile".
-- Triggern behåller planen för klientanrop (anon/authenticated) som inte är admin.
-- Security invoker med flit: då är current_user den riktiga rollen.
create or replace function public.protect_profile_plan() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('anon','authenticated') and not public.has_role(auth.uid(),'admin') then
    if tg_op = 'INSERT' then
      new.plan := 'free';
    elsif new.plan is distinct from old.plan then
      new.plan := old.plan;
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.protect_profile_plan() from public, anon, authenticated;
drop trigger if exists protect_profile_plan on public.profiles;
create trigger protect_profile_plan before insert or update on public.profiles
  for each row execute function public.protect_profile_plan();
