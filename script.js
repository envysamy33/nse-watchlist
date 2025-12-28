// API Endpoints
const NSE_API = 'http://nse-api-khaki.vercel.app:5000';
const NEWS_API = 'https://api.marketaux.com/v1/news/all';
const NEWS_KEY = 'YOUR_MARKETAUX_KEY'; // Get free at marketaux.com

// Global variables
let watchlist = JSON.parse(localStorage.getItem('watchlist')) || ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK'];
let chart = null;

// Market timing check (IST)
function isMarketOpen() {
    const now = new Date();
    const istOffset = 5.5 * 60; // IST offset in minutes
    const istTime = new Date(now.getTime() + (istOffset * 60 * 1000));
    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();
    const timeInMinutes = hours * 60 + minutes;
    return timeInMinutes >= 555 && timeInMinutes <= 945; // 9:15 AM to 3:30 PM IST
}

async function init() {
    updateMarketStatus();
    loadNews();
    updateWatchlist();
    setInterval(updateWatchlist, 30000); // Update every 30 seconds
    setInterval(loadNews, 60000); // Update news every minute
}

async function updateMarketStatus() {
    const status = document.getElementById('market-status');
    if (isMarketOpen()) {
        status.textContent = 'Market Open';
        status.style.background = '#00ff88';
    } else {
        status.textContent = 'Market Closed';
        status.style.background = '#ff4757';
    }
}

async function loadNews() {
    try {
        const response = await fetch(`${NEWS_API}?countries=in&topics=finance&limit=6&api_token=${NEWS_KEY}`);
        const data = await response.json();
        
        const newsBox = document.getElementById('news-box');
        newsBox.innerHTML = '';
        
        if (data.data) {
            data.data.slice(0, 6).forEach(article => {
                const newsItem = document.createElement('div');
                newsItem.className = 'news-item';
                newsItem.innerHTML = `
                    <h4>${article.title}</h4>
                    <p>${article.description || article.summary}</p>
                    <small>${new Date(article.published_at).toLocaleDateString()}</small>
                `;
                newsBox.appendChild(newsItem);
            });
        }
    } catch (error) {
        console.error('News fetch failed:', error);
        document.getElementById('news-box').innerHTML = '<div class="news-item">News temporarily unavailable</div>';
    }
}

async function updateWatchlist() {
    const list = document.getElementById('stock-list');
    list.innerHTML = '<li class="stock-item loading">Loading watchlist...</li>';
    
    for (let symbol of watchlist) {
        try {
            const response = await fetch(`${NSE_API}/quote/${symbol}`);
            const data = await response.json();
            
            if (data && data.price !== undefined) {
                createStockItem(symbol, data);
            }
        } catch (error) {
            console.error(`Failed to fetch ${symbol}:`, error);
        }
    }
}

function createStockItem(symbol, data) {
    const list = document.getElementById('stock-list');
    const li = document.createElement('li');
    li.className = 'stock-item';
    li.onclick = () => showDetails(symbol);
    
    const changeClass = data.change > 0 ? 'up' : 'down';
    li.innerHTML = `
        <div class="stock-info">
            <div class="stock-name">${data.symbol || symbol} (${data.series || ''})</div>
            <div class="stock-price">${data.price?.toFixed(2) || 'N/A'}</div>
            <div class="change ${changeClass}">${data.change?.toFixed(2) || 0}%</div>
        </div>
        <button class="details-btn" onclick="event.stopPropagation(); showDetails('${symbol}')">
            <i class="fas fa-chart-area"></i> Details
        </button>
    `;
    list.appendChild(li);
}

function addToWatchlist() {
    const input = document.getElementById('add-stock');
    const symbol = input.value.toUpperCase().trim();
    
    if (symbol && !watchlist.includes(symbol)) {
        watchlist.push(symbol);
        localStorage.setItem('watchlist', JSON.stringify(watchlist));
        input.value = '';
        updateWatchlist();
    }
}

function clearWatchlist() {
    if (confirm('Clear entire watchlist?')) {
        watchlist = [];
        localStorage.removeItem('watchlist');
        document.getElementById('stock-list').innerHTML = '<li class="stock-item">Watchlist empty. Add stocks to begin.</li>';
    }
}

async function showDetails(symbol) {
    const modal = document.getElementById('stock-modal');
    const title = document.getElementById('modal-title');
    const details = document.getElementById('stock-details');
    
    title.textContent = `${symbol} Details`;
    
    try {
        // Live quote
        const quote = await fetch(`${NSE_API}/quote/${symbol}`).then(r => r.json());
        
        // Mock historical data (replace with Alpha Vantage for real history)
        const history = generateMockHistory();
        
        details.innerHTML = `
            <div class="stock-info-grid">
                <div class="info-card">
                    <div class="info-value">${quote.price?.toFixed(2) || 'N/A'}</div>
                    <div>Current Price</div>
                </div>
                <div class="info-card">
                    <div class="info-value">${quote.change?.toFixed(2) || 0}%</div>
                    <div>Change</div>
                </div>
                <div class="info-card">
                    <div class="info-value">${quote.volume || 'N/A'}</div>
                    <div>Volume</div>
                </div>
                <div class="info-card">
                    <div class="info-value">${quote['52W High'] || 'N/A'}</div>
                    <div>52W High</div>
                </div>
            </div>
        `;
        
        renderChart(history, symbol);
        modal.style.display = 'block';
    } catch (error) {
        details.innerHTML = '<p>Error loading data</p>';
        modal.style.display = 'block';
    }
}

function generateMockHistory() {
    const days = 30;
    const data = [];
    let price = 2500;
    for (let i = days - 1; i >= 0; i--) {
        price += (Math.random() - 0.5) * 50;
        data.push({
            date: new Date(Date.now() - i * 86400000).toLocaleDateString(),
            price: Math.max(100, price)
        });
    }
    return data;
}

function renderChart(history, symbol) {
    const ctx = document.getElementById('price-chart').getContext('2d');
    
    if (chart) chart.destroy();
    
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: history.map(h => h.date),
            datasets: [{
                label: `${symbol} Price`,
                data: history.map(h => h.price),
                borderColor: '#00d4ff',
                backgroundColor: 'rgba(0, 212, 255, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: false }
            }
        }
    });
}

function closeModal() {
    document.getElementById('stock-modal').style.display = 'none';
}

// Close modal on outside click
window.onclick = function(event) {
    const modal = document.getElementById('stock-modal');
    if (event.target === modal) closeModal();
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
