import express from "express";
import { config } from "./config.js";
import { router } from "./router.js";

const app = express();
app.use(express.static("public"));
app.use(express.json());
app.use(router);

app.listen(config.server.port, () => {
  console.log(`Server running on port ${config.server.port}`);
});
