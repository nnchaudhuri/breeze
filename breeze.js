//define element class (fundamental mesh-possessing class)
class Element {
    constructor(scene) {
        //initialize properties
        this.scene = scene; //scene hosting element
        this.mesh = null; //initialize null mesh
    }

    //show element
    show() {
        this.mesh.isVisible = true;
    }

    //hide element
    hide() {
        this.mesh.isVisible = false;
    }

    //toggle element visibility
    toggle() {
        this.mesh.isVisible = !this.mesh.isVisible;
    }

    //delete element
    delete() {
        this.mesh.dispose();
    }

    //set up visuals
    setupVisuals([r, g, b], alpha) {
        //initialize mesh material
        const mat = new BABYLON.StandardMaterial("mat", this.scene);
        mat.diffuseColor = new BABYLON.Color3(r, g, b);
        this.mesh.material = mat;
        this.mesh.material.alpha = alpha;
    }
}

//define duct class
class Duct extends Element {
    constructor(scene, cell0, cell1, elev0, elev1) {
        super(scene);

        //initialize properties
        this.cell0 = cell0; //cell at duct start
        this.cell1 = cell1; //cell at duct end
        this.L = Math.sqrt(Math.pow(cell0.x-cell1.x, 2)+Math.pow(cell0.y-cell1.y, 2)); //duct length
        this.elev0 = elev0; //elevation of duct at start
        this.elev1 = elev1; //elevation of duct at end

        //create duct path
        this.path = [
            new BABYLON.Vector3(cell0.x, elev0, cell0.y),
            new BABYLON.Vector3(cell1.x, elev1, cell1.y)
        ];
    }
}

//define round duct class
class RndDuct extends Duct {
    constructor(scene, cell0, cell1, elev0, elev1, rad) {
        super(scene, cell0, cell1, elev0, elev1);

        //initialize properties
        this.type = "rnd"; //duct type
        this.rad = rad; //duct section radius (ft)
        this.A = Math.PI*Math.pow(rad, 2); //duct section area (ft^2)
        this.P = 2*Math.PI*rad; //duct section perimeter (ft)
        this.V = this.A*this.L; //duct volume (ft^3)
        this.SA = this.P*this.L; //duct surface area (ft^2)

        //create duct mesh
        this.mesh = BABYLON.MeshBuilder.CreateTube("rndDuct", {path:this.path, radius:rad, sideOrientation:BABYLON.Mesh.DOUBLESIDE}, this.scene);

        //setup
        this.setupVisuals([1, 1, 1], 1);
    }

    //returns measure of duct cost
    cost() {
        return this.SA;
    }

    //change duct size
    changeSize(rad) {
        //update properties
        this.rad = rad;
        this.A = Math.PI*Math.pow(rad, 2);
        this.P = 2*Math.PI*rad;
        this.V = this.A*this.L;
        this.SA = this.P*this.L;

        //delete old mesh
        this.delete();

        //create new mesh
        this.mesh = BABYLON.MeshBuilder.CreateTube("rndDuct", {path:this.path, radius:rad, sideOrientation:BABYLON.Mesh.DOUBLESIDE}, this.scene);

        //setup
        this.setupVisuals([1, 1, 1], 1);
    }
}

//define rectangular duct class
class RectDuct extends Duct {
    constructor(scene, cell0, cell1, elev0, elev1, w, h) {
        super(scene, cell0, cell1, elev0, elev1);

        //initialize properties
        this.type = "rect"; //duct type
        this.w = w; //duct section width (ft)
        this.h = h; //duct section height (ft)
        this.A = w*h; //duct section area (ft^2)
        this.P = 2*(w+h); //duct section perimeter (ft)
        this.V = this.A*this.L; //duct volume (ft^3)
        this.SA = this.P*this.L; //duct surface area (ft^2)

        //create duct section shape
        const shape = [
            new BABYLON.Vector3(w/2, h/2, 0),
            new BABYLON.Vector3(-w/2, h/2, 0),
            new BABYLON.Vector3(-w/2, -h/2, 0),
            new BABYLON.Vector3(w/2, -h/2, 0)
        ];
        shape.push(shape[0]);

        //create duct mesh
        this.mesh = BABYLON.MeshBuilder.ExtrudeShape("rectDuct", {shape:shape, path:this.path, sideOrientation:BABYLON.Mesh.DOUBLESIDE}, this.scene);

        //setup
        this.setupVisuals([1, 1, 1], 1);
    }

    //returns measure of duct cost
    cost() {
        return this.SA;
    }

    //change duct size
    changeSize(w, h) {
        //update properties
        this.w = w;
        this.h = h;
        this.A = w*h;
        this.P = 2*(w+h);
        this.V = this.A*this.L;
        this.SA = this.P*this.L;

        //delete old mesh
        this.delete();

        //update section shape
        const shape = [
            new BABYLON.Vector3(w/2, h/2, 0),
            new BABYLON.Vector3(-w/2, h/2, 0),
            new BABYLON.Vector3(-w/2, -h/2, 0),
            new BABYLON.Vector3(w/2, -h/2, 0)
        ];
        shape.push(shape[0]);

        //create new mesh
        this.mesh = BABYLON.MeshBuilder.ExtrudeShape("rectDuct", {shape:shape, path:this.path, sideOrientation:BABYLON.Mesh.DOUBLESIDE}, this.scene);

        //setup
        this.setupVisuals([1, 1, 1], 1);
    }
}

//define cell class (fundamental area unit)
class Cell extends Element {
    constructor(scene, ID, dx, dy, elevB, elevT, x, y) {
        super(scene);

        //initialize properties
        this.space = null; //space the cell is within
        this.ID = ID; //cell ID # (graph vertex)
        this.dx = dx; //x length of cell (ft)
        this.dy = dy; //y length of cell (ft)
        this.elevB = elevB; //elevation at cell bottom (ft)
        this.elevT = elevT; //elevation at cell top (ft)
        this.h = elevT-elevB; //height of cell (ft)
        this.A = dx*dy; //area of cell (ft^2)
        this.V = this.A*this.h; //volume of cell (ft^3)
        this.x = x; //x coordinate (ft)
        this.y = y; //y coordinate (ft)
        this.ductCells = new Map(); //keys: other cells sharing ducts with this cell, values: shared ducts

        //create cell area shape
        const shape = [
            new BABYLON.Vector3(x+dx/2, 0, y+dy/2),
            new BABYLON.Vector3(x-dx/2, 0, y+dy/2),
            new BABYLON.Vector3(x-dx/2, 0, y-dy/2),
            new BABYLON.Vector3(x+dx/2, 0, y-dy/2)
        ];

        //create cell mesh
        this.mesh = BABYLON.MeshBuilder.ExtrudePolygon("cell", {shape:shape, depth:this.h, sideOrientation:BABYLON.Mesh.DOUBLESIDE}, this.scene);
        this.mesh.translate(new BABYLON.Vector3(0, elevT, 0), 1, BABYLON.Space.WORLD);

        //setup
        this.setupVisuals([1, 1, 1], 0.05);
        this.label();
    }

    //generate text label per cell ID
    async label() {
        const font = await (await fetch("https://assets.babylonjs.com/fonts/Kenney Future Regular.json")).json();
        const text = BABYLON.MeshBuilder.CreateText("ID", this.ID.toString(), font, {size:1, resolution:8, depth:0.1});

        text.translate(new BABYLON.Vector3(this.x, this.elevT, this.y), 1, BABYLON.Space.WORLD);
        text.rotate(new BABYLON.Vector3(1, 0, 0), Math.PI/2, BABYLON.Space.WORLD);
        text.translate(new BABYLON.Vector3(0, 0, -0.5), 1, BABYLON.Space.WORLD);

        const textMat = new BABYLON.StandardMaterial("textMat", this.scene);
        textMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
        text.material = textMat;
    }
}

//define space class (collection of adjacent cells)
class Space extends Element {
    constructor(scene, ID, cells, airChng) {
        super(scene);

        //initialize properties
        this.zone = null; //zone the space is within
        this.ID = ID; //space ID #
        this.cells = cells; //array of cells in the space
            //set cell spaces to this space
            for (let i = 0; i < cells.length; i++) {
                cells[i].space = this;
            }
        
        //calc req'd air flow
        this.airChng = airChng; //req'd air changes (per hr = ACH)
        this.V = cells.reduce((sum, cell) => sum+cell.V, 0); //space volume (ft^3)
        this.airFlow = this.V*airChng/60; //req'd air flow to space (ft^3/min = CFM)

        //create space mesh
        this.mesh = BABYLON.Mesh.MergeMeshes(cells.map((cell) => cell.mesh), false, true, undefined, false, false);

        //setup
        this.setupVisuals([1, 1, 1], 0.5);
    }
}

//define zone class (collection of adjacent, co-supplied spaces)
class Zone {
    constructor(scene, tgtVel) {
        //initialize properties
        this.scene = scene; //scene hosting zone
        this.spaces = []; //array of spaces in the zone (initialize empty, then load)
        this.cells = []; //array of cells in the zone (initialize empty, then load)
        this.grid = []; //2D array (grid) of cells in the zone (initialize empty, then load)
        this.graph = []; //graph of the zone cell grid, storing weights between vertices (initialize empty, then createGraph)
            /*
            example:
                    [
                        [[1, 2], [2, 3], [4, 5]], //cell 0: connected to cell 1 (weight 2), cell 2 (weight 3), cell 4 (weight 5)
                        [[0, 2], [3, 4]], //cell 1: connected to cell 0 (weight 2), cell 3 (weight 4)
                        [[0, 3], [4, 6]], //cell 2: connected to cell 0 (weight 3), cell 4 (weight 6)
                    ];
            */
        this.tgtVel = tgtVel; //max target airflow velocity (ft/min = FPM)
        this.ducts = []; //array of ducts in the zone (initialize empty, then createDucts)
        this.cost = 0; //measure of ducts cost (initialize 0, then createDucts)
    }

    //set zone spaces
    set(spaces) {
        this.spaces = spaces;
        for (let i = 0; i < spaces.length; i++) {
            spaces[i].zone = this;
        }
    }

    //translate text to zone spaces & grid
    /*
        format:
                '#' represents a cell in the grid, where the # value is the space (ID) the cell is in
                '-' represents a grid point without a cell
                rows parallel to x axis, columns parallel to y axis (z axis in babylon)
        example:
                - 0 0 0 - - - -
                - 0 0 0 - - - -
                - 0 0 0 1 1 1 1
                - 0 0 0 1 1 1 1
                2 2 2 2 1 1 1 1
                2 2 2 2 1 1 1 1
    */
    translate(rows, dx, dy, elevB, elevT, airChng) {
        //initialize
        this.cells = [];
        let spaceCells = new Map();
        let cellID = 0;
        let x = 0;
        let y = 0;

        //loop through rows
        for (let i = rows.length-1; i >= 0; i--) {
            const row = rows[i].split(' ');
            let gridRow = [];

            //create cell for each item in row
            for (let j = 0; j < row.length; j++) {
                const spaceID = parseFloat(row[j]);
                if (!isNaN(spaceID)) { //ignore points without cells
                    const cell = new Cell(this.scene, cellID, dx, dy, elevB, elevT, x, y);
                    this.cells.push(cell);
                    gridRow.push(cell);

                    if (!spaceCells.has(spaceID)) { //create new space ID if doesn't exist yet
                        spaceCells.set(spaceID, [cell]);
                    } else {
                        spaceCells.get(spaceID).push(cell);
                    }
                    cellID++;
                } else {
                    gridRow.push(null);
                }
                x += dx;
            }

            this.grid.push(gridRow);
            x = 0;
            y += dy;
        }

        //create spaces
        let spaces = [];
        for (const [spaceID, cells] of spaceCells) {
            spaces.push(new Space(this.scene, spaceID, cells, airChng.get(spaceID)));
        }
        this.set(spaces);
    }

    //load zone from file
    async load() {
        //process file from local browser
        const input = document.createElement('input');
        input.type = 'file';
        input.click();
    
        //wrap file selection and reading in a promise
        await new Promise((resolve, reject) => {
            input.onchange = () => {
                const files = input.files;
                if (files.length > 0) {
                    const reader = new FileReader();
                    reader.readAsText(files[0], "utf-8");
                    reader.onload = () => {
                        const lines = reader.result.split('\n');

                        //get standard cell properties
                        const dx = parseFloat(lines[0].split('=')[1]);
                        const dy = parseFloat(lines[1].split('=')[1]);
                        const elevB = parseFloat(lines[2].split('=')[1]);
                        const elevT = parseFloat(lines[3].split('=')[1]);

                        //get air change values
                        let airChng = new Map();
                        const pairStr = lines[4].split('=')[1].split(',');

                        for (let i = 0; i < pairStr.length; i++) {
                            const pair = pairStr[i].split(':');
                            airChng.set(parseFloat(pair[0]), parseFloat(pair[1]));
                        }
                        
                        //translate file text grid to zone spaces
                        this.translate(lines.slice(5), dx, dy, elevB, elevT, airChng);

                        resolve(); //resolve promise
                    };
                    reader.onerror = () => {
                        reject(reader.error);  //reject the promise in case of errors
                    };
                } else {
                    reject(new Error("no file selected"));
                }
            };
        });
    }

    //color zone spaces
    color() {
        //convert HSL to RGB
        function hslToRgb(h, s, l) {
            s /= 100;
            l /= 100;

            const c = (1-Math.abs(2*l-1))*s;
            const x = c*(1-Math.abs(((h/60)%2)-1));
            const m = l-c/2;

            let r, g, b;

            if (h < 60) {
                r = c; g = x; b = 0;
            } else if (h < 120) {
                r = x; g = c; b = 0;
            } else if (h < 180) {
                r = 0; g = c; b = x;
            } else if (h < 240) {
                r = 0; g = x; b = c;
            } else if (h < 300) {
                r = x; g = 0; b = c;
            } else {
                r = c; g = 0; b = x;
            }

            return [
                Math.round((r+m)*255),
                Math.round((g+m)*255),
                Math.round((b+m)*255)
            ];
        }

        //generate evenly spaced colors
        const n = this.spaces.length;
        const step = 360/n;
        
        for (let i = 0; i < n; i++) {
            const hue = i*step;
            const rgb = hslToRgb(hue, 100, 50);
            this.spaces[i].mesh.material.diffuseColor = new BABYLON.Color3(rgb[0], rgb[1], rgb[2]);
        }
    }

    //graph edge weight (cost) between two cells (vertices)
    weight(cell0, cell1) {
        return 1; //TEMPORARY
    }

    //create graph from zone cell grid
    createGraph() {
        //initialize empty graph
        this.graph = Array.from(Array(this.cells.length), () => []);

        //loop through grid, adding neighbors & weights to the graph at the vertex (cell) index (ID)
        const numRows = this.grid.length;
        for (let i = 0; i < numRows; i++) {
            const row = this.grid[i];
            const numCols = row.length;

            for (let j = 0; j < numCols; j++) {
                const cell = this.grid[i][j];
                if (cell != null) {
                    //top neighbor
                    if (i < numRows-1) {
                        const top = this.grid[i+1][j];
                        if (top != null) {this.graph[cell.ID].push([top.ID, this.weight(cell, top)])};
                    }

                    //bottom neighbor
                    if (i > 0) {
                        const bot = this.grid[i-1][j];
                        if (bot != null) {this.graph[cell.ID].push([bot.ID, this.weight(cell, bot)])};
                    }

                    //right neighbor
                    if (j < numCols-1) {
                        const right = this.grid[i][j+1];
                        if (right != null) {this.graph[cell.ID].push([right.ID, this.weight(cell, right)])};
                    }

                    //left neighbor
                    if (j > 0) {
                        const left = this.grid[i][j-1];
                        if (left != null) {this.graph[cell.ID].push([left.ID, this.weight(cell, left)])};
                    }
                }
            }
        }
    }

    //create ducts from paths
    createDucts(paths, elev) {
        //determine # of terminals per space
        const spaceTerminals = new Map();
        for (let path of paths) {
            const terminal = this.cells[path[path.length-1]];
            const spaceID = terminal.space.ID;
            if (spaceTerminals.has(spaceID)) {
                const numTerminals = spaceTerminals.get(spaceID);
                spaceTerminals.set(spaceID, numTerminals+1);
            } else {
                spaceTerminals.set(spaceID, 1);
            }
        }

        //create ducts, sized per airflow requirements
        this.ducts = [];
        this.cost = 0;
        for (let path of paths) {
            //get terminal space
            const terminal = this.cells[path[path.length-1]];
            const spaceID = terminal.space.ID;

            //calculate duct radius
            const rad = Math.sqrt(terminal.space.airFlow/spaceTerminals.get(spaceID)/this.tgtVel/Math.PI);

            for (let i = path.length-1; i > 0; i--) { //go from terminal to start
                //get cells on path
                const cell0 = this.cells[path[i]];
                const cell1 = this.cells[path[i-1]];

                if (cell0.ductCells.has(cell1) || cell1.ductCells.has(cell0)) { //duct already between cells
                    //get existing duct
                    const exDuct = cell0.ductCells.get(cell1) || cell1.ductCells.get(cell0);
                    this.cost -= exDuct.cost();

                    //increase existing duct size
                    const newRad = Math.sqrt(Math.pow(exDuct.rad, 2) + Math.pow(rad, 2));
                    exDuct.changeSize(newRad);
                    this.cost += exDuct.cost();

                } else { //create new duct
                    const duct = new RndDuct(this.scene, cell0, cell1, elev, elev, rad);
                    this.ducts.push(duct);
                    this.cost += duct.cost();

                    cell0.ductCells.set(cell1, duct);
                    cell1.ductCells.set(cell0, duct);
                }   
            }
        }
    }

    //clear zone ducts
    clearDucts() {
        //reset cell duct maps
        for (let cell of this.cells) {
            cell.ductCells = new Map();
        }

        //delete duct meshes
        for (let duct of this.ducts) {
            duct.delete();
        }

        //reset duct & cost properties
        this.ducts = [];
        this.cost = 0;
    }
}

//define minheap class (priority queue returning lowest value node)
class MinHeap {
    constructor() {
        this.heap = [];
    }

    //add node to the heap
    insert(node) {
        this.heap.push(node);
        this.bubbleUp(this.heap.length-1);
    }

    //retrieve lowest value node from the heap
    extractMin() {
        if (this.heap.length === 0) return null;
        if (this.heap.length === 1) return this.heap.pop();

        const min = this.heap[0];
        const end = this.heap.pop();
        this.heap[0] = end;
        this.sinkDown(0);

        return min;
    }

    //move node up in heap
    bubbleUp(index) {
        let current = index;
        const element = this.heap[current];

        while (current > 0) {
            const parentIndex = Math.floor((current-1)/2);
            const parent = this.heap[parentIndex];

            if (element[1] >= parent[1]) break;

            this.heap[current] = parent;
            current = parentIndex;
        }

        this.heap[current] = element;
    }

    //move node down in heap
    sinkDown(index) {
        let current = index;
        const length = this.heap.length;
        const element = this.heap[current];

        while (true) {
            const leftChildIndex = 2*current+1;
            const rightChildIndex = 2*current+2;
            let swap = null;

            if (leftChildIndex < length) {
                const leftChild = this.heap[leftChildIndex];
                if (leftChild[1] < element[1]) {
                    swap = leftChildIndex;
                }
            }

            if (rightChildIndex < length) {
                const rightChild = this.heap[rightChildIndex];
                if ((swap === null && rightChild[1] < element[1]) || (swap !== null && rightChild[1] < this.heap[swap][1])) {
                    swap = rightChildIndex;
                }
            }

            if (swap === null) break;

            this.heap[current] = this.heap[swap];
            current = swap;
        }

        this.heap[current] = element;
    }

    //returns if heap is empty
    isEmpty() {
        return this.heap.length === 0;
    }
}

//Prim's algorithm to find the minimum spanning tree (mst) from start to terminal vertices
function prim(graph, start, terminals) {
    //initialize
    const numVert = graph.length;
    const mst = [];
    const visited = new Array(numVert).fill(false);
    const minHeap = new MinHeap();

    const terminalSet = new Set(terminals);
    let terminalCount = 0;
    const terminalSize = terminals.length;

    //grow tree from start until all terminals connected
    minHeap.insert([start, 0]);
    while (!minHeap.isEmpty() && terminalCount < terminalSize) {
        const [vertex, weight] = minHeap.extractMin();

        if (visited[vertex]) continue;
        visited[vertex] = true;

        if (terminalSet.has(vertex)) terminalCount++;

        mst.push([vertex, weight]);

        //add neighbors to heap
        for (const [neighbor, weight] of graph[vertex]) {
            if (!visited[neighbor]) {
                minHeap.insert([neighbor, weight]);
            }
        }
    }

    return mst;
}

//define class for Prim-A* integrated algorithm to find the most efficient paths from start to terminal vertices
class PrimAStar {
    constructor(zone, start, terminals, nearWeight, avgWeight) {
        this.zone = zone; //zone the algorithm is run on
        this.graph = zone.graph; //graph represented as an array of adjacency lists
        this.start = start; //start node
        this.terminals = new Set(terminals); //target nodes
        this.processedTerminals = new Set(); //track which terminals have been processed
        this.nearWeight = nearWeight; //weight factor for nearest terminal in heuristic
        this.avgWeight = avgWeight; //weight factor for average terminal in heuristic
        this.openSet = new Set(); //nodes to evaluate
        this.cameFrom = new Map(); //to track the MST/path
        this.gScore = new Map(); //cost from start to node
        this.fScore = new Map(); //estimated total cost incl. heuristic
        this.paths = []; //efficient paths for each terminal

        //initialize with start node
        this.gScore.set(this.start, 0);
        this.fScore.set(this.start, this.heuristic(this.start));
        this.openSet.add(this.start);
    }

    //manhattan distance
    manhattanDist(x1, y1, x2, y2) {
        return (Math.abs(x1-x2) + Math.abs(y1-y2));
    }

    //distance to average terminal (remaining)
    distAvgTerminal(node) {
        const cell = this.zone.cells[node];

        let sumDist = 0;
        let numTerminals = 0;
        for (let terminal of this.terminals) {
            if (!this.processedTerminals.has(terminal)) {
                const terminalCell = this.zone.cells[terminal];
                sumDist += this.manhattanDist(cell.x, cell.y, terminalCell.x, terminalCell.y);
                numTerminals++;
            }
        }

        if (numTerminals == 0) {
            return 0;
        } else {
            return (sumDist/numTerminals);
        }
    }

    //distance to nearest terminal (remaining)
    distNearTerminal(node) {
        const cell = this.zone.cells[node];

        let minDist = Infinity;
        for (let terminal of this.terminals) {
            if (!this.processedTerminals.has(terminal)) {
                const terminalCell = this.zone.cells[terminal];
                const dist = this.manhattanDist(cell.x, cell.y, terminalCell.x, terminalCell.y);
                if (dist < minDist) minDist = dist;
            }
        }

        if (minDist == Infinity) {
            return 0;
        } else {
            return minDist;
        }
    }

    //heuristic to improve path efficiency
    heuristic(node) {
        return (this.nearWeight*this.distNearTerminal(node) + this.avgWeight*this.distAvgTerminal(node));
    }

    //reconstruct the path from the start node to a given terminal
    reconstructPath(terminal) {
        let path = [];
        let current = terminal;

        //backtrack from the terminal to the start node using the cameFrom map
        while (current !== undefined) {
            path.push(current);
            current = this.cameFrom.get(current);
        }

        //reverse the path to get the correct order from start to terminal
        path.reverse();

        return path;
    }

    //run Prim-A* search
    run() {
        while (this.openSet.size > 0) {
            //get node in openSet with lowest fScore (A*-like behavior)
            let current = null;
            let lowestF = Infinity;
            
            for (let node of this.openSet) {
                const f = this.fScore.get(node);
                if (f < lowestF) {
                    lowestF = f;
                    current = node;
                }
            }
            
            //if terminal node reached, store the path and mark it as processed
            if (this.terminals.has(current) && !this.processedTerminals.has(current)) {
                const path = this.reconstructPath(current);
                this.paths.push(path);
                this.processedTerminals.add(current);

                //if all terminals processed, return the paths
                if (this.processedTerminals.size === this.terminals.size) {
                    return this.paths;
                }
            }
            
            //remove current node from openSet
            this.openSet.delete(current);

            //process neighbors of the current node
            for (let [neighbor, weight] of this.graph[current]) {
                let currentGScore = Infinity;
                if (this.gScore.has(current)) currentGScore = this.gScore.get(current);
                const tentativeGScore = currentGScore + weight;
                
                //only proceed if found better path
                let neighborGScore = Infinity;
                if (this.gScore.has(neighbor)) neighborGScore = this.gScore.get(neighbor);
                if (tentativeGScore < neighborGScore) {
                    this.cameFrom.set(neighbor, current); //track the most efficient path
                    this.gScore.set(neighbor, tentativeGScore);
                    this.fScore.set(neighbor, tentativeGScore + this.heuristic(neighbor));

                    //add to openSet if not included
                    if (!this.openSet.has(neighbor)) {
                        this.openSet.add(neighbor);
                    }
                }
            } 
        }

        //if not all terminals found
        return null;
    }
}

//helper function to delay time
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

//find best solution by batch-running Prim-A* with different near & average terminal weightings
async function batchPrimAStar(zone, start, terminals, minNear, incrNear, maxNear, minAvg, incrAvg, maxAvg, elev, animate) {
    let bestPaths = [];
    let minCost = Infinity;
    
    for (let nearWeight = minNear; nearWeight <= maxNear; nearWeight += incrNear) {
        for (let avgWeight = minAvg; avgWeight <= maxAvg; avgWeight += incrAvg) {
            const primAStar = new PrimAStar(zone, start, terminals, nearWeight, avgWeight);
            const paths = primAStar.run();
            zone.createDucts(paths, elev);

            if (zone.cost < minCost) {
                minCost = zone.cost;
                bestPaths = paths;
            }

            if (animate) await delay(10);
            zone.clearDucts();
        }
    }

    return [bestPaths, minCost];
}

//create scene
const createScene = async function () {

    //setup scene
    var scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(1, 1, 1, 1);

    //console for debugging
    const DEBUG = true;
    if (DEBUG) {
        await new Promise(resolve => {
            var s = document.createElement("script");
            s.src = "https://console3.babylonjs.xyz/console3-playground.js";
            document.head.appendChild(s);
            s.onload = resolve();
        })
        var c3 = window.console3;
        c3.create(engine, scene);
        c3.log("scene created");
    }

    //setup camera
	const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI/4, Math.PI/4, 100, BABYLON.Vector3.Zero());
	camera.attachControl(canvas, true);
    camera.inputs.attached.keyboard.angularSpeed = 0.005;
    camera.minZ = 0.01;
    camera.maxZ = 1000;
    camera.wheelDeltaPercentage = 0.01;
    camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    camera.orthoLeft = -36;
    camera.orthoRight = 36;
    const ratio = canvas.height/canvas.width;
    const setOrthoCameraTopBottom = (camera, ratio) => {
        camera.orthoTop = camera.orthoRight*ratio;
        camera.orthoBottom = camera.orthoLeft*ratio;
    }
    setOrthoCameraTopBottom(camera, ratio);
    let oldRadius = camera.radius;
    scene.onBeforeRenderObservable.add(() => {
        if (oldRadius !== camera.radius) {
            const radiusChangeRatio = camera.radius/oldRadius;
            camera.orthoLeft *= radiusChangeRatio;
            camera.orthoRight *= radiusChangeRatio;
            oldRadius = camera.radius;
            setOrthoCameraTopBottom(camera, ratio);
        }
    })

    //setup light
	const light = new BABYLON.HemisphericLight("hemiLight", new BABYLON.Vector3(0, 50, 0));
    scene.registerBeforeRender(function () {
        light.direction = camera.position;
    })

    //test code
    ///*
    const zone = new Zone(scene, 800);
    const start = 0;
    const terminals = [22, 17, 54, 65];
    const elev = 18;

    const minNear = -1;
    const incrNear = 0.05;
    const maxNear = 1;

    const minAvg = 1;
    const incrAvg = 0.05;
    const maxAvg = 1;

    zone.load().then(async () => {
        zone.color();
        zone.createGraph();

        const [bestPaths, minCost] = await batchPrimAStar(zone, start, terminals, minNear, incrNear, maxNear, minAvg, incrAvg, maxAvg, elev, true);

        zone.createDucts(bestPaths, elev);
        c3.log("cost: " + Math.round(minCost));
    });

    
    //*/

    //render updates
    scene.registerBeforeRender(function() {

    });

	return scene;
}

