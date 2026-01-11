// Transcript Timeline Viewer JavaScript

// Initialize Lucide icons
lucide.createIcons();

// DOM Elements
const csvInput = document.getElementById('csvInput');
const dropZone = document.getElementById('dropZone');
const dropZoneInput = document.getElementById('dropZoneInput');
const timeline = document.getElementById('timeline');
const statsPanel = document.getElementById('statsPanel');
const legend = document.getElementById('legend');
const searchContainer = document.getElementById('searchContainer');
const searchInput = document.getElementById('searchInput');
const searchNav = document.getElementById('searchNav');
const searchCounter = document.getElementById('searchCounter');
const searchPrev = document.getElementById('searchPrev');
const searchNext = document.getElementById('searchNext');
const searchClear = document.getElementById('searchClear');

// State
let rawData = [];
let speakerColors = {};
let searchMatches = []; // Array of card elements with matches
let currentMatchIndex = -1;

// Color Palette for speakers (using custom classes)
const colorClasses = [
    'speaker-blue',
    'speaker-green',
    'speaker-purple',
    'speaker-orange',
    'speaker-pink',
    'speaker-teal',
    'speaker-yellow',
    'speaker-gray'
];

// Event Listeners
csvInput.addEventListener('change', handleFileUpload);
dropZoneInput.addEventListener('change', handleFileUpload);
searchInput.addEventListener('input', debounce(handleSearch, 300));
searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
            navigateSearch(-1);
        } else {
            navigateSearch(1);
        }
    }
});
searchPrev.addEventListener('click', () => navigateSearch(-1));
searchNext.addEventListener('click', () => navigateSearch(1));
searchClear.addEventListener('click', clearSearch);

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Drop Zone Events
dropZone.addEventListener('click', () => dropZoneInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].name.endsWith('.csv')) {
        processFile(files[0]);
    }
});

// Also support drag & drop on the entire page
document.body.addEventListener('dragover', (e) => {
    e.preventDefault();
});

document.body.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].name.endsWith('.csv')) {
        processFile(files[0]);
    }
});

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    processFile(file);
}

function processFile(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        const text = e.target.result;
        parseCSV(text);
    };
    reader.readAsText(file);
}

// Convert time string (HH:MM:SS) to seconds for sorting
function timeToSeconds(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length === 3) {
        return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    } else if (parts.length === 2) {
        return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    return 0;
}

function parseCSV(csvText) {
    const lines = csvText.trim().split(/\r\n|\n/);
    const headers = lines[0].split(',');

    rawData = [];
    const speakers = new Set();

    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!row) continue;

        const cleanRow = row.map(cell => cell.replace(/^"|"$/g, '').replace(/""/g, '"'));

        let speaker, start, end, text;

        if (cleanRow.length >= 4) {
            [speaker, start, end, ...textParts] = cleanRow;
            text = textParts.join(',');
        } else if (cleanRow.length === 3) {
            [speaker, start, ...textParts] = cleanRow;
            end = "";
            text = textParts.join(',');
        } else {
            continue;
        }

        if (speaker && text) {
            rawData.push({ speaker, start, end, text });
            speakers.add(speaker);
        }
    }

    // Sort by time by default
    rawData.sort((a, b) => timeToSeconds(a.start) - timeToSeconds(b.start));

    assignColors(Array.from(speakers));
    updateStats();
    renderTimeline(rawData);

    // UI Updates
    dropZone.classList.add('hidden');
    timeline.classList.remove('hidden');
    statsPanel.classList.remove('hidden');
    legend.classList.remove('hidden');
    searchContainer.classList.remove('hidden');

    lucide.createIcons();
}

// Group consecutive entries by same speaker
function groupBySpeaker(data) {
    if (data.length === 0) return [];

    const grouped = [];
    let currentGroup = {
        speaker: data[0].speaker,
        start: data[0].start,
        end: data[0].end,
        texts: [data[0].text]
    };

    for (let i = 1; i < data.length; i++) {
        if (data[i].speaker === currentGroup.speaker) {
            currentGroup.texts.push(data[i].text);
            currentGroup.end = data[i].end || currentGroup.end;
        } else {
            grouped.push({
                speaker: currentGroup.speaker,
                start: currentGroup.start,
                end: currentGroup.end,
                text: currentGroup.texts.join('\n')
            });
            currentGroup = {
                speaker: data[i].speaker,
                start: data[i].start,
                end: data[i].end,
                texts: [data[i].text]
            };
        }
    }

    grouped.push({
        speaker: currentGroup.speaker,
        start: currentGroup.start,
        end: currentGroup.end,
        text: currentGroup.texts.join('\n')
    });

    return grouped;
}

function assignColors(speakers) {
    speakerColors = {};
    speakers.sort().forEach((speaker, index) => {
        speakerColors[speaker] = colorClasses[index % colorClasses.length];
    });

    legend.innerHTML = '';
    speakers.forEach(speaker => {
        const badge = document.createElement('div');
        badge.className = `tag ${speakerColors[speaker]} cursor-pointer hover:opacity-80 transition border`;
        badge.textContent = speaker;
        badge.onclick = () => filterBySpeaker(speaker);
        legend.appendChild(badge);
    });

    const resetBtn = document.createElement('div');
    resetBtn.className = "tag tag-gray cursor-pointer hover:bg-gray-200 transition border border-gray-300";
    resetBtn.textContent = "Show All";
    resetBtn.onclick = () => {
        clearSearch();
        renderTimeline(rawData);
    };
    legend.appendChild(resetBtn);
}

function filterBySpeaker(speaker) {
    const filtered = rawData.filter(item => item.speaker === speaker);
    clearSearch();
    renderTimeline(filtered);
}

function updateStats() {
    document.getElementById('totalLines').textContent = rawData.length;
    document.getElementById('totalSpeakers').textContent = Object.keys(speakerColors).length;
    if (rawData.length > 0) {
        document.getElementById('durationRange').textContent = `${rawData[0].start} - ${rawData[rawData.length - 1].end || rawData[rawData.length - 1].start}`;
    }
}

function renderTimeline(data) {
    timeline.innerHTML = '<div class="timeline-line"></div>';
    searchMatches = [];
    currentMatchIndex = -1;

    if (data.length === 0) {
        timeline.innerHTML += '<div class="text-center text-gray-500 py-4 ml-12">No results found</div>';
        return;
    }

    const groupedData = groupBySpeaker(data);

    groupedData.forEach((item, index) => {
        const colorClass = speakerColors[item.speaker] || colorClasses[colorClasses.length - 1];

        const container = document.createElement('div');
        container.className = "relative pl-12 sm:pl-16 py-1 group";
        container.dataset.index = index;

        const timeLabel = document.createElement('div');
        timeLabel.className = "absolute left-0 top-3 text-xs font-mono text-gray-400 w-10 text-right group-hover:text-blue-500 transition-colors";
        timeLabel.innerText = item.start;

        const dot = document.createElement('div');
        dot.className = "absolute left-[20px] top-[14px] w-2.5 h-2.5 rounded-full border-2 border-white bg-gray-400 z-10 timeline-dot";

        const card = document.createElement('div');
        card.className = `p-3 sm:p-4 rounded-lg border shadow-sm timeline-card ${colorClass}`;

        const header = document.createElement('div');
        header.className = "flex justify-between items-center mb-1";

        const speakerName = document.createElement('span');
        speakerName.className = "font-bold text-xs sm:text-sm opacity-90";
        speakerName.innerText = item.speaker;

        const duration = document.createElement('span');
        duration.className = "text-[10px] opacity-60 font-mono";
        if (item.end) duration.innerText = `${item.start} - ${item.end}`;

        header.appendChild(speakerName);
        header.appendChild(duration);

        const bodyText = document.createElement('p');
        bodyText.className = "text-sm sm:text-base leading-relaxed whitespace-pre-wrap timeline-text";
        bodyText.innerText = item.text;

        card.appendChild(header);
        card.appendChild(bodyText);

        container.appendChild(timeLabel);
        container.appendChild(dot);
        container.appendChild(card);

        timeline.appendChild(container);
    });
}

// Search functions
function handleSearch() {
    const query = searchInput.value.trim();

    if (!query) {
        clearHighlights();
        searchNav.classList.add('hidden');
        return;
    }

    searchNav.classList.remove('hidden');
    highlightMatches(query);
}

function highlightMatches(query) {
    clearHighlights();
    searchMatches = [];
    currentMatchIndex = -1;

    const lowerQuery = query.toLowerCase();
    const cards = timeline.querySelectorAll('.timeline-card');

    cards.forEach((card, cardIndex) => {
        const textEl = card.querySelector('.timeline-text');
        if (!textEl) return;

        const originalText = textEl.innerText;
        const lowerText = originalText.toLowerCase();

        if (lowerText.includes(lowerQuery)) {
            // Mark this card as having a match
            card.classList.add('has-match');
            searchMatches.push({ card, textEl, originalText });

            // Highlight the text
            const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
            textEl.innerHTML = originalText.replace(regex, '<mark class="search-highlight">$1</mark>');
        }
    });

    updateSearchCounter();

    // Navigate to first match
    if (searchMatches.length > 0) {
        navigateSearch(0, true);
    }
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clearHighlights() {
    const cards = timeline.querySelectorAll('.timeline-card');
    cards.forEach(card => {
        card.classList.remove('has-match', 'current-match');
        const textEl = card.querySelector('.timeline-text');
        if (textEl && searchMatches.length > 0) {
            // Restore original text
            const match = searchMatches.find(m => m.card === card);
            if (match) {
                textEl.innerText = match.originalText;
            }
        }
    });
}

function navigateSearch(direction, absolute = false) {
    if (searchMatches.length === 0) return;

    // Remove current highlight
    if (currentMatchIndex >= 0 && searchMatches[currentMatchIndex]) {
        searchMatches[currentMatchIndex].card.classList.remove('current-match');
        updateHighlightClass(currentMatchIndex, false);
    }

    // Calculate new index
    if (absolute) {
        currentMatchIndex = direction;
    } else {
        currentMatchIndex += direction;
        if (currentMatchIndex >= searchMatches.length) currentMatchIndex = 0;
        if (currentMatchIndex < 0) currentMatchIndex = searchMatches.length - 1;
    }

    // Add current highlight
    const match = searchMatches[currentMatchIndex];
    match.card.classList.add('current-match');
    updateHighlightClass(currentMatchIndex, true);

    // Scroll into view
    match.card.scrollIntoView({ behavior: 'smooth', block: 'center' });

    updateSearchCounter();
}

function updateHighlightClass(index, isCurrent) {
    const match = searchMatches[index];
    if (!match) return;

    const marks = match.textEl.querySelectorAll('mark');
    marks.forEach(mark => {
        if (isCurrent) {
            mark.classList.remove('search-highlight');
            mark.classList.add('search-highlight-current');
        } else {
            mark.classList.remove('search-highlight-current');
            mark.classList.add('search-highlight');
        }
    });
}

function updateSearchCounter() {
    if (searchMatches.length === 0) {
        searchCounter.textContent = '0/0';
    } else {
        searchCounter.textContent = `${currentMatchIndex + 1}/${searchMatches.length}`;
    }
}

function clearSearch() {
    searchInput.value = '';
    clearHighlights();
    searchMatches = [];
    currentMatchIndex = -1;
    searchNav.classList.add('hidden');

    // Re-render to restore original text
    renderTimeline(rawData);
}
