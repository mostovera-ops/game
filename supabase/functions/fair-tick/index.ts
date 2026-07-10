// fair-tick — cron каждые 15 мин в окне ярмарки (20-backend.md §3.4.2).
// Пассивная симуляция продаж лотов по SellRate, запись fair_sales, FP в ивент.
// Идемпотентно по idempotency(scope='fair_tick', key=lot:tick_window).
import { serveJob } from "../_shared/cron.ts";
Deno.serve(serveJob("job_fair_tick"));
