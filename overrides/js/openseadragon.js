// Standard initialization for OpenSeadragon with IIIF support
var viewer = OpenSeadragon({
    id: "openseadragon-container", // The ID of your HTML element
    prefixUrl: "https://cdnjs.cloudflare.com/ajax/libs/openseadragon/4.1.0/images/",
    preserveViewport: true,
    visibilityRatio: 1,
    minZoomLevel: 1,
    defaultZoomLevel: 1,
    sequenceMode: true,
    tileSources: [
      // Replace this with the URL to your IIIF Manifest
      "https://example.com/iiif/manifest.json" 
    ]
});