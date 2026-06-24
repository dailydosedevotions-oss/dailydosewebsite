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
        padding: 30px 20px 72px;
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
        padding: 42px 34px;
        border-radius: 10px;
        border: 1px solid rgba(198,160,90,.3);
        background: linear-gradient(180deg, rgba(18,16,13,.96), rgba(12,11,10,.96));
        box-shadow: 0 22px 70px rgba(0,0,0,.28);
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
        margin: 0 auto 26px;
        color: #f4ede2;
        font-size: clamp(17px, 2vw, 22px);
        line-height: 1.75;
        font-style: italic;
      }

      .verse-feature-card .verse-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 12px;
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

        .verse-feature-card .verse-actions {
          flex-direction: column;
        }

        .verse-feature-card .btn {
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
      { keys: ["light", "darkness", "lamp"], label: "Light for today", accent: "#d7b56d" },
      { keys: ["water", "thirst", "river", "stream"], label: "Living water", accent: "#c9b072" },
      { keys: ["rest", "peace", "still"], label: "Rest in Him", accent: "#d9c486" },
      { keys: ["shepherd", "lead", "path"], label: "Led by grace", accent: "#d3ad63" },
      { keys: ["cross", "jesus", "christ"], label: "Christ at the centre", accent: "#d6b166" },
      { keys: ["strength", "weak", "fear", "courage"], label: "Strength for today", accent: "#e0bd73" },
      { keys: ["love", "heart", "grace"], label: "Held by grace", accent: "#dcb871" }
    ];

    return themes.find(theme => theme.keys.some(key => combined.includes(key)))
      || { label: "Scripture for today", accent: "#d3ad63" };
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

    const gold = theme.accent;
    const bg = ctx.createLinearGradient(0, 0, 1080, 1920);
    bg.addColorStop(0, "#17120c");
    bg.addColorStop(0.45, "#0d0c0a");
    bg.addColorStop(1, "#080706");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1080, 1920);

    const topLight = ctx.createRadialGradient(230, 120, 0, 230, 120, 760);
    topLight.addColorStop(0, "rgba(211,173,99,.34)");
    topLight.addColorStop(0.42, "rgba(211,173,99,.10)");
    topLight.addColorStop(1, "rgba(211,173,99,0)");
    ctx.fillStyle = topLight;
    ctx.fillRect(0, 0, 1080, 1000);

    const lowerWarmth = ctx.createRadialGradient(900, 1680, 0, 900, 1680, 620);
    lowerWarmth.addColorStop(0, "rgba(255,244,220,.12)");
    lowerWarmth.addColorStop(1, "rgba(255,244,220,0)");
    ctx.fillStyle = lowerWarmth;
    ctx.fillRect(0, 980, 1080, 940);

    ctx.fillStyle = "rgba(255,255,255,.018)";
    for (let x = -80; x < 1160; x += 54) {
      ctx.fillRect(x, 0, 1, 1920);
    }
    for (let yLine = -40; yLine < 1960; yLine += 54) {
      ctx.fillRect(0, yLine, 1080, 1);
    }

    ctx.fillStyle = "rgba(255,248,236,.945)";
    roundRect(ctx, 90, 250, 900, 1250, 54);
    ctx.fill();

    ctx.strokeStyle = "rgba(211,173,99,.72)";
    ctx.lineWidth = 4;
    roundRect(ctx, 116, 276, 848, 1198, 40);
    ctx.stroke();

    ctx.fillStyle = "rgba(211,173,99,.10)";
    roundRect(ctx, 150, 318, 780, 92, 46);
    ctx.fill();

    ctx.fillStyle = "#6e5422";
    ctx.font = "700 28px Inter, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("VERSE OF THE DAY", 540, 374);

    ctx.fillStyle = "#17120c";
    ctx.font = "700 74px Georgia, 'Times New Roman', serif";
    const referenceLines = wrapCanvasText(ctx, verse.reference, 760);
    let y = 535;
    referenceLines.slice(0, 2).forEach(line => {
      ctx.fillText(line, 540, y);
      y += 82;
    });

    ctx.strokeStyle = "rgba(211,173,99,.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(350, y + 22);
    ctx.lineTo(730, y + 22);
    ctx.stroke();

    ctx.fillStyle = "rgba(110,84,34,.18)";
    ctx.font = "700 120px Georgia, 'Times New Roman', serif";
    ctx.fillText("“", 190, y + 150);

    ctx.fillStyle = "#2a2117";
    ctx.font = "italic 50px Georgia, 'Times New Roman', serif";
    const verseLines = wrapCanvasText(ctx, `“${verse.text}”`, 820);
    const limitedLines = verseLines.slice(0, 10);
    y += 185;
    limitedLines.forEach(line => {
      ctx.fillText(line, 540, y);
      y += 70;
    });

    if (verseLines.length > limitedLines.length) {
      ctx.fillText("...", 540, y + 20);
    }

    ctx.fillStyle = "rgba(110,84,34,.72)";
    ctx.font = "600 26px Inter, Arial, sans-serif";
    ctx.fillText(theme.label.toUpperCase(), 540, 1358);

    ctx.fillStyle = "rgba(211,173,99,.95)";
    roundRect(ctx, 330, 1556, 420, 4, 2);
    ctx.fill();

    ctx.fillStyle = "#fff8ec";
    ctx.font = "700 44px Inter, Arial, sans-serif";
    ctx.fillText("DAILY DOSE", 540, 1648);
    ctx.fillStyle = "rgba(245,234,215,.72)";
    ctx.font = "400 27px Inter, Arial, sans-serif";
    ctx.fillText("Scripture • Reflection • Real Life", 540, 1702);
    ctx.fillStyle = "rgba(245,234,215,.58)";
    ctx.font = "400 25px Inter, Arial, sans-serif";
    ctx.fillText("dailydosedevotions.ie", 540, 1756);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png", 0.95));
    return new File([blob], `daily-dose-verse-${verse.date || "today"}.png`, { type: "image/png" });
  }

  function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
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
          <p class="eyebrow">Verse of the Day</p>
          <div class="date" id="votdDate">${escapeHtml(formatDate(verse.date))}</div>
          <h3 id="votdReference">${escapeHtml(verse.reference)}</h3>
          <p class="verse-text" id="votdText">&ldquo;${escapeHtml(verse.text)}&rdquo;</p>

          <div class="verse-actions">
            <a class="btn outline" href="verse-library.html">View Verse Library</a>
            <button class="btn outline" id="shareVerseBtn" type="button">Share Verse Image</button>
            <button class="btn text-link-btn" id="copyVerseBtn" type="button">Copy Verse</button>
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
