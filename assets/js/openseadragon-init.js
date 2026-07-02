document.addEventListener("DOMContentLoaded", function() {
    const assets = window.entityAssets;

    if (!assets) {
        console.warn("OSD: No assets data available");
        return;
    }

    let tileSources = null;

    // 1. Prioritize IIIF Manifest if present and valid
    if (assets.iiif && typeof assets.iiif === 'string' && assets.iiif.trim() !== "") {
        tileSources = assets.iiif;
        console.log("OSD: Loading IIIF Manifest", tileSources);
    } 
    // 2. Fallback to static images if no manifest
    else if (Array.isArray(assets.images) && assets.images.length > 0) {
        tileSources = assets.images
            .map(item => {
                let filename = (typeof item === 'string') ? item : (item && item.value ? item.value : null);
                if (!filename || filename.trim() === "") return null;
                
                const base = (assets.base_github_url || "").trim();
                const path = (assets.local_path || "").trim();
                
                if (!base || !path) {
                    console.warn("OSD: Missing base URL or local path");
                    return null;
                }
                
                // Clean up slashes and prevent "undefined"
                const url = (base + path + filename).replace(/([^:]\/)\/+/g, "$1");
                return {
                    type: 'image',
                    url: url
                };
            })
            .filter(s => s !== null);
        
        if (tileSources.length === 0) {
            console.warn("OSD: No valid images after processing");
            tileSources = null;
        } else {
            console.log("OSD: Loading static images", tileSources);
        }
    }

    // 3. Initialize if we have a valid source, otherwise show placeholder
    if (tileSources && tileSources.length > 0) {
        try {
            var viewer = OpenSeadragon({
                id: "osd-viewer",
                prefixUrl: "https://cdnjs.cloudflare.com/ajax/libs/openseadragon/4.1.0/images/",
                sequenceMode: true,
                showReferenceStrip: true,
                tileSources: tileSources
            });
        } catch (err) {
            console.error("OSD initialization failed:", err);
            document.querySelector("#openseadragon-container").innerHTML = 
                '<p style="color: red; padding: 20px;">Image viewer failed to initialize.</p>';
        }
    } else {
        console.info("OSD: No images or IIIF manifest available for this entity");
        // Optionally hide the container or show a message
        const container = document.querySelector("#openseadragon-container");
        if (container) {
            container.innerHTML = '<p style="color: #999; padding: 20px; text-align: center;">No digital assets available for this entity.</p>';
        }
    }
});