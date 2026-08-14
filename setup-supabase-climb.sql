create table content_pieces_climb (
  id text primary key,
  title text not null,
  pillar text,
  insp text,
  date text,
  status text default 'idea',
  image_data text,
  client_status text default 'pendiente',
  client_comment text,
  idea_detail text,
  format text default 'post',
  created_at timestamp with time zone default now()
);

alter table content_pieces_climb enable row level security;

create policy "Permitir lectura publica climb"
  on content_pieces_climb for select
  using (true);

create policy "Permitir insercion publica climb"
  on content_pieces_climb for insert
  with check (true);

create policy "Permitir actualizacion publica climb"
  on content_pieces_climb for update
  using (true);

create policy "Permitir eliminacion publica climb"
  on content_pieces_climb for delete
  using (true);
