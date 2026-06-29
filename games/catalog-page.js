const FAVORITES_STORAGE_KEY = "gameCatalogFavorites";

const favoritesSection = document.getElementById("favoritesSection");
const favoritesGrid = document.getElementById("favoritesGrid");
const catalogGrid = document.getElementById("catalogGrid");
const catalogEmpty = document.getElementById("catalogEmpty");
const catalogSearch = document.getElementById("catalogSearch");
const tagFilters = document.getElementById("tagFilters");
const allGamesHeading = document.getElementById("allGamesHeading");

let favoriteSlugs = loadFavorites();
let activeTag = "";

function syncFavoritesWithCatalog() {
    const validSlugs = new Set(getCatalog().map((game) => game.slug));
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
    return window.GAME_CATALOG ?? [];
}

function collectTags(catalog) {
    const tags = new Set();

    catalog.forEach((game) => {
        (game.tags ?? []).forEach((tag) => tags.add(tag));
    });

    return [...tags].sort((a, b) => a.localeCompare(b));
}

function itemMatchesFilter(game, searchText, tag) {
    const query = searchText.trim().toLowerCase();

    if (tag && !(game.tags ?? []).includes(tag)) {
        return false;
    }

    if (!query) {
        return true;
    }

    const haystack = [game.title, game.description, game.slug, ...(game.tags ?? [])]
        .join(" ")
        .toLowerCase();

    return haystack.includes(query);
}

function getItemBySlug(slug) {
    return getCatalog().find((game) => game.slug === slug);
}

function createTagList(game, { clickable = false } = {}) {
    const list = document.createElement("ul");
    list.className = "game-catalog-tags";

    (game.tags ?? []).forEach((tag) => {
        const item = document.createElement("li");

        if (clickable) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "game-catalog-tag-btn";
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

function createCatalogCard(game) {
    const card = document.createElement("article");
    card.className = "game-catalog-card";
    card.dataset.slug = game.slug;

    const head = document.createElement("div");
    head.className = "game-catalog-card-head";

    const titleRow = document.createElement("div");
    titleRow.className = "game-catalog-title-row";

    const title = document.createElement("h2");
    title.textContent = game.title;

    const favoriteBtn = document.createElement("button");
    favoriteBtn.type = "button";
    favoriteBtn.className = "catalog-favorite-btn";
    favoriteBtn.setAttribute("aria-pressed", String(isFavorite(game.slug)));
    favoriteBtn.setAttribute(
        "aria-label",
        isFavorite(game.slug) ? "Remove from favorites" : "Add to favorites"
    );
    favoriteBtn.textContent = isFavorite(game.slug) ? "★" : "☆";
    favoriteBtn.addEventListener("click", () => toggleFavorite(game.slug));

    titleRow.append(title, favoriteBtn);
    head.append(titleRow);

    const tags = createTagList(game, { clickable: true });
    if (tags.childElementCount > 0) {
        head.append(tags);
    }

    const description = document.createElement("p");
    description.className = "game-catalog-desc";
    description.textContent = game.description;

    const openLink = document.createElement("a");
    openLink.className = "btn btn-primary";
    openLink.href = `${game.slug}/index.html`;
    openLink.textContent = "Play";

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
    const matchingItems = catalog.filter((game) => itemMatchesFilter(game, searchText, activeTag));

    const matchingSlugs = new Set(matchingItems.map((game) => game.slug));
    const favoriteItems = favoriteSlugs
        .map((slug) => getItemBySlug(slug))
        .filter((game) => game && matchingSlugs.has(game.slug));

    const nonFavoriteItems = matchingItems.filter((game) => !isFavorite(game.slug));

    if (favoritesGrid && favoritesSection) {
        favoritesGrid.innerHTML = "";

        if (favoriteItems.length > 0) {
            favoritesSection.hidden = false;
            favoriteItems.forEach((game) => {
                favoritesGrid.append(createCatalogCard(game));
            });
        } else {
            favoritesSection.hidden = true;
        }
    }

    if (catalogGrid) {
        catalogGrid.innerHTML = "";

        nonFavoriteItems.forEach((game) => {
            catalogGrid.append(createCatalogCard(game));
        });
    }

    if (catalogEmpty) {
        const nothingVisible = favoriteItems.length === 0 && nonFavoriteItems.length === 0;
        catalogEmpty.hidden = !nothingVisible;
    }

    if (allGamesHeading) {
        const count = nonFavoriteItems.length;
        allGamesHeading.textContent =
            count === 0 && favoriteItems.length > 0 ? "All games" : `All games (${count})`;
    }
}

function initCatalogPage() {
    syncFavoritesWithCatalog();
    renderTagFilters();
    renderCatalog();

    catalogSearch?.addEventListener("input", () => {
        renderCatalog();
    });
}

document.addEventListener("DOMContentLoaded", initCatalogPage);
