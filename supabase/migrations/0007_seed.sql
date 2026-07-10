-- ============================================================================
-- 0007_seed.sql — Sunnyside · Сид game_config v1 из канона (00-canon.md)
-- Реализует 20-backend.md §3.8 (конфиг — данные в БД) / §3.9 (сид — часть
--   миграций, чтобы local/staging/prod поднимались с идентичным балансом).
-- Значения — канон-константы (валюты §2.1, календарь §2.3, тиры §2.2,
--   гардрейлы монетизации §3, DECISIONS-B K2/K3/K11) + технические гипотезы
--   таймеров/кэпов (20-backend §4.2/§4.3). Балансные числа централизуются в
--   14-economy.md — здесь стартовый снапшот версии `1.0.0-canon`.
-- Идемпотентно: фиксированный version_id + ON CONFLICT DO NOTHING.
-- ============================================================================

-- Детерминированный id версии сида (чтобы миграция была повторяемой).
do $$
declare v_ver uuid := '00000000-0000-0000-0000-0000000c0f19';  -- "config" v1
begin
  -- 1. Версия конфигурации (active).
  insert into public.config_versions(id, label, state, activated_at, notes)
  values (v_ver, '1.0.0-canon', 'active', now(),
          'Seed v1 из 00-canon.md (валюты §2.1, календарь §2.3, тиры §2.2, гардрейлы §3).')
  on conflict (id) do nothing;

  -- 2. game_configs по неймспейсам (20-backend §3.2.11).

  -- 2.1 Валюты — ровно 4 (канон §2.1, K11). Know-How/scrap/tokens/miles — НЕ валюты.
  insert into public.game_configs(namespace, version_id, doc) values ('currencies', v_ver, $json$
  {
    "list": ["bucks","dimes","tickets","ribbons"],
    "bucks":   {"symbol": "$",  "type": "soft",     "role": "production_economy"},
    "dimes":   {"symbol": "◉",  "type": "premium",  "role": "time_slots_cosmetics", "real_money": true},
    "tickets": {"symbol": "🎟", "type": "event",    "role": "event_shop_streak_insure"},
    "ribbons": {"symbol": "🎀", "type": "prestige", "role": "contest_showcase_only", "purchasable": false},
    "non_currency_state": ["know_how_points","staff_tokens","scrap","route_miles"]
  }$json$::jsonb) on conflict (namespace, version_id) do nothing;

  -- 2.2 Календарь недели (канон §2.3, окна UTC; K7 финал ивента 20:00).
  insert into public.game_configs(namespace, version_id, doc) values ('calendar', v_ver, $json$
  {
    "week_start_dow": 1,
    "phases": ["mon_plan","tue_produce","wed_route","thu_coop","fri_prep","sat_fair","sun_event"],
    "anchors_utc": {
      "week_start":    {"dow": 1, "time": "00:00"},
      "coop_deadline": {"dow": 4, "time": "23:59"},
      "fair_open":     {"dow": 6, "time": "00:00"},
      "fair_close":    {"dow": 7, "time": "12:00"},
      "event_final":   {"dow": 7, "time": "20:00"},
      "rollover":      {"dow": 7, "time": "23:59"}
    },
    "fair_window_hours": 36,
    "route_pass_season_weeks": 8
  }$json$::jsonb) on conflict (namespace, version_id) do nothing;

  -- 2.3 Тиры продуктов T1–T5 (канон §2.2; T5-цикл 240–480, станд. 300, K3).
  insert into public.game_configs(namespace, version_id, doc) values ('tiers', v_ver, $json$
  {
    "T1": {"name": "Garden",  "cycle_min": [5, 15],    "dish_price": 6,   "price_mult": 1.0},
    "T2": {"name": "Farm",    "cycle_min": [30, 120],  "dish_price": 22,  "price_mult": 3.7},
    "T3": {"name": "County",  "cycle_min": [120, 480], "dish_price": 75,  "price_mult": 12.5},
    "T4": {"name": "States",  "cycle_min": [480, 1440],"dish_price": 260, "price_mult": 43.0},
    "T5": {"name": "Legends", "cycle_min": [240, 480], "dish_price": 900, "price_mult": 150.0,
           "cycle_min_standard": 300},
    "scaling": {"value_per_click_T1_to_T5": 150, "income_per_hour_T1_to_T5": 2.5,
                "land_price_per_slot_mult": 1.18, "upgrade_mult": 2.2}
  }$json$::jsonb) on conflict (namespace, version_id) do nothing;

  -- 2.4 Таймеры (гипотезы 20-backend §4.2). grow_min/cycle_min по ключам —
  --     расширяются эконом-спекой 14-economy.md; здесь опорные значения.
  insert into public.game_configs(namespace, version_id, doc) values ('timers', v_ver, $json$
  {
    "crops": {
      "tomato":  {"grow_min": 8},
      "lettuce": {"grow_min": 5},
      "potato":  {"grow_min": 12},
      "wheat":   {"grow_min": 15},
      "corn":    {"grow_min": 60},
      "strawberry": {"grow_min": 90}
    },
    "animals": {
      "cow":     {"cycle_min": 120},
      "chicken": {"cycle_min": 45},
      "pig":     {"cycle_min": 240},
      "dairy_goat": {"cycle_min": 150},
      "turkey":  {"cycle_min": 300}
    },
    "mail_deliver_hours": [8, 20],
    "expedition_hours": {"st_illinois": 8, "st_georgia": 16, "st_maine": 24},
    "fair_tick_min": 15,
    "phase_tick_min": 5,
    "foraging_respawn_hour_utc": 6
  }$json$::jsonb) on conflict (namespace, version_id) do nothing;

  -- 2.5 Цены/спрос (опорные; демо-множители ±15–30% канон §2.3).
  insert into public.game_configs(namespace, version_id, doc) values ('prices', v_ver, $json$
  {
    "tomato":  {"base": 3,  "category": "produce"},
    "lettuce": {"base": 2,  "category": "produce"},
    "potato":  {"base": 4,  "category": "produce"},
    "wheat":   {"base": 3,  "category": "grain"},
    "corn":    {"base": 9,  "category": "grain"},
    "milk":    {"base": 12, "category": "dairy"},
    "egg":     {"base": 5,  "category": "dairy"}
  }$json$::jsonb) on conflict (namespace, version_id) do nothing;

  insert into public.game_configs(namespace, version_id, doc) values ('demand', v_ver, $json$
  {
    "swing_pct": {"min": 15, "max": 30},
    "categories": ["produce","grain","dairy","meat","baked","preserved","luxury"],
    "seed_formula": "hash(town_id, week_index, config_version)"
  }$json$::jsonb) on conflict (namespace, version_id) do nothing;

  -- 2.6 Рецепты (минимальный демо-набор вход/выход/время; справочник — конфиг).
  insert into public.game_configs(namespace, version_id, doc) values ('recipes', v_ver, $json$
  {
    "recipe_tomato_soup": {
      "time_min": 15,
      "inputs":  [{"item_key": "tomato", "qty": 2, "quality": 0}],
      "output":  {"item_key": "tomato_soup", "qty": 1, "quality": 0}
    },
    "recipe_bread": {
      "time_min": 30,
      "inputs":  [{"item_key": "wheat", "qty": 3, "quality": 0}],
      "output":  {"item_key": "bread", "qty": 1, "quality": 0}
    },
    "recipe_omelette": {
      "time_min": 10,
      "inputs":  [{"item_key": "egg", "qty": 2, "quality": 0}, {"item_key": "milk", "qty": 1, "quality": 0}],
      "output":  {"item_key": "omelette", "qty": 1, "quality": 0}
    }
  }$json$::jsonb) on conflict (namespace, version_id) do nothing;

  -- 2.7 Серверный ивент: конвертация предметов в Fill Points + вехи (EV8).
  insert into public.game_configs(namespace, version_id, doc) values ('event', v_ver, $json$
  {
    "milestones": ["ms_25","ms_50","ms_75","ms_100","ms_125","ms_150"],
    "milestone_pct": {"ms_25": 25, "ms_50": 50, "ms_75": 75, "ms_100": 100, "ms_125": 125, "ms_150": 150},
    "event_final_utc": {"dow": 7, "time": "20:00"},
    "league_soft_reset_pct": 25,
    "fp": {"tomato_soup": 3, "bread": 5, "omelette": 4}
  }$json$::jsonb) on conflict (namespace, version_id) do nothing;

  -- 2.8 Route Pass (8 недель, R7; щедрый фри-трек — гардрейл канон §3).
  insert into public.game_configs(namespace, version_id, doc) values ('route_pass', v_ver, $json$
  {
    "season_weeks": 8,
    "max_level": 50,
    "miles_per_level": 1000,
    "free_track_generous": true,
    "second_research_slot_cost_dimes": 40
  }$json$::jsonb) on conflict (namespace, version_id) do nothing;

  -- 2.9 Prize Machine: открытый pity Rare≤10/Chase≤40, дроп 68/24/6.5/1.5% (K2).
  insert into public.game_configs(namespace, version_id, doc) values ('prize_machine', v_ver, $json$
  {
    "cost_dimes": 20,
    "free_pull_daily": 1,
    "rare_pity": 10,
    "chase_pity": 40,
    "drop_rates_pct": {"common": 68, "uncommon": 24, "rare": 6.5, "chase": 1.5},
    "pity_open": true,
    "series": ["toy_cosmos_57","toy_highway_dinos","toy_diner_classics","toy_googie","toy_roadside"],
    "dupes_to_scrap": true
  }$json$::jsonb) on conflict (namespace, version_id) do nothing;

  -- 2.10 Стафф: 12 архетипов, 4 поста (Yard — открыт, §8 п.6/OQ6).
  insert into public.game_configs(namespace, version_id, doc) values ('staff', v_ver, $json$
  {
    "posts": ["kitchen","field","counter","yard"],
    "archetypes": ["staff_bruno","staff_marty","staff_gus","staff_buck","staff_hank",
                   "staff_vernon","staff_clara","staff_pearl","staff_otis","staff_dot",
                   "staff_ray","staff_june"],
    "effects": {
      "staff_bruno":  {"craft_time_pct": -10},
      "staff_marty":  {"batch_plus": 1},
      "staff_gus":    {"expedition_time_pct": -15},
      "staff_buck":   {"route_slot_plus": 1},
      "staff_hank":   {"auto_water": true},
      "staff_vernon": {"upgrade_speedup": true},
      "staff_clara":  {"animal_cycle_pct": -10}
    }
  }$json$::jsonb) on conflict (namespace, version_id) do nothing;

  -- 2.11 Дропы фуражинга/экспедиций (гарантированный минимум — P3).
  insert into public.game_configs(namespace, version_id, doc) values ('drops', v_ver, $json$
  {
    "foraging": {
      "point_types": ["mushroom","berry","fishing","wild_beehive"],
      "fishing_guaranteed_common": true,
      "pool_max_default": 40,
      "respawn_hour_utc": 6
    },
    "expedition_guaranteed_rows": 1
  }$json$::jsonb) on conflict (namespace, version_id) do nothing;

  -- 2.12 Кэпы и лимиты (античит-гардрейлы, 20-backend §4.2/§4.3, канон §3).
  insert into public.game_configs(namespace, version_id, doc) values ('caps', v_ver, $json$
  {
    "help_per_target_per_day": 3,
    "gift_per_target_per_day": 3,
    "mentor_max_mentees": 2,
    "moving_cooldown_days": 14,
    "town_min_stay_days": 3,
    "streak_free_freezes_per_month": 2,
    "mail_in_transit_max": 5,
    "mail_weekly_limits": {"rare": 3, "decor": 1, "tools": 5},
    "mail_speedup_dime_cap": 5,
    "shift_per_fair_window": 3,
    "shift_cooldown_hours": 2,
    "ticket_cap_per_week": 5,
    "cosmetic_collection_fv_cap_pct": 15,
    "farm_level_max": 60,
    "building_level_max": 10,
    "prize_pull_rate_per_min": 20,
    "harvest_rate_per_min": 60,
    "chat_rate_per_min": 10,
    "chat_ttl_days": 30,
    "audit_ttl_days": 90,
    "quorum_caravan_pct": 60,
    "quorum_merge_pct": 50,
    "quorum_merge_turnout_pct": 40,
    "town_capacity": 200,
    "street_capacity": 20,
    "coop_participants": [5, 15],
    "migrate_ticket_compensation_rate": 50
  }$json$::jsonb) on conflict (namespace, version_id) do nothing;

  -- 3. Привязать все существующие города/фермы к активной версии (обычно 0 строк).
  update public.towns set active_config_version_id = v_ver
    where active_config_version_id is null;
  update public.farms set config_version_id = v_ver
    where config_version_id is null;
end $$;
