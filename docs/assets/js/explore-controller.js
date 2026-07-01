document.addEventListener("DOMContentLoaded", async function() {
    const resultsGrid = document.getElementById('search-results');
    if (!resultsGrid) return;

    const indexUrl = 'https://raw.githubusercontent.com/NicholasCorniaOrpheus/tresor-des-demoiselles/main/data/advanced_search_index.json';

    try {
        const response = await fetch(indexUrl);
        const searchData = await response.json();

        // 1. Setup Properties and Date Range
        const propertyKeys = new Set();
        let allYears = [];
        
        searchData.forEach(doc => {
            Object.keys(doc.properties).forEach(k => propertyKeys.add(k));
            Object.values(doc.properties).flat().forEach(val => {
                if (val && val.publication_date) {
                    const y = parseInt(String(val.publication_date).substring(0, 4));
                    if (!isNaN(y)) allYears.push(y);
                }
            });
        });

        const sortedKeys = Array.from(propertyKeys).sort();
        const minYear = Math.min(...allYears) || 1800;
        const maxYear = Math.max(...allYears) || 1900;

        // 2. Initialise UI
        const minSlider = document.getElementById('time-min');
        const maxSlider = document.getElementById('time-max');
        if (minSlider && maxSlider) {
            [minSlider, maxSlider].forEach(s => { s.min = minYear; s.max = maxYear; });
            minSlider.value = minYear;
            maxSlider.value = maxYear;
            document.getElementById('date-display-min').innerText = minYear;
            document.getElementById('date-display-max').innerText = maxYear;
        }

        // 3. Filter Row Logic
        const filterContainer = document.getElementById('filter-rows');
        function addRow() {
            const row = document.createElement('div');
            row.className = 'filter-row';
            row.style = 'display: flex; gap: 10px; margin-bottom: 10px;';
            row.innerHTML = `
                <select class="filter-property" style="padding: 8px;">
                    ${sortedKeys.map(k => `<option value="${k}">${k.replace(/_/g, ' ')}</option>`).join('')}
                </select>
                <input type="text" class="filter-query" placeholder="Query... (Enter)" style="flex-grow: 1; padding: 8px;">
                <button class="remove-filter" style="cursor:pointer; background:none; border:none; font-size:20px;">&times;</button>
            `;
            row.querySelector('.filter-query').addEventListener('keydown', e => { if(e.key==='Enter') performSearch(); });
            row.querySelector('.remove-filter').addEventListener('click', () => { row.remove(); performSearch(); });
            filterContainer.appendChild(row);
        }

        // 4. Advanced Search Logic
        function performSearch() {
            const general = document.getElementById('general-search').value.toLowerCase();
            const minV = parseInt(minSlider.value);
            const maxV = parseInt(maxSlider.value);
            const rows = document.querySelectorAll('.filter-row');

            const results = searchData.filter(doc => {
                // Folder Restriction
                if (!doc.location.startsWith('/entity/')) return false;

                // General Text Search (Search inside the stringified properties)
                const matchesGeneral = !general || JSON.stringify(doc.properties).toLowerCase().includes(general);

                // Date Range Check
                let inRange = true;
                Object.values(doc.properties).flat().forEach(val => {
                    if (val && val.publication_date) {
                        const y = parseInt(String(val.publication_date).substring(0, 4));
                        if (y < minV || y > maxV) inRange = false;
                    }
                });

                // Property Match (AND logic)
                let matchesAll = true;
                rows.forEach(row => {
                    const prop = row.querySelector('.filter-property').value;
                    const query = row.querySelector('.filter-query').value.toLowerCase();
                    if (!query) return;

                    const vals = doc.properties[prop] || [];
                    const found = vals.some(v => {
                        // Check if it's a factoid object with .label or a simple string
                        const text = (v && typeof v === 'object') ? v.label : String(v);
                        return text?.toLowerCase().includes(query);
                    });
                    if (!found) matchesAll = false;
                });

                return matchesGeneral && inRange && matchesAll;
            });
            renderResults(results);
        }

        // 5. Render Grid (Handling Array Values)
        function renderResults(results) {
            resultsGrid.innerHTML = results.map(doc => {
                // Extract first available label and image from arrays
                const title = (doc.properties.label && doc.properties.label.length > 0) 
                    ? doc.properties.label : "Untitled";
                
                const imgSrc = (doc.properties.image && doc.properties.image.length > 0) 
                    ? doc.properties.image : "../assets/images/placeholder.jpg";

                return `
                <a href="..${doc.location}/" class="card-link">
                    <div class="card" style="border: 1px solid var(--md-typeset-table-color); border-radius: 8px; overflow: hidden; height: 100%;">
                        <div style="height: 180px; background: #eee;">
                            <img src="${imgSrc}" style="width:100%; height:100%; object-fit:cover;" loading="lazy">
                        </div>
                        <div style="padding: 10px; text-align: center;">
                            <strong style="font-family: 'Crimson Pro', serif;">${title}</strong>
                        </div>
                    </div>
                </a>`;
            }).join('') || '<p>No entities found.</p>';
        }

        // Event Listeners
        document.getElementById('add-filter').addEventListener('click', addRow);
        document.getElementById('general-search').addEventListener('keydown', e => { if(e.key==='Enter') performSearch(); });
        [minSlider, maxSlider].forEach(s => s.addEventListener('input', () => {
            document.getElementById('date-display-min').innerText = minSlider.value;
            document.getElementById('date-display-max').innerText = maxSlider.value;
            performSearch();
        }));

        addRow(); // Start with one row
        performSearch(); // Initial load

    } catch (err) {
        console.error("Explore script failed:", err);
    }
});