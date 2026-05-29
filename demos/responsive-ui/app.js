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
            behavior: "Single column, sidebar hidden",
            why: "Small screens need focus and readability. Hiding secondary navigation prevents visual overload.",
            rule: "@container (max-width: 767px) { .responsive-sidebar { display: none; } .responsive-main { grid-template-columns: 1fr; } }"
        };
    }

    if (width < 1024) {
        return {
            label: "Tablet",
            behavior: "Sidebar visible, 2 content columns",
            why: "Tablet has enough width for navigation and denser content, but still benefits from fewer columns.",
            rule: "@container (max-width: 1023px) { .responsive-main { grid-template-columns: repeat(2, minmax(0, 1fr)); } }"
        };
    }

    return {
        label: "PC",
        behavior: "Sidebar visible, 3 content columns",
        why: "Desktop screens can show navigation and more data at once, improving scanning speed and efficiency.",
        rule: "Default layout: .responsive-app { grid-template-columns: 260px 1fr; } .responsive-main { grid-template-columns: repeat(3, minmax(0, 1fr)); }"
    };
}

function initResponsiveDemo() {
    const stage = document.getElementById("demoStage");
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
