// Turns any error into a safe JSON response (no stack traces or raw DB errors).

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Friendly messages for common Postgres error codes
function fromDatabase(error) {
  switch (error.code) {
    case "23P01": return new HttpError(409, "This property already has a lease in those dates.");
    case "23503": return new HttpError(409, "This record is linked to other records (or the linked record does not exist).");
    case "23505": return new HttpError(409, "This record already exists.");
    case "23514": return new HttpError(400, "A value is not allowed (check dates, amounts and options).");
    case "22P02": return new HttpError(400, "Invalid value format.");
    default:
      console.error("Database error:", error.message);
      return new HttpError(500, "Something went wrong. Please try again.");
  }
}

function notFound(req, res) {
  res.status(404).json({ error: "Route not found" });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const e = err instanceof HttpError ? err : err && err.code ? fromDatabase(err) : null;
  if (e) return res.status(e.status).json({ error: e.message });
  if (err && err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON" });
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
}

module.exports = { HttpError, notFound, errorHandler };
