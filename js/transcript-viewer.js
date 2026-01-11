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

// State
let rawData = [];
let speakerColors = {};

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
searchInput.addEventListener('input', (e) => renderTimeline(filterData(e.target.value)));

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
    // Simple CSV parser handling quotes
    const lines = csvText.trim().split(/\r\n|\n/);
    const headers = lines[0].split(',');

    rawData = [];
    const speakers = new Set();

    // Expected: Speaker (File), Start Time, End Time, Text

    for (let i = 1; i < lines.length; i++) {
        // Regex to handle quoted CSV fields
        const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!row) continue;

        // Clean quotes
        const cleanRow = row.map(cell => cell.replace(/^"|"$/g, '').replace(/""/g, '"'));

        let speaker, start, end, text;

        if (cleanRow.length >= 4) {
            [speaker, start, end, ...textParts] = cleanRow;
            text = textParts.join(',');
        } else if (cleanRow.length === 3) {
            // Old format: Speaker, Timestamp, Text
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

    // Re-render Lucide icons for any new elements
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
            // Same speaker, add to current group
            currentGroup.texts.push(data[i].text);
            currentGroup.end = data[i].end || currentGroup.end;
        } else {
            // Different speaker, push current group and start new one
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

    // Push the last group
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

    // Render Legend
    legend.innerHTML = '';
    speakers.forEach(speaker => {
        const badge = document.createElement('div');
        badge.className = `tag ${speakerColors[speaker]} cursor-pointer hover:opacity-80 transition border`;
        badge.textContent = speaker;
        badge.onclick = () => filterBySpeaker(speaker);
        legend.appendChild(badge);
    });

    // Reset button
    const resetBtn = document.createElement('div');
    resetBtn.className = "tag tag-gray cursor-pointer hover:bg-gray-200 transition border border-gray-300";
    resetBtn.textContent = "Show All";
    resetBtn.onclick = () => {
        searchInput.value = '';
        renderTimeline(rawData);
    };
    legend.appendChild(resetBtn);
}

function filterBySpeaker(speaker) {
    const filtered = rawData.filter(item => item.speaker === speaker);
    renderTimeline(filtered);
}

function filterData(query) {
    if (!query) return rawData;
    const lowerQuery = query.toLowerCase();
    return rawData.filter(item =>
        item.text.toLowerCase().includes(lowerQuery) ||
        item.speaker.toLowerCase().includes(lowerQuery)
    );
}

function updateStats() {
    document.getElementById('totalLines').textContent = rawData.length;
    document.getElementById('totalSpeakers').textContent = Object.keys(speakerColors).length;
    if (rawData.length > 0) {
        document.getElementById('durationRange').textContent = `${rawData[0].start} - ${rawData[rawData.length - 1].end || rawData[rawData.length - 1].start}`;
    }
}

function renderTimeline(data) {
    // Keep the line
    timeline.innerHTML = '<div class="timeline-line"></div>';

    if (data.length === 0) {
        timeline.innerHTML += '<div class="text-center text-gray-500 py-4 ml-12">No results found</div>';
        return;
    }

    // Group consecutive entries by same speaker
    const groupedData = groupBySpeaker(data);

    groupedData.forEach((item, index) => {
        const colorClass = speakerColors[item.speaker] || colorClasses[colorClasses.length - 1];

        // Item Container
        const container = document.createElement('div');
        container.className = "relative pl-12 sm:pl-16 py-1 group";

        // Timestamp (Left)
        const timeLabel = document.createElement('div');
        timeLabel.className = "absolute left-0 top-3 text-xs font-mono text-gray-400 w-10 text-right group-hover:text-blue-500 transition-colors";
        timeLabel.innerText = item.start;

        // Dot on line
        const dot = document.createElement('div');
        dot.className = "absolute left-[20px] top-[14px] w-2.5 h-2.5 rounded-full border-2 border-white bg-gray-400 z-10 timeline-dot";

        // Content Card
        const card = document.createElement('div');
        card.className = `p-3 sm:p-4 rounded-lg border shadow-sm timeline-card ${colorClass}`;

        // Header (Speaker + End Time)
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

        // Text Body
        const bodyText = document.createElement('p');
        bodyText.className = "text-sm sm:text-base leading-relaxed whitespace-pre-wrap";
        bodyText.innerText = item.text;

        // Assemble
        card.appendChild(header);
        card.appendChild(bodyText);

        container.appendChild(timeLabel);
        container.appendChild(dot);
        container.appendChild(card);

        timeline.appendChild(container);
    });
}
