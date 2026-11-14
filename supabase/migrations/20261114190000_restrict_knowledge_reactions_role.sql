create role navigator_reactions_staging nologin noinherit connection limit 3;
grant usage on schema public to navigator_reactions_staging;
grant select,insert,update,delete on public.navigator_knowledge_reactions to navigator_reactions_staging;
grant select,insert,update on public.navigator_knowledge_editorial to navigator_reactions_staging;
grant execute on function public.navigator_question_reactions(text,text), public.navigator_knowledge_review_queue() to navigator_reactions_staging;
create policy reaction_service on public.navigator_knowledge_reactions to navigator_reactions_staging using (true) with check (true);
create policy editorial_service on public.navigator_knowledge_editorial to navigator_reactions_staging using (true) with check (true);
