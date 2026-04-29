chrome.commands.onCommand.addListener((command) => {
    if (command === "toggle-variants") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { command: "toggle-variants" });
        });
    }
});
