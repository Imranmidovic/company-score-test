import { Router } from "express";
import {
  triggerResearch,
  getResearchStatus,
} from "./controllers/research.js";

const router = Router();

router.post("/api/research", triggerResearch);
router.get("/api/research/:runId", getResearchStatus);

export { router };
