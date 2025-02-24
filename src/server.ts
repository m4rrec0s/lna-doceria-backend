import express from "express";
import { routes } from "./routes";

const app = express();
const port = process.env.PORT || 8080;

app.get("/", (req, res) => {
  res.send("LNA DOCERIA API - v1.0.0");
});

app.use(express.json());
app.use(routes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
