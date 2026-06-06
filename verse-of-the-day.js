async function loadVerseOfTheDay() {
  const verseReference = document.getElementById("votdReference");
  const verseText = document.getElementById("votdText");
  const verseDate = document.getElementById("votdDate");
  const libraryContainer = document.getElementById("votdLibrary");

  if (!verseReference || !verseText || !verseDate) return;

  try {
    const response = await fetch("/verses-of-the-day.json?v=2");
    const verses = await response.json();

    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);

    let todaysVerse = verses.find(v => v.date === todayKey);

    // If the exact date is not found, use the closest previous verse.
    if (!todaysVerse) {
      const previous = verses
        .filter(v => v.date <= todayKey)
        .sort((a, b) => b.date.localeCompare(a.date));
      todaysVerse = previous[0] || verses[0];
    }

    verseReference.textContent = todaysVerse.reference;
    verseText.textContent = "“" + todaysVerse.text + "”";

    const displayDate = new Date(todaysVerse.date + "T00:00:00");
    verseDate.textContent = displayDate.toLocaleDateString("en-IE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    if (libraryContainer) {
      const pastVerses = verses
        .filter(v => v.date < todayKey)
        .sort((a, b) => b.date.localeCompare(a.date));

      if (pastVerses.length === 0) {
        libraryContainer.innerHTML = '<p class="thanks-note">Previous verses will appear here after each day passes.</p>';
      } else {
        libraryContainer.innerHTML = pastVerses.map(v => {
          const d = new Date(v.date + "T00:00:00");
          const formatted = d.toLocaleDateString("en-IE", {
            day: "numeric",
            month: "short",
            year: "numeric"
          });

          return `
            <article class="votd-library-card">
              <div class="date">${formatted}</div>
              <h3>${escapeHtml(v.reference)}</h3>
              <p>“${escapeHtml(v.text)}”</p>
            </article>
          `;
        }).join("");
      }
    }
  } catch (error) {
    verseReference.textContent = "Verse of the Day";
    verseText.textContent = "Unable to load today’s verse at the moment.";
    verseDate.textContent = "";
    console.error("Verse of the Day failed to load:", error);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.addEventListener("DOMContentLoaded", loadVerseOfTheDay);
