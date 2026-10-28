const { crudRouter, text } = require("../utils/crud");
const { HttpError } = require("../middleware/errorHandler");

module.exports = crudRouter({
  table: "tenants",
  searchColumns: ["name", "phone", "email"],
  validate: (b) => {
    const phone = text(b.phone, "Phone", { max: 20 });
    if (!/^[0-9+\-\s]{7,20}$/.test(phone)) throw new HttpError(400, "Phone number is not valid");
    const email = text(b.email, "Email", { required: false, max: 150 });
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "Email is not valid");
    return {
      name: text(b.name, "Name", { max: 100 }),
      phone,
      email,
      id_proof: text(b.id_proof, "ID proof", { required: false, max: 100 }),
    };
  },
});
