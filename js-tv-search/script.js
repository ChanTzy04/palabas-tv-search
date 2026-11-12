/*
  Palabas - TV Show Search
  The URL functions/builder and helper functions located before the TODO parts
  were already given in our starter file.
*/

// ---------- Page element Selector ----------
const form = document.getElementById("searchForm");
const input = document.getElementById("query");
const statusText = document.getElementById("status");
const results = document.getElementById("results");
const dialog = document.getElementById("details");
const detailsBody = document.getElementById("detailsBody");
const closeBtn = document.getElementById("closeDetails");
const modeBadge = document.getElementById("modeBadge");
const favoritesList = document.getElementById("favoritesList");

// ---------- TV-Maze API's URLs ----------
const API = "https://api.tvmaze.com";

function slug(text) {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function searchURL(query) {
  if (USE_SAMPLE_DATA) return `data/search/${slug(query)}.json`;
  return `${API}/search/shows?q=${encodeURIComponent(query)}`;
}

function showURL(id) {
  return USE_SAMPLE_DATA ? `data/shows/${id}.json` : `${API}/shows/${id}`;
}

function castURL(id) {
  return USE_SAMPLE_DATA ? `data/cast/${id}.json` : `${API}/shows/${id}/cast`;
}

function seasonsURL(id) {
  return USE_SAMPLE_DATA ? `data/seasons/${id}.json` : `${API}/shows/${id}/seasons`;
}

// ---------- helper functions ----------
function setStatus(message, type = "info") {
  statusText.textContent = message;
  statusText.className = "status " + type;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function createPoster(show, size = "medium") {
  if (!show.image) {
    return el("span", "poster none", "No poster");
  }
  const img = el("img", "poster");
  img.src = show.image[size] || show.image.medium;
  img.alt = `Poster: ${show.name}`;
  img.loading = "lazy";
  img.addEventListener("error", () => img.replaceWith(el("span", "poster none", "No poster")));
  return img;
}

function yearRange(show) {
  const start = show.premiered ? show.premiered.slice(0, 4) : "?";
  const end = show.ended ? show.ended.slice(0, 4) : "";
  return `${start}–${end}`;
}

function stripTags(html) {
  if (!html) return "No summary yet.";
  return new DOMParser().parseFromString(html, "text/html").body.textContent;
}

// ---------- Close the details pop-up ----------
closeBtn.addEventListener("click", () => dialog.close());

dialog.addEventListener("click", (event) => {
  if (event.target === dialog) {
    dialog.close();
  }
});

// Show which mode is being used.
modeBadge.textContent = USE_SAMPLE_DATA ? "Sample data" : "Live · TVmaze";
modeBadge.classList.toggle("live", !USE_SAMPLE_DATA);

// ================================================================
// STEP 1 This code was made to test our very first API request
// I kept it commented here for reference. Once Step 1 is done, we
// need to removed it so our program won't send unnecessary request
// to the API!
// ================================================================

// ================================================================
// STEP 2 - Search and show the results
// ================================================================

function renderResults(items) {
  // Remove the cards from the previous search.
  results.replaceChildren();

  items.forEach((item) => {
    // Search results have this format: { score, show }.
    const show = item.show;
    const card = el("button", "card");
    card.type = "button";
    card.dataset.id = show.id;

    const rating = show.rating && show.rating.average;

    card.append(
      createPoster(show),
      el("span", "title", show.name),
      el("span", "year", yearRange(show)),
      el("span", "genres", (show.genres || []).join(", ")),
      el("span", "rating", rating ? `★ ${rating}` : "Not rated yet")
    );

    results.appendChild(card);
  });
}

// ================================================================
// STEP 3 - getJSON(): handle network and HTTP errors
// ================================================================

async function getJSON(url) {
  let response;

  try {
    response = await fetch(url);
  } catch (networkError) {
    throw new Error(
      "Can't reach TVmaze. Check your internet connection and make sure Live Server is running."
    );
  }

  if (response.status === 429) {
    throw new Error("Too many requests (429). Please wait 10 seconds and try again.");
  }

  if (!response.ok) {
    if (USE_SAMPLE_DATA) {
      throw new Error(
        "That sample is not available. Try: friends, office, breaking bad, stranger things, sherlock, thrones, or sample."
      );
    }
    throw new Error(`The request failed (HTTP ${response.status}). Please try again.`);
  }

  try {
    return await response.json();
  } catch (jsonError) {
    throw new Error("The server returned data that could not be read. Please try again.");
  }
}

async function searchShows(query) {
  setStatus(`⏳ Searching for "${query}"…`, "loading");
  results.replaceChildren();

  try {
    const data = await getJSON(searchURL(query));

    // A successful request can still return an empty array.
    if (data.length === 0) {
      setStatus(`No shows found for "${query}". Try another title.`, "error");
      return;
    }

    renderResults(data);
    const word = data.length === 1 ? "show" : "shows";
    setStatus(`${data.length} ${word} found for "${query}".`);
  } catch (error) {
    setStatus(error.message, "error");
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const query = input.value.trim();
  if (query === "") {
    return;
  }

  searchShows(query);
});

// ================================================================
// STEP 4 - Click a card to see the show's details
// ================================================================

// One listener handles all cards, including cards added after searching.
results.addEventListener("click", (event) => {
  const card = event.target.closest(".card");

  if (card) {
    showDetails(card.dataset.id);
  }
});

// ================================================================
// STEP 5 - Load show, cast, and seasons together with Promise.all
// ================================================================

async function showDetails(id) {
  detailsBody.replaceChildren(el("p", "status loading", "Loading details…"));
  dialog.showModal();

  try {
    const startTime = performance.now();

    // All three requests begin together instead of waiting one by one.
    const [show, cast, seasons] = await Promise.all([
      getJSON(showURL(id)),
      getJSON(castURL(id)),
      getJSON(seasonsURL(id))
    ]);

    const totalTime = Math.round(performance.now() - startTime);
    console.log(`3 requests in ${totalTime} ms`);

    renderDetails(show, cast, seasons);
  } catch (error) {
    detailsBody.replaceChildren(el("p", "status error", error.message));
  }
}

function renderDetails(show, cast, seasons) {
  const networkName = show.network
    ? show.network.name
    : show.webChannel
      ? show.webChannel.name
      : "Network not listed";

  // Some shows have a null runtime, so use averageRuntime as a backup.
  const minutes = show.runtime || show.averageRuntime;
  const runtimeText = minutes ? `${minutes} min` : "Runtime not listed";

  const seasonCount = seasons.length;
  const seasonText = seasonCount === 1 ? "1 season" : `${seasonCount} seasons`;

  const info = el("div", "info");

  info.append(
    el("h2", "", show.name),
    el(
      "p",
      "meta",
      [yearRange(show), networkName, seasonText, runtimeText].join(" · ")
    ),
    el("p", "meta", (show.genres || []).join(", ")),
    el(
      "p",
      "score",
      show.rating && show.rating.average
        ? `★ ${show.rating.average} / 10`
        : "Not rated yet"
    ),
    // API summary is cleaned and displayed as text, not inserted as HTML.
    el("p", "plot", stripTags(show.summary))
  );

  // Show up to six cast members.
  if (cast.length > 0) {
    info.appendChild(el("h3", "", "Cast"));
    const castList = el("ul", "cast");

    cast.slice(0, 6).forEach((member) => {
      const personName = member.person ? member.person.name : "Unknown actor";
      const characterName = member.character
        ? member.character.name
        : "Unknown character";

      const listItem = el("li", "", `${personName} `);
      listItem.appendChild(el("span", "", `as ${characterName}`));
      castList.appendChild(listItem);
    });

    info.appendChild(castList);
  } else {
    info.appendChild(el("p", "meta", "Cast information is not available."));
  }

  // Add the Favorites button (our extra feature).
  const favoriteButton = el("button", "favorite-button");
  favoriteButton.type = "button";
  favoriteButton.dataset.favoriteId = show.id;
  favoriteButton.textContent = isFavorite(show.id)
    ? "★ Remove from favorites"
    : "☆ Add to favorites";
  favoriteButton.addEventListener("click", () => {
    toggleFavorite({ id: show.id, name: show.name });
    favoriteButton.textContent = isFavorite(show.id)
      ? "★ Remove from favorites"
      : "☆ Add to favorites";
  });
  info.appendChild(favoriteButton);

  const linkArea = el("p", "links");
  const tvmazeLink = el("a", "", "View on TVmaze ↗");
  tvmazeLink.href = show.url;
  tvmazeLink.target = "_blank";
  tvmazeLink.rel = "noopener";
  linkArea.appendChild(tvmazeLink);
  info.appendChild(linkArea);

  detailsBody.replaceChildren(createPoster(show, "original"), info);
}

// ================================================================
// EXTRA FEATURE - Favorites saved in localStorage
// ================================================================

function readFavorites() {
  try {
    return JSON.parse(localStorage.getItem("palabasFavorites")) || [];
  } catch (error) {
    return [];
  }
}

function saveFavorites(favorites) {
  localStorage.setItem("palabasFavorites", JSON.stringify(favorites));
}

function isFavorite(id) {
  return readFavorites().some((favorite) => Number(favorite.id) === Number(id));
}

function toggleFavorite(show) {
  let favorites = readFavorites();

  if (isFavorite(show.id)) {
    favorites = favorites.filter(
      (favorite) => Number(favorite.id) !== Number(show.id)
    );
  } else {
    favorites.push(show);
  }

  saveFavorites(favorites);
  renderFavorites();
}

function renderFavorites() {
  favoritesList.replaceChildren();
  const favorites = readFavorites();

  if (favorites.length === 0) {
    favoritesList.appendChild(el("p", "empty-favorites", "You have no favorites yet."));
    return;
  }

  favorites.forEach((favorite) => {
    const row = el("div", "favorite-item");
    const openButton = el("button", "favorite-name", favorite.name);
    openButton.type = "button";
    openButton.addEventListener("click", () => showDetails(favorite.id));

    const removeButton = el("button", "remove-favorite", "Remove");
    removeButton.type = "button";
    removeButton.addEventListener("click", () => {
      const updated = readFavorites().filter(
        (item) => Number(item.id) !== Number(favorite.id)
      );
      saveFavorites(updated);
      renderFavorites();
    });

    row.append(openButton, removeButton);
    favoritesList.appendChild(row);
  });
}

// Show saved favorites when the page first opens.
renderFavorites();
