-- Install the durable Postgres queue extension required by SCI.
create extension if not exists pgmq;
