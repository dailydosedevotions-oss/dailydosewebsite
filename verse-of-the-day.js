(function () {
  const DATA_URL = "/verses-of-the-day.json?v=3";

  function todayKeyLocal() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
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
        color: #ded6c9;
        font-size: clamp(17px, 2vw, 22px);
        line-height: 1.75;
        font-style: italic;
      }

      .verse-feature-card .verse-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 14px;
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
    const home = document.getElementById("home");

    if (section && devotions && section.nextElementSibling !== devotions) {
      devotions.parentNode.insertBefore(section, devotions);
    }

    if (section && home && section.compareDocumentPosition(home) & Node.DOCUMENT_POSITION_FOLLOWING) {
      // Safety only; normal placement is handled above.
    }
  }

  function renderHomepageVerse(verse) {
    const section = document.getElementById("verse-of-the-day");
    if (!section || !verse) return;

    section.className = "section verse-feature-section";
    section.innerHTML = `
      <div class="container verse-feature-wrap">
        <article class="verse-feature-card reveal visible">
          <div class="icon">📖</div>
          <p class="eyebrow">Verse of the Day</p>
          <div class="date" id="votdDate">${escapeHtml(formatDate(verse.date))}</div>
          <h3 id="votdReference">${escapeHtml(verse.reference)}</h3>
          <p class="verse-text" id="votdText">“${escapeHtml(verse.text)}”</p>
          <div class="verse-actions">
            <a class="btn primary" href="devotions.html">Read Devotions</a>
            <a class="btn outline" href="verse-library.html">View Verse Library</a>
          </div>
        </article>
      </div>
    `;
  }

  function renderLibrary(verses, todayKey) {
    const libraryContainer = document.getElementById("votdLibrary");
    if (!libraryContainer) return;

    const pastVerses = verses
      .filter(v => v.date < todayKey)
      .sort((a, b) => b.date.localeCompare(a.date));

    if (!pastVerses.length) {
      libraryContainer.innerHTML = '<p class="thanks-note">Previous verses will appear here after each day passes.</p>';
      return;
    }

    libraryContainer.innerHTML = pastVerses.map(v => `
      <article class="votd-library-card">
        <div class="date">${escapeHtml(formatDate(v.date, false))}</div>
        <h3>${escapeHtml(v.reference)}</h3>
        <p>“${escapeHtml(v.text)}”</p>
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
              <div class="icon">📖</div>
              <p class="eyebrow">Verse of the Day</p>
              <h3>Verse of the Day</h3>
              <p class="verse-text">Unable to load today’s verse at the moment.</p>
            </article>
          </div>
        `;
      }
      console.error("Verse of the Day failed to load:", error);
    }
  }

  document.addEventListener("DOMContentLoaded", loadVerseOfTheDay);
})();
