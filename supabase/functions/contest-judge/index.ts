// contest-judge — cron Вс 12:00 UTC, конец окна голосования (K8).
// npc_score + агрегация голосов игроков → final_score, ранги, Blue Ribbon.
// Идемпотентно по idempotency(scope='contest_judge', key=contest_id).
import { serveJob } from "../_shared/cron.ts";
Deno.serve(serveJob("job_contest_judge"));
