/* =========================================================
   Ferreira Fitness – Interacciones de la landing
   ========================================================= */
(function () {
  "use strict";

  /* ---------- Preloader ---------- */
  const preloader = document.getElementById("preloader");
  if (preloader) {
    const hidePreloader = () => {
      setTimeout(() => { preloader.classList.add("is-hidden"); }, 500);
    };
    if (document.readyState === "complete") {
      hidePreloader();
    } else {
      window.addEventListener("load", hidePreloader);
    }
  }

  const CFG = window.FF_CONFIG || {};
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const waLink = (text = "") => `https://wa.me/${CFG.whatsapp || ""}${text ? "?text=" + encodeURIComponent(text) : ""}`;

  /* ---------- Modal Global ---------- */
  window.FFModal = (function() {
    const m = document.getElementById("ffModal");
    if (!m) return { alert: () => {}, confirm: async () => true };
    const title = m.querySelector("#modalTitle"), text = m.querySelector("#modalText"), icon = m.querySelector("#modalIcon");
    const btnCancel = m.querySelector("#modalCancel"), btnConfirm = m.querySelector("#modalConfirm");
    let currentResolve = null;
    const close = (val) => { m.setAttribute("aria-hidden", "true"); if (currentResolve) { currentResolve(val); currentResolve = null; } };
    m.querySelectorAll("[data-close]").forEach(el => el.addEventListener("click", () => close(false)));
    btnConfirm.addEventListener("click", () => close(true));
    const show = ({ title: t, text: txt, type = "info", confirmText = "Aceptar", cancelText = "Cancelar", showCancel = false }) => {
      title.textContent = t; text.textContent = txt;
      btnConfirm.textContent = confirmText; btnCancel.textContent = cancelText;
      btnCancel.style.display = showCancel ? "inline-flex" : "none";
      icon.className = "modal__icon " + (type === "warning" ? "is-warning" : type === "error" ? "is-error" : "");
      icon.innerHTML = type === "warning" ? "⚠️" : type === "error" ? "❌" : "💡";
      m.removeAttribute("aria-hidden");
      return new Promise(res => { currentResolve = res; });
    };
    return { alert: (opts) => show({ ...opts, showCancel: false }), confirm: (opts) => show({ ...opts, showCancel: true }) };
  })();

  /* ---------- Restricción global de caracteres ---------- */
  document.addEventListener("input", (e) => {
    const el = e.target;
    // Nombres: solo letras y espacios
    if (el.name === "name") {
      el.value = el.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "");
    }
    // Teléfonos: solo números, +, - y espacios
    if (el.type === "tel") {
      el.value = el.value.replace(/[^0-9+\-\s]/g, "");
    }
  });
  document.addEventListener("keydown", (e) => {
    const el = e.target;
    // Evitar decimales, signos y letra 'e' en campos numéricos que deben ser enteros
    if (el.type === "number" && !["weight", "weightStart", "weightEnd"].includes(el.name || el.id)) {
      if (["e", "E", "+", "-", ".", ","].includes(e.key)) {
        e.preventDefault();
      }
    }
  });

  /* ---------- Header + CTA móvil al hacer scroll ---------- */
  const header = $("#header");
  const mobileCta = $("#mobileCta");
  const reserva = $("#reserva");
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle("is-scrolled", y > 30);
    const r = reserva.getBoundingClientRect();
    const inBooking = r.top < window.innerHeight && r.bottom > 0;
    mobileCta.classList.toggle("is-visible", y > window.innerHeight * 0.6 && !inBooking);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Menú móvil ---------- */
  const burger = $("#burger"), nav = $("#nav");
  const closeNav = () => { nav.classList.remove("is-open"); burger.classList.remove("is-open"); burger.setAttribute("aria-expanded", "false"); };
  burger.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    burger.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
  });
  $$("a", nav).forEach((a) => a.addEventListener("click", closeNav));

  /* ---------- Animación de aparición ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); } });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  $$(".reveal").forEach((el) => io.observe(el));

  /* ---------- Contadores ---------- */
  const animateCount = (el, to, suffix = "", dur = 1600) => {
    const start = performance.now();
    const fmt = (n) => n.toLocaleString("es-VE");
    const step = (t) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(to * eased)) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const statIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      animateCount(en.target, +en.target.dataset.count, en.target.dataset.suffix || "");
      statIO.unobserve(en.target);
    });
  }, { threshold: 0.5 });
  $$("[data-count]").forEach((el) => statIO.observe(el));

  /* ---------- Filtro de máquinas ---------- */
  $$(".tab").forEach((tab) => tab.addEventListener("click", () => {
    $$(".tab").forEach((t) => { t.classList.remove("is-active"); t.setAttribute("aria-selected", "false"); });
    tab.classList.add("is-active"); tab.setAttribute("aria-selected", "true");
    const f = tab.dataset.filter;
    $$(".machine").forEach((m) => m.classList.toggle("is-hidden", f !== "all" && m.dataset.cat !== f));
  }));

  /* ---------- Calculadora de calorías y macros ---------- */
  const calcForm = $("#calcForm");
  
  $$("input, select", calcForm).forEach(el => {
    el.addEventListener("input", () => {
      const field = el.closest(".field");
      if (field && field.classList.contains("is-invalid")) {
        const ok = el.checkValidity();
        field.classList.toggle("is-invalid", !ok);
        const err = $(".error", field);
        if (err) err.textContent = ok ? "" : "Valor inválido.";
      }
    });
  });

  calcForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const fields = $$("input, select", calcForm);
    let isValid = true;
    fields.forEach(el => {
      const field = el.closest(".field");
      if (!field) return;
      const ok = el.checkValidity();
      field.classList.toggle("is-invalid", !ok);
      const err = $(".error", field);
      if (err) err.textContent = ok ? "" : "Valor inválido.";
      if (!ok) isValid = false;
    });

    if (!isValid) {
      window.FFModal.alert({
        title: "Datos incorrectos",
        text: "Por favor revisa los campos marcados en rojo. Asegúrate de que la edad (15-75), peso y estatura sean correctos.",
        type: "error"
      });
      return;
    }

    const fd = new FormData(calcForm);
    const sex = fd.get("sex");
    const age = +fd.get("age"), weight = +fd.get("weight"), height = +fd.get("height");
    const activity = +fd.get("activity"), goal = fd.get("goal");

    // Mifflin-St Jeor
    const bmr = 10 * weight + 6.25 * height - 5 * age + (sex === "m" ? 5 : -161);
    let kcal = bmr * activity;
    const factors = { loss: 0.8, maintain: 1, gain: 1.1 };
    kcal = Math.round((kcal * factors[goal]) / 10) * 10;

    const protPerKg = { loss: 2.0, maintain: 1.6, gain: 1.8 }[goal];
    const fatPerKg = goal === "loss" ? 0.8 : 0.9;
    const prot = Math.round(weight * protPerKg);
    const fat = Math.round(weight * fatPerKg);
    const carb = Math.max(0, Math.round((kcal - prot * 4 - fat * 9) / 4));
    const water = (weight * 0.035).toFixed(1);

    $("#calcResult").hidden = false;
    animateCount($("#kcalNum"), kcal, "", 900);
    $("#mProt").textContent = prot + " g";
    $("#mCarb").textContent = carb + " g";
    $("#mFat").textContent = fat + " g";
    $("#mWater").textContent = water + " L";
    const total = prot * 4 + carb * 4 + fat * 9;
    $("#barP").style.width = (prot * 4 / total) * 100 + "%";
    $("#barC").style.width = (carb * 4 / total) * 100 + "%";
    $("#barF").style.width = (fat * 9 / total) * 100 + "%";
  });

  /* ---------- Antes / Después ---------- */
  $$(".ba").forEach((ba) => {
    ba.style.setProperty("--img", `url("${ba.dataset.img}")`);
    const range = $(".ba__range", ba);
    const update = () => ba.style.setProperty("--pos", range.value + "%");
    range.addEventListener("input", update);
    update();
  });

  /* ---------- Slider de testimonios ---------- */
  const slider = $("#testimonials");
  if (slider) {
    const track = $(".slider__track", slider);
    const cards = $$(".testi", track);
    const dotsWrap = $("#testiDots");
    let index = 0, timer;

    const perView = () => Math.max(1, Math.round(track.clientWidth / cards[0].getBoundingClientRect().width));
    const maxIndex = () => Math.max(0, cards.length - perView());
    const buildDots = () => {
      dotsWrap.innerHTML = "";
      for (let i = 0; i <= maxIndex(); i++) {
        const b = document.createElement("button");
        b.setAttribute("aria-label", `Ir al testimonio ${i + 1}`);
        b.addEventListener("click", () => go(i));
        dotsWrap.appendChild(b);
      }
    };
    const go = (i) => {
      const max = maxIndex();
      index = i > max ? 0 : i < 0 ? max : i;
      const gap = parseFloat(getComputedStyle(track).gap) || 0;
      track.style.transform = `translateX(-${index * (cards[0].getBoundingClientRect().width + gap)}px)`;
      $$("button", dotsWrap).forEach((d, k) => d.classList.toggle("is-active", k === index));
    };
    const auto = () => { clearInterval(timer); timer = setInterval(() => go(index + 1), 6000); };

    $$("[data-dir]", slider).forEach((b) => b.addEventListener("click", () => { go(index + +b.dataset.dir); auto(); }));
    slider.addEventListener("mouseenter", () => clearInterval(timer));
    slider.addEventListener("mouseleave", auto);

    // Swipe en móvil
    let x0 = null;
    track.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    track.addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) { go(index + (dx < 0 ? 1 : -1)); auto(); }
      x0 = null;
    });

    let rt;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { buildDots(); go(Math.min(index, maxIndex())); }, 150); });
    buildDots(); go(0); auto();
  }


  /* ---------- Formulario de reserva ---------- */
  const form = $("#bookingForm");
  const dateInput = form.elements.date;
  const today = new Date();
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  dateInput.min = iso(today);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  dateInput.value = iso(tomorrow);

  const messages = {
    name: "Escribe tu nombre completo (solo letras, mínimo 3).",
    phone: "Ingresa un número de WhatsApp válido.",
    age: "La edad debe estar entre 15 y 75 años.",
    goal: "Selecciona tu objetivo.",
    date: "Elige una fecha a partir de hoy."
  };
  const validateField = (input) => {
    const field = input.closest(".field");
    if (!field) return input.checkValidity();
    const ok = input.checkValidity();
    field.classList.toggle("is-invalid", !ok);
    const err = $(".error", field);
    if (err) err.textContent = ok ? "" : (messages[input.name] || "Campo requerido.");
    return ok;
  };
  $$("input, select", form).forEach((el) => {
    el.addEventListener("blur", () => { if (el.name !== "consent") validateField(el); });
    el.addEventListener("input", () => { if (el.closest(".field.is-invalid")) validateField(el); });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let valid = true;
    ["name", "phone", "age", "goal", "date"].forEach((n) => { if (!validateField(form.elements[n])) valid = false; });
    const consent = form.elements.consent;
    $("#consentError").textContent = consent.checked ? "" : "Necesitamos tu autorización para contactarte.";
    if (!consent.checked) valid = false;
    if (!valid) { 
      window.FFModal.alert({
        title: "Datos incorrectos",
        text: "Por favor revisa los campos en rojo para poder agendar tu cita.",
        type: "error"
      });
      $(".is-invalid input, .is-invalid select", form)?.focus(); 
      return; 
    }

    const d = Object.fromEntries(new FormData(form));
    const lead = { ...d, createdAt: new Date().toISOString(), source: document.referrer || "directo", utm: location.search };

    // Guarda el lead localmente (respaldo). Para producción conecta aquí tu CRM / Google Sheets / backend.
    try {
      const leads = JSON.parse(localStorage.getItem("ff_leads") || "[]");
      leads.push(lead);
      localStorage.setItem("ff_leads", JSON.stringify(leads));
    } catch (_) { /* sin almacenamiento */ }

    const fecha = new Date(d.date + "T12:00:00").toLocaleDateString("es-VE", { weekday: "long", day: "numeric", month: "long" });
    const text =
      `¡Hola ${CFG.gymName || "Ferreira Fitness"}! 💪 Quiero reservar mi valoración GRATIS.\n\n` +
      `👤 Nombre: ${d.name}\n🎂 Edad: ${d.age}\n🎯 Objetivo: ${d.goal}\n` +
      `📅 Fecha: ${fecha}\n⏰ Horario: ${d.time}\n📱 WhatsApp: ${d.phone}`;
    const url = waLink(text);

    $("#waFallback").href = url;
    $("#bookingSuccess").hidden = false;
    const spots = $("#spots");
    if (spots && +spots.textContent > 1) spots.textContent = +spots.textContent - 1;
    window.open(url, "_blank", "noopener");
  });

  /* ---------- Enlaces de WhatsApp, cupos y año ---------- */
  $$(".js-wa").forEach((a) => {
    a.href = waLink("¡Hola! Quiero más información sobre Ferreira Fitness GYM 💪");
    a.target = "_blank"; a.rel = "noopener";
  });
  if (CFG.freeSpotsThisWeek) $("#spots").textContent = CFG.freeSpotsThisWeek;
  $("#year").textContent = new Date().getFullYear();
})();
