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
        this.rad = rad; //duct section radius
        this.A = Math.PI*Math.pow(rad, 2); //duct section area
        this.P = 2*Math.PI*rad; //duct section perimeter
        this.V = this.A*this.L; //duct volume
        this.SA = this.P*this.L; //duct surface area

        //create duct mesh
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
        this.w = w; //duct section width
        this.h = h; //duct section height
        this.A = w*h; //duct section area
        this.P = 2*(w+h); //duct section perimeter
        this.V = this.A*this.L; //duct volume
        this.SA = this.P*this.L; //duct surface area

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
}

//define cell class (fundamental area unit)
class Cell extends Element {
    constructor(scene, ID, dx, dy, elevB, elevT, x, y) {
        super(scene);

        //initialize properties
        this.space = null; //space the cell is within
        this.ID = ID; //cell ID # (as graph vertex)
        this.dx = dx; //x length of cell (ft)
        this.dy = dy; //y length of cell (ft)
        this.elevB = elevB; //elevation at cell bottom (ft)
        this.elevT = elevT; //elevation at cell top (ft)
        this.h = elevT-elevB; //height of cell (ft)
        this.A = dx*dy; //area of cell (ft^2)
        this.V = this.A*this.h; //volume of cell (ft^3)
        this.x = x; //x coordinate (ft)
        this.y = y; //y coordinate (ft)

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
        this.setupVisuals([1, 1, 1], 0.01);
        this.genLabel();
    }

    //generate text label per cell ID
    async genLabel() {
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
    constructor(scene, cells, airChng) {
        super(scene);

        //initialize properties
        this.zone = null; //zone the space is within
        this.cells = cells; //array of cells in the space
            //set cell spaces to this space
            for (let i = 0; i < cells.length; i++) {
                cells[i].space = this;
            }
        
        //calc req'd air flow
        this.airChng = airChng; //req'd air changes (per hr = ACH)
        this.V = cells.reduce((sum, cell) => sum+cell.V, 0); //space volume
        this.airFlow = this.V*airChng/60; //req'd air flow to space (ft^3/min = CFM)

        //create space mesh
        this.mesh = BABYLON.Mesh.MergeMeshes(cells.map((cell) => cell.mesh), false, true, undefined, false, false);

        //setup
        this.setupVisuals([1, 1, 1], 0.75);
    }
}

//define zone class (collection of adjacent, co-supplied spaces)
class Zone {
    constructor(spaces, tgtVel) {
        //initialize properties
        this.spaces = spaces; //array of spaces in the zone
            //set space zones to this zone
            for (let i = 0; i < spaces.length; i++) {
                spaces[i].zone = this;
            }
        this.tgtVel = tgtVel; //max target airflow velocity (ft/min = FPM)
    }
}

//create scene
const createScene = async function () {

    //setup scene
    var scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(1, 1, 1, 1);

    //console for debugging
    const DEBUG = false;
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
        let ID = 0;
        const d = 5;
        let spaces = [];

        let cells = [];
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                cells.push(new Cell(scene, ID, d, d, 0, 15, d*i, d*j));
                ID++;
            }
        }
        spaces.push(new Space(scene, cells, 6));

        cells = [];
        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 5; j++) {
                cells.push(new Cell(scene, ID, d, d, 0, 15, 15+d*i, d*j));
                ID++;
            }
        }
        spaces.push(new Space(scene, cells, 6));

        cells = [];
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 6; j++) {
                cells.push(new Cell(scene, ID, d, d, 0, 15, d*i, 15+d*j));
                ID++;
            }
        }
        spaces.push(new Space(scene, cells, 6));

        cells = [];
        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 5; j++) {
                cells.push(new Cell(scene, ID, d, d, 0, 15, 15+d*i, 25+d*j));
                ID++;
            }
        }
        spaces.push(new Space(scene, cells, 6));
    //*/

    //render updates
    scene.registerBeforeRender(function() {

    });

	return scene;
}

/* PRIM'S ALGORITHM pseudo code
class MinHeap {
    constructor() {
        this.heap = [];
    }

    // Insert a new node into the heap
    insert(node) {
        this.heap.push(node); // Add the new node to the end
        this.bubbleUp(this.heap.length - 1); // Restore heap property
    }

    // Extract the node with the minimum value (root of the heap)
    extractMin() {
        if (this.heap.length === 0) return null;
        if (this.heap.length === 1) return this.heap.pop();

        const min = this.heap[0]; // The root (smallest element)
        const end = this.heap.pop(); // Remove the last element
        this.heap[0] = end; // Replace the root with the last element
        this.sinkDown(0); // Restore heap property

        return min;
    }

    // Restore the heap property by bubbling up the newly added node
    bubbleUp(index) {
        let current = index;
        const element = this.heap[current];

        while (current > 0) {
            const parentIndex = Math.floor((current - 1) / 2); // Parent's index
            const parent = this.heap[parentIndex];

            if (element[1] >= parent[1]) break; // If the element is larger than or equal to the parent, stop

            this.heap[current] = parent; // Swap the element with its parent
            current = parentIndex;
        }
        this.heap[current] = element; // Place the element in the correct position
    }

    // Restore the heap property by sinking down the root node
    sinkDown(index) {
        let current = index;
        const length = this.heap.length;
        const element = this.heap[current];

        while (true) {
            const leftChildIndex = 2 * current + 1; // Left child index
            const rightChildIndex = 2 * current + 2; // Right child index
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

        this.heap[current] = element; // Place the element in the correct position
    }

    // Check if the heap is empty
    isEmpty() {
        return this.heap.length === 0;
    }
}

function primForSubset(graph, subset) {
    const numVertices = graph.length;
    const mst = [];
    const visited = new Array(numVertices).fill(false);
    const inSubset = new Array(numVertices).fill(false);
    const minHeap = new MinHeap();
    
    // Mark subset vertices
    for (const v of subset) {
        inSubset[v] = true;
    }

    let includedInSubset = 0;
    const subsetSize = subset.length;

    // Start from any vertex in the subset (e.g., subset[0])
    const startVertex = subset[0];
    minHeap.insert([startVertex, 0]); // (vertex, weight)

    while (!minHeap.isEmpty() && includedInSubset < subsetSize) {
        const [vertex, weight] = minHeap.extractMin();

        if (visited[vertex]) continue;
        visited[vertex] = true;

        if (inSubset[vertex]) {
            includedInSubset++;
        }
        
        mst.push([vertex, weight]);

        // Add all edges of the current vertex to the priority queue
        for (const [neighbor, edgeWeight] of graph[vertex]) {
            if (!visited[neighbor]) {
                minHeap.insert([neighbor, edgeWeight]);
            }
        }
    }

    // Return the MST that includes all vertices in the subset
    return mst;
}

// Example usage:
const graph = [
    [[1, 2], [3, 6]], // Vertex 0: connected to vertex 1 (weight 2) and vertex 3 (weight 6)
    [[0, 2], [2, 3], [3, 8], [4, 5]], // Vertex 1: connected to 0, 2, 3, 4
    [[1, 3], [4, 7]], // Vertex 2: connected to 1 and 4
    [[0, 6], [1, 8], [4, 9]], // Vertex 3: connected to 0, 1, and 4
    [[1, 5], [2, 7], [3, 9]]  // Vertex 4: connected to 1, 2, and 3
];

const subset = [1, 2, 4];  // We only care about vertices 1, 2, and 4

const mst = primForSubset(graph, subset);
console.log("Minimum Spanning Tree for Subset:", mst);
*/