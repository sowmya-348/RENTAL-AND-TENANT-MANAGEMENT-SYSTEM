// A small helper that builds the 5 standard routes (list, get, create, update, delete)
// for a table, so we don't repeat the same code four times.
const express = require("express");
const supabase = require("../config/supabase");
const { HttpError } = require("../middleware/errorHandler");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function checkId(req, res, next) {
  if (!UUID.test(req.params.id)) return next(new HttpError(400, "Invalid id"));
  next();
}

// options: { table, select, orderBy, searchColumns, validate }
// validate(body) must return the cleaned object or throw HttpError(400, "message")
function crudRouter({ table, select = "*", orderBy = "created_at", ascending = false, searchColumns = [], validate }) {
  const router = express.Router();

  // LIST (with optional ?q=search text)
  router.get("/", async (req, res, next) => {
    try {
      let query = supabase.from(table).select(select).order(orderBy, { ascending });
      const q = String(req.query.q || "").trim().replace(/[,()%]/g, "");
      if (q && searchColumns.length) {
        query = query.or(searchColumns.map((c) => `${c}.ilike.%${q}%`).join(","));
      }
      const { data, error } = await query;
      if (error) throw error;
      res.json(data);
    } catch (e) { next(e); }
  });

  // GET ONE
  router.get("/:id", checkId, async (req, res, next) => {
    try {
      const { data, error } = await supabase.from(table).select(select).eq("id", req.params.id).maybeSingle();
      if (error) throw error;
      if (!data) throw new HttpError(404, "Not found");
      res.json(data);
    } catch (e) { next(e); }
  });

  // CREATE
  router.post("/", async (req, res, next) => {
    try {
      const clean = validate(req.body || {});
      const { data, error } = await supabase.from(table).insert(clean).select(select).single();
      if (error) throw error;
      res.status(201).json(data);
    } catch (e) { next(e); }
  });

  // UPDATE
  router.put("/:id", checkId, async (req, res, next) => {
    try {
      const clean = validate(req.body || {});
      const { data, error } = await supabase.from(table).update(clean).eq("id", req.params.id).select(select).maybeSingle();
      if (error) throw error;
      if (!data) throw new HttpError(404, "Not found");
      res.json(data);
    } catch (e) { next(e); }
  });

  // DELETE
  router.delete("/:id", checkId, async (req, res, next) => {
    try {
      const { data, error } = await supabase.from(table).delete().eq("id", req.params.id).select("id");
      if (error) throw error;
      if (!data.length) throw new HttpError(404, "Not found");
      res.json({ message: "Deleted" });
    } catch (e) { next(e); }
  });

  return router;
}

// ---- small validation helpers used by the route files ----
const text = (v, name, { required = true, max = 200 } = {}) => {
  const s = String(v ?? "").trim();
  if (!s) { if (required) throw new HttpError(400, `${name} is required`); return null; }
  if (s.length > max) throw new HttpError(400, `${name} is too long`);
  return s;
};
const num = (v, name, { min = 0, max = 1e9 } = {}) => {
  const n = Number(v);
  if (v === "" || v == null || !Number.isFinite(n) || n < min || n > max) throw new HttpError(400, `${name} must be a number between ${min} and ${max}`);
  return n;
};
const date = (v, name) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v)) || isNaN(new Date(v))) throw new HttpError(400, `${name} must be a valid date (YYYY-MM-DD)`);
  return String(v);
};
const oneOf = (v, name, list) => {
  if (!list.includes(v)) throw new HttpError(400, `${name} must be one of: ${list.join(", ")}`);
  return v;
};

module.exports = { crudRouter, text, num, date, oneOf, UUID };
