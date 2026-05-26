const themeToggle = document.getElementById("themeToggle");
const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");
const links = document.querySelectorAll(".nav-link");
const sections = document.querySelectorAll("main section");
const backToTopButton = document.getElementById("backToTop");
const year = document.getElementById("year");

if (year) {
  year.textContent = String(new Date().getFullYear());
}

const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") {
  document.body.classList.add("dark");
  themeToggle.textContent = "Light";
}

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  themeToggle.textContent = isDark ? "Light" : "Dark";
});

menuToggle.addEventListener("click", () => {
  const expanded = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!expanded));
  navLinks.classList.toggle("open");
});

links.forEach((link) => {
  link.addEventListener("click", () => {
    if (window.innerWidth <= 720) {
      navLinks.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      const id = entry.target.getAttribute("id");
      links.forEach((link) => {
        link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
      });
    });
  },
  {
    rootMargin: "-45% 0px -45% 0px",
    threshold: 0.01
  }
);

sections.forEach((section) => observer.observe(section));

window.addEventListener("scroll", () => {
  if (window.scrollY > 300) {
    backToTopButton.classList.add("show");
  } else {
    backToTopButton.classList.remove("show");
  }
});

backToTopButton.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

const timelineExpand = document.getElementById("timelineExpand");
const timelineMore = document.getElementById("timelineMore");
const timelineExpandText = timelineExpand?.querySelector(".timeline-expand-text");

if (timelineExpand && timelineMore) {
  timelineExpand.addEventListener("click", () => {
    const isOpen = timelineExpand.getAttribute("aria-expanded") === "true";
    const willOpen = !isOpen;

    timelineExpand.setAttribute("aria-expanded", String(willOpen));
    timelineMore.classList.toggle("is-open", willOpen);
    timelineMore.setAttribute("aria-hidden", String(!willOpen));

    if (timelineExpandText) {
      timelineExpandText.textContent = willOpen ? "Hide earlier roles" : "Show earlier roles";
    }

    if (willOpen) {
      timelineMore.querySelectorAll(".timeline-card.reveal:not(.visible)").forEach((card) => {
        card.classList.add("visible");
      });
    }
  });
}

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!prefersReducedMotion) {
  document.querySelectorAll(".hero-grid > *").forEach((element, index) => {
    element.classList.add("hero-enter");
    element.style.setProperty("--hero-delay", `${0.1 + index * 0.12}s`);
  });

  requestAnimationFrame(() => {
    document.body.classList.add("page-loaded");
  });

  const revealTargets = document.querySelectorAll(
    "main .section h2, .subsection-title, .summary-text, .timeline-card, .skill-group, .language-list li, #contact .container > p, .contact-details li"
  );

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      });
    },
    {
      threshold: 0.12,
      rootMargin: "0px 0px -48px 0px"
    }
  );

  revealTargets.forEach((element, index) => {
    element.classList.add("reveal");
    element.style.setProperty("--reveal-delay", `${(index % 5) * 0.08}s`);
    revealObserver.observe(element);
  });
}
