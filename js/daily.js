window.Garden = window.Garden || {};

(function (Garden) {
  // Dev-only: shifts "today" by N days so rollover is testable without waiting.
  let dayOffset = 0;

  // A "day" is a local calendar date key like "2026-06-13".
  function todayKey(now) {
    const d = new Date(now == null ? Date.now() : now);
    if (dayOffset) d.setDate(d.getDate() + dayOffset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  // Whole-day difference between two "YYYY-MM-DD" keys (positive if to > from).
  function dayDiff(fromKey, toKey) {
    if (!fromKey || !toKey) return Infinity;
    const f = fromKey.split("-").map(Number);
    const t = toKey.split("-").map(Number);
    const a = Date.UTC(f[0], f[1] - 1, f[2]);
    const b = Date.UTC(t[0], t[1] - 1, t[2]);
    return Math.round((b - a) / 86400000);
  }

  function defaultDaily() {
    return {
      streakCount: 0,     // total claims made (cycle position = count % 7 + 1)
      lastClaimDay: null, // "YYYY-MM-DD" of last streak claim
      lastSpinDay: null,  // "YYYY-MM-DD" of last lucky-draw spin
      questsDay: null,    // day key the current quest set belongs to
      chestDay: null,     // day key the all-3 chest was awarded
      lastSeenAt: 0,      // ms timestamp, refreshed on every save — powers recap
    };
  }

  function ensureDaily(state) {
    if (!state.daily || typeof state.daily !== "object") {
      state.daily = defaultDaily();
    }
    return state.daily;
  }

  // ---- Login streak: 7-day repeating reward cycle ----
  const STREAK_REWARDS = [
    { day: 1, coins: 50 },
    { day: 2, coins: 100 },
    { day: 3, potionId: "speedPotion" },
    { day: 4, coins: 200 },
    { day: 5, potionId: "revivalPotion" },
    { day: 6, coins: 400 },
    { day: 7, coins: 500, mysterySeed: 1 },
  ];

  // Cycle position (1-7) the NEXT claim will award, after any rewind.
  function nextStreakPosition(daily, today) {
    let count = daily.streakCount;
    if (daily.lastClaimDay && dayDiff(daily.lastClaimDay, today) > 1) {
      count = Math.max(0, count - 1);
    }
    return (count % 7) + 1;
  }

  function canClaimStreak(state, now) {
    return ensureDaily(state).lastClaimDay !== todayKey(now);
  }

  function claimStreak(state, now) {
    const daily = ensureDaily(state);
    const today = todayKey(now);
    if (daily.lastClaimDay === today) return { ok: false, reason: "claimed" };

    // Rewind rule: a gap of more than 1 calendar day since the last CLAIM
    // slips the streak back one step (never a full reset).
    if (daily.lastClaimDay && dayDiff(daily.lastClaimDay, today) > 1) {
      daily.streakCount = Math.max(0, daily.streakCount - 1);
    }
    const position = (daily.streakCount % 7) + 1;
    const reward = STREAK_REWARDS[position - 1];

    if (!state.inventory) state.inventory = {};
    if (reward.coins) state.coins += reward.coins;
    if (reward.potionId) {
      state.inventory[reward.potionId] = (state.inventory[reward.potionId] || 0) + 1;
    }
    if (reward.mysterySeed) {
      state.inventory.mysterySeed = (state.inventory.mysterySeed || 0) + reward.mysterySeed;
    }
    daily.streakCount += 1;
    daily.lastClaimDay = today;
    return { ok: true, position, reward };
  }

  // ---- Lucky draw: one free spin per day ----
  const DRAW_PRIZES = [
    { id: "coinsSmall",    label: "Coins",          weight: 40, coins: s => 40 + s.level * 5 },
    { id: "coinsMedium",   label: "Coin Pouch",     weight: 25, coins: s => 100 + s.level * 10 },
    { id: "speedPotion",   label: "Speed Potion",   weight: 15, potionId: "speedPotion" },
    { id: "revivalPotion", label: "Revival Potion", weight: 10, potionId: "revivalPotion" },
    { id: "coinsLarge",    label: "Coin Chest",     weight: 5,  coins: s => 300 + s.level * 20 },
    { id: "mysterySeed",   label: "Mystery Seed",   weight: 5,  mysterySeed: 1 },
  ];

  function canSpin(state, now) {
    return ensureDaily(state).lastSpinDay !== todayKey(now);
  }

  // roll in [0, 1) maps onto the weighted table.
  function pickPrize(roll) {
    const total = DRAW_PRIZES.reduce((sum, p) => sum + p.weight, 0);
    let r = roll * total;
    for (const p of DRAW_PRIZES) {
      r -= p.weight;
      if (r < 0) return p;
    }
    return DRAW_PRIZES[0];
  }

  function spinDraw(state, now, roll) {
    const daily = ensureDaily(state);
    const today = todayKey(now);
    if (daily.lastSpinDay === today) return { ok: false, reason: "spun" };
    const prize = pickPrize(roll == null ? Math.random() : roll);

    if (!state.inventory) state.inventory = {};
    let coins = 0;
    if (prize.coins) {
      coins = prize.coins(state);
      state.coins += coins;
    }
    if (prize.potionId) {
      state.inventory[prize.potionId] = (state.inventory[prize.potionId] || 0) + 1;
    }
    if (prize.mysterySeed) {
      state.inventory.mysterySeed = (state.inventory.mysterySeed || 0) + 1;
    }
    daily.lastSpinDay = today;
    return { ok: true, prizeId: prize.id, label: prize.label, coins };
  }

  // ---- Daily quest rollover ----
  function rolloverQuests(state, now) {
    const daily = ensureDaily(state);
    const today = todayKey(now);
    if (daily.questsDay === today) return { rolled: false };
    if (daily.questsDay == null && Array.isArray(state.quests) && state.quests.length > 0) {
      // Migration: a pre-feature save adopts its existing rolling quests as
      // today's set; they're replaced on the first real new-day rollover.
      daily.questsDay = today;
      return { rolled: false };
    }
    state.quests = [];
    for (let i = 0; i < 3; i++) state.quests.push(Garden.state.generateQuest(state));
    daily.questsDay = today;
    return { rolled: true };
  }

  // ---- While-you-were-away recap ----
  function computeRecap(state, now) {
    const daily = ensureDaily(state);
    const since = daily.lastSeenAt || 0;
    const t = now == null ? Date.now() : now;
    let bloomed = 0, wilted = 0, readyNow = 0;
    state.plots.forEach(plot => {
      if (!plot || !plot.bloomAt) return;
      const flower = Garden.flowerById(plot.flowerId);
      if (!flower) return;
      const wiltAt = plot.bloomAt + flower.growMs;
      if (plot.bloomAt > since && plot.bloomAt <= t) bloomed += 1;
      if (wiltAt > since && wiltAt <= t) wilted += 1;
      if (plot.bloomAt <= t && wiltAt > t) readyNow += 1;
    });
    const awayMs = since ? t - since : 0;
    const show = awayMs >= 10 * 60 * 1000 && (bloomed > 0 || wilted > 0);
    return { bloomed, wilted, readyNow, awayMs, show };
  }

  // Unclaimed streak + unused spin (0-2) — drives the Daily button badge.
  function claimablesCount(state, now) {
    return (canClaimStreak(state, now) ? 1 : 0) + (canSpin(state, now) ? 1 : 0);
  }

  Garden.daily = {
    todayKey, dayDiff, defaultDaily, ensureDaily,
    STREAK_REWARDS, nextStreakPosition, canClaimStreak, claimStreak,
    DRAW_PRIZES, canSpin, spinDraw,
    rolloverQuests, computeRecap, claimablesCount,
    _setDayOffset: n => { dayOffset = n; },
  };
})(window.Garden);
