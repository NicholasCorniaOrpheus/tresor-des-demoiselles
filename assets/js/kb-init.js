/**
 * KB-Light: Unified component initializer
 * Supports IIIF Presentation API v2 and v3
 * Handles CORS and Image API format issues
 */

class KBLightInit {
  constructor() {
    this.d3Initialized = false;
    this.osdInitialized = false;
    this.config = window.kbGraphConfig || {};
    this.graphInitialized = false;
  }

  // Adding extra setup to force Instant Loading of AJAX to load D3 and OpenSeadragon properly

    setup() {
      // 1. Consolidate logic for both initial load and AJAX updates
          const runComponents = () => {
            console.log("KB-Light: Running component initialization...");
            this.initD3Graph();
            this.initOpenSeadragon();
            // this.initCETEIcean();
          };  
      // 2. MkDocs Material Instant Loading Observable
      if (typeof document$ !== "undefined") {
        document$.subscribe(() => {
          console.log("Instant Loading: Re-initializing components...");
          this.graphInitialized = false; // Reset flag on navigation
          this.setupGraphTrigger();
          this.runPageLogic();
        });
      } else {
        // Fallback for non-Material environments
        document.addEventListener("DOMContentLoaded", () => this.runPageLogic());
      }
  }

  setupGraphTrigger() {
    // MkDocs Admonitions render as <details> tags
    const graphAdmonition = document.querySelector('details.abstract');
    const graphContainer = document.getElementById("entity-graph");

    if (graphAdmonition && graphContainer) {
      graphAdmonition.addEventListener('toggle', () => {
        // Only run if the admonition was OPENED and not yet initialized
        if (graphAdmonition.open && !this.graphInitialized) {
          console.log("Admonition expanded: Forcing Graph Load.");
          this.initD3Graph();
          this.graphInitialized = true;
        }
      });
    }
  }

  runPageLogic() {

    // Check if we are on an entity page with a Graph container
    this.initD3Graph();

    
    // Always check for OpenSeadragon containers
    this.initOpenSeadragon();
  }

  initD3Graph() {
    const graphContainer = document.querySelector("#graph-container");
    const graphUrl = this.config.graphUrl;

    if (!graphContainer || !graphUrl || graphUrl.trim() === "" || graphUrl === "None") {
      return;
    }

    if (this.d3Initialized) return;
    this.d3Initialized = true;

    console.log("KB: Initializing D3 graph from", graphUrl);

    const csvUrl = "https://raw.githubusercontent.com/NicholasCorniaOrpheus/tresor-des-demoiselles/main/data/mappings/yaml_classes2lod.csv";

    Promise.all([d3.csv(csvUrl), d3.json(graphUrl)])
      .then(([mappingData, graph]) => {
        this._renderD3Graph(graph, mappingData);
      })
      .catch(err => {
        console.error("D3 Graph failed:", err);
        if (graphContainer) {
          graphContainer.innerHTML = '<p style="color: red; padding: 20px;">Failed to load graph.</p>';
        }
      });
  }

  initOpenSeadragon() {
    const osdContainer = document.querySelector("#osd-viewer");
    const assets = this.config.assets;

    if (!osdContainer || !assets) {
      return;
    }

    if (this.osdInitialized) return;
    this.osdInitialized = true;

    console.log("KB: Initializing OpenSeadragon");

    // 1. IIIF Manifest (v2 or v3)
    if (assets.iiif && typeof assets.iiif === 'string' && assets.iiif.trim() !== "") {
      this._loadIIIFManifest(assets.iiif, osdContainer);
      return;
    }

    // 2. Static images fallback
    if (Array.isArray(assets.images) && assets.images.length > 0) {
      const tileSources = assets.images
        .map(item => {
          const filename = (typeof item === 'string') ? item : item?.value;
          if (!filename) return null;

          const base = assets.base_github_url || "";
          const path = assets.local_path || "";
          const url = (base + path + filename).replace(/([^:]\/)\/+/g, "$1");

          return { type: 'image', url: url };
        })
        .filter(s => s !== null);

      if (tileSources.length > 0) {
        this._initOSD(tileSources, osdContainer);
      } else {
        this._showNoAssets(osdContainer);
      }
    } else {
      this._showNoAssets(osdContainer);
    }
  }

  /**
   * Load IIIF Presentation manifest (v2 or v3)
   * Extracts canvas tile sources from the manifest
   */
  _loadIIIFManifest(manifestUrl, container) {
    console.log("KB: Loading IIIF manifest from", manifestUrl);

    // Add CORS header and credentials
    fetch(manifestUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      credentials: 'omit'  // Don't send credentials for CORS
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then(manifest => {
        console.log("KB: Manifest loaded successfully:", manifest);
        console.log("KB: Manifest @context:", manifest['@context']);

        const tileSources = this._parseIIIFManifest(manifest);

        console.log("KB: Parsed tile sources:", tileSources);

        if (tileSources && tileSources.length > 0) {
          console.log("KB: Initializing OSD with tile sources");
          this._initOSD(tileSources, container);
        } else {
          console.warn("KB: No tile sources found in manifest");
          this._showNoAssets(container);
        }
      })
      .catch(err => {
        console.error("KB: Failed to load IIIF manifest:", err);
        console.error("KB: Manifest URL:", manifestUrl);
        this._showNoAssets(container);
      });
  }

  /**
   * Parse IIIF Presentation v2 or v3 manifest
   * Returns array of tile sources for OpenSeadragon
   */
  _parseIIIFManifest(manifest) {
    const tileSources = [];

    // Detect IIIF version
    const context = manifest['@context'] || '';
    const isV3 = typeof context === 'string' 
      ? context.includes('iiif.io/api/presentation/3')
      : Array.isArray(context) && context.some(c => typeof c === 'string' && c.includes('iiif.io/api/presentation/3'));

    console.log("KB: IIIF version detected:", isV3 ? "v3" : "v2");

    if (isV3) {
      return this._parseIIIFv3(manifest);
    } else {
      return this._parseIIIFv2(manifest);
    }
  }

  /**
   * Parse IIIF Presentation v2
   * MDZ uses v2 format
   */
  _parseIIIFv2(manifest) {
    const tileSources = [];

    console.log("KB: Parsing IIIF v2 manifest");

    // Get sequences (v2 structure)
    const sequences = manifest.sequences || [];
    console.log("KB: Found sequences:", sequences.length);

    for (let seqIdx = 0; seqIdx < sequences.length; seqIdx++) {
      const sequence = sequences[seqIdx];
      const canvases = sequence.canvases || [];
      console.log(`KB: Sequence ${seqIdx} has canvases:`, canvases.length);

      for (let canvIdx = 0; canvIdx < canvases.length; canvIdx++) {
        const canvas = canvases[canvIdx];
        const images = canvas.images || [];
        console.log(`KB: Canvas ${canvIdx} has images:`, images.length);

        for (let imgIdx = 0; imgIdx < images.length; imgIdx++) {
          const image = images[imgIdx];
          const resource = image.resource;

          console.log(`KB: Image ${imgIdx} resource:`, resource);

          if (resource && resource.service) {
            const service = resource.service;
            const serviceUrl = service['@id'] || service.id;

            console.log(`KB: Service URL found:`, serviceUrl);

            if (serviceUrl) {
              // OpenSeadragon expects either:
              // 1. A tile source object with @context for IIIF Image API
              // 2. Or a URL that returns info.json

              // Try direct Image API format (IIIF Image API endpoint)
              const tileSource = {
                '@context': 'http://iiif.io/api/image/2/context.json',
                '@id': serviceUrl,
                protocol: 'http://iiif.io/api/image',
                profile: 'http://iiif.io/api/image/2/level1.json',
                width: canvas.width || 800,
                height: canvas.height || 1000,
                tiles: [{
                  width: 256,
                  scaleFactors: [1, 2, 4, 8, 16]
                }]
              };

              tileSources.push(tileSource);
              console.log("KB: Added IIIF Image API tile source:", tileSource);
            }
          } else if (resource && resource.url) {
            // Direct image URL
            console.log("KB: Using direct image URL");
            tileSources.push({
              type: 'image',
              url: resource.url
            });
          }
        }
      }
    }

    return tileSources;
  }

  /**
   * Parse IIIF Presentation v3
   */
  _parseIIIFv3(manifest) {
    const tileSources = [];

    console.log("KB: Parsing IIIF v3 manifest");

    const items = manifest.items || [];

    for (const item of items) {
      const paintings = item.body || item.items || [];

      for (const painting of paintings) {
        if (painting.type === 'Image') {
          const service = painting.service;

          if (Array.isArray(service)) {
            for (const svc of service) {
              if (svc.type === 'ImageService2' || (svc['@context'] && svc['@context'].includes('image'))) {
                const serviceUrl = svc['@id'] || svc.id;
                if (serviceUrl) {
                  const tileSource = {
                    '@context': 'http://iiif.io/api/image/2/context.json',
                    '@id': serviceUrl,
                    protocol: 'http://iiif.io/api/image',
                    profile: 'http://iiif.io/api/image/2/level1.json',
                    width: item.width || 800,
                    height: item.height || 1000,
                    tiles: [{
                      width: 256,
                      scaleFactors: [1, 2, 4, 8, 16]
                    }]
                  };
                  tileSources.push(tileSource);
                }
              }
            }
          } else if (service) {
            const serviceUrl = service['@id'] || service.id;
            if (serviceUrl) {
              const tileSource = {
                '@context': 'http://iiif.io/api/image/2/context.json',
                '@id': serviceUrl,
                protocol: 'http://iiif.io/api/image',
                profile: 'http://iiif.io/api/image/2/level1.json',
                width: item.width || 800,
                height: item.height || 1000,
                tiles: [{
                  width: 256,
                  scaleFactors: [1, 2, 4, 8, 16]
                }]
              };
              tileSources.push(tileSource);
            }
          }
        }
      }
    }

    return tileSources;
  }

  /**
   * Initialize OpenSeadragon with tile sources
   */
  _initOSD(tileSources, container) {
    try {
      console.log("KB: Creating OpenSeadragon viewer with", tileSources.length, "tile source(s)");
      console.log("KB: Tile sources:", JSON.stringify(tileSources, null, 2));

      const viewer = new OpenSeadragon({
        id: "osd-viewer",
        prefixUrl: "https://cdnjs.cloudflare.com/ajax/libs/openseadragon/4.1.0/images/",
        sequenceMode: tileSources.length > 1,
        showReferenceStrip: tileSources.length > 1,
        tileSources: tileSources,
        
        // CORS and IIIF settings
        crossOriginPolicy: 'Anonymous',
        ajaxWithCredentials: false,
        
        // Timeout settings (some servers are slow)
        timeout: 60000,
        
        // Try to load info.json with CORS headers
        loadTilesWithAjax: true,
        
        // Log errors
        debugMode: false
      });

      // Monitor viewer for errors
      viewer.addHandler('open-failed', function(event) {
        console.error("KB: OpenSeadragon failed to open tile source:", event);
      });

      viewer.addHandler('tile-load-failed', function(event) {
        console.warn("KB: Failed to load tile:", event);
      });

      console.log("KB: OpenSeadragon initialized successfully");
    } catch (err) {
      console.error("KB: OSD initialization failed:", err);
      console.error("KB: Error stack:", err.stack);
      this._showNoAssets(container);
    }
  }

  /**
   * Show "no assets" message
   */
  _showNoAssets(container) {
    if (container && container.parentElement) {
      container.parentElement.innerHTML = '<p style="color: #999; padding: 20px; text-align: center;">No digital assets available for this entity.</p>';
    }
  }

  /**
   * D3 rendering logic
   */
  _renderD3Graph(graph, mappingData) {
    const nodeMapping = {};
    const legendContainer = d3.select("#legend");

    mappingData.forEach(row => {
      nodeMapping[row.yaml_class] = { color: row.color, image: row.default_image };
      const item = legendContainer.append("div").attr("class", "legend-item");
      item.append("span").style("background-color", row.color).attr("class", "legend-circle");
      item.append("span").text(row.yaml_class);
    });

    const graphContainer = document.querySelector("#graph-container");
    const width = graphContainer.clientWidth;
    const height = 600;
    const extent = [[0, 0], [width, height]];

    const zoom = d3.zoom()
      .scaleExtent([0.5, 4])
      .translateExtent(extent)
      .on("zoom", (event) => { container.attr("transform", event.transform); });

    const svg = d3.select("#graph-container").append("svg")
      .attr("width", "100%").attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .call(zoom)
      .on("dblclick.zoom", null);

    svg.append("defs").append("marker")
      .attr("id", "arrowhead").attr("viewBox", "0 -5 10 10")
      .attr("refX", 28).attr("refY", 0)
      .attr("markerWidth", 6).attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path").attr("d", "M0,-5L10,0L0,5").attr("fill", "#999");

    const container = svg.append("g");

    const simulation = d3.forceSimulation(graph.nodes)
      .force("link", d3.forceLink(graph.links).id(d => d.id).distance(150))
      .force("charge", d3.forceManyBody().strength(-1000))
      .force("center", d3.forceCenter(width / 2, height / 2));

    const link = container.append("g").attr("stroke", "#999").attr("stroke-opacity", 0.6)
      .selectAll("line").data(graph.links).join("line").attr("marker-end", "url(#arrowhead)");

    const linkLabels = container.append("g").selectAll("text")
      .data(graph.links).join("text")
      .text(d => d.property?.replaceAll("_", " ") || "")
      .attr("font-size", "10px").attr("fill", "#666").style("display", "none");

    const node = container.append("g").selectAll("g")
      .data(graph.nodes).join("g").attr("class", "node-group")
      .on("click", (event, d) => this._openModal(d, nodeMapping))
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
      );

    node.append("circle")
      .attr("r", 18)
      .attr("fill", d => nodeMapping[d.class]?.color || "#ccc")
      .attr("stroke", "#000").attr("stroke-width", 2);

    node.append("image")
      .attr("xlink:href", d => nodeMapping[d.class]?.image)
      .attr("x", -12).attr("y", -12).attr("width", 24).attr("height", 24);

    const labels = node.append("text")
      .text(d => d.label || d.id)
      .attr("x", 0).attr("y", -25)
      .attr("text-anchor", "middle")
      .attr("class", "node-label")
      .style("font-family", "'Crimson Pro', serif");

    d3.select("#zoom-in").on("click", () => svg.transition().duration(300).call(zoom.scaleBy, 1.4));
    d3.select("#zoom-out").on("click", () => svg.transition().duration(300).call(zoom.scaleBy, 0.7));
    d3.select("#toggleLabels").on("change", (e) => labels.style("display", e.target.checked ? "block" : "none"));
    d3.select("#toggleProperties").on("change", (e) => linkLabels.style("display", e.target.checked ? "block" : "none"));

    d3.select("#search").on("keydown", (event) => {
      if (event.key === "Enter") {
        const term = event.target.value.toLowerCase();
        node.selectAll("circle").transition().duration(500)
          .attr("r", d => (d.label?.toLowerCase().includes(term)) ? 30 : 18)
          .attr("stroke", d => (d.label?.toLowerCase().includes(term)) ? "#ffeb3b" : "#000")
          .attr("stroke-width", d => (d.label?.toLowerCase().includes(term)) ? 6 : 2);
      }
    });

    simulation.on("tick", () => {
      link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
      linkLabels.attr("x", d => (d.source.x + d.target.x) / 2).attr("y", d => (d.source.y + d.target.y) / 2);
      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    d3.select("#modal-close").on("click", () => {
      d3.select("#modal-backdrop").style("display", "none").attr("aria-hidden", "true");
    });

    function dragstarted(event, d) { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }
    function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
    function dragended(event, d) { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }
  }

  _openModal(d, nodeMapping) {
    d3.select("#modal-title").text(d.label || d.id);
    d3.select("#modal-desc").text(d.description || "No description available.");
    d3.select("#modal-media").html(`<img src="${nodeMapping[d.class]?.image}" style="max-width: 80px; margin-bottom: 10px;">`);
    d3.select("#modal-link").attr("href", d.id);
    d3.select("#modal-backdrop").style("display", "flex").attr("aria-hidden", "false");
  }

  /**
   * Start watching for DOM changes (handles MkDocs instant navigation)
   */
  startObserver() {
    const observer = new MutationObserver(() => {
      this.initD3Graph();
      this.initOpenSeadragon();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Try initialization on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
      this.initD3Graph();
      this.initOpenSeadragon();
    });

    // Also try immediately
    this.initD3Graph();
    this.initOpenSeadragon();
  }
}

// Initialize KB-Light
const kb = new KBLightInit();
kb.setup();
kb.startObserver();

// Backward compatibility
window.entityGraphUrl = window.kbGraphConfig?.graphUrl || "";
window.entityAssets = window.kbGraphConfig?.assets || null;
