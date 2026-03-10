// AI Service v3.0 - Enhanced for Business Automation with Hugging Face JavaScript SDK
// Optimized for direct browser usage via ESM CDN
// Features: Rate limiting protection, better error handling, retry logic, and fallback models

import { InferenceClient } from 'https://cdn.jsdelivr.net/npm/@huggingface/inference@2.6.4/+esm';

class AIService {
    constructor() {
        this.provider = 'HUGGINGFACE';
        this.hfToken = "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";
        this.primaryModel = "mistralai/Mistral-7B-Instruct-v0.3";
        this.fallbackModels = [
            "microsoft/DialoGPT-medium",
            "facebook/blenderbot-400M-distill",
            "google/flan-t5-base"
        ];
        this.retryAttempts = 3;
        this.retryDelay = 1000;
        this.rateLimitDelay = 5000;

        this.hf = new InferenceClient(this.hfToken);

        this.responseCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000;
    }

    async getResponse(prompt, options = {}) {
        const { maxTokens = 500, temperature = 0.7, useCache = true } = options;
        const cacheKey = `${prompt.slice(0, 100)}_${maxTokens}_${temperature}`;

        if (useCache && this.responseCache.has(cacheKey)) {
            const cached = this.responseCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.response;
            }
        }

        const response = await this.callHuggingFaceWithRetry(prompt, { maxTokens, temperature });

        if (useCache && response && !response.includes('Error')) {
            this.responseCache.set(cacheKey, {
                response,
                timestamp: Date.now()
            });
        }

        return response;
    }

    async callHuggingFaceWithRetry(prompt, options = {}) {
        const { maxTokens = 500, temperature = 0.7 } = options;

        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                const response = await this.callHuggingFaceAPI(prompt, this.primaryModel, { maxTokens, temperature });
                if (response && !response.includes('Error')) {
                    return response;
                }

                for (const fallbackModel of this.fallbackModels) {
                    const fallbackResponse = await this.callHuggingFaceAPI(prompt, fallbackModel, { maxTokens, temperature });
                    if (fallbackResponse && !fallbackResponse.includes('Error')) {
                        console.log(`Using fallback model: ${fallbackModel}`);
                        return fallbackResponse;
                    }
                }

                throw new Error('All models failed to respond');

            } catch (error) {
                console.error(`Attempt ${attempt} failed:`, error);

                if (attempt < this.retryAttempts) {
                    if (error.message.includes('rate limit') || error.message.includes('429')) {
                        await this.delay(this.rateLimitDelay);
                    } else {
                        await this.delay(this.retryDelay * attempt);
                    }
                } else {
                    return `Assistant Error: ${error.message}. Please try again later or check your API token.`;
                }
            }
        }
    }

    async callHuggingFaceAPI(prompt, model, options = {}) {
        const { maxTokens = 500, temperature = 0.7 } = options;

        try {
            const response = await this.hf.textGeneration({
                model: model,
                inputs: `<s>[INST] ${prompt} [/INST]`,
                parameters: {
                    max_new_tokens: maxTokens,
                    temperature: temperature,
                    return_full_text: false,
                    do_sample: true,
                    top_p: 0.95,
                    top_k: 50
                }
            });

            if (response && response.generated_text) {
                return response.generated_text.trim();
            } else if (typeof response === 'string') {
                return response.trim();
            } else {
                return "Received empty response from AI.";
            }

        } catch (error) {
            if (error.message.includes('Authorization')) {
                throw new Error('Invalid HF token. Check your settings.');
            } else if (error.message.includes('Model')) {
                throw new Error(`Model unavailable or requires a token.`);
            } else {
                throw new Error(error.message);
            }
        }
    }

    async generateSmartAlerts(stockData, salesData) {
        try {
            const prompt = this.buildBusinessAnalysisPrompt(stockData, salesData);
            const suggestion = await this.getResponse(prompt, { maxTokens: 50, temperature: 0.3 });
            return this.truncateToWords(suggestion, 20);
        } catch (error) {
            return 'Check inventory levels and sales trends.';
        }
    }

    async generateBusinessInsights(stockData, salesData, options = {}) {
        const { analysisType = 'full' } = options;
        try {
            let prompt;
            switch (analysisType) {
                case 'pricing': prompt = this.buildPricingAnalysisPrompt(stockData, salesData); break;
                case 'restocking': prompt = this.buildRestockingAnalysisPrompt(stockData, salesData); break;
                case 'customers': prompt = this.buildCustomerAnalysisPrompt(stockData, salesData); break;
                default: prompt = this.buildFullBusinessAuditPrompt(stockData, salesData);
            }

            const insights = await this.getResponse(prompt, { maxTokens: 800, temperature: 0.5 });
            return this.formatInsights(insights, analysisType);
        } catch (error) {
            return this.getDefaultInsights(analysisType);
        }
    }

    buildBusinessAnalysisPrompt(stockData, salesData) {
        return `
        Analyze this textile business data:
        Stock: ${this.summarizeStockData(stockData)}
        Recent Sales: ${this.summarizeSalesData(salesData)}
        
        Return ONE critical business alert or a proactive suggestion.
        Keep it strictly under 20 words.
        `;
    }

    buildFullBusinessAuditPrompt(stockData, salesData) {
        return `
        As a textile business analyst for RK Transportations, perform a full audit:
        INVENTORY: ${this.summarizeStockData(stockData)}
        SALES: ${this.summarizeSalesData(salesData)}
        
        Provide insights on Pricing, Restocking, and Target Customers.
        `;
    }

    buildPricingAnalysisPrompt(stockData, salesData) {
        return `Analyze pricing for: ${this.summarizeStockData(stockData)}. Sales: ${this.summarizeSalesData(salesData)}`;
    }

    buildRestockingAnalysisPrompt(stockData, salesData) {
        return `Analyze restocking for: ${this.summarizeStockData(stockData)}. Sales: ${this.summarizeSalesData(salesData)}`;
    }

    buildCustomerAnalysisPrompt(stockData, salesData) {
        return `Analyze customers for: ${this.summarizeStockData(stockData)}. Sales: ${this.summarizeSalesData(salesData)}`;
    }

    summarizeStockData(stockData) {
        return (stockData || []).map(s => `${s.type}(${s.qty}KG)`).join(", ") || 'No stock';
    }

    summarizeSalesData(salesData) {
        return (salesData || []).slice(0, 5).map(sl => `${sl.itemType}(${sl.qty}KG)`).join(", ") || 'No sales';
    }

    truncateToWords(text, maxWords) {
        const words = text.split(/\s+/);
        return words.length <= maxWords ? text : words.slice(0, maxWords).join(' ') + '...';
    }

    formatInsights(insights, analysisType) {
        const sections = insights.split('\n').filter(line => line.trim());
        let formatted = `<div class="ai-insights-${analysisType}">`;
        sections.forEach(section => {
            formatted += `<div class="insight-text mb-2">${section}</div>`;
        });
        formatted += '</div>';
        return formatted;
    }

    getDefaultInsights(analysisType) {
        return '<div class="insight-text">Check your inventory levels for optimal performance.</div>';
    }

    delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

    setToken(token) {
        this.hfToken = token;
        this.hf = new InferenceClient(token);
        this.responseCache.clear();
    }
}

const aiApp = new AIService();
window.aiApp = aiApp; // Attach to window for app.js access

async function triggerAutoAI() {
    const alertBox = document.getElementById('smart-alert-container');
    if (!alertBox) return;
    alertBox.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> RK AI is analyzing...';
    try {
        const suggestion = await aiApp.generateSmartAlerts(window.stockData || [], window.salesData || []);
        alertBox.innerHTML = `<i class="fa-solid fa-lightbulb text-warning me-2"></i> ${suggestion}`;
    } catch (err) {
        alertBox.innerHTML = '<i class="fa-solid fa-circle-exclamation text-danger me-2"></i> RK AI offline.';
    }
}

async function askAI(query) {
    const aiContent = document.getElementById('ai-insight-content');
    if (!aiContent || !query.trim()) return;

    aiContent.innerHTML = `<div class="text-info mb-2"><strong>You:</strong> ${query}</div>` + aiContent.innerHTML;
    const typingId = 'typing-' + Date.now();
    aiContent.innerHTML = `<div id="${typingId}" class="text-warning mb-3"><em>RK ai assistant is thinking...</em></div>` + aiContent.innerHTML;

    try {
        const response = await aiApp.getResponse(query);
        const typingElement = document.getElementById(typingId);
        if (typingElement) {
            typingElement.outerHTML = `<div class="text-warning mb-3"><strong>RK ai assistant:</strong> ${response}</div>`;
        }
    } catch (err) {
        const typingElement = document.getElementById(typingId);
        if (typingElement) {
            typingElement.outerHTML = `<div class="text-danger mb-3"><strong>Error:</strong> Unable to get response</div>`;
        }
    }
}

async function generateBusinessInsights(analysisType = 'full') {
    const aiContent = document.getElementById('ai-insight-content');
    if (!aiContent) return;
    aiContent.innerHTML = '<div class="spinner-border text-warning me-2"></div> Performing RK Business Analysis...';
    try {
        const insights = await aiApp.generateBusinessInsights(window.stockData || [], window.salesData || [], { analysisType });
        aiContent.innerHTML = insights;
    } catch (err) {
        aiContent.innerHTML = '<div class="text-danger">Analysis failed. Try again soon.</div>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const askBtn = document.getElementById('ask-ai-btn');
    const userQueryInput = document.getElementById('ai-user-query');
    const generateBtn = document.getElementById('generate-ai-insight');
    const analysisTypeSelect = document.getElementById('analysis-type');

    if (askBtn && userQueryInput) {
        askBtn.addEventListener('click', () => {
            askAI(userQueryInput.value.trim());
            userQueryInput.value = '';
        });
        userQueryInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                askAI(userQueryInput.value.trim());
                userQueryInput.value = '';
            }
        });
    }

    if (generateBtn) {
        generateBtn.addEventListener('click', () => {
            const type = analysisTypeSelect ? analysisTypeSelect.value : 'full';
            generateBusinessInsights(type);
        });
    }
});

window.triggerAutoAI = triggerAutoAI;
window.askAI = askAI;
window.generateBusinessInsights = generateBusinessInsights;
