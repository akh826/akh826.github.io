const FAVORITES_STORAGE_KEY = "demoCatalogFavorites";

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
    const validSlugs = new Set(getCatalog().map((demo) => demo.slug));
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
    return window.DEMO_CATALOG ?? [];
}

function collectTags(catalog) {
    const tags = new Set();

    catalog.forEach((demo) => {
        (demo.tags ?? []).forEach((tag) => tags.add(tag));
    });

    return [...tags].sort((a, b) => a.localeCompare(b));
}

function itemMatchesFilter(demo, searchText, tag) {
    const query = searchText.trim().toLowerCase();

    if (tag && !(demo.tags ?? []).includes(tag)) {
        return false;
    }

    if (!query) {
        return true;
    }

    const haystack = [demo.title, demo.description, demo.slug, ...(demo.tags ?? [])]
        .join(" ")
        .toLowerCase();

    return haystack.includes(query);
}

function getItemBySlug(slug) {
    return getCatalog().find((demo) => demo.slug === slug);
}

function createTagList(demo, { clickable = false } = {}) {
    const list = document.createElement("ul");
    list.className = "demo-catalog-tags";

    (demo.tags ?? []).forEach((tag) => {
        const item = document.createElement("li");

        if (clickable) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "demo-catalog-tag-btn";
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

function createCatalogCard(demo) {
    const card = document.createElement("article");
    card.className = "demo-catalog-card";
    card.dataset.slug = demo.slug;

    const head = document.createElement("div");
    head.className = "demo-catalog-card-head";

    const titleRow = document.createElement("div");
    titleRow.className = "demo-catalog-title-row";

    const title = document.createElement("h2");
    title.textContent = demo.title;

    const favoriteBtn = document.createElement("button");
    favoriteBtn.type = "button";
    favoriteBtn.className = "catalog-favorite-btn";
    favoriteBtn.setAttribute("aria-pressed", String(isFavorite(demo.slug)));
    favoriteBtn.setAttribute(
        "aria-label",
        isFavorite(demo.slug) ? "Remove from favorites" : "Add to favorites"
    );
    favoriteBtn.textContent = isFavorite(demo.slug) ? "★" : "☆";
    favoriteBtn.addEventListener("click", () => toggleFavorite(demo.slug));

    titleRow.append(title, favoriteBtn);
    head.append(titleRow);

    const tags = createTagList(demo, { clickable: true });
    if (tags.childElementCount > 0) {
        head.append(tags);
    }

    const description = document.createElement("p");
    description.className = "demo-catalog-desc";
    description.textContent = demo.description;

    const openLink = document.createElement("a");
    openLink.className = "btn btn-primary";
    openLink.href = `${demo.slug}/index.html`;
    openLink.textContent = "Open demo";

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
    const matchingItems = catalog.filter((demo) => itemMatchesFilter(demo, searchText, activeTag));

    const matchingSlugs = new Set(matchingItems.map((demo) => demo.slug));
    const favoriteItems = favoriteSlugs
        .map((slug) => getItemBySlug(slug))
        .filter((demo) => demo && matchingSlugs.has(demo.slug));

    const nonFavoriteItems = matchingItems.filter((demo) => !isFavorite(demo.slug));

    if (favoritesGrid && favoritesSection) {
        favoritesGrid.innerHTML = "";

        if (favoriteItems.length > 0) {
            favoritesSection.hidden = false;
            favoriteItems.forEach((demo) => {
                favoritesGrid.append(createCatalogCard(demo));
            });
        } else {
            favoritesSection.hidden = true;
        }
    }

    if (catalogGrid) {
        catalogGrid.innerHTML = "";

        nonFavoriteItems.forEach((demo) => {
            catalogGrid.append(createCatalogCard(demo));
        });
    }

    if (catalogEmpty) {
        const nothingVisible = favoriteItems.length === 0 && nonFavoriteItems.length === 0;
        catalogEmpty.hidden = !nothingVisible;
    }

    if (allToolsHeading) {
        const count = nonFavoriteItems.length;
        allToolsHeading.textContent =
            count === 0 && favoriteItems.length > 0 ? "All demos" : `All demos (${count})`;
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
