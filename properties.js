const { crudRouter, text, num, oneOf } = require("../utils/crud");

const TYPES = ["Apartment", "House", "Villa", "Shop", "Office", "Room/PG"];

module.exports = crudRouter({
  table: "properties",
  searchColumns: ["name", "address", "type"],
  validate: (b) => ({
    name: text(b.name, "Name", { max: 100 }),
    address: text(b.address, "Address", { max: 300 }),
    type: oneOf(b.type, "Type", TYPES),
    market_rent: num(b.market_rent, "Market rent"),
  }),
});
