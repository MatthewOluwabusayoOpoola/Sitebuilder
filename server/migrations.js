// Ordered, append-only migrations. Never edit one that has shipped; add a new one.
const migrations = [
  {
    id: 1,
    sql: `
    create table users (
      id text primary key,
      email text not null unique,
      password_hash text not null,
      email_verified_at timestamptz,
      created_at timestamptz not null default now()
    );
    create table sessions (
      id text primary key,                       -- sha256 of the cookie token
      user_id text not null references users(id) on delete cascade,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    );
    create index sessions_user on sessions(user_id);
    create table auth_tokens (
      id text primary key,                       -- sha256 of the emailed token
      user_id text not null references users(id) on delete cascade,
      kind text not null,                        -- 'verify' | 'reset'
      expires_at timestamptz not null,
      used_at timestamptz
    );
    create table sites (
      id text primary key,
      owner_id text not null references users(id) on delete cascade,
      name text not null,
      slug text not null unique,
      draft jsonb not null,
      revision integer not null default 1,
      published_version_id text,
      published_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index sites_owner on sites(owner_id);
    create table site_versions (
      id text primary key,
      site_id text not null references sites(id) on delete cascade,
      schema jsonb not null,
      pages integer not null,
      bytes integer not null,
      created_at timestamptz not null default now()
    );
    create index site_versions_site on site_versions(site_id, created_at desc);
    create table assets (
      id text primary key,
      owner_id text not null references users(id) on delete cascade,
      site_id text references sites(id) on delete cascade,
      mime text not null,
      bytes integer not null,
      sha256 text not null,
      created_at timestamptz not null default now()
    );
    create index assets_owner on assets(owner_id);
    create index assets_site_hash on assets(site_id, sha256);
    create table form_submissions (
      id text primary key,
      site_id text not null references sites(id) on delete cascade,
      payload jsonb not null,
      read_at timestamptz,
      created_at timestamptz not null default now()
    );
    create index form_submissions_site on form_submissions(site_id, created_at desc);
    `,
  },
]

export async function migrate(db) {
  await db.query('create table if not exists schema_migrations (id integer primary key, applied_at timestamptz not null default now())')
  const done = new Set((await db.query('select id from schema_migrations')).rows.map((r) => r.id))
  for (const m of migrations) {
    if (done.has(m.id)) continue
    await db.tx(async (t) => {
      for (const stmt of m.sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) await t.query(stmt)
      await t.query('insert into schema_migrations(id) values ($1)', [m.id])
    })
  }
}
