/* global chrome */
const cifraOrigin = 'https://www.cifraclub.com.br';
const songPath = /^\/[a-z0-9-]+\/[a-z0-9-]+\/(?:(?:u\/)?[a-z0-9-]+\.html)?$/i;
const appOrigins = new Set([
  'https://tocamaisuma.com.br',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

/**
 * Páginas que o app pode pedir com "source:fetch": só busca e página de música de cada site.
 * (O Cifra Club continua no "cifra:import", que lê a página já montada.)
 */
const fetchablePages = {
  'https://www.cifras.com.br': [/^\/api\/search$/, /^\/cifra\/[a-z0-9-]+\/[a-z0-9-]+\/?$/i],
  'https://www.ultimate-guitar.com': [/^\/search\.php$/],
  'https://tabs.ultimate-guitar.com': [/^\/tab\/[a-z0-9-]+(?:\/[a-z0-9-]+)?\/?$/i],
};

function getUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isFetchable(url) {
  if (!url || url.protocol !== 'https:' || url.username || url.password || url.port) return false;
  return (fetchablePages[url.origin] ?? []).some((re) => re.test(url.pathname));
}

function waitForTab(tabId, origin) {
  return new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      if (error) reject(error);
      else resolve();
    };

    const checkLoaded = (tab) => {
      if (tab.status === 'complete' && getUrl(tab.url)?.origin === origin) finish();
    };
    const onUpdated = (updatedId, _change, tab) => {
      if (updatedId === tabId) checkLoaded(tab);
    };
    const onRemoved = (removedId) => {
      if (removedId === tabId) finish(new Error('A aba da cifra foi fechada.'));
    };
    const timeout = setTimeout(() => finish(new Error('A página da cifra demorou para carregar.')), 15000);

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
    await waitForTab(tab.id, cifraOrigin);
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

// Roda na aba aberta: pede a mesma página de novo (já liberada pelo site) e devolve o HTML bruto.
async function readRawPage() {
  const res = await fetch(location.href, { credentials: 'include' });
  return { html: await res.text(), url: location.href, status: res.status };
}

/** Página como o navegador do usuário recebe: pedido direto e, se o site barrar, por uma aba em segundo plano. */
async function fetchPage(url) {
  try {
    const res = await fetch(url.href, { credentials: 'include', redirect: 'follow' });
    const finalUrl = getUrl(res.url);
    if (res.ok && isFetchable(finalUrl)) return { html: await res.text(), url: res.url, status: res.status };
  } catch {
    // segue para a aba
  }

  const tab = await chrome.tabs.create({ url: url.href, active: false });
  try {
    await waitForTab(tab.id, url.origin);
    const [injection] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readRawPage });
    const page = injection?.result;
    if (!page || !isFetchable(getUrl(page.url))) throw new Error('A página não ficou disponível no navegador. Tente novamente.');
    if (page.status >= 400) return { error: `O site respondeu com HTTP ${page.status}.` };
    return page;
  } finally {
    await chrome.tabs.remove(tab.id).catch(() => {});
  }
}

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  const source = getUrl(sender.url);
  if (!source || !appOrigins.has(source.origin)) return false;

  if (message?.type === 'ping') {
    sendResponse({ ok: true, version: chrome.runtime.getManifest().version, fetch: true });
    return false;
  }

  if (message?.type === 'source:fetch') {
    const url = getUrl(message.url);
    if (!isFetchable(url)) {
      sendResponse({ error: 'Este endereço não é de uma fonte de cifras suportada.' });
      return false;
    }
    fetchPage(url).then(sendResponse, (error) => {
      sendResponse({ error: error?.message || 'A extensão não conseguiu carregar a página.' });
    });
    return true;
  }

  if (message?.type !== 'cifra:import') return false;

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
