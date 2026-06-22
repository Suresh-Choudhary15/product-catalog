const express = require("express");
const cors = require("cors");
require("dotenv").config();

const productsRouter = require("./routes/products");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/", productsRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
