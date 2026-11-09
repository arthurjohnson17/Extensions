document.getElementById('scrapeBtn').addEventListener('click', async () => {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = 'Starting multi-page scrape...';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: scrapeAllPagesAndDownload,
  }, (results) => {
    if (chrome.runtime.lastError) {
      statusDiv.textContent = 'Error: ' + chrome.runtime.lastError.message;
      return;
    }
    const data = results && results[0] ? results[0].result : { count: 0 };
    statusDiv.textContent = `Done! Downloaded ${data.count} images across pages.`;
  });
});

async function scrapeAllPagesAndDownload() {
  const allCardsMap = new Map(); // Use Map to prevent duplicates by card number/URL

  function extractCurrentPageCards() {
    const items = document.querySelectorAll('.cardlistCol .image_lists_item');
    items.forEach((item, index) => {
      const cardNoEl = item.querySelector('.cardNo');
      let cardNo = cardNoEl ? cardNoEl.textContent.trim().replace(/\s+/g, '_') : `card_${index}`;

      const isParallel = item.querySelector('.cardParallel') || item.querySelector('.parallel_icon');
      if (isParallel && !cardNo.includes('P')) {
        cardNo += '_P1';
      }

      const imgElement = item.querySelector('.cardImgInner img') || item.querySelector('.card_img img');
      if (imgElement) {
        let rawSrc = imgElement.getAttribute('data-src') || imgElement.getAttribute('src');
        if (rawSrc && !rawSrc.startsWith('javascript')) {
          const absoluteUrl = new URL(rawSrc, window.location.href).href;
          const urlWithoutQuery = absoluteUrl.split('?')[0];
          const ext = urlWithoutQuery.substring(urlWithoutQuery.lastIndexOf('.')) || '.png';
          
          allCardsMap.set(absoluteUrl, {
            url: absoluteUrl,
            filename: `${cardNo}${ext}`
          });
        }
      }
    });
  }

  // 1. Scrape the first page
  extractCurrentPageCards();

  // 2. Loop through pagination "Next" buttons until none remain
  let hasNextPage = true;
  let safetyCounter = 0; // Prevent infinite loops

  while (hasNextPage && safetyCounter < 50) {
    safetyCounter++;
    
    // Look for common pagination next button selectors (adjust if your specific site uses a different selector like '.next', '.pager_next', etc.)
    const nextBtn = document.querySelector('.pager_next, .pagination .next, a[rel="next"], .nextPage');
    
    // Check if next button exists and is clickable/active
    if (nextBtn && !nextBtn.classList.contains('disabled') && nextBtn.offsetParent !== null) {
      // Store current first card's HTML or identifier to detect when the page has successfully changed
      const firstCardBefore = document.querySelector('.cardlistCol .image_lists_item')?.innerHTML;

      nextBtn.click();

      // Wait for new page content to load
      let loaded = false;
      let attempts = 0;
      while (!loaded && attempts < 20) {
        await new Promise(r => setTimeout(r, 300)); // wait 300ms chunks
        const firstCardAfter = document.querySelector('.cardlistCol .image_lists_item')?.innerHTML;
        if (firstCardAfter && firstCardAfter !== firstCardBefore) {
          loaded = true;
        }
        attempts++;
      }

      if (loaded) {
        extractCurrentPageCards();
      } else {
        hasNextPage = false; // Timed out waiting for next page
      }
    } else {
      hasNextPage = false;
    }
  }

  // 3. Trigger downloads for all collected unique cards
  const cardsArray = Array.from(allCardsMap.values());
  for (const card of cardsArray) {
    try {
      const res = await fetch(card.url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = card.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      
      // Small delay between downloads to prevent browser throttling
      await new Promise(r => setTimeout(r, 150));
    } catch (err) {
      console.error('Failed to download:', card.url, err);
    }
  }

  return { count: cardsArray.length };
}