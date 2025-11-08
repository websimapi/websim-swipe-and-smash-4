import Matter from 'https://esm.sh/matter-js@0.19.0';

export default class Physics {
    constructor(boardElement) {
        this.boardElement = boardElement;
        const { clientWidth, clientHeight } = boardElement;
        this.width = clientWidth;
        this.height = clientHeight;

        this.engine = Matter.Engine.create();
        this.world = this.engine.world;
        this.runner = Matter.Runner.create();
        
        this.engine.world.gravity.y = 1;
        this.engine.world.gravity.x = 0;
        
        this.bodies = new Map(); // Map from body.id to candy element

        this.addWalls();
        Matter.Runner.run(this.runner, this.engine);
    }

    addWalls() {
        const wallOptions = { isStatic: true, restitution: 0.3, friction: 0.1 };
        const wallThickness = 20;

        Matter.World.add(this.world, [
            // Top wall
            Matter.Bodies.rectangle(this.width / 2, -wallThickness / 2, this.width, wallThickness, wallOptions),
            // Bottom wall
            Matter.Bodies.rectangle(this.width / 2, this.height + wallThickness / 2, this.width, wallThickness, wallOptions),
            // Left wall
            Matter.Bodies.rectangle(-wallThickness / 2, this.height / 2, wallThickness, this.height, wallOptions),
            // Right wall
            Matter.Bodies.rectangle(this.width + wallThickness / 2, this.height / 2, wallThickness, this.height, wallOptions)
        ]);
    }

    addCandy(candyElement, x, y, size) {
        const body = Matter.Bodies.circle(x, y, size / 2, {
            restitution: 0.3,
            friction: 0.01,
            // Custom property to link back to the DOM element
            domElement: candyElement,
        });
        
        candyElement.dataset.bodyId = body.id;
        this.bodies.set(body.id, candyElement);
        Matter.World.add(this.world, body);
        return body;
    }

    removeCandy(body) {
        if (!body) return;
        this.bodies.delete(body.id);
        Matter.World.remove(this.world, body);
    }

    setGravity(direction) {
        const g = 1.5;
        this.world.gravity.x = 0;
        this.world.gravity.y = 0;
        if (direction === 'down') this.world.gravity.y = g;
        else if (direction === 'up') this.world.gravity.y = -g;
        else if (direction === 'left') this.world.gravity.x = -g;
        else if (direction === 'right') this.world.gravity.x = g;
        else if (direction === 'face-up' || direction === 'face-down') {
            // Lower gravity when flat to keep things interesting
             this.world.gravity.y = 0.2;
        }
    }

    updateGravityFromSensors(beta, gamma) {
        const g = 1.5;
        // Normalize gamma and beta to [-1, 1] range for gravity vector
        this.world.gravity.x = g * (gamma / 90);
        this.world.gravity.y = g * (beta / 90);
    }
}