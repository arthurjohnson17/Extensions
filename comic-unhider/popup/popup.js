const toggle = document.getElementById("toggle");
const observerToggle = document.getElementById("observerToggle");

chrome.storage.sync.get(
    { unhideVariants: true, enableObserver: true },
    (data) => {
        toggle.checked = data.unhideVariants;
        observerToggle.checked = data.enableObserver;
    }
);

toggle.addEventListener("change", () => {
    chrome.storage.sync.set({ unhideVariants: toggle.checked });
});

observerToggle.addEventListener("change", () => {
    chrome.storage.sync.set({ enableObserver: observerToggle.checked });
});
