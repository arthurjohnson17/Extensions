document.getElementById('scrapeBtn').addEventListener('click', async () => {
  const statusDiv = document.getElementById('status');
  const countInfo = document.getElementById('countInfo');
  const progressBar = document.getElementById('progressBar');
  const progressContainer = document.getElementById('progressContainer');
  const scrapeBtn = document.getElementById('scrapeBtn');

  scrapeBtn.disabled = true;
  progressContainer.style.display = 'block';
  progressBar.style.width = '0%';
  countInfo.textContent = '0%';
  statusDiv.textContent = 'Starting multi-page hash scrape...';

  const messageListener = (message) => {
    if (message.action === 'update_progress') {
      const { current, total, phase, percent } = message;
      progressBar.style.width = `${percent}%`;
      countInfo.textContent = `${percent}%`;
      
      if (phase === 'scraping') {
        statusDiv.textContent = `Scraping page #${current}... (${total} total cards stored)`;
      } else if (phase === 'zipping') {
        statusDiv.textContent = `Packaging image ${current} of ${total} into ZIP...`;
      }
    }
  };

  chrome.runtime.onMessage.addListener(messageListener);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['jszip.min.js']
  }, () => {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeAndZipHashPages,
    }, (results) => {
      chrome.runtime.onMessage.removeListener(messageListener);
      scrapeBtn.disabled = false;

      if (chrome.runtime.lastError) {
        statusDiv.textContent = 'Error: ' + chrome.runtime.lastError.message;
        return;
      }

      const data = results && results[0] ? results[0].result : { count: 0 };
      progressBar.style.width = '100%';
      countInfo.textContent = '100%';
      statusDiv.textContent = `Complete! Zipped and downloaded ${data.count} images!`;
    });
  });
});

async function scrapeAndZipHashPages() {
  const allCardsMap = new Map();

  function sendProgress(phase, current, total, percent) {
    chrome.runtime.sendMessage({
      action: 'update_progress',
      phase,
      current,
      total,
      percent: Math.min(100, Math.round(percent))
    });
  }

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

  // Determine current page index from URL hash (e.g. #page-1 -> 1)
  let currentPageNum = 1;
  const match = window.location.hash.match(/page-(\d+)/);
  if (match) {
    currentPageNum = parseInt(match[1], 10);
  }

  // 1. Scraping Phase across hash pages
  let hasNextPage = true;
  let safetyCounter = 0;

  while (hasNextPage && safetyCounter < 50) {
    safetyCounter++;
    
    // Scrape current page cards
    extractCurrentPageCards();
    sendProgress('scraping', currentPageNum, allCardsMap.size, Math.min(45, safetyCounter * 5));

    // Try finding next page element in pagination list or incrementing page hash
    const nextBtn = document.querySelector(`.pager_next, .pagination a[href*="page-${currentPageNum + 1}"], .nextPage`);
    const pageTargetHash = `#page-${currentPageNum + 1}`;

    const firstCardBefore = document.querySelector('.cardlistCol .image_lists_item')?.innerHTML;

    if (nextBtn && nextBtn.offsetParent !== null && !nextBtn.classList.contains('disabled')) {
      nextBtn.click();
    } else {
      // Direct Hash Navigation fallback for URL-based hash routers
      window.location.hash = pageTargetHash;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }

    // Wait for DOM to update with new page content
    let loaded = false;
    let attempts = 0;
    while (!loaded && attempts < 25) {
      await new Promise(r => setTimeout(r, 250));
      const firstCardAfter = document.querySelector('.cardlistCol .image_lists_item')?.innerHTML;
      if (firstCardAfter && firstCardAfter !== firstCardBefore) {
        loaded = true;
      }
      attempts++;
    }

    if (loaded) {
      currentPageNum++;
    } else {
      hasNextPage = false; // Stop when no new items load
    }
  }

  // 2. Zipping Phase (50% to 100%)
  const zip = new JSZip();
  const cardsArray = Array.from(allCardsMap.values());
  const totalCards = cardsArray.length;

  for (let i = 0; i < totalCards; i++) {
    const card = cardsArray[i];
    try {
      const res = await fetch(card.url);
      const blob = await res.blob();
      zip.file(card.filename, blob);
    } catch (err) {
      console.error('Failed to fetch image for zip:', card.url, err);
    }

    const currentPercent = 50 + Math.round(((i + 1) / totalCards) * 45);
    sendProgress('zipping', i + 1, totalCards, currentPercent);
  }

  sendProgress('zipping', totalCards, totalCards, 98);
  const zipContent = await zip.generateAsync({ type: 'blob' });
  
  const blobUrl = URL.createObjectURL(zipContent);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = 'digimon_cards.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);

  sendProgress('zipping', totalCards, totalCards, 100);
  return { count: totalCards };
}