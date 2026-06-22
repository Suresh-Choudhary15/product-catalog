const express = require("express");
const pool = require("../db");

const router = express.Router();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// The cursor is just "the sort key of the last row on the previous
// page", encoded so it's an opaque token to the client rather than
// something they're tempted to construct by hand.
function encodeCursor(row) {
  const payload = JSON.stringify({ createdAt: row.created_at, id: row.id });
  return Buffer.from(payload).toString("base64");
}

function decodeCursor(cursor) {
  try {
    const payload = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
    if (!payload.createdAt || !payload.id) return null;
    return payload;
  } catch {
    return null;
  }
}

router.get("/products", async (req, res) => {
  const parsedLimit = parseInt(req.query.limit, 10);

  const limit =
    Number.isInteger(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, MAX_LIMIT)
      : DEFAULT_LIMIT;
  const { category } = req.query;
  const cursor = req.query.cursor ? decodeCursor(req.query.cursor) : null;

  if (req.query.cursor && !cursor) {
    return res.status(400).json({ error: "Invalid cursor" });
  }

  // Built as parameterized SQL throughout — no string interpolation of
  // user input — to avoid SQL injection.
  const conditions = [];
  const params = [];

  if (category) {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }

  if (cursor) {
    params.push(cursor.createdAt, cursor.id);
    // Row comparison: true keyset pagination condition. This is what
    // lets a single index scan satisfy "everything strictly after
    // this point in the sort order," rather than re-deriving it from
    // a row count.
    conditions.push(
      `(created_at, id) < ($${params.length - 1}, $${params.length})`,
    );
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  params.push(limit);
  const sql = `
    SELECT id, name, category, price, created_at, updated_at
    FROM products
    ${whereClause}
    ORDER BY created_at DESC, id DESC
    LIMIT $${params.length}
  `;

  try {
    const { rows } = await pool.query(sql, params);
    const nextCursor =
      rows.length === limit ? encodeCursor(rows[rows.length - 1]) : null;

    res.json({
      data: rows,
      nextCursor,
      hasMore: nextCursor !== null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/categories", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT DISTINCT category FROM products ORDER BY category",
    );
    res.json({ categories: rows.map((r) => r.category) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
