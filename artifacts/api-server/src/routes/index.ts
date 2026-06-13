import { Router, type IRouter } from "express";
import healthRouter from "./health";
import casesRouter from "./cases";
import metricsRouter from "./metrics";
import quotaRouter from "./quota";
import webhookRouter from "./webhook";
import demoRouter from "./demo";

const router: IRouter = Router();

router.use(healthRouter);
router.use(casesRouter);
router.use(metricsRouter);
router.use(quotaRouter);
router.use(webhookRouter);
router.use(demoRouter);

export default router;
