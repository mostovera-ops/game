// event-settle — cron Вс 20:00 UTC (K7, 20-backend.md §3.4.2).
// Идемпотентный финал ивента: вехи → личные сундуки → StreetScore → лиги.
// Ключ (town,week,'event_final') в processed_anchors + (player,week,reward) в леджере.
import { serveJob } from "../_shared/cron.ts";
Deno.serve(serveJob("job_event_settle"));
