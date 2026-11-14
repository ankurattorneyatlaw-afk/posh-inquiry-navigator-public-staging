create table public.navigator_knowledge_reactions (
  question text not null check (length(question) between 1 and 100),
  browser_hash text not null check (browser_hash ~ '^[a-f0-9]{64}$'),
  reaction text not null check (reaction in ('useful', 'loved', 'review')),
  reason text check (reason is null or (reaction = 'review' and reason in ('outdated','citation','unclear','context'))),
  updated_at timestamptz not null default now(),
  primary key (question, browser_hash)
);

alter table public.navigator_knowledge_reactions enable row level security;
revoke all on public.navigator_knowledge_reactions from public, anon, authenticated;
grant select, insert, update, delete on public.navigator_knowledge_reactions to service_role;

create table public.navigator_knowledge_editorial (
  question text primary key,
  status text not null check (status in ('under-review','reviewed','updated')),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  note text check (char_length(note) <= 500)
);
alter table public.navigator_knowledge_editorial enable row level security;
revoke all on public.navigator_knowledge_editorial from public, anon, authenticated;
grant select, insert, update on public.navigator_knowledge_editorial to service_role;

create function public.navigator_question_reactions(p_question text, p_browser_hash text)
returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'useful', count(*) filter (where reaction = 'useful'),
    'loved', count(*) filter (where reaction = 'loved'),
    'review', count(*) filter (where reaction = 'review'),
    'selected', max(reaction) filter (where browser_hash = p_browser_hash),
    'reason', max(reason) filter (where browser_hash = p_browser_hash),
    'editorial', (select jsonb_build_object('date', published_at, 'note', note)
                  from public.navigator_knowledge_editorial where question = p_question and published_at is not null))
  from public.navigator_knowledge_reactions where question = p_question;
$$;

revoke all on function public.navigator_question_reactions(text, text) from public, anon, authenticated;
grant execute on function public.navigator_question_reactions(text, text) to service_role;

create function public.navigator_knowledge_review_queue()
returns jsonb
language sql stable
set search_path = ''
as $$
  with flags as (
    select question, count(*) as total, max(updated_at) as latest,
      jsonb_build_object('outdated',count(*) filter(where reason='outdated'),
        'citation',count(*) filter(where reason='citation'),'unclear',count(*) filter(where reason='unclear'),
        'context',count(*) filter(where reason='context')) as reasons
    from public.navigator_knowledge_reactions where reaction='review' group by question
  )
  select coalesce(jsonb_agg(jsonb_build_object('question',coalesce(f.question,e.question),
    'total',coalesce(f.total,0),'latest',f.latest,'reasons',f.reasons,
    'status',case when e.status in ('reviewed','updated') and f.latest>e.updated_at then 'open' else coalesce(e.status,'open') end)
    order by f.latest desc nulls last),'[]'::jsonb)
  from flags f full join public.navigator_knowledge_editorial e using(question);
$$;
revoke all on function public.navigator_knowledge_review_queue() from public, anon, authenticated;
grant execute on function public.navigator_knowledge_review_queue() to service_role;
