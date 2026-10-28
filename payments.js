const { crudRouter, num, date, oneOf, UUID } = require("../utils/crud");
const { HttpError } = require("../middleware/errorHandler");

const METHODS = ["UPI", "Bank transfer", "Cash", "Cheque"];

module.exports = crudRouter({
  table: "payments",
  select: "*, leases(id, tenants(name), properties(name))",
  orderBy: "paid_on",
  validate: (b) => {
    if (!UUID.test(String(b.lease_id))) throw new HttpError(400, "Choose a lease");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(b.month))) throw new HttpError(400, "Month must look like 2026-10");
    return {
      lease_id: b.lease_id,
      month: b.month,
      amount: num(b.amount, "Amount", { min: 0.01 }),
      paid_on: date(b.paid_on, "Paid on"),
      method: oneOf(b.method, "Method", METHODS),
    };
  },
});
