/* =========================================================
   Ferreira Fitness – Progreso semanal (Ejercicio + Nutrición)
   ---------------------------------------------------------
   Experiencia simple: se elige UN día y se responden 4 preguntas
   rápidas (entreno, comida, agua, sueño). El resumen de la semana
   se actualiza solo y todo se guarda automáticamente.

   Arquitectura pensada para migrar a una App:
   - Modelo de datos JSON versionado (SCHEMA_VERSION).
   - "StorageAdapter": hoy usa localStorage; mañana basta con
     crear un ApiAdapter (load/save contra el backend del gym)
     con la misma interfaz y pasarlo a createTracker().
   ========================================================= */
(function () {
  "use strict";

  const SCHEMA_VERSION = 1;
  const STORAGE_KEY = "ff_progress_v1";
  const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const DAY_LONG = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  const WORKOUT_TYPES = ["Fuerza", "Cardio", "Funcional/HIIT", "Clase grupal", "Movilidad"];
  const NO_TYPE = "—";
  const SLEEP_GOAL = 8;        // meta guardada en el modelo
  const SLEEP_OK = 7;          // una noche cuenta como "buena" desde 7 h
  const SLEEP_CHOICES = [5, 6, 7, 8, 9]; // 5 = "5 o menos", 9 = "9 o más"

  const ICONS = {
    workout: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/></svg>',
    food: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>',
    water: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>',
    sleep: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>'
  };

  /* ---------- Adaptador de almacenamiento ---------- */
  const LocalStorageAdapter = {
    load() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; }
      catch (e) { return null; }
    },
    save(data) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* almacenamiento lleno o bloqueado */ }
    }
  };
  // Ejemplo futuro:
  // const ApiAdapter = {
  //   async load() { return (await fetch('/api/members/me/progress')).json(); },
  //   async save(data) { await fetch('/api/members/me/progress', { method: 'PUT', body: JSON.stringify(data) }); }
  // };

  /* ---------- Utilidades de fecha (hora local) ---------- */
  const pad = (n) => String(n).padStart(2, "0");
  const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const mondayOf = (date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diff = (d.getDay() + 6) % 7; // lunes = 0
    d.setDate(d.getDate() - diff);
    return d;
  };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const fmtShort = (d) => d.toLocaleDateString("es-VE", { day: "numeric", month: "short" });

  /* ---------- Modelo ---------- */
  function emptyData() {
    return {
      schemaVersion: SCHEMA_VERSION,
      member: { id: null, name: null, coachId: null }, // se llenará al sincronizar con la App
      goals: { workoutsPerWeek: 4, waterGlasses: 8, sleepHours: SLEEP_GOAL },
      weeks: {}
    };
  }
  function emptyWeek(mondayKey) {
    const monday = fromKey(mondayKey);
    return {
      weekStart: mondayKey,
      weightStart: null,
      weightEnd: null,
      updatedAt: null,
      days: DAY_NAMES.map((_, i) => ({
        date: toKey(addDays(monday, i)),
        workout: false,
        workoutType: NO_TYPE,
        nutrition: false,
        water: 0,
        sleep: 0
      }))
    };
  }

  function createTracker(root, adapter) {
    let data = adapter.load() || emptyData();
    if (data.schemaVersion !== SCHEMA_VERSION) data = emptyData(); // aquí irían migraciones futuras
    let currentMonday = mondayOf(new Date());
    let selected = defaultSelected();
    let saveTimer = null;

    const $ = (sel) => root.querySelector(sel);
    const els = {
      tabs: $("#wkDays"),
      panel: $("#dayPanel"),
      weekLabel: $("#weekLabel"),
      goalWorkouts: $("#goalWorkouts"),
      goalWater: $("#goalWater"),
      weightStart: $("#weightStart"),
      weightEnd: $("#weightEnd"),
      weightDelta: $("#weightDelta"),
      msg: $("#trackerMsg"),
      saved: $("#saveNote")
    };

    const week = () => {
      const k = toKey(currentMonday);
      if (!data.weeks[k]) data.weeks[k] = emptyWeek(k);
      return data.weeks[k];
    };
    const persist = () => {
      week().updatedAt = new Date().toISOString();
      adapter.save(data);
      flashSaved();
    };
    function flashSaved() {
      if (!els.saved) return;
      els.saved.classList.add("is-on");
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => els.saved.classList.remove("is-on"), 1600);
    }

    // Si la semana mostrada contiene hoy, se abre hoy; si no, el lunes.
    function defaultSelected() {
      const todayKey = toKey(new Date());
      for (let i = 0; i < 7; i++) if (toKey(addDays(currentMonday, i)) === todayKey) return i;
      return 0;
    }

    const dayHasData = (d) => d.workout || d.nutrition || d.water > 0 || d.sleep > 0;

    /* ----- Métricas (todo se cuenta en "días" para que sea fácil de entender) ----- */
    function metrics() {
      const w = week(), g = data.goals;
      const workouts = w.days.filter((d) => d.workout).length;
      const nutritionDays = w.days.filter((d) => d.nutrition).length;
      const waterDays = w.days.filter((d) => d.water >= g.waterGlasses).length;
      const sleepDays = w.days.filter((d) => d.sleep >= SLEEP_OK).length;
      return {
        workouts, nutritionDays, waterDays, sleepDays,
        workout: Math.min(100, Math.round((workouts / g.workoutsPerWeek) * 100)),
        nutrition: Math.round((nutritionDays / 7) * 100),
        water: Math.round((waterDays / 7) * 100),
        sleep: Math.round((sleepDays / 7) * 100)
      };
    }

    /* ----- Render ----- */
    function renderTabs() {
      const todayKey = toKey(new Date());
      els.tabs.innerHTML = week().days.map((d, i) => `
        <button type="button" class="wk-tab ${i === selected ? "is-active" : ""} ${d.date === todayKey ? "is-today" : ""}"
                role="tab" aria-selected="${i === selected}" data-i="${i}"
                aria-label="${DAY_LONG[i]} ${fromKey(d.date).getDate()}${dayHasData(d) ? ", con registro" : ""}">
          <span class="wk-tab__name">${DAY_NAMES[i]}</span>
          <span class="wk-tab__num">${fromKey(d.date).getDate()}</span>
          <span class="wk-tab__dot ${dayHasData(d) ? "is-on" : ""}"></span>
        </button>`).join("");
    }

    function renderPanel() {
      const w = week(), g = data.goals, d = w.days[selected];
      const date = fromKey(d.date);
      const isToday = d.date === toKey(new Date());
      const monthTxt = date.toLocaleDateString("es-VE", { month: "short" }).replace(".", "");
      const title = `${isToday ? "Hoy" : DAY_LONG[selected]} · ${DAY_LONG[selected].toLowerCase()} ${date.getDate()} de ${monthTxt}`;

      const glasses = Math.max(g.waterGlasses, d.water);
      const glassBtns = Array.from({ length: glasses }, (_, i) =>
        `<button type="button" class="glass ${i < d.water ? "is-full" : ""}" data-act="water" data-n="${i + 1}" aria-label="${i + 1} ${i === 0 ? "vaso" : "vasos"}">${ICONS.water}</button>`
      ).join("");

      const sleepBtns = SLEEP_CHOICES.map((h) => {
        const active = h === 5 ? d.sleep > 0 && d.sleep <= 5 : h === 9 ? d.sleep >= 9 : d.sleep === h;
        const label = h === 5 ? "5 o menos" : h === 9 ? "9 o más" : h + " h";
        return `<button type="button" class="chip ${active ? "is-active" : ""}" data-act="sleep" data-h="${h}" aria-pressed="${active}">${label}</button>`;
      }).join("");

      const typeBtns = d.workout ? `
        <div class="q__sub">
          <span class="q__hint">¿Qué hiciste? (opcional)</span>
          <div class="chips-row">${WORKOUT_TYPES.map((t) =>
            `<button type="button" class="chip ${t === d.workoutType ? "is-active" : ""}" data-act="type" data-t="${t}" aria-pressed="${t === d.workoutType}">${t}</button>`
          ).join("")}</div>
        </div>` : "";

      els.panel.innerHTML = `
        <h3 class="wk-day__title">${title}</h3>

        <div class="q ${d.workout ? "is-done" : ""}">
          <div class="q__row">
            <span class="q__icon">${ICONS.workout}</span>
            <div class="q__text"><strong>¿Entrenaste?</strong></div>
            <button type="button" class="yn ${d.workout ? "is-on" : ""}" data-act="workout" aria-pressed="${d.workout}">
              ${d.workout ? ICONS.check + " Sí" : "Marcar"}
            </button>
          </div>
          ${typeBtns}
        </div>

        <div class="q ${d.nutrition ? "is-done" : ""}">
          <div class="q__row">
            <span class="q__icon">${ICONS.food}</span>
            <div class="q__text"><strong>¿Comiste bien?</strong><small>Comidas completas y sin excesos</small></div>
            <button type="button" class="yn ${d.nutrition ? "is-on" : ""}" data-act="nutrition" aria-pressed="${d.nutrition}">
              ${d.nutrition ? ICONS.check + " Sí" : "Marcar"}
            </button>
          </div>
        </div>

        <div class="q ${d.water >= g.waterGlasses ? "is-done" : ""}">
          <div class="q__row">
            <span class="q__icon">${ICONS.water}</span>
            <div class="q__text"><strong>Agua</strong><small>Toca cada vaso que tomes</small></div>
            <span class="q__count"><b>${d.water}</b> / ${g.waterGlasses}</span>
          </div>
          <div class="glasses">${glassBtns}</div>
        </div>

        <div class="q ${d.sleep >= SLEEP_OK ? "is-done" : ""}">
          <div class="q__row">
            <span class="q__icon">${ICONS.sleep}</span>
            <div class="q__text"><strong>¿Cuánto dormiste?</strong><small>Anoche</small></div>
          </div>
          <div class="chips-row">${sleepBtns}</div>
        </div>`;
    }

    function renderSummary() {
      const m = metrics(), g = data.goals;
      const set = (id, txt, pct) => {
        $("#s" + id).textContent = txt;
        $("#b" + id).style.width = Math.min(100, pct) + "%";
      };
      set("Workout", `${m.workouts}/${g.workoutsPerWeek}`, m.workout);
      set("Nutrition", `${m.nutritionDays}/7`, m.nutrition);
      set("Water", `${m.waterDays}/7`, m.water);
      set("Sleep", `${m.sleepDays}/7`, m.sleep);

      const avg = (m.workout + m.nutrition + m.water + m.sleep) / 4;
      els.msg.textContent =
        avg === 0 ? "Toca un día y marca lo que hiciste. ¡Así de fácil!" :
        avg < 35 ? "Buen comienzo. Cada día cuenta, ¡sigue sumando!" :
        avg < 70 ? "¡Vas muy bien! Mantén el ritmo y cierra fuerte la semana." :
        avg < 100 ? "¡Semana de campeón! Estás construyendo hábitos reales." :
        "¡100%! Eres la inspiración de la comunidad Ferreira.";

      const w = week();
      els.weightStart.value = w.weightStart ?? "";
      els.weightEnd.value = w.weightEnd ?? "";
      if (w.weightStart && w.weightEnd) {
        const diff = +(w.weightEnd - w.weightStart).toFixed(1);
        els.weightDelta.textContent = (diff > 0 ? "+" : "") + diff + " kg";
        els.weightDelta.className = "weight-delta " + (diff < 0 ? "down" : diff > 0 ? "up" : "");
      } else {
        els.weightDelta.textContent = "—";
        els.weightDelta.className = "weight-delta";
      }

      const end = addDays(currentMonday, 6);
      els.weekLabel.textContent = `${fmtShort(currentMonday)} – ${fmtShort(end)}`;
    }

    function render() {
      els.goalWorkouts.value = data.goals.workoutsPerWeek;
      els.goalWater.value = data.goals.waterGlasses;
      renderTabs();
      renderPanel();
      renderSummary();
    }
    const refresh = () => { renderTabs(); renderPanel(); renderSummary(); };

    /* ----- Eventos ----- */
    els.tabs.addEventListener("click", (e) => {
      const tab = e.target.closest(".wk-tab");
      if (!tab) return;
      selected = +tab.dataset.i;
      renderTabs(); renderPanel();
    });

    els.panel.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const day = week().days[selected];
      switch (btn.dataset.act) {
        case "workout":
          day.workout = !day.workout;
          if (!day.workout) day.workoutType = NO_TYPE;
          break;
        case "nutrition":
          day.nutrition = !day.nutrition;
          break;
        case "type":
          day.workoutType = day.workoutType === btn.dataset.t ? NO_TYPE : btn.dataset.t;
          break;
        case "water": {
          const n = +btn.dataset.n;
          day.water = day.water === n ? n - 1 : n; // tocar el último vaso lo quita
          break;
        }
        case "sleep": {
          const h = +btn.dataset.h;
          const same = h === 5 ? day.sleep > 0 && day.sleep <= 5 : h === 9 ? day.sleep >= 9 : day.sleep === h;
          day.sleep = same ? 0 : h;
          break;
        }
        default: return;
      }
      persist(); refresh();
    });

    const clampInput = (input, min, max, fallback) => {
      const v = parseInt(input.value, 10);
      return isNaN(v) ? fallback : Math.max(min, Math.min(max, v));
    };
    els.goalWorkouts.addEventListener("change", () => {
      data.goals.workoutsPerWeek = clampInput(els.goalWorkouts, 1, 7, 4);
      persist(); render();
    });
    els.goalWater.addEventListener("change", () => {
      data.goals.waterGlasses = clampInput(els.goalWater, 1, 20, 8);
      persist(); render();
    });
    [["weightStart", els.weightStart], ["weightEnd", els.weightEnd]].forEach(([key, input]) => {
      input.addEventListener("change", () => {
        const v = parseFloat(input.value);
        week()[key] = isNaN(v) ? null : v;
        persist(); renderSummary();
      });
    });

    const goToWeek = (delta) => {
      currentMonday = addDays(currentMonday, delta);
      selected = defaultSelected();
      render();
    };
    $("#prevWeek").addEventListener("click", () => goToWeek(-7));
    $("#nextWeek").addEventListener("click", () => goToWeek(7));

    $("#resetWeek").addEventListener("click", async () => {
      const ok = window.FFModal ? await window.FFModal.confirm({
        title: "Borrar semana",
        text: "¿Seguro que quieres borrar todos los datos registrados en esta semana? Esta acción no se puede deshacer.",
        type: "warning",
        confirmText: "Sí, borrar",
        cancelText: "Mantener"
      }) : confirm("¿Seguro que quieres borrar los datos de esta semana?");
      if (!ok) return;
      data.weeks[toKey(currentMonday)] = emptyWeek(toKey(currentMonday));
      persist(); render();
    });

    $("#exportData").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `ferreira-progreso-${toKey(new Date())}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });

    $("#shareCoach").addEventListener("click", () => {
      const m = metrics(), w = week();
      const lines = [
        `*Resumen semanal – ${window.FF_CONFIG?.gymName || "Ferreira Fitness"}*`,
        `Semana: ${els.weekLabel.textContent}`,
        `• Entrenamientos: ${m.workouts}/${data.goals.workoutsPerWeek}`,
        `• Días que comí bien: ${m.nutritionDays}/7`,
        `• Días que cumplí el agua: ${m.waterDays}/7`,
        `• Noches de 7 h o más: ${m.sleepDays}/7`
      ];
      if (w.weightStart && w.weightEnd) lines.push(`• Peso: ${w.weightStart} → ${w.weightEnd} kg`);
      const detail = w.days.map((d, i) => ({ d, i })).filter(({ d }) => d.workout).map(({ d, i }) =>
        `${DAY_NAMES[i]}${d.workoutType !== NO_TYPE ? ": " + d.workoutType : ""}`);
      if (detail.length) lines.push(`Entrenos: ${detail.join(", ")}`);
      const phone = window.FF_CONFIG?.whatsapp || "";
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank", "noopener");
    });

    render();

    // API pública para integraciones futuras (App / panel de entrenadores)
    return {
      getData: () => JSON.parse(JSON.stringify(data)),
      importData(json) { if (json?.schemaVersion === SCHEMA_VERSION) { data = json; persist(); render(); } },
      metrics
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    const root = document.getElementById("progreso");
    if (root) window.FFTracker = createTracker(root, LocalStorageAdapter);
  });
})();
