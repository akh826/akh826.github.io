(() => {
    class TopNav extends HTMLElement {
        connectedCallback() {
            const page = (this.getAttribute("page") || "home").toLowerCase();
            const root = this.getAttribute("root") || ".";
            const showGithub = this.getAttribute("show-github") === "true";

            const isHome = page === "home";
            const isTools = page === "tools";
            const isDemos = page === "demos";
            const isGames = page === "games";

            const homeHref = isHome ? "#home" : `${root}/index.html`;
            const toolsHref = isTools ? "index.html" : `${root}/tools/index.html`;
            const demosHref = isDemos ? "index.html" : `${root}/demos/index.html`;
            const gamesHref = isGames ? "index.html" : `${root}/games/index.html`;

            const sectionLinks = isHome
                ? `
          <li><a href="#home" class="nav-link nav-link-section active">Home</a></li>
          <li><a href="#about" class="nav-link nav-link-section">About</a></li>
          <li><a href="#experience" class="nav-link nav-link-section">Experience</a></li>
          <li><a href="#skills" class="nav-link nav-link-section">Skills</a></li>
          <li><a href="#contact" class="nav-link nav-link-section">Contact</a></li>
        `
                : `
          <li><a href="${homeHref}" class="nav-link nav-link-section">Home</a></li>
        `;

            const githubLink = showGithub
                ? `
          <li>
            <a href="https://github.com/akh826?tab=overview" target="_blank" rel="noopener noreferrer" class="github-link">GitHub</a>
          </li>
        `
                : "";

            this.outerHTML = `
<header class="site-header">
  <nav class="nav container">
    <button class="menu-toggle" id="menuToggle" aria-label="Toggle menu" aria-expanded="false">Menu</button>
    <ul class="nav-links" id="navLinks">
      <li class="nav-sections-group">
        <span class="nav-area-label">Portfolio</span>
        <ul class="nav-sections-list">
          ${sectionLinks}
        </ul>
      </li>
      <li class="nav-divider" aria-hidden="true"></li>
      <li>
        <a href="${toolsHref}" class="nav-link nav-link-tools${isTools ? " active" : ""}">
          <span class="nav-tools-icon" aria-hidden="true">⬡</span>
          Tools
        </a>
      </li>
      <li>
        <a href="${demosHref}" class="nav-link nav-link-demos${isDemos ? " active" : ""}">
          <span class="nav-tools-icon" aria-hidden="true">▦</span>
          Demos
        </a>
      </li>
      <li>
        <a href="${gamesHref}" class="nav-link nav-link-games${isGames ? " active" : ""}">
          <span class="nav-tools-icon" aria-hidden="true">◉</span>
          Games
        </a>
      </li>
      ${githubLink}
    </ul>
    <button class="theme-toggle" id="themeToggle" aria-label="Toggle dark mode">Dark</button>
  </nav>
</header>`.trim();
        }
    }

    if (!customElements.get("top-nav")) {
        customElements.define("top-nav", TopNav);
    }
})();
