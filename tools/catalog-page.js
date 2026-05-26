function renderToolCatalog() {
  const grid = document.getElementById("catalogGrid");
  const catalog = window.TOOL_CATALOG;

  if (!grid || !catalog?.length) {
    return;
  }

  grid.innerHTML = "";

  catalog.forEach((tool) => {
    const card = document.createElement("article");
    card.className = "tool-catalog-card";

    const tagsHtml = (tool.tags ?? [])
      .map((tag) => `<li>${tag}</li>`)
      .join("");

    card.innerHTML = `
      <div class="tool-catalog-card-head">
        <h2>${tool.title}</h2>
        ${tagsHtml ? `<ul class="tool-catalog-tags">${tagsHtml}</ul>` : ""}
      </div>
      <p class="tool-catalog-desc">${tool.description}</p>
      <a class="btn btn-primary" href="${tool.slug}/index.html">Open tool</a>
    `;

    grid.appendChild(card);
  });
}

renderToolCatalog();
