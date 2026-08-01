# Migrations

Numbered, forward-only SQL. Each file runs once, in order, and is never edited
after it has been applied anywhere.

Before this folder existed the schema lived only inside Neon — applied by hand,
recorded nowhere. `0001_baseline.sql` is that schema read back out of
`information_schema` and written down. It is guarded with `IF NOT EXISTS`
throughout, so running it against the existing database changes nothing; its
job is to give everything after it a known starting point, and to let a fresh
environment be built from scratch.

## Applying them

```bash
npm run migrate
```

Reads `DATABASE_URL` from `.env.local`, applies anything not yet recorded in
`schema_migrations`, and does each file in a transaction so a failure leaves no
half-applied state.

To see what would run without running it:

```bash
npm run migrate -- --dry-run
```

## Writing one

- Name it `NNNN_short_description.sql`, taking the next number.
- Say in a comment at the top *why*, not just what. The what is the SQL.
- Additive changes only where possible. A column that is dropped is a column
  some running deploy may still be selecting.
- No `DROP TABLE` without checking the row count first and saying so in the
  comment.
- Rooms and calls are user-facing history. Prefer marking things closed or
  expired to deleting them.
