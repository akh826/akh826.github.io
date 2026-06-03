function setDemoStatus(statusElement, message, isSuccess = false) {
    if (!statusElement) {
        return;
    }

    statusElement.textContent = message;
    statusElement.classList.toggle("success", isSuccess);
}

function describeBreakpoint(width) {
    if (width < 768) {
        return {
            label: "Mobile",
            behavior: "Menu button + drawer nav, 1 content column",
            why: "Small screens keep primary content full width. Navigation stays available through a familiar menu button and overlay drawer.",
            rule: "@container (max-width: 1023px) { .responsive-menu-toggle { display: inline-flex; } .responsive-sidebar { position: absolute; transform: translateX(-100%); } .responsive-app.nav-open .responsive-sidebar { transform: translateX(0); } } @container (max-width: 767px) { .responsive-main { grid-template-columns: 1fr; } }"
        };
    }

    if (width < 1024) {
        return {
            label: "Tablet",
            behavior: "Menu button + drawer nav, 2 content columns",
            why: "Tablet balances density and touch targets. A drawer preserves navigation without permanently consuming horizontal space.",
            rule: "@container (max-width: 1023px) { .responsive-app { grid-template-columns: 1fr; } .responsive-menu-toggle { display: inline-flex; } .responsive-sidebar { transform: translateX(-100%); } .responsive-main { grid-template-columns: repeat(2, minmax(0, 1fr)); } }"
        };
    }

    return {
        label: "PC",
        behavior: "Fixed sidebar, header actions, 3 content columns",
        why: "Desktop screens can show navigation and more data at once, improving scanning speed and efficiency.",
        rule: "Default layout: .responsive-app { grid-template-columns: 260px 1fr; } .responsive-main { grid-template-columns: repeat(3, minmax(0, 1fr)); }"
    };
}

function initPreviewNavigation(app, menuToggle, backdrop) {
    const navItems = app?.querySelectorAll(".responsive-nav li");

    function closeNav() {
        app?.classList.remove("nav-open");
        menuToggle?.setAttribute("aria-expanded", "false");
        menuToggle?.setAttribute("aria-label", "Open navigation menu");
        if (backdrop) {
            backdrop.hidden = true;
        }
    }

    function openNav() {
        app?.classList.add("nav-open");
        menuToggle?.setAttribute("aria-expanded", "true");
        menuToggle?.setAttribute("aria-label", "Close navigation menu");
        if (backdrop) {
            backdrop.hidden = false;
        }
    }

    menuToggle?.addEventListener("click", () => {
        if (app?.classList.contains("nav-open")) {
            closeNav();
            return;
        }

        openNav();
    });

    backdrop?.addEventListener("click", closeNav);

    navItems?.forEach((item) => {
        item.addEventListener("click", closeNav);
    });

    return { closeNav };
}

function initResponsiveDemo() {
    const stage = document.getElementById("demoStage");
    const app = document.getElementById("responsiveApp");
    const menuToggle = document.getElementById("previewMenuToggle");
    const backdrop = document.getElementById("navBackdrop");
    const previewNav = initPreviewNavigation(app, menuToggle, backdrop);
    const widthRange = document.getElementById("widthRange");
    const widthValue = document.getElementById("widthValue");
    const activeWidth = document.getElementById("activeWidth");
    const breakpointLabel = document.getElementById("breakpointLabel");
    const layoutBehavior = document.getElementById("layoutBehavior");
    const chipSize = document.getElementById("chipSize");
    const status = document.getElementById("toolStatus");
    const explainSummary = document.getElementById("explainSummary");
    const whyItWorksText = document.getElementById("whyItWorksText");
    const activeRuleBlock = document.getElementById("activeRuleBlock");
    const deviceButtons = document.querySelectorAll(".demo-device-btn");

    if (!stage || !widthRange) {
        return;
    }

    function setActiveButton(width) {
        deviceButtons.forEach((button) => {
            const buttonWidth = Number.parseInt(button.dataset.width || "0", 10);
            button.classList.toggle("active", buttonWidth === width);
        });
    }

    function renderState(width) {
        stage.style.width = `${width}px`;

        if (width >= 1024) {
            previewNav?.closeNav();
        }

        const summary = describeBreakpoint(width);

        if (widthValue) {
            widthValue.textContent = `${width} px`;
        }

        if (activeWidth) {
            activeWidth.textContent = `${width} px`;
        }

        if (breakpointLabel) {
            breakpointLabel.textContent = summary.label;
        }

        if (layoutBehavior) {
            layoutBehavior.textContent = summary.behavior;
        }

        if (chipSize) {
            chipSize.textContent = summary.label;
        }

        if (explainSummary) {
            explainSummary.textContent = `At ${width}px, the ${summary.label} rule set is active: ${summary.behavior}.`;
        }

        if (whyItWorksText) {
            whyItWorksText.textContent = summary.why;
        }

        if (activeRuleBlock) {
            activeRuleBlock.textContent = summary.rule;
        }

        setDemoStatus(status, `Preview updated to ${width}px (${summary.label}).`, true);
    }

    function updateFromRange() {
        const width = Number.parseInt(widthRange.value, 10);
        renderState(width);
        setActiveButton(width);
    }

    widthRange.addEventListener("input", updateFromRange);

    deviceButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const width = Number.parseInt(button.dataset.width || "1024", 10);
            widthRange.value = String(width);
            renderState(width);
            setActiveButton(width);
        });
    });

    renderState(Number.parseInt(widthRange.value, 10));
    setActiveButton(Number.parseInt(widthRange.value, 10));
}

document.addEventListener("DOMContentLoaded", initResponsiveDemo);
