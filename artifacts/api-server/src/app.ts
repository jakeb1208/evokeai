import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "32mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

const defaultWebDistDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../evoai/dist/public",
);
const webDistDirectory =
  process.env["WEB_DIST_DIR"] ?? defaultWebDistDirectory;
app.use(express.static(webDistDirectory));
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api")) return next();
  res.sendFile(path.join(webDistDirectory, "index.html"), (error) => {
    if (error) next();
  });
});

export default app;
