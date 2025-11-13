const AVAILABLE_TRANSLATIONS = [
  'AKJV',
  'AMP',
  'ASV',
  'BRG',
  'CSB',
  'EHV',
  'ESV',
  'ESVUK',
  'GNV',
  'GW',
  'ISV',
  'JUB',
  'KJ21',
  'KJV',
  'LEB',
  'MEV',
  'NASB',
  'NASB1995',
  'NET',
  'NIV',
  'NIVUK',
  'NKJV',
  'NLT',
  'NLV',
  'NOG',
  'NRSV',
  'NRSVUE',
  'WEB',
  'YLT',
];

const DEFAULT_TRANSLATION = 'NASB';
const TRANSLATION_STORAGE_KEY = 'preferredTranslation';

let currentTranslation = DEFAULT_TRANSLATION;
const translationCache = new Map();
let popover;
let headerTitle;
let verseTextContainer;
let closeButton;
let activeReference = null;

const TRANSLATION_PICKER_SELECTOR = '[data-translation-picker]';

document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem(TRANSLATION_STORAGE_KEY);
  if (saved && AVAILABLE_TRANSLATIONS.includes(saved)) {
    currentTranslation = saved;
  }

  initializeTranslationSelector();
  initializeScriptureReferences();
});

function initializeTranslationSelector() {
  const picker = document.querySelector(TRANSLATION_PICKER_SELECTOR);
  if (!picker) {
    return;
  }

  const select = picker.querySelector('#translation-select');
  const label = picker.querySelector('label[for="translation-select"]');
  const helper = picker.querySelector('[data-translation-helper]');
  if (!select) {
    return;
  }

  select.innerHTML = '';
  AVAILABLE_TRANSLATIONS.forEach((code) => {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = code;
    select.appendChild(option);
  });

  select.value = currentTranslation;
  if (label) {
    label.textContent = 'Preferred Translation';
  }
  if (helper) {
    helper.textContent = 'Verses render using your selected translation. Default is NASB.';
  }

  select.addEventListener('change', async (event) => {
    currentTranslation = event.target.value;
    localStorage.setItem(TRANSLATION_STORAGE_KEY, currentTranslation);
    if (activeReference) {
      await openPopover(activeReference, true);
    }
  });
}

function initializeScriptureReferences() {
  const references = document.querySelectorAll('.scripture-ref');
  if (!references.length) {
    return;
  }

  popover = document.createElement('div');
  popover.className = 'verse-popover';
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-modal', 'false');
  popover.innerHTML = `
    <div class="verse-popover__header">
      <h4></h4>
      <button type="button" class="verse-popover__close" aria-label="Close verse popup">&times;</button>
    </div>
    <p></p>
  `;
  document.body.appendChild(popover);

  headerTitle = popover.querySelector('h4');
  verseTextContainer = popover.querySelector('p');
  closeButton = popover.querySelector('.verse-popover__close');

  references.forEach((ref) => {
    ref.setAttribute('tabindex', '0');
    ref.setAttribute('role', 'button');
    ref.setAttribute('aria-expanded', 'false');

    ref.addEventListener('click', async (event) => {
      event.preventDefault();
      if (ref === activeReference) {
        closePopover();
      } else {
        await openPopover(ref, false);
      }
    });

    ref.addEventListener('keydown', async (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (ref === activeReference) {
          closePopover();
        } else {
          await openPopover(ref, false);
        }
      }
      if (event.key === 'Escape' && activeReference) {
        closePopover();
      }
    });
  });

  closeButton.addEventListener('click', () => closePopover());

  document.addEventListener('click', (event) => {
    if (!popover.contains(event.target) && !event.target.classList.contains('scripture-ref')) {
      closePopover();
    }
  });

  window.addEventListener('resize', () => {
    if (activeReference) {
      positionPopover(activeReference);
    }
  });

  window.addEventListener(
    'scroll',
    () => {
      if (activeReference) {
        positionPopover(activeReference);
      }
    },
    { passive: true },
  );
}

async function openPopover(target, isRefresh) {
  const verseLabel = target.dataset.verseLabel || target.textContent.trim();
  activeReference = target;
  activeReference.setAttribute('aria-expanded', 'true');

  if (!isRefresh) {
    displayPopover(verseLabel, 'Loading verse...', currentTranslation, false);
  }
  positionPopover(target);

  try {
    const translationData = await loadTranslationData(currentTranslation);
    const parsed = parseReference(verseLabel);
    if (!parsed) {
      throw new Error('Unable to parse verse reference');
    }
    const verseText = extractVerseText(translationData, parsed);
    displayPopover(verseLabel, verseText, currentTranslation, false);
    positionPopover(target);
  } catch (error) {
    console.error('Unable to load verse', error);
    displayPopover(
      verseLabel,
      'Unable to load this verse for the selected translation. If you are viewing the site from the filesystem (file://), please serve it over http:// or https:// to allow fetching translation files.',
      currentTranslation,
      true,
    );
    positionPopover(target);
  }
}

function closePopover() {
  if (!popover) {
    return;
  }
  popover.classList.remove('active', 'verse-popover--error');
  if (activeReference) {
    activeReference.setAttribute('aria-expanded', 'false');
    activeReference = null;
  }
}

function displayPopover(label, text, translation, isError) {
  if (!popover) {
    return;
  }
  headerTitle.textContent = `${label} (${translation})`;
  verseTextContainer.textContent = text;
  popover.classList.add('active');
  popover.classList.toggle('verse-popover--error', Boolean(isError));
}

function positionPopover(target) {
  const targetRect = target.getBoundingClientRect();
  const popRect = popover.getBoundingClientRect();
  let top = targetRect.bottom + window.scrollY + 12;
  let left = targetRect.left + window.scrollX;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  if (left + popRect.width > window.scrollX + viewportWidth - 20) {
    left = window.scrollX + viewportWidth - popRect.width - 20;
  }

  if (left < window.scrollX + 16) {
    left = window.scrollX + 16;
  }

  if (top + popRect.height > window.scrollY + viewportHeight - 20) {
    top = targetRect.top + window.scrollY - popRect.height - 16;
  }

  if (top < window.scrollY + 16) {
    top = window.scrollY + 16;
  }

  popover.style.top = `${top}px`;
  popover.style.left = `${left}px`;
}

async function loadTranslationData(code) {
  if (translationCache.has(code)) {
    return translationCache.get(code);
  }

  const url = new URL(`bible-translations/${code}/${code}_bible.json`, window.location.origin).toString();
  const response = await fetch(url, { cache: 'force-cache' });
  if (!response.ok) {
    throw new Error(`Failed to load ${code} translation (${response.status})`);
  }
  const rawData = await response.json();
  const normalizedData = {};
  Object.keys(rawData).forEach((book) => {
    if (rawData[book] && typeof rawData[book] === 'object') {
      normalizedData[normalizeBookName(book)] = rawData[book];
    }
  });
  translationCache.set(code, normalizedData);
  return normalizedData;
}

function parseReference(label) {
  const trimmed = label.trim();
  const colonIndex = trimmed.lastIndexOf(':');
  if (colonIndex === -1) {
    return null;
  }

  const bookAndChapter = trimmed.slice(0, colonIndex).trim();
  const versesPart = trimmed.slice(colonIndex + 1).trim();
  const lastSpace = bookAndChapter.lastIndexOf(' ');
  if (lastSpace === -1) {
    return null;
  }

  const book = bookAndChapter.slice(0, lastSpace).trim();
  const chapter = bookAndChapter.slice(lastSpace + 1).trim();
  if (!/^[0-9]+$/.test(chapter)) {
    return null;
  }

  const verses = [];
  versesPart.split(',').forEach((segment) => {
    const clean = segment.trim();
    if (!clean) {
      return;
    }
    if (clean.includes('-')) {
      const [startRaw, endRaw] = clean.split('-').map((value) => value.trim());
      const start = parseInt(startRaw, 10);
      const end = parseInt(endRaw, 10);
      if (!Number.isNaN(start) && !Number.isNaN(end)) {
        const min = Math.min(start, end);
        const max = Math.max(start, end);
        for (let verse = min; verse <= max; verse += 1) {
          verses.push(String(verse));
        }
      }
    } else {
      const numeric = parseInt(clean, 10);
      if (!Number.isNaN(numeric)) {
        verses.push(String(numeric));
      }
    }
  });

  return {
    book,
    chapter,
    verses,
  };
}

function extractVerseText(translationData, parsedReference) {
  const normalizedBook = normalizeBookName(parsedReference.book);
  const bookData = translationData[normalizedBook];
  if (!bookData) {
    throw new Error(`Book "${normalizedBook}" not found`);
  }

  const chapterData = bookData[parsedReference.chapter];
  if (!chapterData) {
    throw new Error(`Chapter ${parsedReference.chapter} not found in ${normalizedBook}`);
  }

  if (!parsedReference.verses.length) {
    throw new Error('No verse number detected');
  }

  const lines = parsedReference.verses.map((verseNumber) => {
    const verseText = chapterData[verseNumber];
    if (!verseText) {
      throw new Error(`Verse ${verseNumber} not found in ${normalizedBook} ${parsedReference.chapter}`);
    }
    if (parsedReference.verses.length > 1) {
      return `${verseNumber}. ${verseText}`;
    }
    return verseText;
  });

  return lines.join('\n\n');
}

function normalizeBookName(book) {
  const lowered = book.trim().toLowerCase();
  const aliases = {
    psalms: 'Psalm',
    psalm: 'Psalm',
    'song of songs': 'Song Of Solomon',
    'song of solomon': 'Song Of Solomon',
    canticles: 'Song Of Solomon',
  };
  if (aliases[lowered]) {
    return aliases[lowered];
  }
  return book
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((segment) => {
      if (/^[0-9]+$/.test(segment)) {
        return segment;
      }
      return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
    })
    .join(' ');
}
