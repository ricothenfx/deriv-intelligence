import "./env";
import { runMigrations } from "./migrate";
import { closePool } from "./db";

runMigrations()
  .then((applied) => {
    console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Up to date");
    return closePool();
  })
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
