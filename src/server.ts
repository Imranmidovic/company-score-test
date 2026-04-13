import express, { type Request, type Response } from "express";
import { tasks, runs } from "@trigger.dev/sdk";
import { config } from "./config.js";
import { researchRequestSchema, type CompanyReport } from "./types.js";
import type { researchCompany } from "./trigger/research-company.js";

const app = express();
app.use(express.static("public"));
app.use(express.json());

// POST /api/research — trigger a new research run
app.post("/api/research", async (req: Request, res: Response) => {
  const parsed = researchRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const handle = await tasks.trigger<typeof researchCompany>(
      "research-company",
      { domain: parsed.data.domain }
    );

    res.status(202).json({
      runId: handle.id,
      status: "QUEUED",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to trigger task";
    res.status(500).json({ error: message });
  }
});

// GET /api/research/:runId — check status and retrieve results
app.get("/api/research/:runId", async (req: Request, res: Response) => {
  const runId = req.params["runId"];

  if (!runId || typeof runId !== "string") {
    res.status(400).json({ error: "Missing runId parameter" });
    return;
  }

  try {
    const run = await runs.retrieve<typeof researchCompany>(runId);

    if (run.status === "COMPLETED") {
      res.json({
        runId: run.id,
        status: run.status,
        report: run.output as CompanyReport,
      });
      return;
    }

    if (run.status === "FAILED" || run.status === "CANCELED") {
      res.json({
        runId: run.id,
        status: run.status,
        error: run.error,
      });
      return;
    }

    // Still running
    res.json({
      runId: run.id,
      status: run.status,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to retrieve run";
    res.status(500).json({ error: message });
  }
});

app.listen(config.server.port, () => {
  console.log(`Server running on port ${config.server.port}`);
});
