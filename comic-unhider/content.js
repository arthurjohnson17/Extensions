(function () {
    console.log("[Comic Variant Unhider] Loaded");

    let observer = null;

    function unhideVariants() {
        const hiddenItems = document.querySelectorAll("li.issue.variant-collapsed.hidden");
        hiddenItems.forEach(el => {
            el.classList.remove("hidden");
            el.style.display = "";
        });
        console.log(`[Comic Variant Unhider] Unhid ${hiddenItems.length} items`);
    }

    function hideVariants() {
        const items = document.querySelectorAll("li.issue.variant-collapsed:not(.hidden)");
        items.forEach(el => {
            el.classList.add("hidden");
            el.style.display = "none";
        });
        console.log(`[Comic Variant Unhider] Hid ${items.length} items`);
    }

    function loadLazyImages() {
        const lazyImgs = document.querySelectorAll("img.lazy");

        lazyImgs.forEach(img => {
            const realSrc = img.dataset.src || img.dataset.original;
            if (realSrc) {
                img.src = realSrc;
                img.removeAttribute("data-src");
                img.classList.add("loaded");
            }
            img.loading = "eager";
            img.decoding = "sync";
        });

        console.log(`[Comic Variant Unhider] Forced load on ${lazyImgs.length} images`);
    }

    function applyState(enabled) {
        if (enabled) {
            unhideVariants();
            loadLazyImages();
        } else {
            hideVariants();
        }
    }

    function enableObserver() {
        if (observer) return;

        observer = new MutationObserver(() => {
            chrome.storage.sync.get({ unhideVariants: true }, (data) => {
                applyState(data.unhideVariants);
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log("[Comic Variant Unhider] MutationObserver enabled");
    }

    function disableObserver() {
        if (observer) {
            observer.disconnect();
            observer = null;
            console.log("[Comic Variant Unhider] MutationObserver disabled");
        }
    }

    // Listen for popup changes
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.unhideVariants) {
            applyState(changes.unhideVariants.newValue);
        }
        if (changes.enableObserver) {
            changes.enableObserver.newValue ? enableObserver() : disableObserver();
        }
    });

    // Listen for keyboard shortcut
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.command === "toggle-variants") {
            chrome.storage.sync.get({ unhideVariants: true }, (data) => {
                chrome.storage.sync.set({ unhideVariants: !data.unhideVariants });
            });
        }
    });

    // Initial load
    chrome.storage.sync.get(
        { unhideVariants: true, enableObserver: true },
        (data) => {
            applyState(data.unhideVariants);
            if (data.enableObserver) enableObserver();
        }
    );
})();
