(function () {
  const DATA_URL = "/verses-of-the-day.json?v=8";
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
    return `Daily Dose Devotions | Verse of the Day\n\n${verseReferenceLabel(verse)}\n${verse.text}\n\nScripture • Reflection • Real Life\nhttps://dailydosedevotions.ie/#verse-of-the-day`;
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

  function fitVerseText(ctx, text, maxWidth, maxLines, maxHeight) {
    for (let fontSize = 52; fontSize >= 34; fontSize -= 2) {
      ctx.font = `400 ${fontSize}px Georgia, 'Times New Roman', serif`;
      const lines = wrapCanvasText(ctx, text, maxWidth);
      const lineHeight = Math.round(fontSize * 1.62);
      const height = Math.max(0, (lines.length - 1) * lineHeight) + fontSize;
      if (lines.length <= maxLines && height <= maxHeight) {
        return { lines, fontSize, lineHeight, height };
      }
    }

    ctx.font = "400 34px Georgia, 'Times New Roman', serif";
    const lines = wrapCanvasText(ctx, text, maxWidth);
    const lineHeight = 55;
    return {
      lines,
      fontSize: 34,
      lineHeight,
      height: Math.max(0, (lines.length - 1) * lineHeight) + 34
    };
  }

  async function createVerseStoryFile(verse) {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    const brandGold = "#d7ad4e";
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    const background = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
    background.addColorStop(0, "#060606");
    background.addColorStop(0.5, "#0a0908");
    background.addColorStop(1, "#050505");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    for (let i = 0; i < 6200; i += 1) {
      const x = (i * 73) % canvasWidth;
      const y = (i * 199) % canvasHeight;
      const alpha = 0.006 + ((i * 17) % 9) / 1900;
      ctx.fillStyle = `rgba(235,222,198,${alpha})`;
      ctx.fillRect(x, y, 1, 1);
    }

    const edgeShade = ctx.createRadialGradient(540, 850, 260, 540, 850, 1050);
    edgeShade.addColorStop(0, "rgba(0,0,0,0)");
    edgeShade.addColorStop(0.72, "rgba(0,0,0,.16)");
    edgeShade.addColorStop(1, "rgba(0,0,0,.64)");
    ctx.fillStyle = edgeShade;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.textAlign = "center";
    ctx.fillStyle = brandGold;
    ctx.font = "600 29px Inter, Arial, sans-serif";
    ctx.fillText("V E R S E   O F   T H E   D A Y", 540, 178);

    ctx.fillStyle = brandGold;
    ctx.fillRect(326, 220, 428, 3);

    // Let the Scripture determine the composition. Wider, naturally balanced
    // lines and generous leading keep the words open and readable.
    const fittedVerse = fitVerseText(ctx, verse.text, 860, 11, 820);
    const textHeight = fittedVerse.height;
    const textTop = Math.max(400, 750 - textHeight / 2);
    const firstBaseline = textTop + fittedVerse.fontSize;
    const textBottom = textTop + textHeight;

    const mark = new Image();
    mark.decoding = "async";
    mark.src = "/icons/brand-mark-v3.png?v=3";
    try {
      await new Promise((resolve, reject) => {
        mark.onload = resolve;
        mark.onerror = reject;
      });
      ctx.save();
      // Approved final treatment: the standalone DD-and-dove mark sits broadly
      // behind the Scripture with a warm, visible gold presence and no ring.
      const markSize = 1020;
      ctx.globalAlpha = 0.21;
      ctx.globalCompositeOperation = "screen";
      ctx.drawImage(mark, 30, 436, markSize, markSize);
      ctx.restore();
    } catch (_) {
      // The Scripture image remains usable if the decorative watermark is unavailable.
    }

    ctx.fillStyle = "#fffaf1";
    ctx.shadowColor = "rgba(0,0,0,.96)";
    ctx.shadowBlur = 12;
    ctx.font = `400 ${fittedVerse.fontSize}px Georgia, 'Times New Roman', serif`;
    let y = firstBaseline;
    fittedVerse.lines.forEach(line => {
      ctx.fillText(line, 540, y);
      y += fittedVerse.lineHeight;
    });
    ctx.shadowBlur = 0;

    const referenceY = Math.min(1490, Math.max(textBottom + 100, 1390));
    ctx.fillStyle = brandGold;
    ctx.font = "500 29px Inter, Arial, sans-serif";
    ctx.fillText(verseReferenceLabel(verse).toUpperCase(), 540, referenceY);

    ctx.fillStyle = brandGold;
    ctx.font = "500 31px Inter, Arial, sans-serif";
    ctx.fillText("D A I L Y   D O S E   D E V O T I O N S", 540, 1618);
    ctx.fillRect(282, 1658, 225, 2);
    ctx.fillRect(573, 1658, 225, 2);
    ctx.beginPath();
    ctx.arc(540, 1659, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(215,173,78,.88)";
    ctx.font = "400 21px Inter, Arial, sans-serif";
    ctx.fillText("d a i l y d o s e d e v o t i o n s . i e", 540, 1722);

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
    const whatsappBtn = document.getElementById("whatsappVerseBtn");
    const facebookBtn = document.getElementById("facebookVerseBtn");
    const copyBtn = document.getElementById("copyVerseBtn");
    const status = document.getElementById("verseShareStatus");

    shareToggle?.addEventListener("click", () => {
      const isOpen = shareToggle.getAttribute("aria-expanded") === "true";
      shareToggle.setAttribute("aria-expanded", String(!isOpen));
      sharePanel.hidden = isOpen;
      if (!isOpen) instagramBtn?.focus();
    });

    const shareImage = async platform => {
      if (status) status.textContent = `Creating the Daily Dose image for ${platform}...`;
      try {
        await recordInteraction("share", verse);
      } catch {
        // Sharing still continues even if tracking fails.
      }

      try {
        const file = await createVerseStoryFile(verse);
        const shareData = {
          title: `Verse of the Day - ${verseReferenceLabel(verse)}`,
          text: `Daily Dose Devotions | Verse of the Day\n${verseReferenceLabel(verse)}`,
          files: [file]
        };

        if (navigator.canShare?.({ files: [file] }) && navigator.share) {
          await navigator.share(shareData);
          if (status) status.textContent = `Image ready. Choose ${platform} from your share menu.`;
          return;
        }

        await downloadVerseStory(verse);
        if (status) {
          status.textContent = `Image downloaded. Open ${platform} and upload the saved Daily Dose image.`;
        }
      } catch (error) {
        if (error?.name === "AbortError") {
          if (status) status.textContent = "Share cancelled. The image has not been changed.";
        } else if (status) {
          status.textContent = "Could not create the share image. Please try again.";
        }
      }
    };

    shareBtn?.addEventListener("click", () => shareImage("your preferred app"));
    instagramBtn?.addEventListener("click", () => shareImage("Instagram / Stories"));
    whatsappBtn?.addEventListener("click", () => shareImage("WhatsApp"));
    facebookBtn?.addEventListener("click", () => shareImage("Facebook"));

    downloadBtn?.addEventListener("click", async () => {
      try {
        if (status) status.textContent = "Preparing download...";
        await downloadVerseStory(verse);
        if (status) status.textContent = "Daily Dose share image downloaded.";
      } catch {
        if (status) status.textContent = "Could not create the image. Please try again.";
      }
    });

    copyBtn?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(shareText(verse));
        if (status) status.textContent = "Verse copied.";
      } catch {
        if (status) status.textContent = "Copy failed. You can copy the verse from the page.";
      }
    });
  }

  function renderHomepageVerse(verse, options = {}) {
    const section = document.getElementById("verse-of-the-day");
    if (!section || !verse) return;

    section.className = "section verse-feature-section";
    section.setAttribute("aria-labelledby", "votdHeading");
    const reflectionUrl = options.reflectionUrl || "devotions.html";
    section.innerHTML = `
      <div class="container verse-feature-wrap">
        <article class="verse-feature-card reveal visible">
          <div class="verse-feature-ornament" aria-hidden="true">&#10013;</div>
          <p class="eyebrow" id="votdHeading">Verse of the Day</p>
          <div class="date" id="votdDate">${escapeHtml(formatDate(verse.date))}</div>
          <blockquote class="verse-text" id="votdText">${escapeHtml(verse.text)}</blockquote>
          <p class="verse-reference" id="votdReference">${escapeHtml(verseReferenceLabel(verse))}</p>
          <div class="verse-actions verse-primary-actions">
            <a class="btn primary" href="${escapeHtml(reflectionUrl)}">Read Today&rsquo;s Reflection</a>
            <a class="btn outline" href="verse-library.html">View Verse Library</a>
            <button class="btn outline" id="shareVerseToggle" type="button" aria-expanded="false" aria-controls="verseSharePanel">Share This Verse</button>
          </div>
          <div class="verse-share-panel" id="verseSharePanel" hidden>
            <div class="verse-story-preview verse-story-preview-branded" aria-label="Preview of the standard Daily Dose share image" style="position:relative;overflow:hidden;background:#080807;color:#fffaf1;">
              <span style="position:relative;z-index:2;color:#d7ad4e;letter-spacing:.24em;">Verse of the Day</span>
              <span aria-hidden="true" style="position:relative;z-index:2;display:block;width:42%;height:1px;margin:10px auto 16px;background:#d7ad4e;"></span>
              <img src="/icons/brand-mark-v3.png?v=3" alt="" aria-hidden="true" style="position:absolute;z-index:0;width:82%;left:9%;top:36%;opacity:.18;mix-blend-mode:screen;">
              <p style="position:relative;z-index:2;color:#fffaf1;font-family:Georgia,'Times New Roman',serif;">${escapeHtml(verse.text)}</p>
              <strong style="position:relative;z-index:2;color:#d7ad4e;">${escapeHtml(verseReferenceLabel(verse))}</strong>
              <small style="position:relative;z-index:2;color:#d7ad4e;">DAILY DOSE DEVOTIONS<br>dailydosedevotions.ie</small>
            </div>
            <div class="verse-share-options">
              <p>Choose where you would like to share today&rsquo;s Scripture.</p>
              <button class="btn primary" id="instagramVerseBtn" type="button">Instagram / Stories</button>
              <button class="btn outline" id="whatsappVerseBtn" type="button">WhatsApp</button>
              <button class="btn outline" id="facebookVerseBtn" type="button">Facebook</button>
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
        <p>${escapeHtml(v.text)}</p>
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
