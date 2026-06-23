document.addEventListener("DOMContentLoaded", function() {
    const graphUrl = window.entityGraphUrl;
    const csvUrl = "https://raw.githubusercontent.com/NicholasCorniaOrpheus/tresor-des-demoiselles/main/data/mappings/yaml_classes2lod.csv";

    if (!graphUrl) return;

    Promise.all([d3.csv(csvUrl), d3.json(graphUrl)]).then(([mappingData, graph]) => {
        const nodeMapping = {};
        const legendContainer = d3.select("#legend");

        mappingData.forEach(row => {
            nodeMapping[row.yaml_class] = { color: row.color, image: row.default_image };
            const item = legendContainer.append("div").attr("class", "legend-item");
            item.append("span").style("background-color", row.color).attr("class", "legend-circle");
            item.append("span").text(row.yaml_class);
        });

        const width = document.querySelector("#graph-container").clientWidth;
        const height = 600;
        const radius = 20; // Collision radius for boundaries

        // Ensure the extent is a valid 2D array [[x0, y0], [x1, y1]]
        const extent = [[0, 0], [width, height]]; 

        const zoom = d3.zoom()
            .scaleExtent([0.5, 4])
            // Restricted to container dimensions to prevent "lost" graphs
            .translateExtent(extent) 
            .on("zoom", (event) => {
                container.attr("transform", event.transform);
            });

        const svg = d3.select("#graph-container").append("svg")
            .attr("width", "100%").attr("height", height)
            .attr("viewBox", `0 0 ${width} ${height}`)
            .call(zoom)
            .on("dblclick.zoom", null); // Disable double-click zoom

        //const container = svg.append("g"); 


        // Arrowhead definition
        svg.append("defs").append("marker")
            .attr("id", "arrowhead").attr("viewBox", "0 -5 10 10").attr("refX", 28).attr("refY", 0)
            .attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto")
            .append("path").attr("d", "M0,-5L10,0L0,5").attr("fill", "#999");

        const container = svg.append("g");

        // Force Simulation: Increased repulsion (-1000) for more distance
        const simulation = d3.forceSimulation(graph.nodes)
            .force("link", d3.forceLink(graph.links).id(d => d.id).distance(150))
            .force("charge", d3.forceManyBody().strength(-1000))
            .force("center", d3.forceCenter(width / 2, height / 2));

        const link = container.append("g").attr("stroke", "#999").attr("stroke-opacity", 0.6)
            .selectAll("line").data(graph.links).join("line").attr("marker-end", "url(#arrowhead)");

        const linkLabels = container.append("g").selectAll("text")
            .data(graph.links).join("text")
            .text(d => d.property.replace("_"," ") || "").attr("font-size", "10px").attr("fill", "#666").style("display", "none");

        const node = container.append("g").selectAll("g")
            .data(graph.nodes).join("g").attr("class", "node-group")
            .on("click", (event, d) => openModal(d)) // Click trigger
            .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended));

        node.append("circle").attr("r", 18).attr("fill", d => nodeMapping[d.class]?.color || "#ccc")
            .attr("stroke", "#fff").attr("stroke-width", 2);

        node.append("image").attr("xlink:href", d => nodeMapping[d.class]?.image)
            .attr("x", -12).attr("y", -12).attr("width", 24).attr("height", 24);

        // Labels centered ABOVE nodes
        const labels = node.append("text").text(d => d.label || d.id)
            .attr("x", 0).attr("y", -25).attr("text-anchor", "middle").attr("class", "node-label")
            .style("font-family", "'Crimson Pro', serif");

        // 2. Attach Manual Zoom Button Actions
        d3.select("#zoom-in").on("click", () => {
            svg.transition().duration(300).call(zoom.scaleBy, 1.4);
        });

        d3.select("#zoom-out").on("click", () => {
            svg.transition().duration(300).call(zoom.scaleBy, 0.7);
        });


        d3.select("#zoom-reset").on("click", () => {
            svg.transition().duration(750).call(
                zoom.transform, 
                d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8)
            );
        });


        // Toggles
        d3.select("#toggleLabels").on("change", (e) => labels.style("display", e.target.checked ? "block" : "none"));
        d3.select("#toggleProperties").on("change", (e) => linkLabels.style("display", e.target.checked ? "block" : "none"));

        // 3. Search Logic
        d3.select("#search").on("keydown", (event) => {
            if (event.key === "Enter") {
                const term = event.target.value.toLowerCase();
                node.selectAll("circle").transition().duration(500)
                    .attr("r", d => (d.label?.toLowerCase().includes(term)) ? 30 : 18)
                    .attr("stroke", d => (d.label?.toLowerCase().includes(term)) ? "#ffeb3b" : "#fff")
                    .attr("stroke-width", d => (d.label?.toLowerCase().includes(term)) ? 6 : 2);
            }
        });

        // 4. Modal Logic
        function openModal(d) {
            d3.select("#modal-title").text(d.label || d.id);
            d3.select("#modal-desc").text(d.description || "No description available.");
            d3.select("#modal-media").html(`<img src="${nodeMapping[d.class]?.image}" style="max-width: 80px; margin-bottom: 10px;">`);
            
            // Absolute URL from d.id
            d3.select("#modal-link").attr("href", d.id);
            
            d3.select("#modal-backdrop").style("display", "flex").attr("aria-hidden", "false");
        }

        d3.select("#modal-close").on("click", () => {
            d3.select("#modal-backdrop").style("display", "none").attr("aria-hidden", "true");
        });

        simulation.on("tick", () => {
            link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
            linkLabels.attr("x", d => (d.source.x + d.target.x) / 2).attr("y", d => (d.source.y + d.target.y) / 2);
            node.attr("transform", d => `translate(${d.x},${d.y})`);
        });



        function dragstarted(event, d) { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }
        function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
        function dragended(event, d) { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }

    }).catch(err => console.error("D3 Error:", err));
});