document.addEventListener('DOMContentLoaded', () => {
    // State variables
    let allReleases = [];
    let selectedUpdate = null;
    let currentFilter = 'all';
    let searchQuery = '';

    // DOM Elements
    const feedContainer = document.getElementById('feed-container');
    const btnRefresh = document.getElementById('btn-refresh');
    const refreshSpinner = document.getElementById('refresh-spinner');
    const btnText = document.getElementById('btn-text');
    const lastUpdatedTime = document.getElementById('last-updated-time');
    const searchInput = document.getElementById('search-input');
    const filterBadges = document.querySelectorAll('.filter-badge');
    const selectionBar = document.getElementById('selection-bar');
    const selectionType = document.getElementById('selection-type');
    const selectionDate = document.getElementById('selection-date');
    const btnSelectionTweet = document.getElementById('btn-selection-tweet');
    const btnSelectionCancel = document.getElementById('btn-selection-cancel');

    // Helper: Strip HTML tags to get clean plain text
    function stripHtml(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.body.textContent || "";
    }

    // Helper: Classify content into distinct topics for themed styling
    function classifyTopic(text) {
        const lower = text.toLowerCase();
        
        if (lower.match(/\b(weather|forecast|temperature|climate|rain|cloud|storm|snow|wind|meteorolog)\b/)) {
            return 'weather';
        }
        if (lower.match(/\b(sport|game|play|athlete|football|basketball|soccer|baseball|tennis|cricket|olympic|stadium|match)\b/)) {
            return 'sports';
        }
        if (lower.match(/\b(ai|ml|gemini|model|predict|prediction|embedding|embeddings|generative|training|inference|neuron)\b/)) {
            return 'ai';
        }
        if (lower.match(/\b(security|iam|permission|permissions|encrypt|encryption|key|keys|kms|access|auth|credentials|login|policy|policies)\b/)) {
            return 'security';
        }
        if (lower.match(/\b(table|tables|storage|bucket|partition|partitioned|iceberg|parquet|backup|restore|disk)\b/)) {
            return 'storage';
        }
        if (lower.match(/\b(performance|perform|speed|latency|slow|fast|optimize|optimization|capacity|accelerate|scale)\b/)) {
            return 'performance';
        }
        if (lower.match(/\b(query|queries|sql|select|join|syntax|dialect|statement|statements|bqsql)\b/)) {
            return 'sql';
        }
        return 'none';
    }

    // Helper: Construct Tweet and launch Twitter intent
    function tweetUpdate(date, type, htmlContent, link) {
        const plainText = stripHtml(htmlContent).trim().replace(/\s+/g, ' ');
        const dateStr = date;
        const typeStr = type.charAt(0).toUpperCase() + type.slice(1);
        
        // Character Budgeting:
        // Max Tweet length = 280
        // URL ~23 chars (automatically handled by Twitter)
        // Meta tags (#BigQuery #GCP) ~20 chars
        // Template text: "📢 BigQuery Update () - : " ~35 chars
        // Total buffer = 80 chars. Remaining for update description ~200 chars.
        
        let descLimit = 200;
        let descText = plainText;
        if (plainText.length > descLimit) {
            descText = plainText.substring(0, descLimit - 3) + '...';
        }
        
        const tweetText = `📢 BigQuery Update (${dateStr}) - ${typeStr}: ${descText}\n\nRead more: ${link}\n\n#BigQuery #GCP #Cloud`;
        
        const tweetUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
        window.open(tweetUrl, '_blank');
    }

    // Fetch Release Notes from API
    async function fetchReleases() {
        // Show loading state
        btnRefresh.disabled = true;
        refreshSpinner.style.display = 'block';
        btnText.textContent = 'Loading...';
        
        // Clear selection when refreshing
        clearSelection();

        try {
            const response = await fetch('/api/releases');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            if (data.status === 'success') {
                allReleases = data.releases;
                
                // Update Last Checked Time
                const now = new Date();
                lastUpdatedTime.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                
                // Render the feed
                renderFeed();
            } else {
                renderError(data.message || 'Failed to fetch release notes.');
            }
        } catch (error) {
            console.error('Fetch error:', error);
            renderError('Unable to connect to the backend server. Please verify Flask is running.');
        } finally {
            // Restore button state
            btnRefresh.disabled = false;
            refreshSpinner.style.display = 'none';
            btnText.textContent = 'Refresh Feed';
        }
    }

    // Render Feed based on Search and Filters
    function renderFeed() {
        feedContainer.innerHTML = '';
        
        if (allReleases.length === 0) {
            renderEmptyState('No Release Notes Available', 'The release notes feed was empty.');
            return;
        }

        let displayedDaysCount = 0;

        allReleases.forEach((day, dayIndex) => {
            // Filter the updates in the current day
            const filteredUpdates = day.updates.filter(update => {
                // Type Filter Check
                const typeMatches = currentFilter === 'all' || 
                                    update.type.toLowerCase() === currentFilter;
                
                // Search Query Check
                const plainText = stripHtml(update.html).toLowerCase();
                const typeText = update.type.toLowerCase();
                const searchMatches = searchQuery === '' || 
                                      plainText.includes(searchQuery) ||
                                      typeText.includes(searchQuery);
                
                return typeMatches && searchMatches;
            });

            // Only render the day section if it contains updates after filtering
            if (filteredUpdates.length > 0) {
                displayedDaysCount++;
                
                const daySection = document.createElement('section');
                daySection.className = 'day-section';
                daySection.setAttribute('aria-label', `Updates for ${day.date}`);
                
                const dayHeader = document.createElement('div');
                dayHeader.className = 'day-header';
                
                // Create linkable date title
                dayHeader.innerHTML = `
                    <div class="day-date">
                        ${day.date}
                        <a href="${day.link}" target="_blank" title="View original release notes on Google Cloud" aria-label="Original release notes link for ${day.date}">
                            <svg class="day-link-icon" viewBox="0 0 24 24" width="16" height="16">
                                <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
                            </svg>
                        </a>
                    </div>
                `;
                daySection.appendChild(dayHeader);

                const updatesList = document.createElement('div');
                updatesList.className = 'updates-list';

                filteredUpdates.forEach((update, updateIndex) => {
                    const uniqueId = `update-${dayIndex}-${updateIndex}`;
                    const updateCard = document.createElement('div');
                    
                    // Classify content to determine topic theme and background
                    const plainText = stripHtml(update.html);
                    const topic = classifyTopic(plainText);
                    
                    updateCard.className = `update-card type-${update.type.toLowerCase()}`;
                    if (topic !== 'none') {
                        updateCard.classList.add(`topic-${topic}`);
                    }
                    updateCard.id = uniqueId;
                    
                    // Mark as selected if it is the current selection
                    if (selectedUpdate && selectedUpdate.id === uniqueId) {
                        updateCard.classList.add('selected');
                    }

                    // Append background watermark SVG based on classified topic
                    let watermarkSvg = '';
                    if (topic === 'weather') {
                        watermarkSvg = '<svg viewBox="0 0 24 24"><path d="M19.36 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.64-4.96z"/></svg>';
                    } else if (topic === 'sports') {
                        watermarkSvg = '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 2c1.47 0 2.82.4 3.99 1.1L12.5 8.6c-.16-.07-.33-.1-.5-.1s-.34.03-.5.1L8.01 5.1C9.18 4.4 10.53 4 12 4zm-8 8c0-1.47.4-2.82 1.1-3.99l3.5 3.49c-.07.16-.1.33-.1.5s.03.34.1.5l-3.5 3.49C4.4 14.82 4 13.47 4 12zm8 8c-1.47 0-2.82-.4-3.99-1.1l3.49-3.5c.16.07.33.1.5.1s.34-.03.5-.1l3.49 3.5C14.82 19.6 13.47 20 12 20zm8-8c0 1.47-.4 2.82-1.1 3.99l-3.5-3.49c.07-.16.1-.33.1-.5s-.03-.34-.1-.5l3.5-3.49c.7 1.17 1.1 2.52 1.1 3.99z"/></svg>';
                    } else if (topic === 'ai') {
                        watermarkSvg = '<svg viewBox="0 0 24 24"><path d="M9 21h6v-2H9v2zm3-19C6.48 2 2 6.48 2 12c0 3.4 1.7 6.4 4.3 8.2l1.4-1.4C5.7 17.5 4.5 14.9 4.5 12c0-4.1 3.4-7.5 7.5-7.5s7.5 3.4 7.5 7.5c0 2.9-1.2 5.5-3.2 6.8l1.4 1.4c2.6-1.8 4.3-4.8 4.3-8.2 0-5.5-4.48-10-10-10zm-1 5h2v6h-2V7zm0 8h2v2h-2v-2z"/></svg>';
                    } else if (topic === 'security') {
                        watermarkSvg = '<svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>';
                    } else if (topic === 'storage') {
                        watermarkSvg = '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 4.02 2 6.5v11c0 2.48 4.48 4.5 10 4.5s10-2.02 10-4.5v-11C22 4.02 17.52 2 12 2zm0 2c4.82 0 8 1.62 8 2.5s-3.18 2.5-8 2.5-8-1.62-8-2.5 3.18-2.5 8-2.5zm0 15c-4.82 0-8-1.62-8-2.5v-2.14c1.93 1.31 4.8 2.14 8 2.14s6.07-.83 8-2.14V16.5c0 .88-3.18 2.5-8 2.5zm0-4.5c-4.82 0-8-1.62-8-2.5v-2.14c1.93 1.31 4.8 2.14 8 2.14s6.07-.83 8-2.14V12c0 .88-3.18 2.5-8 2.5z"/></svg>';
                    } else if (topic === 'performance') {
                        watermarkSvg = '<svg viewBox="0 0 24 24"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>';
                    } else if (topic === 'sql') {
                        watermarkSvg = '<svg viewBox="0 0 24 24"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>';
                    }

                    if (watermarkSvg) {
                        const watermarkDiv = document.createElement('div');
                        watermarkDiv.className = 'card-watermark';
                        watermarkDiv.innerHTML = watermarkSvg;
                        updateCard.appendChild(watermarkDiv);
                    }

                    // Card top row (Type Badge and Tweet inline button)
                    const cardTop = document.createElement('div');
                    cardTop.className = 'card-top';
                    
                    const badge = document.createElement('span');
                    badge.className = `type-badge ${update.type.toLowerCase()}`;
                    badge.textContent = update.type;
                    
                    const actions = document.createElement('div');
                    actions.className = 'card-actions';
                    
                    const btnTweet = document.createElement('button');
                    btnTweet.className = 'btn-tweet';
                    btnTweet.innerHTML = `
                        <svg viewBox="0 0 24 24">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        Tweet
                    `;
                    
                    // Prevent card selection trigger when clicking the Tweet button directly
                    btnTweet.addEventListener('click', (e) => {
                        e.stopPropagation();
                        tweetUpdate(day.date, update.type, update.html, day.link);
                    });

                    actions.appendChild(btnTweet);
                    cardTop.appendChild(badge);
                    cardTop.appendChild(actions);

                    // Card body content
                    const cardContent = document.createElement('div');
                    cardContent.className = 'card-content';
                    cardContent.innerHTML = update.html;

                    updateCard.appendChild(cardTop);
                    updateCard.appendChild(cardContent);

                    // Card select event
                    updateCard.addEventListener('click', () => {
                        toggleSelectUpdate(uniqueId, day.date, update.type, update.html, day.link);
                    });

                    updatesList.appendChild(updateCard);
                });

                daySection.appendChild(updatesList);
                feedContainer.appendChild(daySection);
            }
        });

        // Show empty state if filters cleared all content
        if (displayedDaysCount === 0) {
            renderEmptyState('No Matching Updates Found', 'Try adjusting your search query or switching your category filter.');
        }
    }

    // Toggle Card Selection
    function toggleSelectUpdate(cardId, date, type, htmlContent, link) {
        // If clicking the already selected card, deselect it
        if (selectedUpdate && selectedUpdate.id === cardId) {
            clearSelection();
            return;
        }

        // Remove active class from previous selection
        if (selectedUpdate) {
            const prevCard = document.getElementById(selectedUpdate.id);
            if (prevCard) prevCard.classList.remove('selected');
        }

        // Apply new selection
        selectedUpdate = { id: cardId, date, type, html: htmlContent, link };
        
        const newCard = document.getElementById(cardId);
        if (newCard) newCard.classList.add('selected');

        // Show Selection Floating Bar
        selectionType.textContent = type.charAt(0).toUpperCase() + type.slice(1);
        selectionDate.textContent = date;
        selectionBar.classList.add('active');
    }

    // Clear Selection State
    function clearSelection() {
        if (selectedUpdate) {
            const card = document.getElementById(selectedUpdate.id);
            if (card) card.classList.remove('selected');
        }
        selectedUpdate = null;
        selectionBar.classList.remove('active');
    }

    // Render Empty State UI
    function renderEmptyState(title, description) {
        feedContainer.innerHTML = `
            <div class="no-results" id="empty-state-view">
                <div class="empty-title">${title}</div>
                <div class="empty-desc">${description}</div>
            </div>
        `;
    }

    // Render Error UI
    function renderError(message) {
        feedContainer.innerHTML = `
            <div class="error-card" id="error-state-view">
                <div class="error-title">Feed Sync Failure</div>
                <div class="error-msg">${message}</div>
                <button class="btn-primary" id="btn-retry-sync" style="margin-top: 1rem;">
                    Try Again
                </button>
            </div>
        `;
        document.getElementById('btn-retry-sync').addEventListener('click', fetchReleases);
    }

    // Register Event Listeners
    btnRefresh.addEventListener('click', fetchReleases);
    
    btnSelectionCancel.addEventListener('click', clearSelection);
    
    btnSelectionTweet.addEventListener('click', () => {
        if (selectedUpdate) {
            tweetUpdate(
                selectedUpdate.date, 
                selectedUpdate.type, 
                selectedUpdate.html, 
                selectedUpdate.link
            );
        }
    });

    // Search input (updates searchQuery on keyup)
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderFeed();
    });

    // Category filters
    filterBadges.forEach(badge => {
        badge.addEventListener('click', (e) => {
            // Update active state class
            filterBadges.forEach(b => b.classList.remove('active'));
            badge.classList.add('active');
            
            // Set current filter and render
            currentFilter = badge.getAttribute('data-type');
            renderFeed();
        });
    });

    // Initial load
    fetchReleases();
});

// Global Click Fire Particle Effect
document.addEventListener('click', (e) => {
    const particleCount = 18;
    const colors = ['#ff3300', '#ff6600', '#ff9900', '#ffcc00', '#ffff00', '#ff0055'];
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'fire-particle';
        
        // Random dimensions (mix of smaller sparks and slightly larger flame cores)
        const size = Math.random() * 10 + 4; // 4px to 14px
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        
        // Vibrant fire radial gradient
        const mainColor = colors[Math.floor(Math.random() * colors.length)];
        particle.style.background = `radial-gradient(circle, ${mainColor} 0%, rgba(255,69,0,0.8) 50%, transparent 100%)`;
        
        // Position centering on click coordinate
        particle.style.left = `${e.clientX - size / 2}px`;
        particle.style.top = `${e.clientY - size / 2}px`;
        
        // Velocity mathematics: generate circular spread with upwards drift (gravity simulation)
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 100 + 30; // spread distance
        
        const tx = Math.cos(angle) * speed;
        // Subtract additional offset from ty so the fire particles float upwards
        const ty = Math.sin(angle) * speed - 40;
        
        particle.style.setProperty('--tx', `${tx}px`);
        particle.style.setProperty('--ty', `${ty}px`);
        
        // Append to DOM
        document.body.appendChild(particle);
        
        // Auto cleanup on animation end
        particle.addEventListener('animationend', () => {
            particle.remove();
        });
    }
});
