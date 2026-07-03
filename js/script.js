(() => {
  const API_BASE = location.hostname === "127.0.0.1" || location.hostname === "localhost"
    ? "http://127.0.0.1:8034"
    : "https://lk-backend-production-91d8.up.railway.app";
  const API = `${API_BASE}/api`;

  const els = {
    urlInput: document.getElementById("urlInput"),
    fetchBtn: document.getElementById("fetchBtn"),
    convertBtn: document.getElementById("convertBtn"),
    infoLabel: document.getElementById("infoLabel"),
    infoThumb: document.getElementById("infoThumb"),
    infoTitle: document.getElementById("infoTitle"),
    infoMeta: document.getElementById("infoMeta"),
    formatToggle: document.getElementById("formatToggle"),
    qualityRow: document.getElementById("qualityRow"),
    vuMeter: document.getElementById("vuMeter"),
    statusText: document.getElementById("statusText"),
    ffmpegWarning: document.getElementById("ffmpegWarning"),
    serverLed: document.getElementById("serverLed"),
    serverStatusText: document.getElementById("serverStatusText"),
  };

  const state = {
    format: "mp4",
    quality: "1080p",
    ffmpegAvailable: true,
    videoLoaded: false,
    busy: false,
  };

  // Build the VU meter bars.
  const BAR_COUNT = 24;
  for (let i = 0; i < BAR_COUNT; i++) {
    const bar = document.createElement("span");
    bar.style.setProperty("--i", i);
    els.vuMeter.appendChild(bar);
  }

  function setStatus(text, mode) {
    els.statusText.textContent = text;
    els.statusText.className = "readout__status" + (mode ? ` is-${mode}` : "");
    els.vuMeter.className = "vu-meter" + (state.format === "mp3" ? "" : " is-video") + (mode ? ` is-${mode}` : " is-idle");
  }

  function formatDuration(seconds) {
    if (!seconds && seconds !== 0) return "";
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    const m = Math.floor((seconds / 60) % 60).toString().padStart(2, "0");
    const h = Math.floor(seconds / 3600);
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  }

  async function checkHealth() {
    try {
      const res = await fetch(`${API}/health`);
      const data = await res.json();
      state.ffmpegAvailable = !!data.ffmpeg;
      els.serverLed.classList.remove("led-dot--off");
      els.serverStatusText.textContent = "Servidor online";
      els.ffmpegWarning.classList.toggle("is-visible", !state.ffmpegAvailable);
    } catch {
      els.serverLed.classList.add("led-dot--off");
      els.serverStatusText.textContent = "Servidor offline";
    }
  }

  function selectFormat(format) {
    state.format = format;
    els.formatToggle.classList.toggle("is-audio", format === "mp3");
    document.getElementById("btnMp4").classList.toggle("is-active", format === "mp4");
    document.getElementById("btnMp3").classList.toggle("is-active", format === "mp3");
    els.qualityRow.classList.toggle("is-hidden", format !== "mp4");
    els.convertBtn.classList.toggle("is-video", format === "mp4");
    if (!state.busy) setStatus(state.videoLoaded ? "PRONTO PARA CONVERTER" : "AGUARDANDO LINK");
  }

  els.formatToggle.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-format]");
    if (btn) selectFormat(btn.dataset.format);
  });

  els.qualityRow.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-quality]");
    if (!btn) return;
    state.quality = btn.dataset.quality;
    [...els.qualityRow.children].forEach((c) => c.classList.toggle("is-active", c === btn));
  });

  function extractYoutubeUrl(raw) {
    return raw.trim();
  }

  els.fetchBtn.addEventListener("click", async () => {
    const url = extractYoutubeUrl(els.urlInput.value);
    if (!url) {
      setStatus("COLE UM LINK VÁLIDO", "error");
      return;
    }

    els.fetchBtn.disabled = true;
    setStatus("LENDO METADADOS…", "active");

    try {
      const res = await fetch(`${API}/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Falha ao ler o vídeo.");

      els.infoThumb.src = data.thumbnail || "";
      els.infoTitle.textContent = data.title || "Vídeo sem título";
      els.infoMeta.textContent = [data.author, formatDuration(data.duration)].filter(Boolean).join(" · ");
      els.infoLabel.classList.add("is-visible");

      state.videoLoaded = true;
      state.ffmpegAvailable = !!data.ffmpeg_available;
      els.ffmpegWarning.classList.toggle("is-visible", !state.ffmpegAvailable);
      setStatus("PRONTO PARA CONVERTER");
    } catch (err) {
      state.videoLoaded = false;
      els.infoLabel.classList.remove("is-visible");
      setStatus(`ERRO: ${err.message}`, "error");
    } finally {
      els.fetchBtn.disabled = false;
    }
  });

  els.convertBtn.addEventListener("click", async () => {
    const url = extractYoutubeUrl(els.urlInput.value);
    if (!url) {
      setStatus("COLE UM LINK VÁLIDO", "error");
      return;
    }
    if (state.format === "mp3" && !state.ffmpegAvailable) {
      setStatus("ERRO: MP3 EXIGE FFMPEG NO SERVIDOR", "error");
      return;
    }

    state.busy = true;
    els.convertBtn.disabled = true;
    els.fetchBtn.disabled = true;
    setStatus("CONVERTENDO…", "active");

    try {
      const res = await fetch(`${API}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, format: state.format, quality: state.quality }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Falha na conversão.");

      setStatus("CONCLUÍDO — BAIXANDO ARQUIVO", "done");

      const link = document.createElement("a");
      link.href = `${API}/download/${data.token}`;
      link.download = "";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setStatus(`ERRO: ${err.message}`, "error");
    } finally {
      state.busy = false;
      els.convertBtn.disabled = false;
      els.fetchBtn.disabled = false;
    }
  });

  document.querySelectorAll(".faq__item").forEach((item) => {
    const q = item.querySelector(".faq__q");
    const a = item.querySelector(".faq__a");
    q.addEventListener("click", () => {
      const isOpen = item.classList.contains("is-open");
      document.querySelectorAll(".faq__item.is-open").forEach((other) => {
        if (other !== item) {
          other.classList.remove("is-open");
          other.querySelector(".faq__a").style.maxHeight = null;
        }
      });
      item.classList.toggle("is-open", !isOpen);
      a.style.maxHeight = !isOpen ? `${a.scrollHeight}px` : null;
    });
  });

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (window.gsap && !prefersReducedMotion) {
    if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
    gsap.set(["header.site-header", ".hero__eyebrow", ".hero h1", ".hero p.lede", "#deck"], { opacity: 0, y: 16 });
    const tl = gsap.timeline({ defaults: { ease: "power3.out", duration: 0.6 } });
    tl.to("header.site-header", { opacity: 1, y: 0, duration: 0.4 })
      .to(".hero__eyebrow", { opacity: 1, y: 0 }, "-=0.2")
      .to(".hero h1", { opacity: 1, y: 0 }, "-=0.4")
      .to(".hero p.lede", { opacity: 1, y: 0 }, "-=0.4")
      .to("#deck", { opacity: 1, y: 0 }, "-=0.35");

    gsap.utils.toArray(".path__step, .specs__item").forEach((el) => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%" },
        }
      );
    });
  }

  selectFormat("mp4");
  checkHealth();
})();
