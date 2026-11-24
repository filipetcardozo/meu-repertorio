/* global chrome */
const cifraOrigin = 'https://www.cifraclub.com.br';
const songPath = /^\/[a-z0-9-]+\/[a-z0-9-]+\/(?:(?:u\/)?[a-z0-9-]+\.html)?$/i;
const appOrigins = new Set([
  'https://tocamaisuma.com.br',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

function getUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function waitForTab(tabId) {
  return new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      if (error) reject(error);
      else resolve();
    };

    const checkLoaded = (tab) => {
      if (tab.status === 'complete' && getUrl(tab.url)?.origin === cifraOrigin) finish();
    };
    const onUpdated = (updatedId, _change, tab) => {
      if (updatedId === tabId) checkLoaded(tab);
    };
    const onRemoved = (removedId) => {
      if (removedId === tabId) finish(new Error('A aba da cifra foi fechada.'));
    };
    const timeout = setTimeout(() => finish(new Error('A página da cifra demorou para carregar.')), 12000);

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    chrome.tabs.get(tabId).then(checkLoaded, finish);
  });
}

// Esta função roda na aba da música, em um ambiente isolado.
function readCifraPage(expectedOrigin) {
  if (location.origin !== expectedOrigin) return null;
  const status = performance.getEntriesByType('navigation')[0]?.responseStatus;
  if (status >= 400) return { error: `O Cifra Club respondeu com HTTP ${status} no navegador.` };

  const pre = document.querySelector('pre[data-chord-content]') ?? document.querySelector('pre:has(b), pre:has(strong), pre:has(span.tab)');
  if (!pre?.textContent.trim()) return null;

  function serialize(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    if (node.nodeType !== Node.ELEMENT_NODE || node.matches('script, style, template')) return '';
    if (node.matches('br')) return '\n';
    const children = Array.from(node.childNodes, serialize).join('');
    if (node.matches('b, strong')) return `<b>${children}</b>`;
    if (node.matches('span.tab, span.tablatura')) return `<span class="tab">${children}</span>`;
    return children;
  }

  const title = document.querySelector('title')?.outerHTML ?? '';
  const ogTitle = document.querySelector('meta[property="og:title"]')?.outerHTML ?? '';
  const key = document.querySelector('#key, #cifra_tom')?.outerHTML ?? '';
  const metadata = Array.from(document.scripts, (script) => script.textContent)
    .filter((script) => script.includes('self.__next_f.push([1,'))
    .join('\n');

  return {
    html: `${title}${ogTitle}${key}<pre data-chord-content>${serialize(pre)}</pre>${metadata}`,
    url: location.href,
  };
}

async function importSong(url) {
  const tab = await chrome.tabs.create({ url, active: false });
  try {
    await waitForTab(tab.id);
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: readCifraPage,
      args: [cifraOrigin],
    });
    const page = injection?.result;
    if (page?.error) return page;
    if (!page || !songPath.test(getUrl(page.url)?.pathname ?? '')) {
      throw new Error('A cifra não ficou disponível no navegador. Tente novamente.');
    }
    return page;
  } finally {
    await chrome.tabs.remove(tab.id).catch(() => {});
  }
}

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  const source = getUrl(sender.url);
  if (!source || !appOrigins.has(source.origin) || message?.type !== 'cifra:import') return false;

  const url = getUrl(message.url);
  if (!url || url.origin !== cifraOrigin || !songPath.test(url.pathname) || url.username || url.password) {
    sendResponse({ error: 'O link precisa ser de uma cifra do Cifra Club.' });
    return false;
  }

  importSong(`${cifraOrigin}${url.pathname}`).then(sendResponse, (error) => {
    sendResponse({ error: error?.message || 'A extensão não conseguiu carregar a cifra.' });
  });
  return true;
});
