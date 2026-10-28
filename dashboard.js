const express = require("express");
const supabase = require("../config/supabase");
const { parseDate, startOfToday, daysBetween, leaseStatus, buildSchedule } = require("../services/rentService");

const router = express.Router();

// Loads everything needed and returns leases + outstanding rent rows
async function loadData() {
  const [props, leases, payments] = await Promise.all([
    supabase.from("properties").select("id"),
    supabase.from("leases").select("*, properties(name), tenants(name)"),
    supabase.from("payments").select("lease_id, month, amount"),
  ]);
  for (const r of [props, leases, payments]) if (r.error) throw r.error;

  const today = startOfToday();
  const outstanding = [];
  for (const lease of leases.data) {
    const own = payments.data.filter((p) => p.lease_id === lease.id);
    for (const row of buildSchedule(lease, own, today)) {
      if (row.balance > 0) {
        outstanding.push({ ...row, tenant: lease.tenants?.name, property: lease.properties?.name });
      }
    }
  }
  outstanding.sort((a, b) => a.due_date.localeCompare(b.due_date));
  return { properties: props.data, leases: leases.data, outstanding, today };
}

// GET /api/outstanding -> every unpaid / partly paid month
router.get("/outstanding", async (req, res, next) => {
  try {
    res.json((await loadData()).outstanding);
  } catch (e) { next(e); }
});

// GET /api/dashboard -> summary numbers + upcoming renewals + outstanding rent
router.get("/dashboard", async (req, res, next) => {
  try {
    const { properties, leases, outstanding, today } = await loadData();

    const active = leases.filter((l) => leaseStatus(l, today) === "Active");
    const occupied = new Set(active.map((l) => l.property_id)).size;
    const overdue = outstanding.filter((r) => r.status === "Overdue" || r.status === "Partial");

    const renewals = leases
      .map((l) => ({ ...l, days_left: daysBetween(parseDate(l.end_date), today) }))
      .filter((l) => l.days_left >= -30 && l.days_left <= 90)
      .sort((a, b) => a.days_left - b.days_left);

    res.json({
      total_properties: properties.length,
      occupancy_percent: properties.length ? Math.round((occupied / properties.length) * 100) : 0,
      active_leases: active.length,
      monthly_rent_roll: active.reduce((s, l) => s + Number(l.rent), 0),
      overdue_amount: overdue.reduce((s, r) => s + r.balance, 0),
      overdue_count: overdue.length,
      renewals,
      outstanding,
    });
  } catch (e) { next(e); }
});

module.exports = router;
