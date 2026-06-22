// Configuration
const csvUrl = "https://raw.githubusercontent.com/NicholasCorniaOrpheus/tresor-des-demoiselles/main/data/mappings/yaml_classes2lod.csv";
const graphUrl = "./graph.json";
const width = 800;
const height = 600;

// Setup SVG Container
const svg = d3.select("#d3-graph-container")
  .append("svg")
  .attr("width", "100%")
  .attr("height", height)
  .call(d3.zoom().on("zoom", (event) => {
    container.attr("transform", event.transform);
  }));

const container = svg.append("g");

// Load both CSV (Mapping) and JSON (Graph) data
Promise.all([
  d3.csv(csvUrl),
  d3.json(graphUrl)
]).then(([mappingData, graph]) => {
  
  // Create a dynamic lookup object from the CSV rows
  // Keyed by yaml_class (e.g., "Agent")
  const nodeMapping = {};
  mappingData.forEach(row => {
    nodeMapping[row.yaml_class] = {
      color: row.color,
      image: row.default_image
    };
  });

  // Initialize Force Simulation
  const simulation = d3.forceSimulation(graph.nodes)
    .force("link", d3.forceLink(graph.links).id(d => d.id).distance(100))
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2));

  // Render Links
  const link = container.append("g")
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.6)
    .selectAll("line")
    .data(graph.links)
    .join("line");

  // Render Node Groups
  const node = container.append("g")
    .selectAll("g")
    .data(graph.nodes)
    .join("g")
    .call(d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended));

  // Add Dynamic Circle Backgrounds
  node.append("circle")
    .attr("r", 18)
    .attr("fill", d => nodeMapping[d.class]?.color || "#ccc") // Dynamic Color from CSV
    .attr("stroke", "#fff")
    .attr("stroke-width", 2);

  // Add Dynamic Images (Icons)
  node.append("image")
    .attr("xlink:href", d => nodeMapping[d.class]?.image) // Dynamic Image from CSV
    .attr("x", -12)
    .attr("y", -12)
    .attr("width", 24)
    .attr("height", 24);

  // Tooltip
  node.append("title").text(d => `${d.id} (${d.class})`);

  // Simulation Ticks
  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    node.attr("transform", d => `translate(${d.x},${d.y})`);
  });

  // Drag Behaviors
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x; d.fy = d.y;
  }
  function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null; d.fy = null;
  }

}).catch(err => {
  console.error("Error loading graph data:", err);
});