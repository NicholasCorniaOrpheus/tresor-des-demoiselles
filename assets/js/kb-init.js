/**
 * KB-Light: Unified component initializer (FIXED)
 * Supports IIIF Presentation API v2 and v3 with multiple manifest structure variations
 * Handles CORS and Image API format issues with comprehensive fallback logic
 * FIXES: Prevents infinite reload loop, handles 406 errors, proper V2/V3 detection
 */

class KBLightInit {
  constructor() {
    this.d3Initialized = false;
    this.config = window.kbGraphConfig || {};
    this.graphInitialized = false;
    this._running = false;
    this._observerTimer = null;
    this._observer = null;
    this._initializedContainers = new Set(); // Track initialized containers to prevent re-initialization
    this._initializingContainers = new Set(); // Track containers currently initializing
  }

  setup() {
    if (typeof document$ !== "undefined") {
      document$.subscribe(() => {
        console.log("Instant Loading: Re-initializing components...");
        this.graphInitialized = false;
        this.runPageLogic();
      });
    } else {
      document.addEventListener("DOMContentLoaded", () => this.runPageLogic());
    }
  }

  _relocateOSDContainersIntoAdmonitions() {
    const containers = Array.from(document.querySelectorAll('[id^="openseadragon-container-"]'));
    if (!containers.length) return;

    const admonitionCandidates = Array.from(document.querySelectorAll('details.abstract, details, .admonition, .md-typeset .admonition'));

    containers.forEach(container => {
      if (container.dataset.relocated === "true") return;

      const insideAdmon = container.closest('details, .admonition');
      if (insideAdmon) {
        container.dataset.relocated = "true";
        return;
      }

      const targetTitle = (container.dataset.admonitionTitle || 'Digitised images').trim().toLowerCase();

      let matched = admonitionCandidates.find(ad => {
        const summary = ad.querySelector('summary');
        if (summary && summary.textContent && summary.textContent.toLowerCase().includes(targetTitle)) return true;
        const heading = ad.querySelector('.admonition-title, .md-typeset > p, .md-typeset > h1, .md-typeset > h2, .md-typeset > h3');
        if (heading && heading.textContent && heading.textContent.toLowerCase().includes(targetTitle)) return true;
        const txt = (ad.textContent || '').trim().toLowerCase();
        return txt.startsWith(targetTitle);
      });

      if (!matched) {
        matched = document.querySelector('details.abstract') || document.querySelector('details') || null;
      }

      if (matched) {
        const summary = matched.querySelector('summary');
        try {
          if (summary && summary.parentNode) {
            summary.insertAdjacentElement('afterend', container);
          } else {
            matched.appendChild(container);
          }
          container.dataset.relocated = "true";
        } catch (err) {
          console.warn("KB: relocation failed for container", container.id, err);
        }
      }
    });
  }

  async runPageLogic() {
    if (this._running) {
      console.debug("KB: runPageLogic already running, skipping");
      return;
    }
    this._running = true;
    try {
      this.initD3Graph();
      this._relocateOSDContainersIntoAdmonitions();
      await this.initOpenSeadragon();
    } catch (err) {
      console.error("KB: runPageLogic error:", err);
    } finally {
      this._running = false;
    }
  }

  initD3Graph() {
    const graphContainer = document.querySelector("#graph-container");
    const graphUrl = this.config.graphUrl;
    if (!graphContainer || !graphUrl || graphUrl.trim() === "" || graphUrl === "None") return;
    if (this.d3Initialized) return;
    this.d3Initialized = true;

    console.log("KB: Initializing D3 graph from", graphUrl);
    const csvUrl = "https://raw.githubusercontent.com/NicholasCorniaOrpheus/tresor-des-demoiselles/main/data/mappings/yaml_classes2lod.csv";

    Promise.all([d3.csv(csvUrl), d3.json(graphUrl)])
      .then(([mappingData, graph]) => this._renderD3Graph(graph, mappingData))
      .catch(err => {
        console.error("D3 Graph failed:", err);
        if (graphContainer) {
          graphContainer.innerHTML = '<p style="color: red; padding: 20px;">Failed to load graph.</p>';
        }
      });
  }

  async initOpenSeadragon() {
    const osdContainers = Array.from(document.querySelectorAll('.osd-viewer'));
    if (osdContainers.length === 0) {
      const legacy = document.querySelector('#osd-viewer');
      if (legacy) osdContainers.push(legacy);
    }

    const assets = this.config.assets || {};
    if (osdContainers.length === 0 || !assets) return;

    const iiif = assets.iiif;

    if (Array.isArray(iiif) && iiif.length > 0) {
      if (iiif.length === osdContainers.length) {
        for (let idx = 0; idx < iiif.length; idx++) {
          const m = iiif[idx];
          const c = osdContainers[idx];
          if (!c) continue;
          
          // FIXED: Check both data attribute and our tracking Set to prevent re-initialization
          const containerId = c.id || `osd-viewer-generated-${idx}`;
          if (!c.id) c.id = containerId;
          
          if (c.dataset.osdInitialized === "true" || this._initializedContainers.has(containerId)) {
            console.debug(`KB: Container ${containerId} already initialized, skipping`);
            continue;
          }
          
          if (this._initializingContainers.has(containerId)) {
            console.debug(`KB: Container ${containerId} currently initializing, skipping`);
            continue;
          }

          this._initializingContainers.add(containerId);
          
          if (typeof m === 'object') {
            const tileSources = this._parseIIIFManifestV3(m) || this._parseIIIFManifestV2(m) || [];
            if (tileSources.length) {
              this._initOSD(tileSources, c);
            } else {
              this._showNoAssets(c);
            }
          } else if (typeof m === 'string' && m.trim() !== "") {
            await this._loadIIIFManifest(m, c);
          } else {
            this._showNoAssets(c);
          }
          
          c.dataset.osdInitialized = "true";
          this._initializedContainers.add(containerId);
          this._initializingContainers.delete(containerId);
        }
        return;
      }

      try {
        const tileSources = await this._loadMultipleIIIFManifests(iiif);
        if (!tileSources || tileSources.length === 0) {
          this._initImagesFallback(assets, osdContainers[0]);
          osdContainers.forEach((c, idx) => {
            const cId = c.id || `osd-viewer-generated-${idx}`;
            c.id = cId;
            c.dataset.osdInitialized = "true";
            this._initializedContainers.add(cId);
          });
          return;
        }
        const first = osdContainers[0];
        if (!first.id) first.id = `osd-viewer-generated-0`;
        
        if (this._initializedContainers.has(first.id)) {
          console.debug(`KB: First container already initialized`);
          return;
        }
        
        this._initOSD(tileSources, first);
        first.dataset.osdInitialized = "true";
        this._initializedContainers.add(first.id);
      } catch (err) {
        console.error("KB: Error loading multiple IIIF manifests:", err);
        this._initImagesFallback(assets, osdContainers[0]);
        osdContainers.forEach((c, idx) => {
          const cId = c.id || `osd-viewer-generated-${idx}`;
          c.id = cId;
          c.dataset.osdInitialized = "true";
          this._initializedContainers.add(cId);
        });
      }
      return;
    }

    const container = osdContainers[0];
    if (!container) return;
    if (!container.id) container.id = `osd-viewer-generated-0`;
    
    // FIXED: Check initialized containers
    if (container.dataset.osdInitialized === "true" || this._initializedContainers.has(container.id)) {
      console.debug(`KB: Container ${container.id} already initialized`);
      return;
    }

    if (typeof iiif === 'string' && iiif.trim() !== "") {
      await this._loadIIIFManifest(iiif, container);
      container.dataset.osdInitialized = "true";
      this._initializedContainers.add(container.id);
      return;
    }

    if (typeof iiif === 'object' && iiif !== null) {
      const tileSources = this._parseIIIFManifestV3(iiif) || this._parseIIIFManifestV2(iiif) || [];
      if (tileSources.length > 0) {
        this._initOSD(tileSources, container);
      } else {
        this._initImagesFallback(assets, container);
      }
      container.dataset.osdInitialized = "true";
      this._initializedContainers.add(container.id);
      return;
    }

    this._initImagesFallback(assets, container);
    container.dataset.osdInitialized = "true";
    this._initializedContainers.add(container.id);
  }

  _initImagesFallback(assets, container) {
    if (!container) return;
    const images = assets.images || assets.jpg || [];
    if (!Array.isArray(images) || images.length === 0) {
      this._showNoAssets(container);
      return;
    }
    const tileSources = images.map(item => {
      const filename = (typeof item === 'string') ? item : item?.value;
      if (!filename) return null;
      const base = assets.base_github_url || "";
      const path = assets.local_path || "";
      const url = (base + path + filename).replace(/([^:]\/)\/+/g, "$1");
      return { type: 'image', url: url };
    }).filter(s => s !== null);

    if (tileSources.length > 0) {
      this._initOSD(tileSources, container);
    } else {
      this._showNoAssets(container);
    }
  }

  /**
   * FIXED: Improved manifest loading with better error handling
   * Prevents 406 errors and handles timeout gracefully
   */
  _loadIIIFManifest(manifestUrl, container) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    // FIXED: Try multiple Accept header strategies
    const tryAcceptHeaders = async (headerIndex = 0) => {
      const acceptHeaders = [
        'application/json',
        'application/ld+json',
        'application/hal+json',
        '*/*'
      ];

      if (headerIndex >= acceptHeaders.length) {
        console.error("KB: All Accept header strategies failed for", manifestUrl);
        clearTimeout(timeoutId);
        this._showNoAssets(container);
        return false;
      }

      const acceptHeader = acceptHeaders[headerIndex];
      console.debug(`KB: Trying manifest with Accept: ${acceptHeader}`);

      try {
        const response = await fetch(manifestUrl, {
          method: 'GET',
          headers: { 'Accept': acceptHeader },
          credentials: 'omit',
          signal: controller.signal
        });

        if (response.status === 406) {
          console.warn(`KB: Got 406 with Accept: ${acceptHeader}, trying next strategy`);
          return tryAcceptHeaders(headerIndex + 1);
        }

        if (!response.ok) {
          console.warn(`KB: Got ${response.status} with Accept: ${acceptHeader}`);
          if (headerIndex < acceptHeaders.length - 1) {
            return tryAcceptHeaders(headerIndex + 1);
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const manifest = await response.json();
        console.debug("KB: Manifest loaded successfully with Accept:", acceptHeader);
        
        // FIXED: Better V2/V3 detection
        const tileSources = this._parseIIIFManifestV3(manifest) || 
                           this._parseIIIFManifestV2(manifest) || 
                           this._parseIIIFManifestFallback(manifest) || 
                           [];

        if (tileSources && tileSources.length > 0) {
          this._initOSD(tileSources, container);
          clearTimeout(timeoutId);
          return true;
        } else {
          console.warn("KB: No tileSources found in manifest after all parsing attempts");
          this._showNoAssets(container);
          clearTimeout(timeoutId);
          return false;
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          console.error("KB: Manifest fetch timeout for", manifestUrl);
          clearTimeout(timeoutId);
          this._showNoAssets(container);
          return false;
        }
        console.warn(`KB: Error with Accept: ${acceptHeader}`, err.message);
        return tryAcceptHeaders(headerIndex + 1);
      }
    };

    return tryAcceptHeaders();
  }

  _loadMultipleIIIFManifests(manifests) {
    const fetchWithAcceptRetry = async (url, headerIndex = 0) => {
      const acceptHeaders = [
        'application/json',
        'application/ld+json',
        'application/hal+json',
        '*/*'
      ];

      if (headerIndex >= acceptHeaders.length) {
        return Promise.reject(new Error(`All Accept strategies failed for ${url}`));
      }

      const acceptHeader = acceptHeaders[headerIndex];
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': acceptHeader },
          credentials: 'omit'
        });

        if (response.status === 406) {
          return fetchWithAcceptRetry(url, headerIndex + 1);
        }

        if (!response.ok) {
          if (headerIndex < acceptHeaders.length - 1) {
            return fetchWithAcceptRetry(url, headerIndex + 1);
          }
          return Promise.reject(new Error(`HTTP ${response.status}`));
        }

        return response.json();
      } catch (err) {
        if (headerIndex < acceptHeaders.length - 1) {
          return fetchWithAcceptRetry(url, headerIndex + 1);
        }
        return Promise.reject(err);
      }
    };

    const fetchPromises = manifests.map(m => {
      if (typeof m === 'object') return Promise.resolve(m);
      if (typeof m === 'string') return fetchWithAcceptRetry(m);
      return Promise.reject(new Error('Unsupported manifest type'));
    });

    return Promise.allSettled(fetchPromises)
      .then(results => {
        const tileSourcesAll = [];
        results.forEach((res, idx) => {
          if (res.status === 'fulfilled' && res.value) {
            try {
              const tiles = this._parseIIIFManifestV3(res.value) || 
                           this._parseIIIFManifestV2(res.value) || 
                           this._parseIIIFManifestFallback(res.value);
              if (Array.isArray(tiles) && tiles.length) tileSourcesAll.push(...tiles);
            } catch (e) {
              console.warn("KB: parse manifest failed for index", idx, e);
            }
          } else {
            console.warn("KB: manifest fetch failed for index", idx, res.reason);
          }
        });
        return tileSourcesAll;
      });
  }

  /**
   * FIXED: Better V2/V3 detection and parsing
   */
  _parseIIIFManifestV3(manifest) {
    if (!manifest) return null;
    
    const context = manifest['@context'] || manifest.context || '';
    const isV3 = typeof context === 'string' 
      ? context.includes('presentation/3') 
      : Array.isArray(context) && context.some(c => typeof c === 'string' && c.includes('presentation/3'));

    if (!isV3) return null;

    console.debug("KB: Parsing IIIF v3 manifest");
    const tileSources = [];
    const items = manifest.items || [];
    
    for (const item of items) {
      const canvasId = item.id || '';
      const canvasWidth = item.width || 800;
      const canvasHeight = item.height || 1000;

      console.debug("KB: Processing Canvas:", canvasId);

      // Path 1: Canvas → items (AnnotationPages) → items (Annotations) → body (Image with service)
      if (item.items && Array.isArray(item.items)) {
        for (const page of item.items) {
          if (page.type !== 'AnnotationPage') continue;
          if (!page.items || !Array.isArray(page.items)) continue;

          for (const annotation of page.items) {
            if (annotation.type !== 'Annotation') continue;
            if (annotation.motivation && !['painting', 'supplementing'].includes(annotation.motivation)) continue;

            const body = annotation.body;
            if (!body) continue;

            if (body.type === 'Image' && body.service) {
              const services = Array.isArray(body.service) ? body.service : [body.service];
              for (const svc of services) {
                const serviceId = svc['@id'] || svc.id;
                if (serviceId) {
                  tileSources.push(this._makeIIIFImageTileSource(serviceId, body));
                  console.debug("KB: Added tile source from v3 annotation body.service:", serviceId);
                }
              }
            } else if (body.type === 'Image' && (body['@id'] || body.id)) {
              const url = body['@id'] || body.id;
              tileSources.push({ type: 'image', url: url });
              console.debug("KB: Added tile source from v3 annotation body.id:", url);
            }
          }
        }
      }

      // Path 2: Canvas → annotations (AnnotationPages)
      if (item.annotations && Array.isArray(item.annotations)) {
        for (const page of item.annotations) {
          if (page.type !== 'AnnotationPage') continue;
          if (!page.items || !Array.isArray(page.items)) continue;

          for (const annotation of page.items) {
            if (annotation.type !== 'Annotation') continue;
            if (annotation.motivation && !['painting', 'supplementing'].includes(annotation.motivation)) continue;

            const body = annotation.body;
            if (!body) continue;

            if (body.type === 'Image' && body.service) {
              const services = Array.isArray(body.service) ? body.service : [body.service];
              for (const svc of services) {
                const serviceId = svc['@id'] || svc.id;
                if (serviceId) {
                  tileSources.push(this._makeIIIFImageTileSource(serviceId, body));
                  console.debug("KB: Added tile source from v3 canvas.annotations:", serviceId);
                }
              }
            } else if (body.type === 'Image' && (body['@id'] || body.id)) {
              const url = body['@id'] || body.id;
              tileSources.push({ type: 'image', url: url });
              console.debug("KB: Added tile source from v3 canvas.annotations URL:", url);
            }
          }
        }
      }

      // Path 3: Canvas → body (direct image on canvas)
      if (item.body) {
        const body = Array.isArray(item.body) ? item.body[0] : item.body;
        if (body && body.type === 'Image') {
          if (body.service) {
            const services = Array.isArray(body.service) ? body.service : [body.service];
            for (const svc of services) {
              const serviceId = svc['@id'] || svc.id;
              if (serviceId) {
                tileSources.push(this._makeIIIFImageTileSource(serviceId, body));
                console.debug("KB: Added tile source from v3 canvas.body.service:", serviceId);
              }
            }
          } else if (body['@id'] || body.id) {
            const url = body['@id'] || body.id;
            tileSources.push({ type: 'image', url: url });
            console.debug("KB: Added tile source from v3 canvas.body.id:", url);
          }
        }
      }

      // Path 4: Canvas → rendering
      if (item.rendering && Array.isArray(item.rendering)) {
        for (const render of item.rendering) {
          if (render['@id'] || render.id) {
            const url = render['@id'] || render.id;
            if (url.match(/\.(jpg|jpeg|png|tif|tiff|jp2)(\?|$)/i)) {
              tileSources.push({ type: 'image', url: url });
              console.debug("KB: Added tile source from v3 canvas.rendering:", url);
            }
          }
        }
      }
    }

    return tileSources.length > 0 ? tileSources : null;
  }

  /**
   * FIXED: Proper V2 manifest parsing for EDL Italy structure
   */
  _parseIIIFManifestV2(manifest) {
    if (!manifest) return null;
    
    const context = manifest['@context'] || manifest.context || '';
    const isV2 = typeof context === 'string' 
      ? context.includes('presentation/2') 
      : Array.isArray(context) && context.some(c => typeof c === 'string' && c.includes('presentation/2'));

    if (!isV2) return null;

    console.debug("KB: Parsing IIIF v2 manifest");
    const tileSources = [];

    // FIXED: Handle both standard V2 structure and EDL Italy's variant
    const sequences = manifest.sequences || [];
    
    if (sequences.length === 0) {
      console.warn("KB: V2 manifest has no sequences");
      return null;
    }

    for (const seq of sequences) {
      const canvases = seq.canvases || [];
      console.debug("KB: V2 sequence has", canvases.length, "canvases");
      
      for (const canvas of canvases) {
        const images = canvas.images || [];
        
        for (const image of images) {
          // EDL Italy structure: image.resource.service
          const resource = image.resource || {};
          const service = resource.service || resource['service'];
          
          if (service) {
            const serviceUrl = service['@id'] || service.id;
            if (serviceUrl) {
              tileSources.push(this._makeIIIFImageTileSource(serviceUrl, canvas));
              console.debug("KB: Added tile source from v2 resource.service:", serviceUrl);
            }
          } else if (resource && (resource['@id'] || resource.id || resource.url)) {
            const url = resource['@id'] || resource.id || resource.url;
            tileSources.push({ type: 'image', url: url });
            console.debug("KB: Added tile source from v2 resource URL:", url);
          }
        }
      }
    }

    return tileSources.length > 0 ? tileSources : null;
  }

  /**
   * Fallback parser - unchanged from original
   */
  _parseIIIFManifestFallback(manifest) {
    const services = new Set();
    const images = new Set();

    function collect(obj) {
      if (!obj) return;
      if (typeof obj === 'string') {
        if (obj.match(/\.(jpg|jpeg|png|tif|tiff|webp|jp2)(\?|$)/i) || obj.endsWith('/info.json')) {
          images.add(obj);
        }
        return;
      }
      if (Array.isArray(obj)) {
        obj.forEach(collect);
        return;
      }
      if (typeof obj !== 'object') return;

      if (obj.service) {
        const s = Array.isArray(obj.service) ? obj.service : [obj.service];
        s.forEach(si => {
          if (!si) return;
          if (typeof si === 'string') {
            if (si.endsWith('/info.json') || si.match(/\.(jpg|png|jpeg|jp2|tif|tiff)/i)) {
              images.add(si);
            } else {
              services.add(si);
            }
            return;
          }
          const sid = si['@id'] || si.id || null;
          if (sid && typeof sid === 'string') services.add(sid);
          collect(si);
        });
      }

      if (obj.resource && obj.resource.service) {
        const s = Array.isArray(obj.resource.service) ? obj.resource.service : [obj.resource.service];
        s.forEach(si => {
          const sid = (si && (si['@id'] || si.id)) || null;
          if (sid) services.add(sid);
          else collect(si);
        });
      }

      if (obj['@id'] && typeof obj['@id'] === 'string') {
        const idv = obj['@id'];
        if (idv.endsWith('/info.json') || idv.match(/\.(jpg|jpeg|png|tif|tiff|jp2)(\?|$)/i)) {
          images.add(idv);
        } else {
          services.add(idv);
        }
      }
      if (obj.id && typeof obj.id === 'string') {
        const idv = obj.id;
        if (idv.endsWith('/info.json') || idv.match(/\.(jpg|jpeg|png|tif|tiff|jp2)(\?|$)/i)) {
          images.add(idv);
        } else {
          services.add(idv);
        }
      }

      if (obj.type && String(obj.type).toLowerCase() === 'image') {
        if (obj.service) collect(obj.service);
        if (obj.id) {
          const idv = obj.id;
          if (idv.endsWith('/info.json') || idv.match(/\.(jpg|jpeg|png|tif|tiff|jp2)(\?|$)/i)) {
            images.add(idv);
          } else {
            services.add(idv);
          }
        }
      }

      if (obj.url && typeof obj.url === 'string') {
        const urlv = obj.url;
        if (urlv.match(/\.(jpg|jpeg|png|tif|tiff|jp2)(\?|$)/i)) {
          images.add(urlv);
        }
        if (urlv.endsWith('/info.json')) {
          services.add(urlv);
        }
      }
      if (obj.href && typeof obj.href === 'string') {
        const hv = obj.href;
        if (hv.match(/\.(jpg|jpeg|png|tif|tiff|jp2)(\?|$)/i)) {
          images.add(hv);
        }
        if (hv.endsWith('/info.json')) {
          services.add(hv);
        }
      }

      for (const k of Object.keys(obj)) {
        try { collect(obj[k]); } catch (e) { /* ignore */ }
      }
    }

    collect(manifest);

    console.debug("KB: fallback parser found services:", Array.from(services), "images:", Array.from(images));

    const tileSources = [];

    services.forEach(surl => {
      if (!surl || typeof surl !== 'string') return;
      if (surl.endsWith('/info.json')) {
        tileSources.push(surl);
      } else if (surl.match(/\.(jpg|jpeg|png|tif|tiff|jp2)(\?|$)/i)) {
        tileSources.push({ type: 'image', url: surl });
      } else {
        const infoCandidate = surl.endsWith('/') ? (surl + 'info.json') : (surl + '/info.json');
        tileSources.push(infoCandidate);
        tileSources.push(this._makeIIIFImageTileSource(surl, null));
      }
    });

    images.forEach(img => {
      if (!img || typeof img !== 'string') return;
      if (img.endsWith('/info.json')) {
        tileSources.push(img);
      } else {
        tileSources.push({ type: 'image', url: img });
      }
    });

    const seen = new Set();
    const unique = [];
    for (const t of tileSources) {
      const key = (typeof t === 'string') ? t : (t['@id'] || t.url || JSON.stringify(t));
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(t);
      }
    }

    return unique.length > 0 ? unique : null;
  }

  _makeIIIFImageTileSource(serviceUrl, canvasItem) {
    return {
      '@context': 'http://iiif.io/api/image/2/context.json',
      '@id': serviceUrl,
      protocol: 'http://iiif.io/api/image',
      profile: 'http://iiif.io/api/image/2/level1.json',
      width: (canvasItem && canvasItem.width) || 800,
      height: (canvasItem && canvasItem.height) || 1000,
      tiles: [{ width: 256, scaleFactors: [1, 2, 4, 8, 16] }]
    };
  }

  _initOSD(tileSources, container) {
    try {
      if (!container.id) {
        container.id = `osd-viewer-generated-${Math.floor(Math.random() * 100000)}`;
      }
      const viewer = new OpenSeadragon({
        id: container.id,
        prefixUrl: "https://cdnjs.cloudflare.com/ajax/libs/openseadragon/4.1.0/images/",
        sequenceMode: tileSources.length > 1,
        showReferenceStrip: tileSources.length > 1,
        tileSources: tileSources,
        crossOriginPolicy: 'Anonymous',
        ajaxWithCredentials: false,
        timeout: 60000,
        loadTilesWithAjax: true,
        debugMode: false
      });

      viewer.addHandler('open-failed', e => console.error("KB: OpenSeadragon open-failed", e));
      viewer.addHandler('tile-load-failed', e => console.warn("KB: OpenSeadragon tile-load-failed", e));
      console.log("KB: OpenSeadragon initialized with", tileSources.length, "tileSources on", container.id);
    } catch (err) {
      console.error("KB: OSD initialization failed:", err);
      this._showNoAssets(container);
    }
  }

  _showNoAssets(container) {
    if (container && container.parentElement) {
      container.parentElement.innerHTML = '<p style="color: #999; padding: 20px; text-align: center;">No digital assets available for this entity.</p>';
    }
  }

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

  startObserver() {
    if (this._observer) return;

    const observer = new MutationObserver((mutations) => {
      // FIXED: Only react to relevant mutations to prevent excessive re-initialization
      const hasRelevantChanges = mutations.some(m => {
        return m.addedNodes.length > 0 && 
               Array.from(m.addedNodes).some(n => 
                 (n.nodeType === 1 && (n.classList?.contains('osd-viewer') || n.id?.startsWith('osd-viewer')))
               );
      });

      if (!hasRelevantChanges) return;

      if (this._observerTimer) clearTimeout(this._observerTimer);
      this._observerTimer = setTimeout(() => {
        if (!this._running) {
          try {
            this.runPageLogic();
          } catch (e) {
            console.error("KB: observer-runPageLogic error", e);
          }
        }
      }, 300);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    this._observer = observer;

    document.addEventListener('DOMContentLoaded', () => this.runPageLogic());
    this.runPageLogic();
  }
}

// Initialize KB-Light
const kb = new KBLightInit();
kb.setup();
kb.startObserver();