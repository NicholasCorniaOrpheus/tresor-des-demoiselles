document.addEventListener("DOMContentLoaded", async function() {
    console.debug("Explore: DOMContentLoaded - starting script");
    const resultsGrid = document.getElementById('search-results');
    if (!resultsGrid) {
        console.warn("Explore: #search-results not found - aborting script");
        return;
    }

    const reponame = "NicholasCorniaOrpheus/tresor-des-demoiselles"

    const indexUrl = `https://raw.githubusercontent.com/${reponame}/main/data/advanced_search_index.json`;
    const classCsvUrl = `https://raw.githubusercontent.com/${reponame}/main/data/mappings/yaml_classes2lod.csv`;

    // Preview constants
    const PREVIEW_COUNT = 30;
    let userInteracted = false;
    function markInteracted() {
        if (!userInteracted) {
            userInteracted = true;
            console.debug("Explore: user interacted - future renders will show full result sets");
        }
    }

    // Helper: fetch with timeout
    async function fetchWithTimeout(url, timeout = 10000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            console.debug(`Explore: fetching ${url} (timeout ${timeout}ms)`);
            const resp = await fetch(url, { signal: controller.signal });
            clearTimeout(id);
            return resp;
        } catch (err) {
            clearTimeout(id);
            throw err;
        }
    }

    try {
        // 1) Load index.json with timeout
        let response;
        try {
            response = await fetchWithTimeout(indexUrl, 15000);
        } catch (err) {
            console.error("Explore: failed to fetch index.json:", err);
            throw new Error("Failed to fetch search index");
        }

        if (!response.ok) {
            console.error("Explore: index fetch returned", response.status);
            throw new Error(`Index fetch HTTP ${response.status}`);
        }

        let searchData;
        try {
            const text = await response.text();
            console.debug("Explore: index.json size (bytes):", text.length);
            searchData = JSON.parse(text);
        } catch (err) {
            console.error("Explore: failed to parse index JSON:", err);
            throw new Error("Failed to parse search index JSON");
        }

        if (!Array.isArray(searchData)) {
            console.warn("Explore: searchData is not an array; coercing if possible");
            if (searchData && typeof searchData === 'object') {
                searchData = Object.values(searchData);
            } else {
                searchData = [];
            }
        }

        console.debug("Explore: loaded searchData entries:", searchData.length);

        // Helper: parse class CSV to get class options
        async function fetchClassOptions() {
            try {
                const res = await fetchWithTimeout(classCsvUrl, 8000);
                if (!res.ok) {
                    console.warn("Explore: class CSV fetch returned", res.status);
                    return [];
                }
                const txt = await res.text();
                const lines = txt.split(/\r?\n/).filter(Boolean);
                if (lines.length === 0) return [];
                const headerParts = lines[0].split(',');
                let dataLines = lines;
                if (headerParts.some(p => /yaml|class/i.test(p))) {
                    dataLines = lines.slice(1);
                }
                const classes = dataLines.map(line => {
                    const parts = line.split(',');
                    return parts[0] ? parts[0].trim().replace(/^"(.+)"$/, '$1') : null;
                }).filter(Boolean);
                const unique = Array.from(new Set(classes)).sort((a, b) => a.localeCompare(b));
                console.debug("Explore: fetched class options count:", unique.length);
                return unique;
            } catch (err) {
                console.warn("Explore: Failed to load class CSV:", err);
                return [];
            }
        }

        const classOptions = await fetchClassOptions();

        // 2) Setup properties and extract year range ONLY from "date" property
        const propertyKeys = new Set();
        let allYears = [];

        // Helper: extract years from "date" property (arrays of numbers)
        function extractYearsFromDateProperty(dateValue) {
            if (dateValue === null || dateValue === undefined) return [];
            
            const years = [];
            
            // If dateValue is an array (e.g., [1544, 1540])
            if (Array.isArray(dateValue)) {
                dateValue.forEach(item => {
                    if (typeof item === 'number' && !Number.isNaN(item) && item >= 1000 && item <= 3000) {
                        years.push(item);
                    }
                });
            }
            // If dateValue is a single number
            else if (typeof dateValue === 'number' && !Number.isNaN(dateValue) && dateValue >= 1000 && dateValue <= 3000) {
                years.push(dateValue);
            }
            
            return years;
        }

        // Build propertyKeys and allYears (from date property only)
        for (let i = 0; i < searchData.length; i++) {
            const doc = searchData[i];
            if (!doc || typeof doc !== 'object') continue;
            if (doc.properties && typeof doc.properties === 'object') {
                Object.keys(doc.properties).forEach(k => propertyKeys.add(k));
                
                // Extract years ONLY from the "date" property
                const dateValue = doc.properties.date;
                if (dateValue) {
                    const yearsInDoc = extractYearsFromDateProperty(dateValue);
                    allYears.push(...yearsInDoc);
                }
            }
        }

        console.debug("Explore: properties detected:", Array.from(propertyKeys).sort());
        console.debug("Explore: years extracted from 'date' property:", allYears.length);

        const sortedKeys = Array.from(propertyKeys).sort();
        const minYear = (allYears.length > 0) ? Math.min(...allYears) : 0;
        const maxYear = (allYears.length > 0) ? Math.max(...allYears) : 2030;

        // Initialize UI: date range sliders
        const minSlider = document.getElementById('time-min');
        const maxSlider = document.getElementById('time-max');
        if (minSlider && maxSlider) {
            [minSlider, maxSlider].forEach(s => { 
                s.min = minYear; 
                s.max = maxYear; 
            });
            minSlider.value = minYear;
            maxSlider.value = maxYear;
            const minDisplay = document.getElementById('date-display-min');
            const maxDisplay = document.getElementById('date-display-max');
            if (minDisplay) minDisplay.innerText = minYear;
            if (maxDisplay) maxDisplay.innerText = maxYear;
        } else {
            console.warn("Explore: sliders not found in DOM (#time-min/#time-max)");
        }

        // Helper to create value control (class dropdown or text input)
        function createValueControlForProperty(prop) {
            if (prop === 'class') {
                const sel = document.createElement('select');
                sel.className = 'filter-query';
                sel.style.padding = '8px';
                const empty = document.createElement('option');
                empty.value = '';
                empty.textContent = '(any)';
                sel.appendChild(empty);
                for (const c of classOptions) {
                    const opt = document.createElement('option');
                    opt.value = c;
                    opt.textContent = c;
                    sel.appendChild(opt);
                }
                return sel;
            } else {
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'filter-query';
                input.placeholder = 'Query... (Enter)';
                input.style.flexGrow = '1';
                input.style.padding = '8px';
                return input;
            }
        }

        // Build filter UI
        const filterContainer = document.getElementById('filter-rows');
        if (!filterContainer) {
            console.warn("Explore: #filter-rows not found - filters UI won't be available");
        }

        function addRow() {
            if (!filterContainer) return;
            markInteracted();
            const row = document.createElement('div');
            row.className = 'filter-row';
            row.style = 'display: flex; gap: 10px; margin-bottom: 10px; align-items:center;';

            const propSelect = document.createElement('select');
            propSelect.className = 'filter-property';
            propSelect.style.padding = '8px';
            propSelect.innerHTML = sortedKeys.map(k => `<option value="${k}">${k.replace(/_/g, ' ')}</option>`).join('');

            const initialProp = propSelect.value;
            const valueControl = createValueControlForProperty(initialProp);

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-filter';
            removeBtn.style.cursor = 'pointer';
            removeBtn.style.background = 'none';
            removeBtn.style.border = 'none';
            removeBtn.style.fontSize = '20px';
            removeBtn.innerHTML = '&times;';

            row.appendChild(propSelect);
            row.appendChild(valueControl);
            row.appendChild(removeBtn);

            propSelect.addEventListener('change', (e) => {
                markInteracted();
                const newProp = e.target.value;
                const existingValueControl = row.querySelector('.filter-query');
                const newControl = createValueControlForProperty(newProp);
                if (existingValueControl && existingValueControl.tagName === 'INPUT' && newControl.tagName === 'INPUT') {
                    newControl.value = existingValueControl.value;
                }
                if (existingValueControl) existingValueControl.replaceWith(newControl);
                if (newControl.tagName === 'INPUT') {
                    newControl.addEventListener('keydown', ev => { if (ev.key === 'Enter') performSearch(); });
                } else {
                    newControl.addEventListener('change', () => { markInteracted(); performSearch(); });
                }
                performSearch();
            });

            if (valueControl.tagName === 'INPUT') {
                valueControl.addEventListener('keydown', e => { if (e.key === 'Enter') { markInteracted(); performSearch(); } });
            } else {
                valueControl.addEventListener('change', () => { markInteracted(); performSearch(); });
            }

            removeBtn.addEventListener('click', () => { markInteracted(); row.remove(); performSearch(); });

            filterContainer.appendChild(row);
        }

        // Search logic
        function performSearch() {
            console.debug("Explore: performSearch() invoked - userInteracted:", userInteracted);
            const generalEl = document.getElementById('general-search');
            const general = generalEl ? generalEl.value.trim().toLowerCase() : '';
            const minV = minSlider ? parseInt(minSlider.value, 10) : minYear;
            const maxV = maxSlider ? parseInt(maxSlider.value, 10) : maxYear;
            const rows = document.querySelectorAll('.filter-row');

            const results = searchData.filter(doc => {
                if (!doc || typeof doc !== 'object') return false;
                if (!doc.location || !doc.location.startsWith('/entity/')) return false;

                const matchesGeneral = !general || JSON.stringify(doc.properties).toLowerCase().includes(general);

                // Date range filter: only check the "date" property
                let inDateRange = true;
                const dateValue = doc.properties && doc.properties.date;
                if (dateValue) {
                    const docYears = extractYearsFromDateProperty(dateValue);
                    if (docYears.length > 0) {
                        // Accept if ANY year in the date property falls within range
                        inDateRange = docYears.some(y => y >= minV && y <= maxV);
                    } else {
                        // No valid years found in date property, include anyway
                        inDateRange = true;
                    }
                } else {
                    // No date property at all, include anyway (permissive)
                    inDateRange = true;
                }

                // Property filters (AND logic)
                let matchesAll = true;
                rows.forEach(row => {
                    const prop = row.querySelector('.filter-property').value;
                    const control = row.querySelector('.filter-query');
                    if (!control) return;
                    
                    let query = '';
                    if (control.tagName === 'INPUT') {
                        query = control.value.trim().toLowerCase();
                        if (!query) return;
                    } else if (control.tagName === 'SELECT') {
                        query = control.value.trim().toLowerCase();
                        if (!query) return;
                    }

                    const vals = doc.properties[prop] || [];
                    const found = vals.some(v => {
                        if (v === null || v === undefined) return false;
                        if (typeof v === 'object') {
                            const text = v.label || v.value || JSON.stringify(v);
                            return String(text).toLowerCase().includes(query);
                        } else {
                            return String(v).toLowerCase().includes(query);
                        }
                    });
                    if (!found) matchesAll = false;
                });

                return matchesGeneral && inDateRange && matchesAll;
            });

            console.debug("Explore: results count:", results.length);
            renderResults(results);
        }

        function renderResults(results) {
            let resultsToShow = results;
            let prefixNote = '';
            if (!userInteracted && results.length > PREVIEW_COUNT) {
                // pick PREVIEW_COUNT random entries
                const shuffled = results.slice();
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                resultsToShow = shuffled.slice(0, PREVIEW_COUNT);
                prefixNote = `<p>Showing ${PREVIEW_COUNT} random entities out of ${results.length}. Interact with the filters or sliders to see the full results.</p>`;
            }

            const html = resultsToShow.map(doc => {
                // Title extraction
                let title = "Untitled";
                if (doc.properties) {
                    const lab = doc.properties.label;
                    if (Array.isArray(lab) && lab.length > 0) {
                        const f = lab[0];
                        if (f !== null && f !== undefined && typeof f === 'object') {
                            title = f.label || f.value || JSON.stringify(f);
                        } else if (f !== null && f !== undefined) {
                            title = String(f);
                        }
                    } else if (lab && typeof lab === 'object') {
                        title = lab.label || lab.value || JSON.stringify(lab);
                    } else if (typeof lab === 'string') {
                        title = lab;
                    }
                }

                // Image extraction
                let imgSrc = "../assets/icons/concept.png";
                if (doc.properties) {
                    const img = doc.properties.image;
                    if (Array.isArray(img) && img.length > 0) {
                        const f = img[0];
                        if (f !== null && f !== undefined && typeof f === 'object') {
                            imgSrc = f.value || f.url || JSON.stringify(f);
                        } else if (f !== null && f !== undefined) {
                            imgSrc = String(f);
                        }
                    } else if (img && typeof img === 'object') {
                        imgSrc = img.value || img.url || JSON.stringify(img);
                    } else if (typeof img === 'string') {
                        imgSrc = img;
                    }
                }

                return `
                <a href="..${doc.location}/" class="card-link">
                    <div class="card" style="border: 1px solid var(--md-typeset-table-color); border-radius: 8px; overflow: hidden; height: 100%;">
                        <div style="height: 180px; background: #eee;">
                            <img src="${imgSrc}" style="width:100%; height:100%; object-fit:cover;" loading="lazy" alt="${title}">
                        </div>
                        <div style="padding: 10px; text-align: center;">
                            <strong style="font-family: 'Crimson Pro', serif;">${title}</strong>
                        </div>
                    </div>
                </a>`;
            }).join('') || '<p>No entities found.</p>';

            resultsGrid.innerHTML = prefixNote + html;
        }

        // Wire UI event listeners
        const addFilterBtn = document.getElementById('add-filter');
        if (addFilterBtn) addFilterBtn.addEventListener('click', () => { markInteracted(); addRow(); });

        const generalInput = document.getElementById('general-search');
        if (generalInput) generalInput.addEventListener('keydown', e => { if (e.key === 'Enter') { markInteracted(); performSearch(); } });

        if (minSlider && maxSlider) {
            [minSlider, maxSlider].forEach(s => s.addEventListener('input', () => {
                const minDisplay = document.getElementById('date-display-min');
                const maxDisplay = document.getElementById('date-display-max');
                if (minDisplay) minDisplay.innerText = minSlider.value;
                if (maxDisplay) maxDisplay.innerText = maxSlider.value;
                markInteracted();
                performSearch();
            }));
        }

        // Start UI: initial preview list
        addRow();
        performSearch();

        console.debug("Explore: initialization complete (preview shown)");
    } catch (err) {
        console.error("Explore script failed:", err);
    }
});