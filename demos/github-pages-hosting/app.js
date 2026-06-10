const SAMPLE_INDEX = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Static Site</title>
</head>
<body>
  <h1>Hello, GitHub Pages</h1>
  <p>Deployed from a static HTML repo.</p>
</body>
</html>`;

function sanitizeSegment(value, fallback) {
    const trimmed = String(value ?? "").trim().replace(/\s+/g, "-");
    return trimmed || fallback;
}

function getSiteType() {
    return document.querySelector('input[name="siteType"]:checked')?.value ?? "project";
}

function getConfig() {
    const username = sanitizeSegment(document.getElementById("githubUser")?.value, "username");
    const branch = sanitizeSegment(document.getElementById("branchName")?.value, "main");
    const publishFolder = document.getElementById("publishFolder")?.value ?? "root";
    const siteType = getSiteType();

    let repo = sanitizeSegment(document.getElementById("repoName")?.value, "my-static-site");
    if (siteType === "user") {
        repo = `${username}.github.io`;
    }

    const baseUrl =
        siteType === "user"
            ? `https://${username}.github.io/`
            : `https://${username}.github.io/${repo}/`;

    const settingsPath = `github.com/${username}/${repo}/settings/pages`;
    const settingsUrl = `https://${settingsPath}`;
    const repoUrl = `https://github.com/${username}/${repo}`;

    const folderLabel = publishFolder === "docs" ? "/docs" : "/ (root)";
    const pagesSourceFolder = publishFolder === "docs" ? "/docs" : "/ (root)";

    return {
        username,
        repo,
        branch,
        publishFolder,
        siteType,
        baseUrl,
        settingsPath,
        settingsUrl,
        repoUrl,
        folderLabel,
        pagesSourceFolder
    };
}

function buildFileTree(config) {
    if (config.publishFolder === "docs") {
        return [
            `${config.repo}/`,
            "├── README.md",
            "└── docs/",
            "    ├── index.html",
            "    ├── styles.css",
            "    └── 404.html"
        ].join("\n");
    }

    return [
        `${config.repo}/`,
        "├── README.md",
        "├── index.html",
        "├── styles.css",
        "└── 404.html"
    ].join("\n");
}

function buildGitCommands(config) {
    const initBlock = [
        "git init",
        "git add .",
        `git commit -m "Initial static site"`,
        `git branch -M ${config.branch}`,
        `git remote add origin https://github.com/${config.username}/${config.repo}.git`,
        `git push -u origin ${config.branch}`
    ];

    const existingBlock = [
        "git add .",
        `git commit -m "Publish static site"`,
        `git push origin ${config.branch}`
    ];

    return `${initBlock.join("\n")}\n\n# If the repo already exists locally, use:\n${existingBlock.join("\n")}`;
}

function setText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
}

function setHref(id, href) {
    const element = document.getElementById(id);
    if (element) element.href = href;
}

function updateDemo() {
    const config = getConfig();

    if (getSiteType() === "user") {
        const repoInput = document.getElementById("repoName");
        if (repoInput) {
            repoInput.value = `${config.username}.github.io`;
            repoInput.readOnly = true;
        }
    } else {
        const repoInput = document.getElementById("repoName");
        if (repoInput) {
            repoInput.readOnly = false;
            if (repoInput.value.endsWith(".github.io")) {
                repoInput.value = "my-static-site";
            }
        }
    }

    const refreshed = getConfig();

    setText("liveUrl", refreshed.baseUrl);
    setHref("liveUrl", refreshed.baseUrl);
    setText("settingsPath", refreshed.settingsPath);
    setHref("settingsLink", refreshed.settingsUrl);
    setText("pagesSourceBranch", refreshed.branch);
    setText("pagesSourceFolder", refreshed.pagesSourceFolder);
    setHref("finalUrl", refreshed.baseUrl);
    setText("userRepoHint", `${refreshed.username}.github.io`);
    setText("fileTree", buildFileTree(refreshed));
    setText("gitCommands", buildGitCommands(refreshed));
    setText("sampleIndexHtml", SAMPLE_INDEX);
    setText("sampleAddress", refreshed.baseUrl.replace(/^https?:\/\//, ""));
    setHref("sampleLink", refreshed.baseUrl);
}

async function copyBlock(blockId, statusId = "toolStatus") {
    const block = document.getElementById(blockId);
    const status = document.getElementById(statusId);
    const text = block?.textContent?.trim();

    if (!text) {
        if (status) status.textContent = "Nothing to copy.";
        return;
    }

    try {
        await navigator.clipboard.writeText(text);
        if (status) {
            status.textContent = "Copied to clipboard.";
            status.classList.add("success");
        }
    } catch {
        if (status) status.textContent = "Copy failed. Select the text and copy manually.";
    }
}

function initGithubPagesDemo() {
    const inputs = [
        document.getElementById("githubUser"),
        document.getElementById("repoName"),
        document.getElementById("branchName"),
        document.getElementById("publishFolder")
    ];

    inputs.forEach((input) => input?.addEventListener("input", updateDemo));
    inputs.forEach((input) => input?.addEventListener("change", updateDemo));

    document.querySelectorAll('input[name="siteType"]').forEach((input) => {
        input.addEventListener("change", updateDemo);
    });

    document.querySelectorAll(".ghpages-copy").forEach((button) => {
        button.addEventListener("click", () => {
            const blockId = button.dataset.copy;
            if (blockId) copyBlock(blockId);
        });
    });

    updateDemo();
}

initGithubPagesDemo();
