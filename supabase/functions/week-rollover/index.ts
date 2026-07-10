// week-rollover — cron Вс 23:59 (20-backend.md §3.4.2/§3.6).
// Атомарная смена мира: закрыть неделю → открыть следующую (Demand/Specials/
// слоты). Идемпотентно по processed_anchors (town,week,'rollover').
import { serveJob } from "../_shared/cron.ts";
Deno.serve(serveJob("job_week_rollover"));
