const { from: copyFrom } = require("pg-copy-streams");
const { faker } = require("@faker-js/faker");
const pool = require("../src/db");

const TOTAL_PRODUCTS = 200_000;
const BATCH_SIZE = 5_000; // how many rows we build in memory at a time

const CATEGORIES = [
  "Electronics",
  "Home & Kitchen",
  "Books",
  "Clothing",
  "Toys",
  "Sports",
  "Beauty",
  "Automotive",
  "Grocery",
  "Office Supplies",
];

function csvEscape(value) {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function randomPastDate() {
  return faker.date.past({ years: 2 }).toISOString();
}

function buildRow() {
  const createdAt = randomPastDate();
  // Most products are untouched since creation; a slice have been
  // edited later. This isn't load-bearing for correctness (we sort by
  // created_at, not updated_at) but it makes the data realistic.
  const wasUpdated = Math.random() < 0.1;
  const updatedAt = wasUpdated
    ? faker.date.between({ from: createdAt, to: new Date() }).toISOString()
    : createdAt;

  const name = `${faker.commerce.productAdjective()} ${faker.commerce.product()}`;
  const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  const price = faker.commerce.price({ min: 1, max: 2000 });

  return [name, category, price, createdAt, updatedAt].map(csvEscape).join(",");
}

async function seed() {
  const client = await pool.connect();
  console.log(`Seeding ${TOTAL_PRODUCTS} products...`);
  const start = Date.now();

  try {
    const stream = client.query(
      copyFrom(
        `COPY products (name, category, price, created_at, updated_at) FROM STDIN WITH (FORMAT csv)`,
      ),
    );

    let written = 0;
    while (written < TOTAL_PRODUCTS) {
      const batchCount = Math.min(BATCH_SIZE, TOTAL_PRODUCTS - written);
      const lines = [];
      for (let i = 0; i < batchCount; i++) {
        lines.push(buildRow());
      }
      const chunk = lines.join("\n") + "\n";

      // Backpressure: wait for the stream to be ready for more data
      // before writing the next chunk, instead of firehosing it.
      const canContinue = stream.write(chunk);
      if (!canContinue) {
        await new Promise((resolve) => stream.once("drain", resolve));
      }

      written += batchCount;
      console.log(`  ${written}/${TOTAL_PRODUCTS}`);
    }

    await new Promise((resolve, reject) => {
      stream.end();
      stream.on("finish", resolve);
      stream.on("error", reject);
    });

    const seconds = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`Done. Inserted ${TOTAL_PRODUCTS} rows in ${seconds}s.`);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
