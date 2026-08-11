(function () {
  const DATA_URL = "/verses-of-the-day.json?v=7";
  const TRACK_URL = "/api/votd-interaction";

  function todayKeyIreland() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Dublin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());

    const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
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

  function verseReferenceLabel(verse) {
    return verse.translation ? `${verse.reference} (${verse.translation})` : verse.reference;
  }

  function injectVerseStyles() {
    // Verse presentation lives in styles.css so it can be cached and maintained with the rest of the site.
  }

  function placeVerseSection() {
    const section = document.getElementById("verse-of-the-day");
    const devotions = document.getElementById("devotions");

    if (section && devotions && section.nextElementSibling !== devotions) {
      devotions.parentNode.insertBefore(section, devotions);
    }
  }

  function shareText(verse) {
    return `Daily Dose Devotions | Verse of the Day\n\n${verseReferenceLabel(verse)}\n“${verse.text}”\n\nScripture • Reflection • Real Life\nhttps://dailydosedevotions.ie/#verse-of-the-day`;
  }

  function validateVerseSchedule(verses) {
    const issues = [];
    const seen = new Set();

    verses.forEach((verse, index) => {
      if (!verse || !/^\d{4}-\d{2}-\d{2}$/.test(verse.date || "") || !verse.reference?.trim() || !verse.text?.trim() || !["WEB", "BSB"].includes(verse.translation)) {
        issues.push(`Invalid verse entry at position ${index + 1}`);
        return;
      }
      if (seen.has(verse.date)) issues.push(`Duplicate verse date: ${verse.date}`);
      seen.add(verse.date);
    });

    const dates = [...seen].sort();
    for (let index = 1; index < dates.length; index += 1) {
      const previous = new Date(`${dates[index - 1]}T00:00:00Z`);
      const current = new Date(`${dates[index]}T00:00:00Z`);
      if ((current - previous) / 86400000 !== 1) {
        issues.push(`Schedule gap between ${dates[index - 1]} and ${dates[index]}`);
      }
    }

    if (issues.length) console.warn("Verse schedule validation:", issues);
    return issues;
  }

  async function findReflectionUrl(date) {
    try {
      const response = await fetch("/devotions.html");
      if (!response.ok) return "devotions.html";
      const documentCopy = new DOMParser().parseFromString(await response.text(), "text/html");
      const expected = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      });
      const cards = [...documentCopy.querySelectorAll(".devotion-card")];
      const match = cards.find(card => card.querySelector(".date")?.textContent.trim() === expected);
      return match?.querySelector("a[href]")?.getAttribute("href") || "devotions.html";
    } catch {
      return "devotions.html";
    }
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

  function fitVerseText(ctx, text, maxWidth, maxLines) {
    for (let fontSize = 50; fontSize >= 30; fontSize -= 2) {
      ctx.font = `italic ${fontSize}px Georgia, 'Times New Roman', serif`;
      const lines = wrapCanvasText(ctx, text, maxWidth);
      if (lines.length <= maxLines) return { lines, fontSize, lineHeight: Math.round(fontSize * 1.42) };
    }

    ctx.font = "italic 30px Georgia, 'Times New Roman', serif";
    return { lines: wrapCanvasText(ctx, text, maxWidth), fontSize: 30, lineHeight: 43 };
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
    const referenceLines = wrapCanvasText(ctx, verseReferenceLabel(verse), 760);
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
    const fittedVerse = fitVerseText(ctx, `“${verse.text}”`, 820, 12);
    y += 185;
    fittedVerse.lines.forEach(line => {
      ctx.fillText(line, 540, y);
      y += fittedVerse.lineHeight;
    });

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
    ctx.fillText("dailydosedevotions.ie  •  @dailydosedevotions3", 540, 1756);

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
    const shareToggle = document.getElementById("shareVerseToggle");
    const sharePanel = document.getElementById("verseSharePanel");
    const shareBtn = document.getElementById("shareVerseBtn");
    const downloadBtn = document.getElementById("downloadVerseStoryBtn");
    const instagramBtn = document.getElementById("instagramVerseBtn");
    const copyBtn = document.getElementById("copyVerseBtn");
    const status = document.getElementById("verseShareStatus");

    shareToggle?.addEventListener("click", () => {
      const isOpen = shareToggle.getAttribute("aria-expanded") === "true";
      shareToggle.setAttribute("aria-expanded", String(!isOpen));
      sharePanel.hidden = isOpen;
      if (!isOpen) instagramBtn?.focus();
    });

    if (shareBtn || instagramBtn) {
      const openShare = async () => {
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
            title: `Verse of the Day - ${verseReferenceLabel(verse)}`,
            text: `Verse of the Day - ${verseReferenceLabel(verse)}\n\nDaily Dose Devotions`,
            files: [file]
          };

          if (navigator.canShare?.({ files: [file] }) && navigator.share) {
            await navigator.share(shareData);
            if (status) status.textContent = "Story image ready. Choose Instagram/Stories if it appears.";
          } else if (navigator.share) {
            await navigator.share({
              title: `Verse of the Day - ${verseReferenceLabel(verse)}`,
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
      };

      shareBtn?.addEventListener("click", openShare);
      instagramBtn?.addEventListener("click", openShare);
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

  function renderHomepageVerse(verse, options = {}) {
    const section = document.getElementById("verse-of-the-day");
    if (!section || !verse) return;

    section.className = "section verse-feature-section";
    section.setAttribute("aria-labelledby", "votdHeading");
    const reflectionUrl = options.reflectionUrl || "devotions.html";
    const brandedText = shareText(verse);
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(brandedText)}`;
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent("https://dailydosedevotions.ie/#verse-of-the-day")}`;
    section.innerHTML = `
      <div class="container verse-feature-wrap">
        <article class="verse-feature-card reveal visible">
          <div class="verse-feature-ornament" aria-hidden="true">&#10013;</div>
          <p class="eyebrow" id="votdHeading">Verse of the Day</p>
          <div class="date" id="votdDate">${escapeHtml(formatDate(verse.date))}</div>
          <blockquote class="verse-text" id="votdText">&ldquo;${escapeHtml(verse.text)}&rdquo;</blockquote>
          <p class="verse-reference" id="votdReference">${escapeHtml(verseReferenceLabel(verse))}</p>
          <div class="verse-actions verse-primary-actions">
            <a class="btn primary" href="${escapeHtml(reflectionUrl)}">Read Today&rsquo;s Reflection</a>
            <a class="btn outline" href="verse-library.html">View Verse Library</a>
            <button class="btn outline" id="shareVerseToggle" type="button" aria-expanded="false" aria-controls="verseSharePanel">Share This Verse</button>
          </div>
          <div class="verse-share-panel" id="verseSharePanel" hidden>
            <div class="verse-story-preview" aria-label="Preview of the Daily Dose Instagram Story image">
              <span>Verse of the Day</span>
              <strong>${escapeHtml(verseReferenceLabel(verse))}</strong>
              <p>&ldquo;${escapeHtml(verse.text)}&rdquo;</p>
              <small>DAILY DOSE<br>Scripture &bull; Reflection &bull; Real Life</small>
            </div>
            <div class="verse-share-options">
              <p>Choose where you would like to share today&rsquo;s Scripture.</p>
              <button class="btn primary" id="instagramVerseBtn" type="button">Instagram / Stories</button>
              <a class="btn outline" href="${whatsappUrl}" target="_blank" rel="noopener">WhatsApp</a>
              <a class="btn outline" href="${facebookUrl}" target="_blank" rel="noopener">Facebook</a>
              <button class="btn outline" id="downloadVerseStoryBtn" type="button">Download Story Image</button>
              <button class="btn text-link-btn" id="copyVerseBtn" type="button">Copy Verse</button>
            </div>
          </div>
          ${options.scheduleExpired ? '<p class="verse-schedule-note">The verse schedule needs updating. Showing the most recently scheduled Scripture.</p>' : ""}
          <div class="verse-share-status" id="verseShareStatus" aria-live="polite"></div>
        </article>
      </div>
    `;

    wireVerseButtons(verse);
  }

  function renderLibrary(verses, todayKey) {
    const libraryContainer = document.getElementById("votdLibrary");
    if (!libraryContainer) return;

    const pastVerses = verses
      .filter(v => v.date <= todayKey)
      .sort((a, b) => b.date.localeCompare(a.date));

    if (!pastVerses.length) {
      libraryContainer.innerHTML = '<p class="thanks-note">No previous verses are available yet.</p>';
      return;
    }

    libraryContainer.innerHTML = pastVerses.map(v => `
      <article class="votd-library-card">
        <div class="date">${v.date === todayKey ? '<span class="votd-today-badge">Today</span>' : ""}${escapeHtml(formatDate(v.date, false))}</div>
        <h3>${escapeHtml(verseReferenceLabel(v))}</h3>
        <p>&ldquo;${escapeHtml(v.text)}&rdquo;</p>
      </article>
    `).join("");
  }

  async function loadVerseOfTheDay() {
    injectVerseStyles();
    placeVerseSection();

    try {
      const response = await fetch(DATA_URL);
      if (!response.ok) throw new Error(`Verse schedule request failed: ${response.status}`);
      const verses = await response.json();
      if (!Array.isArray(verses) || !verses.length) throw new Error("Verse schedule is empty");
      validateVerseSchedule(verses);
      const todayKey = todayKeyIreland();

      let todaysVerse = verses.find(v => v.date === todayKey);

      if (!todaysVerse) {
        const previous = verses
          .filter(v => v.date <= todayKey)
          .sort((a, b) => b.date.localeCompare(a.date));
        todaysVerse = previous[0] || verses[0];
      }

      const latestDate = verses.map(verse => verse.date).sort().at(-1);
      const reflectionUrl = await findReflectionUrl(todaysVerse.date);
      renderHomepageVerse(todaysVerse, {
        reflectionUrl,
        scheduleExpired: todayKey > latestDate
      });
      renderLibrary(verses, todayKey);
    } catch (error) {
      const section = document.getElementById("verse-of-the-day");
      if (section) {
        section.className = "section verse-feature-section";
        section.innerHTML = `
          <div class="container verse-feature-wrap">
            <article class="verse-feature-card reveal visible">
              <div class="verse-feature-ornament" aria-hidden="true">&#10013;</div>
              <p class="eyebrow">Verse of the Day</p>
              <blockquote class="verse-text">&ldquo;Your word is a lamp to my feet, and a light for my path.&rdquo;</blockquote>
              <p class="verse-reference">Psalm 119:105</p>
              <div class="verse-actions">
                <a class="btn primary" href="devotions.html">Read Today&rsquo;s Reflection</a>
                <a class="btn outline" href="verse-library.html">View Verse Library</a>
              </div>
            </article>
          </div>
        `;
      }
      console.error("Verse of the Day failed to load:", error);
    }
  }

  document.addEventListener("DOMContentLoaded", loadVerseOfTheDay);
})();
