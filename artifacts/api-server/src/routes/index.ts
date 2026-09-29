import { Router, type IRouter } from "express";
import healthRouter from "./health";
import marbleRouter from "./marble";
import musicRouter from "./music";
import worldsRouter from "./worlds";

const router: IRouter = Router();

router.use(healthRouter);
router.use(marbleRouter);
router.use(musicRouter);
router.use(worldsRouter);

export default router;
