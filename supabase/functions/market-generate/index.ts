// market-generate — cron Пн 00:00 (20-backend.md §3.4.2/§3.6).
// Детерминированная генерация недельного спроса + конкурсы/кооп/тема недели по
// всем городам. Идемпотентно по processed_anchors (town,week,'A0') внутри SQL.
import { serveJob } from "../_shared/cron.ts";
Deno.serve(serveJob("job_market_generate"));
