document.addEventListener("DOMContentLoaded", () => {
    const colsInput = document.getElementById("cols");
    const showMetaInput = document.getElementById("showMeta");

    // Load saved settings
    chrome.storage.sync.get({ cols: 4, showMeta: false }, (settings) => {
        colsInput.value = settings.cols;
        showMetaInput.checked = settings.showMeta;
    });

    document.getElementById("save").addEventListener("click", () => {
        const cols = parseInt(colsInput.value, 10);
        const showMeta = showMetaInput.checked;

        chrome.storage.sync.set({ cols, showMeta });

        // Notify content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { type: "updateSettings", cols, showMeta });
        });
    });
});
