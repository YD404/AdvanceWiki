class ScenarioParser {
    constructor() {
        this.lines = [];
        this.labels = {};
    }

    parse(text) {
        const rawLines = text.split(/\r\n|\n|\r/);
        this.lines = [];
        this.labels = {};

        rawLines.forEach((rawLine, index) => {
            const line = rawLine.trim();
            if (!line) return;

            const parsed = this.parseLine(line, this.lines.length);
            this.lines.push(parsed);

            if (parsed.type === 'label') {
                this.labels[parsed.content] = this.lines.length - 1;
            }
        });

        return { lines: this.lines, labels: this.labels };
    }

    parseLine(line, index) {
        if (line.startsWith('//')) return { type: 'comment', content: line, original: line };
        if (line.startsWith('*')) return { type: 'label', content: line.trim(), original: line };
        if (line.startsWith('#') || line.startsWith('＃')) return { type: 'param', content: line.substring(1).trim(), original: line };
        if (line.startsWith('♪') || line.startsWith('○') || line.startsWith('@')) return { type: 'command', content: line, original: line };
        if (line.startsWith('★') || line.startsWith('->') || line.startsWith('→')) return { type: 'choice', content: line, original: line };
        if (line.startsWith('goto')) return { type: 'goto', content: line.substring(4).trim(), original: line };

        if (line.includes('「') || line.includes('『')) {
            let name = '';
            let text = line;
            const bracketIndex = Math.min(
                line.indexOf('「') !== -1 ? line.indexOf('「') : 9999,
                line.indexOf('『') !== -1 ? line.indexOf('『') : 9999
            );
            if (bracketIndex > 0 && bracketIndex < 9999) {
                name = line.substring(0, bracketIndex).trim();
                text = line.substring(bracketIndex);
            }
            return { type: 'dialog', name: name, content: text, original: line };
        }

        if (line.startsWith('（') || line.startsWith('(')) return { type: 'direction', content: line, original: line };

        return { type: 'narration', content: line, original: line };
    }
}

class GameState {
    constructor() {
        this.variables = {};
    }

    reset() {
        this.variables = {};
    }

    executeParam(command) {
        const parts = command.match(/^(.+?)\s*([+\-=])\s*(-?\d+)$/);
        if (!parts) return false;

        const name = parts[1].trim();
        const op = parts[2];
        const val = parseInt(parts[3], 10);
        if (isNaN(val)) return false;

        let current = this.variables[name] || 0;
        switch (op) {
            case '+': current += val; break;
            case '-': current -= val; break;
            case '=': current = val; break;
        }
        this.variables[name] = current;
        return true;
    }
}

class SimulatorUI {
    constructor() {
        this.parser = new ScenarioParser();
        this.gameState = new GameState();

        this.lines = [];
        this.labels = {};
        this.currentIndex = 0;
        this.autoPlayTimer = null;

        // Elements
        this.inputArea = document.getElementById('scenarioInput');
        this.loadBtn = document.getElementById('loadButton');

        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.autoBtn = document.getElementById('autoBtn');

        // Game Spec Elements
        this.gameBackground = document.getElementById('gameBackground');
        this.nameLabel = document.getElementById('nameLabel');
        this.messageText = document.getElementById('messageText');

        this.varTable = document.getElementById('variableTableBody');
        this.systemLog = document.getElementById('systemLog');

        this.init();
    }

    init() {
        this.loadBtn.addEventListener('click', () => this.loadScenario());
        this.nextBtn.addEventListener('click', () => this.next());
        this.prevBtn.addEventListener('click', () => this.prev());
        this.autoBtn.addEventListener('click', () => this.toggleAuto());

        // Sample
        if (!this.inputArea.value) {
            this.inputArea.value = `// サンプル
○教室
#好感度 = 0
[先生]「転校生を紹介する」
（ドアが開く）
[転校生]「はじめまして」
★挨拶する
→*greet
★無視する
→*ignore

*greet
#好感度 + 10
 주인공「よろしく！」
goto *end

*ignore
#好感度 - 5
主人公「……」

*end
#好感度 + 1
// 終了`;
        }
    }

    loadScenario() {
        const text = this.inputArea.value;
        const result = this.parser.parse(text);
        this.lines = result.lines;
        this.labels = result.labels;

        this.currentIndex = 0;
        this.gameState.reset();
        this.systemLog.innerHTML = '<div>System ready.</div>';
        this.addSystemLog("Loaded " + this.lines.length + " lines.");

        // Reset UI
        this.resetGameScreen();

        this.renderVariables();
        this.updateButtons();
        this.stopAuto();
    }

    resetGameScreen() {
        this.gameBackground.style.backgroundColor = '#111827';
        this.gameBackground.textContent = 'BG';
        this.nameLabel.classList.add('hidden');
        this.messageText.textContent = '';
    }

    next() {
        if (this.currentIndex >= this.lines.length) {
            this.addSystemLog("End of scenario.");
            this.stopAuto();
            return;
        }

        const line = this.lines[this.currentIndex];
        this.processLine(line);
        this.currentIndex++;
        this.updateButtons();
    }

    prev() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.addSystemLog("Back 1 line (State not reverted)");
            this.updateButtons();
            // In a real simulator we would restore state, 
            // but here we just step index back. UI remains at 'last drawn'.
        }
    }

    processLine(line) {
        // Visuals
        if (line.type === 'dialog') {
            this.messageText.textContent = line.content;

            if (line.name) {
                const cleanName = line.name.replace(/[\[\]【】]/g, '');
                this.nameLabel.textContent = cleanName;
                this.nameLabel.classList.remove('hidden');
            }
            // If no name, keep previous name? Spec says: "省略=継続"
            // But if it was hidden, what then? simple: if hidden, stays hidden.
            // If visible, stays visible.
        }
        else if (line.type === 'narration') {
            this.nameLabel.classList.add('hidden');
            this.messageText.textContent = line.content;
        }
        else if (line.type === 'direction') {
            this.nameLabel.classList.add('hidden');
            this.messageText.innerHTML = `<span class="italic text-gray-300">${line.content}</span>`;
        }
        else if (line.type === 'command') {
            this.addSystemLog(`Cmd: ${line.content}`);
            // Background
            if (line.content.startsWith('○') || line.content.startsWith('@')) {
                const bgName = line.content.substring(1).trim();
                this.gameBackground.textContent = bgName;
                this.gameBackground.style.backgroundColor = this.stringToColor(bgName);
            }
        }
        else if (line.type === 'param') {
            if (this.gameState.executeParam(line.content)) {
                this.addSystemLog(`Param: ${line.content}`);
                this.renderVariables();
            }
        }
        else if (line.type === 'goto') {
            const label = line.content.replace(/\*/g, '').trim();
            // Search label
            let target = this.labels[label] ?? this.labels['*' + label];

            if (target !== undefined) {
                this.addSystemLog(`Jump -> ${label}`);
                this.currentIndex = target;
            } else {
                this.addSystemLog(`Label not found: ${label}`);
            }
        }
        else if (line.type === 'label') {
            this.addSystemLog(`Label: ${line.content}`);
        }
    }

    updateButtons() {
        this.prevBtn.disabled = this.currentIndex <= 0;
        this.nextBtn.disabled = this.currentIndex >= this.lines.length;
    }

    renderVariables() {
        const vars = this.gameState.variables;
        const keys = Object.keys(vars).sort();

        if (keys.length === 0) {
            this.varTable.innerHTML = '<tr><td colspan="2" class="text-center text-gray-400 py-4">変数なし</td></tr>';
            return;
        }

        let html = '';
        keys.forEach(key => {
            html += `
                <tr class="border-b last:border-0 hover:bg-blue-50 transition">
                    <td class="py-2 px-3 font-mono text-gray-700">${key}</td>
                    <td class="py-2 px-3 text-right font-bold text-blue-600">${vars[key]}</td>
                </tr>
            `;
        });
        this.varTable.innerHTML = html;
    }

    addSystemLog(msg) {
        const div = document.createElement('div');
        div.textContent = `> ${msg}`;
        this.systemLog.insertBefore(div, this.systemLog.firstChild);
    }

    toggleAuto() {
        if (this.autoPlayTimer) {
            this.stopAuto();
        } else {
            this.autoPlayTimer = setInterval(() => this.next(), 1500);
            this.autoBtn.classList.replace('bg-gray-700', 'bg-blue-600');
            this.autoBtn.classList.replace('text-gray-300', 'text-white');
        }
    }

    stopAuto() {
        if (this.autoPlayTimer) {
            clearInterval(this.autoPlayTimer);
            this.autoPlayTimer = null;
            this.autoBtn.classList.replace('bg-blue-600', 'bg-gray-700');
            this.autoBtn.classList.replace('text-white', 'text-gray-300');
        }
    }

    stringToColor(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
        const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
        return '#' + '00000'.substring(0, 6 - c.length) + c;
    }
}

document.addEventListener('DOMContentLoaded', () => new SimulatorUI());
