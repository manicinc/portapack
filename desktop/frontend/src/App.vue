<template>
  <div :class="['brutal-container', isDarkMode ? 'mode-dark' : 'mode-light']">
    
    <!-- Brutalist Header -->
    <header class="brutal-header">
      <div class="header-grid">
        <div class="logo-section">
          <pre class="ascii-logo">{{ asciiLogo }}</pre>
        </div>
        <div class="title-section">
          <h1 class="glitch-title" :data-text="glitchText">{{ glitchText }}</h1>
        </div>
        <div class="controls-section">
          <button @click="toggleTheme" class="theme-switch">
            <span class="switch-indicator">{{ isDarkMode ? '[DARK]' : '[LIGHT]' }}</span>
          </button>
        </div>
      </div>
    </header>

    <main class="brutal-main">
      <!-- Toolbar Section -->
      <section class="toolbar">
        <span class="toolbar-label">Toggle Sections:</span>
        <div class="toolbar-buttons">
            <button @click="toggleSection('io')" :class="{ active: sectionVisibility.io }">--io</button>
            <button @click="toggleSection('minify')" :class="{ active: sectionVisibility.minify }">--minify</button>
            <button @click="toggleSection('assets')" :class="{ active: sectionVisibility.assets }">--assets</button>
            <button @click="toggleSection('crawl')" :class="{ active: sectionVisibility.crawl }">--crawl</button>
            <button @click="toggleSection('advanced')" :class="{ active: sectionVisibility.advanced }">--advanced</button>
        </div>
      </section>

      <!-- Grid Layout -->
      <div class="brutal-grid">
        
        <!-- Input/Output Section -->
        <section v-show="sectionVisibility.io" class="brutal-card primary-card">
          <div class="card-header">
            <h2>--input-output</h2>
          </div>
          <div class="form-matrix">
            <div class="input-block">
              <label class="brutal-label">--input-path:</label>
              <div class="input-container">
                <input 
                  type="text" 
                  v-model="inputPath"
                  class="brutal-input"
                  placeholder="./index.html OR https://target.site"
                />
                <div class="input-indicator">[FILE]</div>
              </div>
            </div>
            
            <div class="input-block">
              <label class="brutal-label">--output-path:</label>
              <div class="input-container">
                <input 
                  type="text"
                  v-model="outputPath"
                  class="brutal-input"
                  placeholder="./dist/bundle.html"
                />
                <div class="input-indicator">[DEST]</div>
              </div>
            </div>
          </div>
        </section>

        <!-- Minification Matrix -->
        <section v-show="sectionVisibility.minify" class="brutal-card">
          <div class="card-header">
            <h2>--minification-matrix</h2>
          </div>
          <div class="checkbox-matrix">
            <label class="brutal-checkbox">
              <input 
                type="checkbox" 
                v-model="minifyAll"
              />
              <span class="checkbox-visual"></span>
              <span class="checkbox-text">enable-all-compression</span>
            </label>
            
            <label :class="['brutal-checkbox', { 'disabled': minifyAll }]">
              <input 
                type="checkbox" 
                v-model="noMinifyHtml"
                :disabled="minifyAll"
              />
              <span class="checkbox-visual"></span>
              <span class="checkbox-text">disable-html-minify</span>
            </label>
            
            <label :class="['brutal-checkbox', { 'disabled': minifyAll }]">
              <input 
                type="checkbox" 
                v-model="noMinifyCss"
                :disabled="minifyAll"
              />
              <span class="checkbox-visual"></span>
              <span class="checkbox-text">disable-css-minify</span>
            </label>
            
            <label :class="['brutal-checkbox', { 'disabled': minifyAll }]">
              <input 
                type="checkbox" 
                v-model="noMinifyJs"
                :disabled="minifyAll"
              />
              <span class="checkbox-visual"></span>
              <span class="checkbox-text">disable-js-minify</span>
            </label>
          </div>
        </section>

        <!-- Asset Control -->
        <section v-show="sectionVisibility.assets" class="brutal-card">
          <div class="card-header">
            <h2>--asset-control</h2>
          </div>
          <div class="checkbox-matrix">
            <label class="brutal-checkbox">
              <input 
                type="checkbox" 
                v-model="embedAssets"
              />
              <span class="checkbox-visual"></span>
              <span class="checkbox-text">embed-as-data-uri</span>
            </label>
          </div>
        </section>

        <!-- Recursive Crawl -->
        <section v-show="sectionVisibility.crawl" class="brutal-card">
          <div class="card-header">
            <h2>--recursive-crawl</h2>
          </div>
          <div class="checkbox-matrix">
            <label class="brutal-checkbox">
              <input 
                type="checkbox" 
                v-model="recursive"
              />
              <span class="checkbox-visual"></span>
              <span class="checkbox-text">enable-site-crawl</span>
            </label>
            
            <div v-if="recursive" class="input-block">
              <label class="brutal-label">--max-depth:</label>
              <div class="input-container">
                <input 
                  type="number"
                  v-model="maxDepth"
                  class="brutal-input small"
                  placeholder="5"
                  min="0"
                />
                <div class="input-indicator">[INT]</div>
              </div>
            </div>
          </div>
        </section>

        <!-- Advanced Config -->
        <section v-show="sectionVisibility.advanced" class="brutal-card advanced-card">
          <div class="card-header">
            <h2>--advanced-config</h2>
          </div>
          <div class="form-matrix">
            <div class="input-block">
              <label class="brutal-label">--base-url:</label>
              <div class="input-container">
                <input 
                  type="text"
                  v-model="baseUrl"
                  class="brutal-input"
                  placeholder="http://localhost:8080"
                />
                <div class="input-indicator">[URL]</div>
              </div>
            </div>
            
            <div class="checkbox-matrix">
              <label class="brutal-checkbox">
                <input 
                  type="checkbox" 
                  v-model="dryRun"
                />
                <span class="checkbox-visual"></span>
                <span class="checkbox-text">dry-run-mode</span>
              </label>
              
              <label class="brutal-checkbox">
                <input 
                  type="checkbox" 
                  v-model="verbose"
                />
                <span class="checkbox-visual"></span>
                <span class="checkbox-text">verbose-logging</span>
              </label>
            </div>
            
            <div class="input-block">
              <label class="brutal-label">--log-level:</label>
              <div class="select-container">
                <select v-model="logLevel" class="brutal-select">
                  <option value="debug">DEBUG</option>
                  <option value="info">INFO</option>
                  <option value="warn">WARN</option>
                  <option value="error">ERROR</option>
                  <option value="silent">SILENT</option>
                  <option value="none">NONE</option>
                </select>
                <div class="select-indicator">[SELECT]</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- Control Panel -->
      <section class="control-panel">
        <button 
          @click="executePortapack"
          :disabled="isProcessing"
          class="execute-btn"
        >
          <span class="btn-text">
            {{ isProcessing ? '[PROCESSING...]' : '[EXECUTE]' }}
          </span>
        </button>
        
        <button 
          @click="resetOptions"
          :disabled="isProcessing"
          class="reset-btn"
        >
          <span class="btn-text">[RESET]</span>
        </button>
      </section>

      <!-- Terminal Output -->
      <section class="terminal-output">
        <div class="terminal-header">
          <span class="terminal-title">[OUTPUT]</span>
          <div class="terminal-controls">
            <span class="terminal-dot red"></span>
            <span class="terminal-dot yellow"></span>
            <span class="terminal-dot green"></span>
          </div>
        </div>
        <div class="terminal-content">
          <pre class="output-text">{{ commandOutput }}</pre>
          <span class="cursor"></span>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, watch, reactive } from 'vue';

// ASCII Art Logo
const asciiLogo = `
  ██████╗  ██████╗ ██████╗ ████████╗ █████╗ 
  ██╔══██╗██╔═══██╗██╔══██╗╚══██╔══╝██╔══██╗
  ██████╔╝██║   ██║██████╔╝   ██║   ███████║
  ██╔═══╝ ██║   ██║██╔══██╗   ██║   ██╔══██║
  ██║     ╚██████╔╝██║  ██║   ██║   ██║  ██║
  ╚═╝      ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝
`;

// State for CLI options using ref for reactivity
const inputPath = ref('');
const outputPath = ref('');
const minifyAll = ref(false);
const noMinifyHtml = ref(false);
const noMinifyCss = ref(false);
const noMinifyJs = ref(false);
const embedAssets = ref(false);
const recursive = ref(false);
const maxDepth = ref('');
const baseUrl = ref('');
const dryRun = ref(false);
const verbose = ref(false);
const logLevel = ref('info');
const commandOutput = ref('SYSTEM READY // AWAITING COMMANDS...');
const isProcessing = ref(false);
const isDarkMode = ref(true);
const glitchText = ref('PORTAPACK');

// --- NEW --- State for section visibility
const sectionVisibility = reactive({
  io: true,
  minify: true,
  assets: true,
  crawl: true,
  advanced: true,
});

// --- NEW --- Method to toggle section visibility
const toggleSection = (section) => {
    sectionVisibility[section] = !sectionVisibility[section];
};


// Watch for changes on minifyAll to auto-disable individual minify options
watch(minifyAll, (newValue) => {
  if (newValue) {
    noMinifyHtml.value = false;
    noMinifyCss.value = false;
    noMinifyJs.value = false;
  }
});

// Method to simulate command execution
const executePortapack = async () => {
  isProcessing.value = true;
  commandOutput.value = '>>> INITIALIZING PORTAPACK SEQUENCE...\n>>> SCANNING INPUT VECTORS...\n>>> COMPILING ASSET MATRIX...';

  setTimeout(() => {
    commandOutput.value += '\n>>> MINIFICATION PROTOCOL ENGAGED...\n>>> ASSET COMPRESSION: 89.7%\n>>> BUNDLE OPTIMIZATION COMPLETE\n>>> STATUS: [SUCCESS] PACKAGE DEPLOYED';
    isProcessing.value = false;
  }, 3000);
};

// Method to reset all options to their default values
const resetOptions = () => {
  inputPath.value = '';
  outputPath.value = '';
  minifyAll.value = false;
  noMinifyHtml.value = false;
  noMinifyCss.value = false;
  noMinifyJs.value = false;
  embedAssets.value = false;
  recursive.value = false;
  maxDepth.value = '';
  baseUrl.value = '';
  dryRun.value = false;
  verbose.value = false;
  logLevel.value = 'info';
  commandOutput.value = 'SYSTEM READY // AWAITING COMMANDS...';
};

// Method to toggle the color theme
const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value;
};
</script>

<style>
/* PERFORMANCE NOTE: For Wails apps, it's best to link fonts in your main index.html
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap">
*/

:root {
  --main-color: #4cc9f0;
  --accent-pink: #b5179e;
  --accent-green: #57cc99;
  --accent-orange: #f77f00;
  --dark-bg: #1a1d24;
  --darker-bg: #101216;
  --light-bg: #f8f9fa;
  --light-text: #212529;
  --light-border: #adb5bd;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
    font-family: 'JetBrains Mono', monospace;
}

.brutal-container {
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.mode-dark {
  background-color: var(--darker-bg);
  color: var(--main-color);
}

.mode-light {
  background-color: var(--light-bg);
  color: var(--light-text);
}

.brutal-header {
  padding: 20px;
  border-bottom: 2px solid var(--main-color);
  background-color: var(--darker-bg); /* Use solid color */
  position: relative;
}

.header-grid {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
  flex-wrap: wrap; /* Allow wrapping on smaller screens */
}

.ascii-logo {
  font-size: 8px;
  line-height: 1;
  color: var(--accent-pink);
  white-space: pre;
}

.glitch-title {
  font-size: 2.5rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 4px;
  position: relative;
  color: var(--main-color);
}

.subtitle {
  font-size: 0.8rem;
  color: var(--accent-orange);
  text-transform: uppercase;
  letter-spacing: 2px;
  margin-top: 5px;
}

.theme-switch {
  background: none;
  border: 2px solid var(--main-color);
  color: var(--main-color);
  padding: 10px 20px;
  font-family: inherit;
  font-weight: bold;
  text-transform: uppercase;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.theme-switch:hover {
  background: var(--main-color);
  color: var(--dark-bg);
}

.brutal-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 30px 20px;
}

/* --- NEW TOOLBAR STYLES --- */
.toolbar {
    padding: 10px;
    margin-bottom: 20px;
    border: 2px solid var(--main-color);
    display: flex;
    align-items: center;
    gap: 15px;
    flex-wrap: wrap;
}

.toolbar-label {
    font-weight: bold;
    text-transform: uppercase;
    color: var(--accent-orange);
}

.toolbar-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.toolbar button {
    background-color: var(--dark-bg);
    border: 1px solid var(--main-color);
    color: var(--main-color);
    padding: 5px 10px;
    cursor: pointer;
    font-family: inherit;
    transition: background-color 0.2s ease;
    opacity: 0.6;
}

.toolbar button.active {
    background-color: var(--main-color);
    color: var(--dark-bg);
    opacity: 1;
}

.toolbar button:hover {
    opacity: 1;
}
/* --- END TOOLBAR STYLES --- */


.brutal-grid {
  display: grid;
  grid-template-columns: 1fr; /* Force single column layout */
  gap: 20px;
  margin-bottom: 30px;
}

.brutal-card {
  background: var(--dark-bg);
  border: 2px solid var(--main-color);
  padding: 0;
  position: relative;
  transition: border-color 0.2s ease;
}

.brutal-card:hover {
  border-color: var(--accent-green);
}

.primary-card {
  border-color: var(--accent-pink);
}
.primary-card:hover {
    border-color: var(--main-color);
}

.advanced-card {
  border-color: var(--accent-orange);
}
.advanced-card:hover {
    border-color: var(--accent-green);
}


.card-header {
  background: var(--main-color);
  color: var(--dark-bg);
  padding: 15px 20px;
  border-bottom: 2px solid var(--main-color);
  position: relative;
}

.primary-card .card-header {
  background: var(--accent-pink);
  border-color: var(--accent-pink);
}

.advanced-card .card-header {
  background: var(--accent-orange);
  border-color: var(--accent-orange);
}

.card-header h2 {
  font-size: 1.1rem;
  font-weight: 700; /* Bolder */
  text-transform: lowercase; /* Changed */
  letter-spacing: 1px; /* Adjusted */
  margin: 0;
}

.form-matrix,
.checkbox-matrix {
  padding: 20px;
}

.input-block {
  margin-bottom: 20px;
}

.brutal-label {
  display: block;
  font-size: 0.9rem;
  font-weight: bold;
  text-transform: lowercase; /* Changed */
  letter-spacing: 1px;
  margin-bottom: 8px;
  color: var(--accent-green);
}

.input-container,
.select-container {
  position: relative;
  display: flex;
  align-items: center;
}

.brutal-input,
.brutal-select {
  width: 100%;
  background: var(--darker-bg);
  border: 2px solid var(--main-color);
  color: var(--main-color);
  padding: 12px 60px 12px 15px;
  font-family: inherit;
  font-size: 0.9rem;
  text-transform: uppercase;
}

.brutal-input:focus,
.brutal-select:focus {
  outline: none;
  border-color: var(--accent-green);
}

.brutal-input.small {
  width: 100px;
}

.brutal-select {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  cursor: pointer;
}

.input-indicator,
.select-indicator {
  position: absolute;
  right: 15px;
  font-size: 0.7rem;
  font-weight: bold;
  color: var(--accent-orange);
  background: var(--dark-bg);
  padding: 2px 5px;
  border: 1px solid var(--accent-orange);
}

.brutal-checkbox {
  display: flex;
  align-items: center;
  cursor: pointer;
  margin-bottom: 15px;
  padding: 10px;
  border: 1px solid transparent;
  transition: background-color 0.2s ease;
}

.brutal-checkbox:hover {
  background: rgba(76, 201, 240, 0.05);
}

.brutal-checkbox.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.brutal-checkbox input[type="checkbox"] {
  display: none;
}

.checkbox-visual {
  width: 20px;
  height: 20px;
  border: 2px solid var(--main-color);
  margin-right: 15px;
  position: relative;
  background: var(--dark-bg);
}

.brutal-checkbox input:checked + .checkbox-visual {
  background: var(--main-color);
}

.brutal-checkbox input:checked + .checkbox-visual::after {
  content: '✓';
  position: absolute;
  top: -2px;
  left: 3px;
  color: var(--dark-bg);
  font-weight: bold;
  font-size: 14px;
}

.checkbox-text {
  font-size: 0.9rem;
  font-weight: bold;
  text-transform: lowercase; /* Changed */
  letter-spacing: 1px;
}

.control-panel {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-bottom: 30px;
}

.execute-btn,
.reset-btn {
  position: relative;
  background: var(--dark-bg);
  border: 2px solid var(--accent-green);
  color: var(--accent-green);
  padding: 15px 30px;
  font-family: inherit;
  font-weight: bold;
  font-size: 1.1rem;
  text-transform: uppercase;
  letter-spacing: 2px;
  cursor: pointer;
  overflow: hidden;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.reset-btn {
  border-color: var(--accent-orange);
  color: var(--accent-orange);
}

.execute-btn:hover:not(:disabled) {
  background-color: var(--accent-green);
  color: var(--dark-bg);
}

.reset-btn:hover:not(:disabled) {
  background-color: var(--accent-orange);
  color: var(--dark-bg);
}

.execute-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.terminal-output {
  background: var(--darker-bg);
  border: 2px solid var(--accent-green);
  font-family: inherit;
}

.terminal-header {
  background: var(--accent-green);
  color: var(--dark-bg);
  padding: 10px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid var(--accent-green);
}

.terminal-title {
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.terminal-controls {
  display: flex;
  gap: 8px;
}

.terminal-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid var(--dark-bg);
}

.terminal-dot.red { background: #ff605c; }
.terminal-dot.yellow { background: #ffbd44; }
.terminal-dot.green { background: #00ca4e; }

.terminal-content {
  padding: 20px;
  position: relative;
  min-height: 200px;
  max-height: 400px;
  overflow-y: auto;
}

.output-text {
  color: var(--accent-green);
  font-size: 0.9rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.cursor {
  display: inline-block;
  background: var(--accent-green);
  width: 10px;
  height: 15px;
  margin-left: 5px;
}


/* Responsive Design */
@media (max-width: 768px) {
  .header-grid {
    flex-direction: column;
    gap: 20px;
    text-align: center;
  }
  
  .ascii-logo {
    font-size: 6px;
  }
  
  .glitch-title {
    font-size: 1.8rem;
  }
  
  .control-panel {
    flex-direction: column;
    align-items: center;
  }
  
  .execute-btn,
  .reset-btn {
    width: 100%;
    max-width: 300px;
  }
}

/* Light Mode Overrides */
.mode-light .brutal-header {
  border-bottom-color: var(--light-border);
  background: var(--light-bg);
}
.mode-light .brutal-card {
  background: #fff;
  border-color: var(--light-text);
  color: var(--light-text);
}
.mode-light .card-header {
  background: var(--light-text);
  color: #fff;
  border-color: var(--light-text);
}
.mode-light .brutal-input,
.mode-light .brutal-select {
  background: #fff;
  border-color: var(--light-text);
  color: var(--light-text);
}
.mode-light .checkbox-visual {
  border-color: var(--light-text);
  background: #fff;
}
.mode-light .brutal-checkbox input:checked + .checkbox-visual {
  background: var(--light-text);
  color: #fff;
}
.mode-light .brutal-checkbox input:checked + .checkbox-visual::after {
  color: #fff;
}
.mode-light .terminal-output {
  background: #fff;
  border-color: var(--light-text);
}
.mode-light .terminal-header {
  background: var(--light-text);
  color: #fff;
  border-color: var(--light-text);
}
.mode-light .output-text {
  color: var(--light-text);
}
.mode-light .cursor {
  background: var(--light-text);
}

.mode-light .toolbar {
    border-color: var(--light-border);
}
.mode-light .toolbar button {
    background-color: #fff;
    border-color: var(--light-text);
    color: var(--light-text);
}
.mode-light .toolbar button.active {
    background-color: var(--light-text);
    color: #fff;
}
</style>
