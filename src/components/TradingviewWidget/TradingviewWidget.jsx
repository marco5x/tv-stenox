import { useEffect, useRef } from 'react';
// import { widget  } from '../../charting_library';
import { widget } from '../../../public/charting_library';
import datafeed from './api-cryptocompare/datafeed';

export const TradingviewWidget = () => {
    const chartContainerRef = useRef();

    useEffect(() => {
        let currentUrl = window.location.href;
        let url = new URL(currentUrl);
        const symbol = url.searchParams.get('symbol') === undefined ? "BTC" : url.searchParams.get('symbol');

        const storageKeys = {
            charts: "LocalStorageSaveLoadAdapter_charts",
            studyTemplates: "LocalStorageSaveLoadAdapter_studyTemplates",
            drawingTemplates: "LocalStorageSaveLoadAdapter_drawingTemplates",
            chartTemplates: "LocalStorageSaveLoadAdapter_chartTemplates",
            drawings: "LocalStorageSaveLoadAdapter_drawings",
        };

        class LocalStorageSaveLoadAdapter {
            _charts = [];
            _studyTemplates = [];
            _drawingTemplates = [];
            _chartTemplates = [];
            _isDirty = false;
            _drawings = {};

            constructor() {
                this._charts = this._getFromLocalStorage(storageKeys.charts) ?? [];
                this._studyTemplates =
                    this._getFromLocalStorage(storageKeys.studyTemplates) ?? [];
                this._drawingTemplates =
                    this._getFromLocalStorage(storageKeys.drawingTemplates) ?? [];
                this._chartTemplates =
                    this._getFromLocalStorage(storageKeys.chartTemplates) ?? [];
                this._drawings = this._getFromLocalStorage(storageKeys.drawings) ?? {};

                setInterval(() => {
                    if (this._isDirty) {
                        this._saveAllToLocalStorage();
                        this._isDirty = false;
                    }
                }, 1000);
            }

            getAllCharts() {
                return Promise.resolve(this._charts);
            }

            removeChart(id) {
                for (var i = 0; i < this._charts.length; ++i) {
                    if (this._charts[i].id === id) {
                        this._charts.splice(i, 1);
                        this._isDirty = true;
                        return Promise.resolve();
                    }
                }
                return Promise.reject(new Error("The chart does not exist"));
            }

            saveChart(chartData) {
                if (!chartData.id) {
                    chartData.id = this._generateUniqueChartId();
                } else {
                    this.removeChart(chartData.id);
                }
                const savedChartData = {
                    ...chartData,
                    id: chartData.id,
                    timestamp: Math.round(Date.now() / 1000),
                };
                this._charts.push(savedChartData);
                this._isDirty = true;
                return Promise.resolve(savedChartData.id);
            }

            getChartContent(id) {
                for (var i = 0; i < this._charts.length; ++i) {
                    if (this._charts[i].id === id) {
                        return Promise.resolve(this._charts[i].content);
                    }
                }
                return Promise.reject(new Error("The chart does not exist"));
            }

            removeStudyTemplate(studyTemplateData) {
                for (var i = 0; i < this._studyTemplates.length; ++i) {
                    if (this._studyTemplates[i].name === studyTemplateData.name) {
                        this._studyTemplates.splice(i, 1);
                        this._isDirty = true;
                        return Promise.resolve();
                    }
                }
                return Promise.reject(new Error("The study template does not exist"));
            }

            getStudyTemplateContent(studyTemplateData) {
                for (var i = 0; i < this._studyTemplates.length; ++i) {
                    if (this._studyTemplates[i].name === studyTemplateData.name) {
                        return Promise.resolve(this._studyTemplates[i].content);
                    }
                }
                return Promise.reject(new Error("The study template does not exist"));
            }

            saveStudyTemplate(studyTemplateData) {
                for (var i = 0; i < this._studyTemplates.length; ++i) {
                    if (this._studyTemplates[i].name === studyTemplateData.name) {
                        this._studyTemplates.splice(i, 1);
                        break;
                    }
                }
                this._studyTemplates.push(studyTemplateData);
                this._isDirty = true;
                return Promise.resolve();
            }

            getAllStudyTemplates() {
                return Promise.resolve(this._studyTemplates);
            }

            removeDrawingTemplate(toolName, templateName) {
                for (var i = 0; i < this._drawingTemplates.length; ++i) {
                    if (
                        this._drawingTemplates[i].name === templateName &&
                        this._drawingTemplates[i].toolName === toolName
                    ) {
                        this._drawingTemplates.splice(i, 1);
                        this._isDirty = true;
                        return Promise.resolve();
                    }
                }
                return Promise.reject(new Error("The drawing template does not exist"));
            }

            loadDrawingTemplate(toolName, templateName) {
                for (var i = 0; i < this._drawingTemplates.length; ++i) {
                    if (
                        this._drawingTemplates[i].name === templateName &&
                        this._drawingTemplates[i].toolName === toolName
                    ) {
                        return Promise.resolve(this._drawingTemplates[i].content);
                    }
                }
                return Promise.reject(new Error("The drawing template does not exist"));
            }

            saveDrawingTemplate(toolName, templateName, content) {
                for (var i = 0; i < this._drawingTemplates.length; ++i) {
                    if (
                        this._drawingTemplates[i].name === templateName &&
                        this._drawingTemplates[i].toolName === toolName
                    ) {
                        this._drawingTemplates.splice(i, 1);
                        break;
                    }
                }
                this._drawingTemplates.push({
                    name: templateName,
                    content: content,
                    toolName: toolName,
                });
                this._isDirty = true;
                return Promise.resolve();
            }

            getDrawingTemplates() {
                return Promise.resolve(
                    this._drawingTemplates.map(function (template) {
                        return template.name;
                    })
                );
            }

            async getAllChartTemplates() {
                return this._chartTemplates.map((x) => x.name);
            }

            async saveChartTemplate(templateName, content) {
                const theme = this._chartTemplates.find((x) => x.name === templateName);
                if (theme) {
                    theme.content = content;
                } else {
                    this._chartTemplates.push({ name: templateName, content });
                }
                this._isDirty = true;
            }

            async removeChartTemplate(templateName) {
                this._chartTemplates = this._chartTemplates.filter(
                    (x) => x.name !== templateName
                );
                this._isDirty = true;
            }

            async getChartTemplateContent(templateName) {
                const content = this._chartTemplates.find(
                    (x) => x.name === templateName
                )?.content;
                return {
                    content: structuredClone(content),
                };
            }

            // Only used if `saveload_separate_drawings_storage` featureset is enabled
            async saveLineToolsAndGroups(layoutId, chartId, state) {
                const drawings = state.sources;
                if (!drawings) return;

                if (!this._drawings[this._getDrawingKey(layoutId, chartId)]) {
                    this._drawings[this._getDrawingKey(layoutId, chartId)] = {};
                }

                for (let [key, state] of drawings) {
                    if (state === null) {
                        delete this._drawings[this._getDrawingKey(layoutId, chartId)][key];
                    } else {
                        this._drawings[this._getDrawingKey(layoutId, chartId)][key] = state;
                    }
                }
                this._isDirty = true;
            }

            // Only used if `saveload_separate_drawings_storage` featureset is enabled
            async loadLineToolsAndGroups(
                layoutId,
                chartId,
                _requestType,
                _requestContext
            ) {
                if (!layoutId) return null;

                const rawSources = this._drawings[this._getDrawingKey(layoutId, chartId)];

                if (!rawSources) return null;

                const sources = new Map();

                for (let [key, state] of Object.entries(rawSources)) {
                    sources.set(key, state);
                }

                return {
                    sources,
                };
            }

            _generateUniqueChartId() {
                const existingIds = this._charts.map((i) => i.id);
                while (true) {
                    const uid = Math.random().toString(16).slice(2);

                    if (!existingIds.includes(uid)) return uid;
                }
            }

            _getFromLocalStorage(key) {
                const dataFromStorage = window.localStorage.getItem(key);
                return JSON.parse(dataFromStorage || "null");
            }

            _saveToLocalStorage(key, data) {
                const dataString = JSON.stringify(data);
                window.localStorage.setItem(key, dataString);
            }

            _saveAllToLocalStorage() {
                this._saveToLocalStorage(storageKeys.charts, this._charts);
                this._saveToLocalStorage(storageKeys.studyTemplates, this._studyTemplates);
                this._saveToLocalStorage(
                    storageKeys.drawingTemplates,
                    this._drawingTemplates
                );
                this._saveToLocalStorage(storageKeys.chartTemplates, this._chartTemplates);
                this._saveToLocalStorage(storageKeys.drawings, this._drawings);
            }

            _getDrawingKey(layoutId, chartId) {
                return `${layoutId}/${chartId}`;
            }
        }

        const customCSS = `
            #theme-toggle {
                display: flex;
                flex-direction: row;
                align-items: center;
                gap: 12px;
            }
            .switcher {
                display: inline-block;
                position: relative;
                flex: 0 0 auto;
                width: 38px;
                height: 20px;
                vertical-align: middle;
                z-index: 0;
                -webkit-tap-highlight-color: transparent;
            }

            .switcher input {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                opacity: 0;
                z-index: 1;
                cursor: default;
            }

            .switcher .thumb-wrapper {
                display: block;
                border-radius: 20px;
                position: relative;
                 z-index: 0;
                width: 100%;
                height: 100%;
            }

            .switcher .track {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                border-radius: 20px;
                background-color: #a3a6af;
            }

            #theme-switch:checked + .thumb-wrapper .track {
                background-color: #2962ff;
            }

            .switcher .thumb {
                display: block;
                width: 14px;
                height: 14px;
                border-radius: 14px;
                transition-duration: 250ms;
                transition-property: transform;
                transition-timing-function: ease-out;
                transform: translate(3px, 3px);
                background: #ffffff;
            }

            [dir=rtl] .switcher .thumb {
                transform: translate(-3px, 3px);
            }

            .switcher input:checked + .thumb-wrapper .thumb {
                transform: translate(21px, 3px);
            }

            [dir=rtl] .switcher input:checked + .thumb-wrapper .thumb {
                transform: translate(-21px, 3px);
            }

            #documentation-toolbar-button:focus-visible:before,
            .switcher:focus-within:before {
                content: '';
                display: block;
                position: absolute;
                top: -2px;
                right: -2px;
                bottom: -2px;
                left: -2px;
                border-radius: 16px;
                outline: #2962FF solid 2px;
            }`;

        const cssBlob = new Blob([customCSS], {
            type: "text/css",
        });

        const cssBlobUrl = URL.createObjectURL(cssBlob);

        const isDarkMode = document.body.classList.contains('dark-mode');
        const theme = isDarkMode ? 'dark' : 'light';

        const widgetOptions = {
            symbol: `Binance:${symbol}/USDT`,
            datafeed,
            locale: 'es',
            interval: '1',
            container: chartContainerRef.current,
            library_path: '/charting_library/',
            charts_storage_url: 'https://saveload.tradingview.com',
            charts_storage_api_version: '1.1',
            client_id: location?.host,
            user_id: 'stenox',
            autosize: true,
            custom_css_url: cssBlobUrl,
            symbol_search_request_delay: 1500,
            save_load_adapter: new LocalStorageSaveLoadAdapter(),
            disabled_features: ["header_fullscreen_button"],
            enabled_features: ['chart_property_page_trading', 'show_exchange_logos', 'show_symbol_logos'],
            theme: 'Dark',
        };

        const widgets = new widget(widgetOptions);

        widgets.headerReady().then(() => {
            const customButton = widgets.createButton({
                useTradingViewStyle: false,
                align: "right",
            });

            const themeToggleEl = widgets.createButton({
                useTradingViewStyle: false,
                align: "right",
            });

            themeToggleEl.dataset.internalAllowKeyboardNavigation = "true";
            themeToggleEl.id = "theme-toggle";
            themeToggleEl.innerHTML = `<label for="theme-switch" id="theme-switch-label">Light/Dark</label>
        <div class="switcher">
            <input type="checkbox" id="theme-switch" tabindex="-1">
            <span class="thumb-wrapper">
                <span class="track"></span>
                <span class="thumb"></span>
            </span>
        </div>`;
            themeToggleEl.title = "Cambiar tema";
            const checkboxEl = themeToggleEl.querySelector("#theme-switch");
            checkboxEl.checked = theme === "dark";
            checkboxEl.addEventListener("change", function () {
                const themeToSet = this.checked ? "dark" : "light";
                widgets.changeTheme(themeToSet, { disableUndo: true });
            });

            customButton.dataset.internalAllowKeyboardNavigation = "true";
            customButton.innerHTML = `<button id="button-size" style="background-color: transparent; border: none; color: #dedede)">
            <svg width="18px" height="18px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M1.25 4C1.25 2.48122 2.48122 1.25 4 1.25H8C8.41421 1.25 8.75 1.58579 8.75 2C8.75 2.41421 8.41421 2.75 8 2.75H4C3.30964 2.75 2.75 3.30964 2.75 4V8C2.75 8.41421 2.41421 8.75 2 8.75C1.58579 8.75 1.25 8.41421 1.25 8V4Z" fill="currentColor"/>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M20 1.25C21.5188 1.25 22.75 2.48122 22.75 4L22.75 8C22.75 8.41421 22.4142 8.75 22 8.75C21.5858 8.75 21.25 8.41421 21.25 8L21.25 4C21.25 3.30964 20.6904 2.75 20 2.75L16 2.75C15.5858 2.75 15.25 2.41421 15.25 2C15.25 1.58579 15.5858 1.25 16 1.25L20 1.25Z" fill="currentColor"/>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M22.75 20C22.75 21.5188 21.5188 22.75 20 22.75L16 22.75C15.5858 22.75 15.25 22.4142 15.25 22C15.25 21.5858 15.5858 21.25 16 21.25L20 21.25C20.6904 21.25 21.25 20.6904 21.25 20L21.25 16C21.25 15.5858 21.5858 15.25 22 15.25C22.4142 15.25 22.75 15.5858 22.75 16L22.75 20Z" fill="currentColor"/>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M1.25 20C1.25 21.5188 2.48122 22.75 4 22.75L8 22.75C8.41421 22.75 8.75 22.4142 8.75 22C8.75 21.5858 8.41421 21.25 8 21.25L4 21.25C3.30964 21.25 2.75 20.6904 2.75 20L2.75 16C2.75 15.5858 2.41421 15.25 2 15.25C1.58579 15.25 1.25 15.5858 1.25 16L1.25 20Z" fill="currentColor"/>
            </svg>
        </Button>`;
            customButton.title = "Pantalla Completa";

            customButton.addEventListener("click", function () {
                const iframe = chartContainerRef.current

                if (iframe.requestFullscreen) {
                    iframe.requestFullscreen(); // Para navegadores modernos
                } else if (iframe.mozRequestFullScreen) { // Firefox
                    iframe.mozRequestFullScreen();
                } else if (iframe.webkitRequestFullscreen) { // Chrome, Safari
                    iframe.webkitRequestFullscreen();
                }
            });
        });

    }, []);

    return <div ref={chartContainerRef} style={{ height: '100vh', width: '100%' }} />;
};
