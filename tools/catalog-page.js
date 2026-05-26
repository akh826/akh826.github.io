const FAVORITES_STORAGE_KEY = "toolCatalogFavorites";

const favoritesSection = document.getElementById("favoritesSection");
const favoritesGrid = document.getElementById("favoritesGrid");
const catalogGrid = document.getElementById("catalogGrid");
const catalogEmpty = document.getElementById("catalogEmpty");
const catalogSearch = document.getElementById("catalogSearch");
const tagFilters = document.getElementById("tagFilters");
const allToolsHeading = document.getElementById("allToolsHeading");

let favoriteSlugs = loadFavorites();
let activeTag = "";

function syncFavoritesWithCatalog() {
  const validSlugs = new Set(getCatalog().map((tool) => tool.slug));
  const pruned = favoriteSlugs.filter((slug) => validSlugs.has(slug));

  if (pruned.length !== favoriteSlugs.length) {
    favoriteSlugs = pruned;
    saveFavorites();
  }
}

function loadFavorites() {
  try {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((slug) => typeof slug === "string");
  } catch {
    return [];
  }
}

function saveFavorites() {
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteSlugs));
}

function isFavorite(slug) {
  return favoriteSlugs.includes(slug);
}

function toggleFavorite(slug) {
  if (isFavorite(slug)) {
    favoriteSlugs = favoriteSlugs.filter((item) => item !== slug);
  } else {
    favoriteSlugs.push(slug);
  }

  saveFavorites();
  renderCatalog();
}

function getCatalog() {
  return window.TOOL_CATALOG ?? [];
}

function collectTags(catalog) {
  const tags = new Set();

  catalog.forEach((tool) => {
    (tool.tags ?? []).forEach((tag) => tags.add(tag));
  });

  return [...tags].sort((a, b) => a.localeCompare(b));
}

function toolMatchesFilter(tool, searchText, tag) {
  const query = searchText.trim().toLowerCase();

  if (tag && !(tool.tags ?? []).includes(tag)) {
    return false;
  }

  if (!query) {
    return true;
  }

  const haystack = [
    tool.title,
    tool.description,
    tool.slug,
    ...(tool.tags ?? [])
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function getToolBySlug(slug) {
  return getCatalog().find((tool) => tool.slug === slug);
}

function createTagList(tool, { clickable = false } = {}) {
  const list = document.createElement("ul");
  list.className = "tool-catalog-tags";

  (tool.tags ?? []).forEach((tag) => {
    const item = document.createElement("li");

    if (clickable) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tool-catalog-tag-btn";
      button.textContent = tag;
      button.addEventListener("click", () => {
        activeTag = tag;
        renderTagFilters();
        renderCatalog();
      });
      item.appendChild(button);
    } else {
      item.textContent = tag;
    }

    list.appendChild(item);
  });

  return list;
}

function createToolCard(tool) {
  const card = document.createElement("article");
  card.className = "tool-catalog-card";
  card.dataset.slug = tool.slug;

  const head = document.createElement("div");
  head.className = "tool-catalog-card-head";

  const titleRow = document.createElement("div");
  titleRow.className = "tool-catalog-title-row";

  const title = document.createElement("h2");
  title.textContent = tool.title;

  const favoriteBtn = document.createElement("button");
  favoriteBtn.type = "button";
  favoriteBtn.className = "catalog-favorite-btn";
  favoriteBtn.setAttribute("aria-pressed", String(isFavorite(tool.slug)));
  favoriteBtn.setAttribute(
    "aria-label",
    isFavorite(tool.slug) ? "Remove from favorites" : "Add to favorites"
  );
  favoriteBtn.textContent = isFavorite(tool.slug) ? "★" : "☆";
  favoriteBtn.addEventListener("click", () => toggleFavorite(tool.slug));

  titleRow.append(title, favoriteBtn);
  head.append(titleRow);

  const tags = createTagList(tool, { clickable: true });
  if (tags.childElementCount > 0) {
    head.append(tags);
  }

  const description = document.createElement("p");
  description.className = "tool-catalog-desc";
  description.textContent = tool.description;

  const openLink = document.createElement("a");
  openLink.className = "btn btn-primary";
  openLink.href = `${tool.slug}/index.html`;
  openLink.textContent = "Open tool";

  card.append(head, description, openLink);
  return card;
}

function renderTagFilters() {
  if (!tagFilters) {
    return;
  }

  tagFilters.innerHTML = "";
  const tags = collectTags(getCatalog());

  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = "tag-filter";
  allButton.textContent = "All";
  allButton.dataset.tag = "";
  allButton.classList.toggle("active", activeTag === "");
  allButton.addEventListener("click", () => {
    activeTag = "";
    renderTagFilters();
    renderCatalog();
  });
  tagFilters.append(allButton);

  tags.forEach((tag) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tag-filter";
    button.textContent = tag;
    button.dataset.tag = tag;
    button.classList.toggle("active", activeTag === tag);
    button.addEventListener("click", () => {
      activeTag = tag;
      renderTagFilters();
      renderCatalog();
    });
    tagFilters.append(button);
  });
}

function renderCatalog() {
  const catalog = getCatalog();
  const searchText = catalogSearch?.value ?? "";
  const matchingTools = catalog.filter((tool) =>
    toolMatchesFilter(tool, searchText, activeTag)
  );

  const matchingSlugs = new Set(matchingTools.map((tool) => tool.slug));
  const favoriteTools = favoriteSlugs
    .map((slug) => getToolBySlug(slug))
    .filter((tool) => tool && matchingSlugs.has(tool.slug));

  const nonFavoriteTools = matchingTools.filter((tool) => !isFavorite(tool.slug));

  if (favoritesGrid && favoritesSection) {
    favoritesGrid.innerHTML = "";

    if (favoriteTools.length > 0) {
      favoritesSection.hidden = false;
      favoriteTools.forEach((tool) => {
        favoritesGrid.append(createToolCard(tool));
      });
    } else {
      favoritesSection.hidden = true;
    }
  }

  if (catalogGrid) {
    catalogGrid.innerHTML = "";

    nonFavoriteTools.forEach((tool) => {
      catalogGrid.append(createToolCard(tool));
    });
  }

  if (catalogEmpty) {
    const nothingVisible =
      favoriteTools.length === 0 && nonFavoriteTools.length === 0;
    catalogEmpty.hidden = !nothingVisible;
  }

  if (allToolsHeading) {
    const count = nonFavoriteTools.length;
    allToolsHeading.textContent =
      count === 0 && favoriteTools.length > 0
        ? "All tools"
        : `All tools (${count})`;
  }
}

function initCatalogPage() {
  if (!getCatalog().length) {
    return;
  }

  syncFavoritesWithCatalog();
  renderTagFilters();
  renderCatalog();

  catalogSearch?.addEventListener("input", renderCatalog);
}

initCatalogPage();
