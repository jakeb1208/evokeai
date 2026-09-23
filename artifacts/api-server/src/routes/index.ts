import { Router, type IRouter } from "express";
import healthRouter from "./health";
import marbleRouter from "./marble";

const router: IRouter = Router();

router.use(healthRouter);
router.use(marbleRouter);

export default router;
