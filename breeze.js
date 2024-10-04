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
    setupVisuals() {
        //initialize mesh material
        this.mat = new BABYLON.StandardMaterial("mat", scene);
        this.col = new BABYLON.Color3(1, 1, 1);
        this.mat.diffuseColor = this.col;
        this.mesh.material = this.mat;
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

        //create duct section shape
        this.shape = [];
        const numArcPts = 32;
        for (let i = 0; i < numArcPts; i++) {
            this.shape.push(new BABYLON.Vector3(rad*Math.cos(i*2*Math.PI/numArcPts), rad*Math.sin(i*2*Math.PI/numArcPts), 0));
        }

        //create duct mesh
        this.mesh = BABYLON.MeshBuilder.ExtrudeShape("rndDuct", {shape:this.shape, path:this.path, sideOrientation:BABYLON.Mesh.DOUBLESIDE}, scene);

        //setup
        this.setupVisuals();
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
        this.shape = [
            new BABYLON.Vector3(w/2, h/2, 0),
            new BABYLON.Vector3(-w/2, h/2, 0),
            new BABYLON.Vector3(-w/2, -h/2, 0),
            new BABYLON.Vector3(w/2, -h/2, 0)
        ];

        //create duct mesh
        this.mesh = BABYLON.MeshBuilder.ExtrudeShape("rectDuct", {shape:this.shape, path:this.path, sideOrientation:BABYLON.Mesh.DOUBLESIDE}, scene);

        //setup
        this.setupVisuals();
    }
}

//define cell class (fundamental area unit)
class Cell extends Element {
    constructor(scene, space, dx, dy, h, x, y) {
        super(scene);

        //initialize properties
        this.space = space; //space the cell is within
        this.dx = dx; //x length of cell (ft)
        this.dy = dy; //y length of cell (ft)
        this.h = h; //height of cell (ft)
        this.A = dx*dy; //area of cell (ft^2)
        this.V = this.A*h; //volume of cell (ft^3)
        this.x = x; //x coordinate (ft)
        this.y = y; // y coordinate (ft)

        //create cell area shape
        this.shape = [
            new BABYLON.Vector3(dx/2, dy/2, 0),
            new BABYLON.Vector3(-dx/2, dy/2, 0),
            new BABYLON.Vector3(-dx/2, -dy/2, 0),
            new BABYLON.Vector3(dx/2, -dy/2, 0)
        ];

        //create cell path (height)
        const path = [
            new BABYLON.Vector3(x, 0, y),
            new BABYLON.Vector3(x, h, y)
        ];

        //create cell mesh
        this.mesh = BABYLON.MeshBuilder.ExtrudeShape("cell", {shape:this.shape, path:path, sideOrientation:BABYLON.Mesh.DOUBLESIDE}, scene);

        //setup
        this.setupVisuals();
    }
}

//define space class (collection of adjacent cells)
class Space {
    constructor(cluster, cells, airChng) {
        //initialize properties
        this.cluster = cluster; //cluster the cell is within
        this.cells = cells; //array of cells in the cluster
        this.airChng = airChng; //req'd air changes (per hr) = ACH
        
        //calc req'd air flow
        this.V = cells.reduce((sum, cell) => sum+cell.V, 0); //space volume
        this.airFlow = this.V*airChng/60; //req'd air flow to space (ft^3/min) = CFM
    }
}

//define zone class (collection of adjacent, co-supplied spaces)
class Zone {
    constructor(spaces, tgtVel) {
        //initialize properties
        this.spaces = spaces; //array of spaces in the zone
        this.tgtVel = tgtVel; //target airflow velocity
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

    //render updates
    scene.registerBeforeRender(function() {

    });

	return scene;
}


