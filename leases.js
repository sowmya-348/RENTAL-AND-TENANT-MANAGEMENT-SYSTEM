const { crudRouter, num, date, UUID } = require("../utils/crud");
const { HttpError } = require("../middleware/errorHandler");

module.exports = crudRouter({
  table: "leases",
  select: "*, properties(name), tenants(name)",
  orderBy: "end_date",
  ascending: true,
  validate: (b) => {
    if (!UUID.test(String(b.property_id))) throw new HttpError(400, "Choose a property");
    if (!UUID.test(String(b.tenant_id))) throw new HttpError(400, "Choose a tenant");
    const start_date = date(b.start_date, "Start date");
    const end_date = date(b.end_date, "End date");
    if (end_date <= start_date) throw new HttpError(400, "End date must be after start date");
    return {
      property_id: b.property_id,
      tenant_id: b.tenant_id,
      start_date,
      end_date,
      rent: num(b.rent, "Rent"),
      due_day: Math.trunc(num(b.due_day, "Due day", { min: 1, max: 31 })),
      deposit: num(b.deposit ?? 0, "Deposit"),
    };
  },
});
