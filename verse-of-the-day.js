(function () {
  const DATA_URL = "/verses-of-the-day.json?v=5";
  const TRACK_URL = "/api/votd-interaction";

  function todayKeyLocal() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function visitorId() {
    const key = "dailyDoseVisitorId";
    let id = localStorage.getItem(key);
    if (!id) {
      id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(key, id);
    }
    return id;
  }

  function formatDate(value, longFormat = true) {
    const d = new Date(value + "T00:00:00");
    return d.toLocaleDateString("en-IE", longFormat ? {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    } : {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function injectVerseStyles() {
    if (document.getElementById("daily-dose-votd-feature-styles")) return;

    const style = document.createElement("style");
    style.id = "daily-dose-votd-feature-styles";
    style.textContent = `
      .verse-feature-section {
        padding: 34px 20px 78px;
        position: relative;
      }

      .verse-feature-wrap {
        max-width: 980px;
        margin: 0 auto;
      }

      .verse-feature-card {
        position: relative;
        overflow: hidden;
        text-align: center;
        padding: 48px 36px;
        border-radius: 28px;
        border: 1px solid rgba(198,160,90,.38);
        background:
          radial-gradient(circle at top, rgba(198,160,90,.16), transparent 42%),
          linear-gradient(145deg, rgba(255,255,255,.06), rgba(255,255,255,.025));
        box-shadow: 0 30px 90px rgba(0,0,0,.32);
      }

      .verse-feature-card:before {
        content: "";
        position: absolute;
        inset: 18px;
        border: 1px solid rgba(198,160,90,.12);
        border-radius: 22px;
        pointer-events: none;
      }

      .verse-feature-card .icon {
        width: 72px;
        height: 72px;
        margin: 0 auto 18px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(198,160,90,.10);
        border: 1px solid rgba(198,160,90,.22);
        font-size: 30px;
      }

      .verse-feature-card .date {
        color: var(--primary, #c6a05a);
        font-size: 13px;
        letter-spacing: .14em;
        text-transform: uppercase;
        margin: 8px 0 12px;
      }

      .verse-feature-card h3 {
        font-family: var(--font-heading, "Playfair Display", serif);
        font-size: clamp(34px, 5vw, 56px);
        line-height: 1.05;
        margin: 0 0 22px;
        color: #fff;
      }

      .verse-feature-card .verse-text {
        max-width: 780px;
        margin: 0 auto 30px;
        color: #f4ede2;
        font-size: clamp(17px, 2vw, 22px);
        line-height: 1.75;
        font-style: italic;
      }

      .verse-feature-card .verse-actions,
      .verse-feature-card .verse-social-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 14px;
      }

      .verse-feature-card .verse-social-actions {
        margin: 10px 0 26px;
      }

      .verse-action-btn {
        appearance: none;
        border: 1px solid rgba(198,160,90,.35);
        background: #171512;
        color: #f4ead4;
        border-radius: 999px;
        padding: 11px 18px;
        font-size: 13px;
        letter-spacing: .08em;
        text-transform: uppercase;
        cursor: pointer;
        transition: transform .2s ease, border-color .2s ease, background .2s ease;
      }

      .verse-action-btn:hover {
        transform: translateY(-2px);
        border-color: rgba(198,160,90,.75);
        background: rgba(198,160,90,.12);
      }

      .verse-action-btn.primary-share {
        background: linear-gradient(135deg, #c6a05a, #f1d78a);
        color: #12100d;
        border-color: rgba(241,215,138,.85);
        font-weight: 800;
      }

      .verse-action-btn.primary-share:hover {
        background: linear-gradient(135deg, #d9b66c, #f6df9c);
      }

      .verse-share-status {
        min-height: 20px;
        margin-top: 12px;
        color: var(--primary, #c6a05a);
        font-size: 13px;
      }

      .votd-library-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 18px;
        margin-top: 30px;
      }

      .votd-library-card {
        border: 1px solid rgba(198,160,90,.22);
        border-radius: 20px;
        padding: 22px;
        background: rgba(255,255,255,.035);
      }

      .votd-library-card h3 {
        margin: 8px 0 12px;
        font-family: var(--font-heading, "Playfair Display", serif);
      }

      .votd-library-card p {
        color: #ded6c9;
        line-height: 1.65;
      }

      @media (max-width: 620px) {
        .verse-feature-section {
          padding: 26px 16px 58px;
        }

        .verse-feature-card {
          padding: 36px 22px;
        }

        .verse-feature-card .verse-actions,
        .verse-feature-card .verse-social-actions {
          flex-direction: column;
        }

        .verse-feature-card .btn,
        .verse-action-btn {
          width: 100%;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function placeVerseSection() {
    const section = document.getElementById("verse-of-the-day");
    const devotions = document.getElementById("devotions");

    if (section && devotions && section.nextElementSibling !== devotions) {
      devotions.parentNode.insertBefore(section, devotions);
    }
  }

  function shareText(verse) {
    return `Verse of the Day - ${verse.reference}\n\n"${verse.text}"\n\nRead more Daily Dose Devotions:\nhttps://dailydosedevotions.ie/#verse-of-the-day`;
  }

  function getVerseTheme(verse) {
    const combined = `${verse.reference || ""} ${verse.text || ""}`.toLowerCase();
    const themes = [
      { keys: ["light", "darkness", "lamp"], name: "light", colors: ["#080706", "#2d2412", "#c6a05a"], symbol: "LIGHT" },
      { keys: ["water", "thirst", "river", "stream"], name: "water", colors: ["#071011", "#153a3b", "#c6a05a"], symbol: "LIVING WATER" },
      { keys: ["rest", "peace", "still"], name: "rest", colors: ["#0b0b0a", "#273322", "#d7bc7a"], symbol: "PEACE" },
      { keys: ["shepherd", "lead", "path"], name: "path", colors: ["#090807", "#2f2717", "#d9b66c"], symbol: "THE WAY" },
      { keys: ["cross", "jesus", "christ"], name: "cross", colors: ["#070605", "#241916", "#c6a05a"], symbol: "CHRIST" },
      { keys: ["strength", "weak", "fear", "courage"], name: "strength", colors: ["#090909", "#352118", "#e0bd73"], symbol: "STRENGTH" },
      { keys: ["love", "heart", "grace"], name: "grace", colors: ["#100908", "#33201e", "#e2ba70"], symbol: "GRACE" }
    ];

    return themes.find(theme => theme.keys.some(key => combined.includes(key)))
      || { name: "daily-dose", colors: ["#080706", "#17120c", "#c6a05a"], symbol: "DAILY DOSE" };
  }

  function wrapCanvasText(ctx, text, maxWidth) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";

    words.forEach(word => {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });

    if (line) lines.push(line);
    return lines;
  }

  async function createVerseStoryFile(verse) {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    const theme = getVerseTheme(verse);
    const [dark, mid, gold] = theme.colors;

    const bg = ctx.createLinearGradient(0, 0, 1080, 1920);
    bg.addColorStop(0, dark);
    bg.addColorStop(0.55, mid);
    bg.addColorStop(1, "#070606");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1080, 1920);

    for (let i = 0; i < 9; i += 1) {
      const x = 120 + i * 120;
      const glow = ctx.createRadialGradient(x, 420 + i * 75, 0, x, 420 + i * 75, 360);
      glow.addColorStop(0, "rgba(198,160,90,.16)");
      glow.addColorStop(1, "rgba(198,160,90,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, 420 + i * 75, 360, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = "rgba(198,160,90,.55)";
    ctx.lineWidth = 3;
    ctx.strokeRect(70, 70, 940, 1780);
    ctx.strokeStyle = "rgba(255,255,255,.10)";
    ctx.lineWidth = 1;
    ctx.strokeRect(98, 98, 884, 1724);

    ctx.fillStyle = "rgba(198,160,90,.13)";
    ctx.beginPath();
    ctx.arc(540, 260, 108, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(198,160,90,.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(540, 190);
    ctx.lineTo(540, 330);
    ctx.moveTo(485, 245);
    ctx.lineTo(595, 245);
    ctx.stroke();

    ctx.fillStyle = gold;
    ctx.font = "700 34px Inter, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.letterSpacing = "4px";
    ctx.fillText("VERSE OF THE DAY", 540, 450);

    ctx.fillStyle = "#fff8ec";
    ctx.font = "700 74px Georgia, 'Times New Roman', serif";
    const referenceLines = wrapCanvasText(ctx, verse.reference, 820);
    let y = 560;
    referenceLines.slice(0, 2).forEach(line => {
      ctx.fillText(line, 540, y);
      y += 86;
    });

    ctx.fillStyle = "#f5ead7";
    ctx.font = "italic 52px Georgia, 'Times New Roman', serif";
    const verseLines = wrapCanvasText(ctx, `“${verse.text}”`, 820);
    const limitedLines = verseLines.slice(0, 10);
    y = 800;
    limitedLines.forEach(line => {
      ctx.fillText(line, 540, y);
      y += 76;
    });

    if (verseLines.length > limitedLines.length) {
      ctx.fillText("...", 540, y + 20);
    }

    ctx.fillStyle = "rgba(198,160,90,.88)";
    ctx.font = "700 28px Inter, Arial, sans-serif";
    ctx.fillText(theme.symbol, 540, 1588);

    ctx.fillStyle = "#fff8ec";
    ctx.font = "700 42px Inter, Arial, sans-serif";
    ctx.fillText("DAILY DOSE DEVOTIONS", 540, 1688);
    ctx.fillStyle = "rgba(245,234,215,.72)";
    ctx.font = "400 28px Inter, Arial, sans-serif";
    ctx.fillText("dailydosedevotions.ie", 540, 1738);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png", 0.95));
    return new File([blob], `daily-dose-verse-${verse.date || "today"}.png`, { type: "image/png" });
  }

  async function downloadVerseStory(verse) {
    const file = await createVerseStoryFile(verse);
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function recordInteraction(type, verse) {
    const response = await fetch(TRACK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type,
        date: verse.date,
        reference: verse.reference,
        text: verse.text,
        page: "https://dailydosedevotions.ie/#verse-of-the-day",
        visitorId: visitorId()
      })
    });

    return response.json();
  }

  function wireVerseButtons(verse) {
    const shareBtn = document.getElementById("shareVerseBtn");
    const downloadBtn = document.getElementById("downloadVerseStoryBtn");
    const copyBtn = document.getElementById("copyVerseBtn");
    const status = document.getElementById("verseShareStatus");

    if (shareBtn) {
      shareBtn.addEventListener("click", async () => {
        if (status) status.textContent = "Creating story image...";
        try {
          await recordInteraction("share", verse);
        } catch {
          // Sharing still continues even if tracking fails.
        }

        const text = shareText(verse);

        try {
          const file = await createVerseStoryFile(verse);
          const shareData = {
            title: `Verse of the Day - ${verse.reference}`,
            text: `Verse of the Day - ${verse.reference}\n\nDaily Dose Devotions`,
            files: [file]
          };

          if (navigator.canShare?.({ files: [file] }) && navigator.share) {
            await navigator.share(shareData);
            if (status) status.textContent = "Story image ready. Choose Instagram/Stories if it appears.";
          } else if (navigator.share) {
            await navigator.share({
              title: `Verse of the Day - ${verse.reference}`,
              text,
              url: "https://dailydosedevotions.ie/#verse-of-the-day"
            });
            if (status) status.textContent = "Shared. If Instagram did not appear, use Download Story Image.";
          } else if (navigator.clipboard) {
            await navigator.clipboard.writeText(text);
            if (status) status.textContent = "Verse copied. Use Download Story Image for Instagram Stories.";
          } else {
            if (status) status.textContent = "Use Download Story Image for Instagram Stories.";
          }
        } catch {
          if (status) status.textContent = "Share cancelled. You can still download the story image.";
        }
      });
    }

    if (downloadBtn) {
      downloadBtn.addEventListener("click", async () => {
        try {
          if (status) status.textContent = "Preparing download...";
          await downloadVerseStory(verse);
          if (status) status.textContent = "Story image downloaded. Upload it to Instagram Stories.";
        } catch {
          if (status) status.textContent = "Could not create the image. Please try again.";
        }
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(shareText(verse));
          if (status) status.textContent = "Verse copied.";
        } catch {
          if (status) status.textContent = "Copy failed. You can copy the verse from the page.";
        }
      });
    }
  }

  function renderHomepageVerse(verse) {
    const section = document.getElementById("verse-of-the-day");
    if (!section || !verse) return;

    section.className = "section verse-feature-section";
    section.innerHTML = `
      <div class="container verse-feature-wrap">
        <article class="verse-feature-card reveal visible">
              <div class="icon">&#128214;</div>
          <p class="eyebrow">Verse of the Day</p>
          <div class="date" id="votdDate">${escapeHtml(formatDate(verse.date))}</div>
          <h3 id="votdReference">${escapeHtml(verse.reference)}</h3>
          <p class="verse-text" id="votdText">&ldquo;${escapeHtml(verse.text)}&rdquo;</p>

          <div class="verse-social-actions">
            <button class="verse-action-btn primary-share" id="shareVerseBtn" type="button">Share Story Image</button>
            <button class="verse-action-btn" id="downloadVerseStoryBtn" type="button">Download Story Image</button>
            <button class="verse-action-btn" id="copyVerseBtn" type="button">Copy Verse</button>
          </div>

          <div class="verse-actions">
            <a class="btn primary" href="devotions.html">Read Devotions</a>
            <a class="btn outline" href="verse-library.html">View Verse Library</a>
          </div>

          <div class="verse-share-status" id="verseShareStatus"></div>
        </article>
      </div>
    `;

    wireVerseButtons(verse);
  }

  function renderLibrary(verses, todayKey) {
    const libraryContainer = document.getElementById("votdLibrary");
    if (!libraryContainer) return;

    const pastVerses = verses
      .filter(v => v.date < todayKey)
      .sort((a, b) => b.date.localeCompare(a.date));

    if (!pastVerses.length) {
      libraryContainer.innerHTML = '<p class="thanks-note">No previous verses are available yet.</p>';
      return;
    }

    libraryContainer.innerHTML = pastVerses.map(v => `
      <article class="votd-library-card">
        <div class="date">${escapeHtml(formatDate(v.date, false))}</div>
        <h3>${escapeHtml(v.reference)}</h3>
        <p>&ldquo;${escapeHtml(v.text)}&rdquo;</p>
      </article>
    `).join("");
  }

  async function loadVerseOfTheDay() {
    injectVerseStyles();
    placeVerseSection();

    try {
      const response = await fetch(DATA_URL);
      const verses = await response.json();
      const todayKey = todayKeyLocal();

      let todaysVerse = verses.find(v => v.date === todayKey);

      if (!todaysVerse) {
        const previous = verses
          .filter(v => v.date <= todayKey)
          .sort((a, b) => b.date.localeCompare(a.date));
        todaysVerse = previous[0] || verses[0];
      }

      renderHomepageVerse(todaysVerse);
      renderLibrary(verses, todayKey);
    } catch (error) {
      const section = document.getElementById("verse-of-the-day");
      if (section) {
        section.className = "section verse-feature-section";
        section.innerHTML = `
          <div class="container verse-feature-wrap">
            <article class="verse-feature-card reveal visible">
          <div class="icon">&#128214;</div>
              <p class="eyebrow">Verse of the Day</p>
              <h3>Verse of the Day</h3>
              <p class="verse-text">Unable to load today&rsquo;s verse at the moment.</p>
            </article>
          </div>
        `;
      }
      console.error("Verse of the Day failed to load:", error);
    }
  }

  document.addEventListener("DOMContentLoaded", loadVerseOfTheDay);
})();
