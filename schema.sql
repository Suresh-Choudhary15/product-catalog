-- schema.sql
-- Run this once against your database before seeding.

DROP TABLE IF EXISTS products;

CREATE TABLE products (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    category    TEXT NOT NULL,
    price       NUMERIC(10,2) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supports the default "newest first, no filter" pagination.
CREATE INDEX idx_products_cursor ON products (created_at DESC, id DESC);

-- Supports "newest first, filtered by category" pagination.
-- category must lead the index so Postgres can seek directly to
-- that category's rows instead of scanning the whole table.
CREATE INDEX idx_products_category_cursor ON products (category, created_at DESC, id DESC);