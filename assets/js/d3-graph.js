document.addEventListener("DOMContentLoaded", function() {
  const csvUrl = "https://raw.githubusercontent.com/NicholasCorniaOrpheus/tresor-des-demoiselles/main/data/mappings/yaml_classes2lod.csv";
  const graphUrl = "https://raw.githubusercontent.com/NicholasCorniaOrpheus/tresor-des-demoiselles/main/data/graph.json";
  
  Promise.all([d3.csv(csvUrl), d3.json(graphUrl)]).then(([mappingData, graph]) => {
    const nodeMapping = {};
    const legendContainer = d3.select("#legend");

    // 1. Generate Legend and Map Data
    mappingData.forEach(row => {
      nodeMapping[row.yaml_class] = { color: row.color, image: row.default_image };
      const item = legendContainer.append("div").attr("class", "legend-item");
      item.append("span").style("background-color", row.color).attr("class", "legend-circle");
      item.append("span").text(row.yaml_class);
    });

    const width = document.querySelector("#graph-container").clientWidth;
    const height = 600;

    const svg = d3.select("#graph-container").append("svg")
      .attr("width", "100%").attr("height", height)
      .call(d3.zoom().on("zoom", (event) => container.attr("transform", event.transform)));

    const container = svg.append("g");

    const simulation = d3.forceSimulation(graph.nodes)
      .force("link", d3.forceLink(graph.links).id(d => d.id).distance(120))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2));

    const link = container.append("g").attr("stroke", "#999").selectAll("line")
      .data(graph.links).join("line");

    const node = container.append("g").selectAll("g")
      .data(graph.nodes).join("g").attr("class", "node-group")
      .on("click", (event, d) => openModal(d)) // MODAL TRIGGER
      .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended));

    node.append("circle").attr("r", 20)
      .attr("fill", d => nodeMapping[d.class]?.color || "#ccc");

    node.append("image").attr("xlink:href", d => nodeMapping[d.class]?.image)
      .attr("x", -12).attr("y", -12).attr("width", 24).attr("height", 24);

    const labels = node.append("text").text(d => d.label || d.id)
      .attr("x", 25).attr("y", 5).attr("class", "node-label");

    // 2. Search Functionality
    d3.select("#search").on("keydown", (event) => {
      if (event.key === "Enter") {
        const term = event.target.value.toLowerCase();
        node.selectAll("circle").transition().duration(500)
          .attr("r", d => (d.label?.toLowerCase().includes(term) || d.id.toLowerCase().includes(term)) ? 35 : 20)
          .attr("stroke", d => (d.label?.toLowerCase().includes(term)) ? "#ffeb3b" : "#fff")
          .attr("stroke-width", d => (d.label?.toLowerCase().includes(term)) ? 5 : 2);
      }
    });

    // 3. Label Toggle
    d3.select("#toggleLabels").on("change", (event) => {
      labels.style("display", event.target.checked ? "block" : "none");
    });

    // 4. Modal Logic
    function openModal(d) {
      d3.select("#modal-title").text(d.label || d.id);
      d3.select("#modal-desc").text(d.description || "No description available.");
      d3.select("#modal-media").html(`<img src="${d.image}" width="100">`);
      // Link logic based on your repository structure [Conversation History]
      d3.select("#modal-link").attr("href", `${d.id}/`);
      d3.select("#modal-backdrop").style("display", "flex").attr("aria-hidden", "false");
    }

    d3.select("#modal-close").on("click", () => {
      d3.select("#modal-backdrop").style("display", "none").attr("aria-hidden", "true");
    });

    simulation.on("tick", () => {
      link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
          .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event, d) { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }
    function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
    function dragended(event, d) { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }
  });
});


// // Configuration
// const csvUrl = "https://raw.githubusercontent.com/NicholasCorniaOrpheus/tresor-des-demoiselles/main/data/mappings/yaml_classes2lod.csv";
// const graphUrl = "https://raw.githubusercontent.com/NicholasCorniaOrpheus/tresor-des-demoiselles/main/data/graph.json";
// const width = 800;
// const height = 600;

// // Setup SVG Container
// const svg = d3.select("#d3-graph-container")
//   .append("svg")
//   .attr("width", "100%")
//   .attr("height", height)
//   .call(d3.zoom().on("zoom", (event) => {
//     container.attr("transform", event.transform);
//   }));

// const container = svg.append("g");

// // Load both CSV (Mapping) and JSON (Graph) data
// Promise.all([
//   d3.csv(csvUrl),
//   d3.json(graphUrl)
// ]).then(([mappingData, graph]) => {
  
//   // Create a dynamic lookup object from the CSV rows
//   // Keyed by yaml_class (e.g., "Agent")
//   const nodeMapping = {};
//   mappingData.forEach(row => {
//     nodeMapping[row.yaml_class] = {
//       color: row.color,
//       image: row.default_image
//     };
//   });

//   // Initialize Force Simulation
//   const simulation = d3.forceSimulation(graph.nodes)
//     .force("link", d3.forceLink(graph.links).id(d => d.id).distance(100))
//     .force("charge", d3.forceManyBody().strength(-300))
//     .force("center", d3.forceCenter(width / 2, height / 2));

//   // Render Links
//   const link = container.append("g")
//     .attr("stroke", "#999")
//     .attr("stroke-opacity", 0.6)
//     .selectAll("line")
//     .data(graph.links)
//     .join("line");

//   // Render Node Groups
//   const node = container.append("g")
//     .selectAll("g")
//     .data(graph.nodes)
//     .join("g")
//     .call(d3.drag()
//       .on("start", dragstarted)
//       .on("drag", dragged)
//       .on("end", dragended));

//   // Add Dynamic Circle Backgrounds
//   node.append("circle")
//     .attr("r", 18)
//     .attr("fill", d => nodeMapping[d.class]?.color || "#ccc") // Dynamic Color from CSV
//     .attr("stroke", "#fff")
//     .attr("stroke-width", 2);

//   // Add Dynamic Images (Icons)
//   node.append("image")
//     .attr("xlink:href", d => nodeMapping[d.class]?.image) // Dynamic Image from CSV
//     .attr("x", -12)
//     .attr("y", -12)
//     .attr("width", 24)
//     .attr("height", 24);

//   // Tooltip
//   node.append("title").text(d => `${d.id} (${d.class})`);

//   // Simulation Ticks
//   simulation.on("tick", () => {
//     link
//       .attr("x1", d => d.source.x)
//       .attr("y1", d => d.source.y)
//       .attr("x2", d => d.target.x)
//       .attr("y2", d => d.target.y);

//     node.attr("transform", d => `translate(${d.x},${d.y})`);
//   });

//   // Drag Behaviors
//   function dragstarted(event, d) {
//     if (!event.active) simulation.alphaTarget(0.3).restart();
//     d.fx = d.x; d.fy = d.y;
//   }
//   function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
//   function dragended(event, d) {
//     if (!event.active) simulation.alphaTarget(0);
//     d.fx = null; d.fy = null;
//   }

// }).catch(err => {
//   console.error("Error loading graph data:", err);
// });