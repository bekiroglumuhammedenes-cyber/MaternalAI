create extension if not exists vector with schema extensions;

create table if not exists public.question_clusters (
  id bigint generated always as identity primary key,
  representative text not null,
  embedding extensions.vector(1536) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id bigint generated always as identity primary key,
  text text not null check (char_length(text) between 5 and 1000),
  embedding extensions.vector(1536) not null,
  cluster_id bigint not null references public.question_clusters(id),
  created_at timestamptz not null default now()
);

create table if not exists public.chunks (
  id bigint generated always as identity primary key,
  content text not null,
  source text not null,
  page integer,
  kind text not null default 'kaynak',
  embedding extensions.vector(1536) not null,
  created_at timestamptz not null default now()
);

create index if not exists questions_cluster_created_idx on public.questions(cluster_id, created_at desc);
create index if not exists chunks_embedding_idx on public.chunks using hnsw (embedding extensions.vector_cosine_ops);

alter table public.questions enable row level security;
alter table public.question_clusters enable row level security;
alter table public.chunks enable row level security;
revoke all on public.questions, public.question_clusters, public.chunks from anon, authenticated;

create or replace function public.submit_question(p_text text, p_embedding extensions.vector(1536))
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_cluster bigint;
begin
  select id into v_cluster from public.question_clusters
  where 1 - (embedding OPERATOR(extensions.<=>) p_embedding) >= 0.85
  order by embedding OPERATOR(extensions.<=>) p_embedding limit 1;
  if v_cluster is null then
    insert into public.question_clusters(representative, embedding) values (p_text, p_embedding) returning id into v_cluster;
  end if;
  insert into public.questions(text, embedding, cluster_id) values (p_text, p_embedding, v_cluster);
  return v_cluster;
end;
$$;

create or replace function public.search_chunks(p_embedding extensions.vector(1536), p_limit integer default 5)
returns table(content text, source text, page integer, kind text, similarity real)
language sql security definer set search_path = '' as $$
  select c.content, c.source, c.page, c.kind, (1 - (c.embedding OPERATOR(extensions.<=>) p_embedding))::real
  from public.chunks c order by c.embedding OPERATOR(extensions.<=>) p_embedding limit least(greatest(p_limit, 1), 8);
$$;

create or replace function public.presenter_questions()
returns table(cluster_id bigint, representative text, question_count bigint, latest_at timestamptz, examples text[])
language sql security definer set search_path = '' as $$
  select c.id, c.representative, count(q.id), max(q.created_at),
    (array_agg(q.text order by q.created_at desc))[1:3]
  from public.question_clusters c join public.questions q on q.cluster_id = c.id
  group by c.id, c.representative order by count(q.id) desc, max(q.created_at) desc;
$$;

revoke all on function public.submit_question(text, extensions.vector) from public, anon, authenticated;
revoke all on function public.search_chunks(extensions.vector, integer) from public, anon, authenticated;
revoke all on function public.presenter_questions() from public, anon, authenticated;
grant execute on function public.submit_question(text, extensions.vector) to service_role;
grant execute on function public.search_chunks(extensions.vector, integer) to service_role;
grant execute on function public.presenter_questions() to service_role;
