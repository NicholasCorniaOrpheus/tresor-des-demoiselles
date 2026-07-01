# Explore

<div class="explore-container">
    <div class="search-section-center" style="text-align: center; margin-bottom: 40px;">
        <input id="general-search" type="text" placeholder="Search all fields... (Press Enter)" 
               style="width: 80%; max-width: 600px; padding: 12px; border-radius: 25px; border: 1px solid var(--md-typeset-table-color); background: var(--md-default-bg-color);">
    </div>
    <div id="advanced-filters" style="margin-bottom: 30px;">
        <h3>Advanced Filters <button id="add-filter" class="md-button" style="margin-left: 10px; padding: 2px 10px; cursor: pointer;">+</button></h3>
        <div id="filter-rows">
        </div>
    </div>
    <div class="time-slider-section" style="margin-bottom: 40px;">
        <h3>Year Range: <span id="date-display-min">...</span> - <span id="date-display-max">...</span></h3>
        <div style="display: flex; flex-direction: column; gap: 10px;">
            <input type="range" id="time-min" style="width: 100%;">
            <input type="range" id="time-max" style="width: 100%;">
        </div>
    </div>
    <hr>
    <div id="search-results" class="grid cards">
        <div class="search-placeholder">Initialising collection index...</div>
    </div>
</div>

<script src="https://unpkg.com/lunr/lunr.js"></script>
<script src="../assets/js/explore-controller.js"></script>