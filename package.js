// Entry point: starts the Express server, exposes the API and serves the frontend.
require("dotenv").config();
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers (we allow inline onclick handlers because the frontend uses them)
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: { "script-src-attr": ["'unsafe-inline'"] },
    },
  })
);
app.use(express.json({ limit: "100kb" }));

// Health check
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// API routes
app.use("/api/properties", require("./routes/properties"));
app.use("/api/tenants", require("./routes/tenants"));
app.use("/api/leases", require("./routes/leases"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api", require("./routes/dashboard"));
app.use("/api", notFound);

// Serve the frontend folder
app.use(express.static(path.join(__dirname, "..", "frontend")));

app.use(errorHandler);

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
