function applyGrid(cols, showMeta) {
    const tbody = document.querySelector("tbody.sortable_listing");
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll("tr"));
    const grid = document.createElement("div");
    grid.className = "comic-grid";
    grid.style.setProperty("--cols", cols);

    rows.forEach(row => {
        const img = row.querySelector("img.cover_img");
        const meta = row.querySelector("td:nth-child(3)");

        if (img) {
            const item = document.createElement("div");
            item.className = "comic-item";

            // Cover image
            item.appendChild(img.cloneNode(true));

            // Metadata
            if (meta) {
                const metaDiv = document.createElement("div");
                metaDiv.className = "comic-meta";
                metaDiv.innerHTML = meta.innerHTML;
                if (!showMeta) metaDiv.classList.add("hidden");

                const toggle = document.createElement("button");
                toggle.textContent = "Toggle Info";
                toggle.onclick = () => metaDiv.classList.toggle("hidden");

                item.appendChild(toggle);
                item.appendChild(metaDiv);
            }

            grid.appendChild(item);
        }
    });

    tbody.replaceWith(grid);
}

// Load settings from storage
chrome.storage.sync.get({ cols: 4, showMeta: false }, (settings) => {
    applyGrid(settings.cols, settings.showMeta);
});

// Listen for changes from popup
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "updateSettings") {
        applyGrid(msg.cols, msg.showMeta);
    }
});

function injectToggleButton() {
    const btn = document.createElement("button");
    btn.id = "gridToggleBtn";
    btn.textContent = "Toggle Grid/Table";
    btn.style.position = "fixed";
    btn.style.top = "10px";
    btn.style.right = "10px";
    btn.style.zIndex = "9999";
    btn.style.padding = "8px 12px";
    btn.style.background = "#2727eb";
    btn.style.color = "#fff";
    btn.style.border = "none";
    btn.style.borderRadius = "4px";
    btn.style.cursor = "pointer";

    document.body.appendChild(btn);

    let gridActive = false;
    let originalTable = null;

    function toggleGrid() {
        const tbody = document.querySelector("tbody.sortable_listing");
        const grid = document.querySelector(".comic-grid");

        if (!gridActive && tbody) {
            originalTable = tbody.cloneNode(true);
            chrome.storage.sync.get({ cols: 4, showMeta: false }, (settings) => {
                applyGrid(settings.cols, settings.showMeta);
                gridActive = true;
            });
        } else if (gridActive && originalTable) {
            const gridContainer = document.querySelector(".comic-grid");
            if (gridContainer) {
                gridContainer.replaceWith(originalTable);
            }
            gridActive = false;
        }
    }

    btn.addEventListener("click", toggleGrid);

    // Keyboard shortcut: press "G" to toggle
    document.addEventListener("keydown", (e) => {
        if (e.key.toLowerCase() === "g" && !e.ctrlKey && !e.altKey && !e.metaKey) {
            toggleGrid();
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    injectToggleButton();
    chrome.storage.sync.get({ cols: 4, showMeta: false }, (settings) => {
        applyGrid(settings.cols, settings.showMeta);
    });
});
