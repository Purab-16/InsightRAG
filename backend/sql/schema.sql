create extension if not exists vector;

-- ───────────── papers ─────────────
create table papers (
  id            uuid primary key default gen_random_uuid(),
  source        text not null check (source in ('arxiv','upload')),
  arxiv_id      text unique,                 -- normalized, no version: 2310.06825
  content_hash  text,                        -- sha256 of uploaded PDF
  uploaded_by   uuid references auth.users(id) on delete cascade,
  title         text not null,
  authors       text[] not null default '{}',
  abstract      text,
  published     date,
  categories    text[] not null default '{}', -- e.g. {cs.LG, stat.ML}
  pdf_url       text,
  parse_source  text check (parse_source in ('pdf','html')),
  status        text not null default 'processing'
                check (status in ('processing','ready','failed')),
  status_step   text,                        -- 'parsing' | 'embedding' | 'insights'
  error         text,
  insights      jsonb,
  s2_data       jsonb,
  s2_fetched_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint arxiv_has_id   check (source <> 'arxiv'  or arxiv_id is not null),
  constraint upload_has_own check (source <> 'upload' or uploaded_by is not null)
);
create unique index papers_upload_dedupe on papers (uploaded_by, content_hash)
  where source = 'upload';

-- ───────────── chunks ─────────────
create table chunks (
  id          uuid primary key default gen_random_uuid(),
  paper_id    uuid not null references papers(id) on delete cascade,
  chunk_index int  not null,
  content     text not null,                 -- includes "[title | section]" prefix
  section     text,
  page        int,                           -- null when parsed from HTML
  embedding   vector(768) not null           -- = EMBED_DIM
);
create index chunks_paper_idx on chunks (paper_id);

-- ───────────── library ─────────────
create table user_papers (
  user_id  uuid not null references auth.users(id) on delete cascade,
  paper_id uuid not null references papers(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (user_id, paper_id)
);

-- ───────────── chat ─────────────
create table chat_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text,
  paper_ids  uuid[] not null check (cardinality(paper_ids) between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chat_sessions_user_idx on chat_sessions (user_id, updated_at desc);

create table messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role       text not null check (role in ('user','assistant')),
  content    text not null,
  sources    jsonb,                          -- assistant only
  created_at timestamptz not null default now()
);
create index messages_session_idx on messages (session_id, created_at);

-- ───────────── security ─────────────
alter table papers        enable row level security;
alter table chunks        enable row level security;
alter table user_papers   enable row level security;
alter table chat_sessions enable row level security;
alter table messages      enable row level security;
-- No policies: only the backend (service role) touches tables.

-- ───────────── search ─────────────
create or replace function match_chunks(
  query_embedding vector(768),
  target_paper    uuid,
  match_count     int default 5
)
returns table (id uuid, paper_id uuid, content text, section text,
               page int, similarity float)
language sql stable as $$
  select c.id, c.paper_id, c.content, c.section, c.page,
         1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  where c.paper_id = target_paper
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- keep updated_at fresh
create or replace function touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger papers_touch        before update on papers
  for each row execute function touch_updated_at();
create trigger chat_sessions_touch before update on chat_sessions
  for each row execute function touch_updated_at();
