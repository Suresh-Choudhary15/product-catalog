# Product Catalog API

A backend service for browsing approximately 200,000 products with:

- Newest-first ordering
- Category filtering
- Cursor-based pagination
- Stable pagination while data is changing
- PostgreSQL indexing for fast queries

The project was built as part of the CodeVector Internship take-home assignment.

---

## Tech Stack

### Backend

- Node.js
- Express.js

### Database

- PostgreSQL
- Neon (hosted database)

### Data Generation

- Faker.js
- pg-copy-streams

### Bonus UI

- Vanilla HTML
- JavaScript
- CSS

### Development

- Docker
- Postman

---

## Project Structure

```text
product-catalog/
├── Postman_Collection/
│   └── Product Catalog API.postman_collection.json
├── public/
│   └── index.html
├── scripts/
│   └── seed.js
├── src/
│   ├── routes/
│   │   └── products.js
│   ├── db.js
│   └── server.js
├── schema.sql
├── package.json
└── package-lock.json
```

---

## Why PostgreSQL?

The assignment requires:

- filtering by category
- sorting by newest products
- fast pagination
- correctness while data is changing

PostgreSQL fits this well because composite indexes can efficiently support both filtering and sorting in a single query.

---

## Pagination Strategy

### Why not OFFSET pagination?

A common implementation is:

```sql
SELECT *
FROM products
ORDER BY created_at DESC
LIMIT 20 OFFSET 40;
```

This has two problems:

1. Performance gets worse as offsets grow.
2. New inserts can shift rows between pages.

Example:

- User loads page 1.
- 50 new products are inserted.
- User loads page 2 using OFFSET.

Rows may be skipped or duplicated because the position of every row changed.

---

## Cursor Pagination

This project uses keyset (cursor) pagination.

The cursor contains:

```json
{
  "createdAt": "...",
  "id": ...
}
```

encoded as Base64.

The next page query becomes:

```sql
WHERE (created_at, id) < (:cursor_created_at, :cursor_id)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

This keeps pagination stable because new rows appear above the cursor position and do not affect pages already visited.

---

## Why Sort by created_at?

The assignment mentions inserts and updates.

Sorting by updated_at can cause products to move around while users are browsing.

Example:

- User loads page 1.
- An old product is updated.
- It jumps to the top of the feed.
- The user may see duplicates or miss products.

Using created_at avoids this because a product's position never changes after creation.

The id column is used as a tiebreaker when multiple rows share the same timestamp.

---

## Database Indexes

```sql
CREATE INDEX idx_products_cursor
ON products (created_at DESC, id DESC);

CREATE INDEX idx_products_category_cursor
ON products (category, created_at DESC, id DESC);
```

### Purpose

- First index supports newest-first pagination.
- Second index supports category-filtered pagination.

---

## Query Performance

Verified using EXPLAIN ANALYZE on a 200,000-row dataset.

Example results:

Unfiltered query:

```text
Execution Time: 0.300 ms
```

Category filtered query:

```text
Execution Time: 0.270 ms
```

The execution plans showed PostgreSQL using the intended indexes rather than sequential scans.

---

## Data Generation

The assignment required generating approximately 200,000 products.

Fields generated:

- id
- name
- category
- price
- created_at
- updated_at

Instead of inserting rows one at a time, the seed script uses PostgreSQL COPY through pg-copy-streams for bulk loading.

Actual seed result:

```text
200,000 rows inserted in ~25 seconds
```

---

## Correctness Verification

I manually tested the scenario described in the assignment:

1. Fetch first page and save cursor.
2. Insert additional products.
3. Request the next page using the saved cursor.
4. Compare results.

The page remained unchanged and no products were skipped or duplicated.

A fresh page-one request correctly showed the newly inserted products at the top.

---

## API Endpoints

### Get Products

```http
GET /products
```

Optional query parameters:

```text
limit
category
cursor
```

Example:

```http
GET /products?limit=20&category=Electronics
```

Response:

```json
{
  "data": [],
  "nextCursor": "...",
  "hasMore": true
}
```

---

### Get Categories

```http
GET /categories
```

Response:

```json
{
  "categories": []
}
```

---

### Health Check

```http
GET /health
```

Response:

```json
{
  "status": "ok"
}
```

---

## Running Locally

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create:

```text
.env
```

```env
DATABASE_URL=<postgres_connection_string>
```

### 3. Create Schema

Run schema.sql against PostgreSQL.

### 4. Seed Data

```bash
npm run seed
```

### 5. Start Server

```bash
npm start
```

Server:

```text
http://localhost:3000
```

Bonus UI:

```text
http://localhost:3000
```

API:

```text
http://localhost:3000/products
```

---

## Docker

The project was developed and tested using PostgreSQL running inside Docker.

Example:

```bash
docker compose up -d
```

The backend can connect to either:

- Local PostgreSQL (Docker)
- Neon PostgreSQL

without code changes.

---

## Hosted Setup

### Database

Neon PostgreSQL

### Backend

Render

---

## Postman Collection

A Postman collection is included in:

```text
Postman_Collection/
```

to make endpoint testing easier.

---

## What I Would Improve With More Time

- Add automated integration tests for cursor pagination.
- Sign cursors to prevent client-side manipulation.
- Add request validation.
- Add pagination metrics and monitoring.
- Add API documentation with Swagger/OpenAPI.

---

## How I Used AI

I used AI tools primarily for brainstorming implementation approaches, validating design decisions, and speeding up boilerplate code generation.

The most useful discussion was around offset pagination versus cursor pagination. After reviewing the suggestions, I verified the behavior manually against a real PostgreSQL database and tested the concurrent insert scenario myself rather than relying only on AI-generated explanations.

I also used AI to help structure the seed script and project setup, while reviewing and testing the final implementation before submission.
