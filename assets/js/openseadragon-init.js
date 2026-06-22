document.addEventListener("DOMContentLoaded", function() {
    const assets = window.entityAssets;

    if (assets) {
        let tileSources = null;

        // 1. Prioritize IIIF Manifest if present
        if (assets.iiif && assets.iiif.trim() !== "") {
            tileSources = assets.iiif;
            console.log("OSD: Loading IIIF Manifest", tileSources);
        } 
        // 2. Fallback to static images if no manifest
        else if (Array.isArray(assets.images) && assets.images.length > 0) {
            tileSources = assets.images.map(item => {
                let filename = (typeof item === 'string') ? item : (item && item.value ? item.value : null);
                if (!filename) return null;
                
                const base = assets.base_github_url || "";
                const path = assets.local_path || "";
                // Clean up slashes and prevent "undefined"
                return {
                    type: 'image',
                    url: (base + path + filename).replace(/([^:]\/)\/+/g, "$1")
                };
            }).filter(s => s !== null);
            console.log("OSD: Loading static images", tileSources);
        }

        // 3. Initialize if we have a source
        if (tileSources) {
            var viewer = OpenSeadragon({
                id: "osd-viewer", // Targeting the inner viewer div
                prefixUrl: "https://cdnjs.cloudflare.com/ajax/libs/openseadragon/4.1.0/images/",
                sequenceMode: true,
                showReferenceStrip: true,
                tileSources: tileSources
            });
        }
    }
});