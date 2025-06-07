<script setup>
import { ref, onMounted, watch } from 'vue';
import {RunPortapack} from "../wailsjs/go/main/App"

// State for CLI options
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
const logLevel = ref('info'); // Default log level
const commandOutput = ref('');
const isProcessing = ref(false); // To indicate when the command is running

// Theme state
const isDarkMode = ref(true); // Default to dark mode
const mascotPath = ref('https://res.cloudinary.com/dwaypfftw/image/upload/v1744373244/portapack-transparent_qlyfpm.png');

// Toggle light/dark mode
const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value;
  document.documentElement.setAttribute('data-theme', isDarkMode.value ? 'dark' : 'light');
};

// Watchers for minification logic
// When minifyAll is true, individual no-minify options should be disabled but not set to true
// When minifyAll is false, individual no-minify options are enabled
watch(minifyAll, (newVal) => {
  if (newVal) {
    noMinifyHtml.value = false;
    noMinifyCss.value = false;
    noMinifyJs.value = false;
  }
});

// Build and execute the portapack command
const executePortapack = async () => {
  isProcessing.value = true;
  commandOutput.value = 'Running portapack command...';

  try {
    // Construct command arguments
    let args = [];
    if (inputPath.value) {
      args.push(inputPath.value);
    }
    if (outputPath.value) {
      args.push('-o', outputPath.value);
    }
    if (minifyAll.value) {
      args.push('-m');
    } else {
      // Only add individual no-minify if minifyAll is false
      if (noMinifyHtml.value) args.push('--no-minify-html');
      if (noMinifyCss.value) args.push('--no-minify-css');
      if (noMinifyJs.value) args.push('--no-minify-js');
    }
    if (embedAssets.value) {
      args.push('-e');
    } else {
      args.push('--no-embed-assets');
    }
    if (recursive.value) {
      args.push('-r');
      if (maxDepth.value) args.push(maxDepth.value);
    }
    if (baseUrl.value) {
      args.push('-b', baseUrl.value);
    }
    if (dryRun.value) {
      args.push('-d');
    }
    if (verbose.value) {
      args.push('-v');
    }
    if (logLevel.value && logLevel.value !== 'info') { // 'info' is default, no need to explicitly add
      args.push('--log-level', logLevel.value);
    }

    console.log("Executing with arguments:", args);

    // Call Go backend to execute the command
    const result = await RunPortapack(args); // This method will be implemented in app.go
    commandOutput.value = result;
  } catch (error) {
    commandOutput.value = `Error: ${error.message || error}`;
    console.error("Portapack command failed:", error);
  } finally {
    isProcessing.value = false;
  }
};

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
  commandOutput.value = '';
};

onMounted(() => {
  // Set initial theme based on default
  document.documentElement.setAttribute('data-theme', isDarkMode.value ? 'dark' : 'light');
});
</script>

<template>
  <div class="container" :class="{ 'dark-mode': isDarkMode, 'light-mode': !isDarkMode }">
    <header class="app-header">
      <img :src="mascotPath" alt="Portapack Mascot" class="mascot" />
      <h1>Portapack CLI UI</h1>
      <button @click="toggleTheme" class="theme-toggle">
        <span v-if="isDarkMode">☀️ Light Mode</span>
        <span v-else>🌙 Dark Mode</span>
      </button>
    </header>

    <main class="main-content">
      <section class="input-section card">
        <h2>Input & Output</h2>
        <div class="form-group">
          <label for="inputPath">Input HTML File or URL:</label>
          <div class="input-wrapper">
            <input id="inputPath" v-model="inputPath" placeholder="e.g., index.html or https://example.com" />
            <div class="input-icon">📁</div>
          </div>
        </div>
        <div class="form-group">
          <label for="outputPath">Output File Path (-o, --output):</label>
          <div class="input-wrapper">
            <input id="outputPath" v-model="outputPath" placeholder="e.g., output.html" />
            <div class="input-icon">💾</div>
          </div>
        </div>
      </section>

      <section class="options-section">
        <div class="card">
          <h2>Minification Options</h2>
          <div class="form-group checkbox-group">
            <label class="checkbox-container">
              <input type="checkbox" id="minifyAll" v-model="minifyAll" />
              <span class="checkmark"></span>
              Enable All Minification (-m, --minify)
            </label>
          </div>
          <div class="form-group checkbox-group">
            <label class="checkbox-container" :class="{ disabled: minifyAll }">
              <input type="checkbox" id="noMinifyHtml" v-model="noMinifyHtml" :disabled="minifyAll" />
              <span class="checkmark"></span>
              Disable HTML Minification (--no-minify-html)
            </label>
          </div>
          <div class="form-group checkbox-group">
            <label class="checkbox-container" :class="{ disabled: minifyAll }">
              <input type="checkbox" id="noMinifyCss" v-model="noMinifyCss" :disabled="minifyAll" />
              <span class="checkmark"></span>
              Disable CSS Minification (--no-minify-css)
            </label>
          </div>
          <div class="form-group checkbox-group">
            <label class="checkbox-container" :class="{ disabled: minifyAll }">
              <input type="checkbox" id="noMinifyJs" v-model="noMinifyJs" :disabled="minifyAll" />
              <span class="checkmark"></span>
              Disable JavaScript Minification (--no-minify-js)
            </label>
          </div>
        </div>

        <div class="card">
          <h2>Asset Handling</h2>
          <div class="form-group checkbox-group">
            <label class="checkbox-container">
              <input type="checkbox" id="embedAssets" v-model="embedAssets" />
              <span class="checkmark"></span>
              Embed Assets as Data URIs (-e, --embed-assets)
            </label>
          </div>
        </div>

        <div class="card">
          <h2>Recursive Crawling</h2>
          <div class="form-group checkbox-group">
            <label class="checkbox-container">
              <input type="checkbox" id="recursive" v-model="recursive" />
              <span class="checkmark"></span>
              Recursively Crawl Site (-r, --recursive)
            </label>
          </div>
          <div class="form-group" v-if="recursive">
            <label for="maxDepth">Max Depth (optional, for -r):</label>
            <div class="input-wrapper">
              <input type="number" id="maxDepth" v-model="maxDepth" placeholder="e.g., 2" min="0" />
              <div class="input-icon">🔢</div>
            </div>
          </div>
        </div>
      </section>

      <section class="advanced-options card">
        <h2>Advanced Options</h2>
        <div class="form-group">
          <label for="baseUrl">Base URL for Relative Links (-b, --base-url):</label>
          <div class="input-wrapper">
            <input id="baseUrl" v-model="baseUrl" placeholder="e.g., http://localhost:8080" />
            <div class="input-icon">🌐</div>
          </div>
        </div>
        <div class="form-group checkbox-group">
          <label class="checkbox-container">
            <input type="checkbox" id="dryRun" v-model="dryRun" />
            <span class="checkmark"></span>
            Dry Run (-d, --dry-run)
          </label>
        </div>
        <div class="form-group checkbox-group">
          <label class="checkbox-container">
            <input type="checkbox" id="verbose" v-model="verbose" />
            <span class="checkmark"></span>
            Enable Verbose Logging (-v, --verbose)
          </label>
        </div>
        <div class="form-group">
          <label for="logLevel">Log Level (--log-level):</label>
          <div class="select-wrapper">
            <select id="logLevel" v-model="logLevel">
              <option value="debug">debug</option>
              <option value="info">info</option>
              <option value="warn">warn</option>
              <option value="error">error</option>
              <option value="silent">silent</option>
              <option value="none">none</option>
            </select>
            <div class="select-arrow">▼</div>
          </div>
        </div>
      </section>

      <div class="actions">
        <button @click="executePortapack" :disabled="isProcessing" class="primary-button">
          {{ isProcessing ? 'Bundling...' : '📦 Bundle!' }}
        </button>
        <button @click="resetOptions" :disabled="isProcessing" class="secondary-button">Reset Options</button>
      </div>

      <section class="output-log card">
        <h2>Command Output</h2>
        <pre>{{ commandOutput }}</pre>
      </section>
    </main>
  </div>
</template>

<style>
/* Base styles from style.css and additional for App.vue */
html {
  background-color: rgba(27, 38, 54, 1); /* Base dark background */
  text-align: center;
}

body {
  margin: 0;
  font-family: "Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
}

@font-face {
  font-family: "Nunito";
  font-style: normal;
  font-weight: 400;
  src: local(""), url("./assets/fonts/nunito-v16-latin-regular.woff2") format("woff2");
}

#app {
  height: 100vh;
  text-align: center;
}

/* Light/Dark Mode variables */
:root {
  /* Dark mode colors */
  --bg-dark: rgba(27, 38, 54, 1);
  --text-dark: #ffffff;
  --card-bg-dark: rgba(35, 49, 70, 0.8);
  --border-dark: rgba(50, 70, 90, 0.7);
  --input-bg-dark: #2c3e50;
  --input-border-dark: #4a6572;
  --input-focus-dark: #5dade2;
  --checkbox-bg-dark: #34495e;
  --checkbox-checked-dark: #3498db;
  
  /* Light mode colors */
  --bg-light: linear-gradient(135deg, #ffd89b 0%, #19547b 100%);
  --text-light: #2c3e50;
  --card-bg-light: rgba(255, 255, 255, 0.95);
  --border-light: #e0e6ed;
  --input-bg-light: #ffffff;
  --input-border-light: #d1d9e6;
  --input-focus-light: #f39c12;
  --checkbox-bg-light: #f8f9fa;
  --checkbox-checked-light: #f39c12;
  
  /* Button colors */
  --btn-primary-dark: linear-gradient(135deg, #4CAF50, #45a049);
  --btn-primary-light: linear-gradient(135deg, #667eea, #764ba2);
  --btn-secondary-dark: linear-gradient(135deg, #6c757d, #5a6268);
  --btn-secondary-light: linear-gradient(135deg, #a8a8a8, #8d8d8d);
}

/* Theme application */
html[data-theme='dark'] {
  background: var(--bg-dark);
  color: var(--text-dark);
}

html[data-theme='light'] {
  background: var(--bg-light);
  color: var(--text-light);
}

/* General Layout */
.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  padding: 20px;
  box-sizing: border-box;
}

.dark-mode {
  color: var(--text-dark);
}

.light-mode {
  color: var(--text-light);
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 800px;
  margin-bottom: 30px;
  gap: 20px;
  position: relative;
}

.mascot {
  width: 80px;
  height: auto;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
}

h1 {
  font-size: 2.5em;
  margin: 0;
  font-weight: 700;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.light-mode h1 {
  color: var(--text-light);
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
}

.theme-toggle {
  position: absolute;
  right: 0;
  padding: 12px 20px;
  border-radius: 25px;
  cursor: pointer;
  border: none;
  font-weight: 600;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9em;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.dark-mode .theme-toggle {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.light-mode .theme-toggle {
  background: rgba(255, 255, 255, 0.9);
  color: var(--text-light);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.theme-toggle:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
}

.main-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  max-width: 800px;
}

.card {
  backdrop-filter: blur(10px);
  border-radius: 15px;
  padding: 25px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  text-align: left;
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

.dark-mode .card {
  background: var(--card-bg-dark);
  border-color: var(--border-dark);
}

.light-mode .card {
  background: var(--card-bg-light);
  border-color: var(--border-light);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}

.light-mode .card:hover {
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
}

.options-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

h2 {
  margin-top: 0;
  border-bottom: 2px solid;
  padding-bottom: 12px;
  margin-bottom: 25px;
  font-size: 1.4em;
  font-weight: 600;
}

.dark-mode h2 {
  color: var(--text-dark);
  border-color: var(--border-dark);
}

.light-mode h2 {
  color: var(--text-light);
  border-color: var(--border-light);
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  font-size: 0.95em;
}

.dark-mode .form-group label {
  color: var(--text-dark);
}

.light-mode .form-group label {
  color: var(--text-light);
}

/* Enhanced Input Styles */
.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-wrapper input {
  width: 100%;
  padding: 15px 50px 15px 15px;
  border-radius: 10px;
  border: 2px solid;
  font-size: 1em;
  transition: all 0.3s ease;
  box-sizing: border-box;
  font-family: inherit;
}

.dark-mode .input-wrapper input {
  background: var(--input-bg-dark);
  border-color: var(--input-border-dark);
  color: var(--text-dark);
}

.light-mode .input-wrapper input {
  background: var(--input-bg-light);
  border-color: var(--input-border-light);
  color: var(--text-light);
}

.input-wrapper input:focus {
  outline: none;
  transform: translateY(-1px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
}

.dark-mode .input-wrapper input:focus {
  border-color: var(--input-focus-dark);
  box-shadow: 0 0 0 3px rgba(93, 173, 226, 0.2);
}

.light-mode .input-wrapper input:focus {
  border-color: var(--input-focus-light);
  box-shadow: 0 0 0 3px rgba(243, 156, 18, 0.2);
}

.input-icon {
  position: absolute;
  right: 15px;
  font-size: 1.2em;
  opacity: 0.6;
  pointer-events: none;
}

/* Enhanced Select Styles */
.select-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.select-wrapper select {
  width: 100%;
  padding: 15px 40px 15px 15px;
  border-radius: 10px;
  border: 2px solid;
  font-size: 1em;
  transition: all 0.3s ease;
  box-sizing: border-box;
  appearance: none;
  cursor: pointer;
  font-family: inherit;
}

.dark-mode .select-wrapper select {
  background: var(--input-bg-dark);
  border-color: var(--input-border-dark);
  color: var(--text-dark);
}

.light-mode .select-wrapper select {
  background: var(--input-bg-light);
  border-color: var(--input-border-light);
  color: var(--text-light);
}

.select-wrapper select:focus {
  outline: none;
  transform: translateY(-1px);
}

.dark-mode .select-wrapper select:focus {
  border-color: var(--input-focus-dark);
  box-shadow: 0 0 0 3px rgba(93, 173, 226, 0.2);
}

.light-mode .select-wrapper select:focus {
  border-color: var(--input-focus-light);
  box-shadow: 0 0 0 3px rgba(243, 156, 18, 0.2);
}

.select-arrow {
  position: absolute;
  right: 15px;
  font-size: 0.8em;
  opacity: 0.6;
  pointer-events: none;
  transition: transform 0.3s ease;
}

.select-wrapper:hover .select-arrow {
  transform: translateY(-1px);
}

/* Enhanced Checkbox Styles */
.checkbox-container {
  display: flex;
  align-items: center;
  cursor: pointer;
  margin-bottom: 12px;
  padding: 10px;
  border-radius: 8px;
  transition: all 0.3s ease;
  font-weight: 500;
}

.checkbox-container:hover {
  background: rgba(255, 255, 255, 0.05);
}

.light-mode .checkbox-container:hover {
  background: rgba(0, 0, 0, 0.03);
}

.checkbox-container.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.checkbox-container input[type="checkbox"] {
  position: absolute;
  opacity: 0;
  cursor: pointer;
}

.checkmark {
  height: 20px;
  width: 20px;
  border-radius: 4px;
  border: 2px solid;
  margin-right: 12px;
  position: relative;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.dark-mode .checkmark {
  background: var(--checkbox-bg-dark);
  border-color: var(--input-border-dark);
}

.light-mode .checkmark {
  background: var(--checkbox-bg-light);
  border-color: var(--input-border-light);
}

.checkbox-container input:checked ~ .checkmark {
  transform: scale(1.1);
}

.dark-mode .checkbox-container input:checked ~ .checkmark {
  background: var(--checkbox-checked-dark);
  border-color: var(--checkbox-checked-dark);
}

.light-mode .checkbox-container input:checked ~ .checkmark {
  background: var(--checkbox-checked-light);
  border-color: var(--checkbox-checked-light);
}

.checkmark:after {
  content: "";
  position: absolute;
  display: none;
  left: 6px;
  top: 2px;
  width: 6px;
  height: 10px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.checkbox-container input:checked ~ .checkmark:after {
  display: block;
}

.checkbox-group {
  display: block;
  margin-bottom: 0;
}

.actions {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 30px;
}

button {
  padding: 15px 30px;
  border: none;
  border-radius: 12px;
  font-size: 1.1em;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
}

button.primary-button {
  background: var(--btn-primary-dark);
  color: white;
}

.light-mode button.primary-button {
  background: var(--btn-primary-light);
}

button.primary-button:hover:not(:disabled) {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
}

button.secondary-button {
  background: var(--btn-secondary-dark);
  color: white;
}

.light-mode button.secondary-button {
  background: var(--btn-secondary-light);
}

button.secondary-button:hover:not(:disabled) {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
}

.output-log pre {
  padding: 20px;
  border-radius: 10px;
  max-height: 300px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: 'Fira Code', 'Courier New', Courier, monospace;
  font-size: 0.9em;
  border: 2px solid;
  margin: 0;
  line-height: 1.5;
}

.dark-mode .output-log pre {
  background: rgba(0, 0, 0, 0.5);
  color: #eee;
  border-color: var(--border-dark);
}

.light-mode .output-log pre {
  background: rgba(248, 249, 250, 0.9);
  color: var(--text-light);
  border-color: var(--border-light);
}

/* Responsive Design */
@media (max-width: 768px) {
  .app-header {
    flex-direction: column;
    gap: 15px;
  }
  
  .theme-toggle {
    position: static;
  }
  
  .options-section {
    grid-template-columns: 1fr;
  }
  
  .actions {
    flex-direction: column;
    align-items: center;
  }
  
  button {
    width: 100%;
    max-width: 300px;
  }
}
</style>