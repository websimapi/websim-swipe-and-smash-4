export default class Board {
    constructor(size, candyTypes, onMatchCallback, physics) {
        this.size = size;
        this.candyTypes = candyTypes;
        this.onMatch = onMatchCallback;
        this.physics = physics;
        this.grid = [];
        this.boardElement = document.getElementById('game-board');
        this.candySize = this.boardElement.clientWidth / size;
        this.gravityDirection = 'down'; // 'down', 'up', 'left', 'right'
        this.setupBoard();
    }

    setupBoard() {
        // No grid styles needed anymore, it's a physics container
        this.boardElement.style.gridTemplateColumns = '';
        this.boardElement.style.gridTemplateRows = '';
        
        // Use clientWidth which reflects the actual rendered size on screen
        const boardWidth = this.boardElement.clientWidth;
        this.candySize = boardWidth / this.size;
    }

    initialize() {
        for (let row = 0; row < this.size; row++) {
            this.grid[row] = [];
            for (let col = 0; col < this.size; col++) {
                this.grid[row][col] = this.createCandy(row, col, true);
            }
        }
        // Physics will handle settling, match checking will happen dynamically.
        // For simplicity, we'll skip the initial match check as physics will shuffle them anyway.
    }

    createCandy(row, col, isInitializing = false) {
        const type = this.candyTypes[Math.floor(Math.random() * this.candyTypes.length)];
        const candy = document.createElement('div');
        candy.classList.add('candy');
        candy.dataset.row = row;
        candy.dataset.col = col;
        candy.dataset.type = type;
        candy.style.backgroundImage = `url(${type})`;
        candy.style.width = `${this.candySize}px`;
        candy.style.height = `${this.candySize}px`;
        
        this.boardElement.appendChild(candy);
        
        const x = col * this.candySize + this.candySize / 2;
        const y = row * this.candySize + this.candySize / 2;

        const body = this.physics.addCandy(candy, x, y, this.candySize);

        // Store body reference with the candy element for easy access
        candy.physicsBody = body;

        return candy;
    }

    getInitialPosition(row, col) {
        const margin = this.candySize;
        switch (this.gravityDirection) {
            case 'up': return { x: col * this.candySize + this.candySize / 2, y: this.size * this.candySize + margin };
            case 'left': return { x: this.size * this.candySize + margin, y: row * this.candySize + this.candySize / 2 };
            case 'right': return { x: -margin, y: row * this.candySize + this.candySize / 2 };
            case 'down':
            default: return { x: col * this.candySize + this.candySize / 2, y: -margin };
        }
    }

    async swapCandies(candy1, candy2) {
        // With physics, we swap the underlying data and let the visuals catch up if needed
        // Or better, apply forces. For gameplay, direct position swap is better.
        const pos1 = candy1.physicsBody.position;
        const pos2 = candy2.physicsBody.position;

        Matter.Body.setPosition(candy1.physicsBody, pos2);
        Matter.Body.setPosition(candy2.physicsBody, pos1);
        Matter.Body.setVelocity(candy1.physicsBody, {x:0, y:0});
        Matter.Body.setVelocity(candy2.physicsBody, {x:0, y:0});


        // Because we don't have a fixed grid, we don't swap in `this.grid` anymore.
        // The check for matches will now happen based on proximity after the swap.

        return new Promise(resolve => setTimeout(resolve, 300));
    }

    isValid(row, col) {
        return row >= 0 && row < this.size && col >= 0 && col < this.size;
    }

    findAllMatches() {
        const matches = new Set();
        // Horizontal matches
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size - 2; c++) {
                if (this.grid[r][c] && this.grid[r][c+1] && this.grid[r][c+2] &&
                    this.grid[r][c].dataset.type === this.grid[r][c+1].dataset.type &&
                    this.grid[r][c+1].dataset.type === this.grid[r][c+2].dataset.type) {
                    matches.add(this.grid[r][c]);
                    matches.add(this.grid[r][c+1]);
                    matches.add(this.grid[r][c+2]);
                }
            }
        }
        // Vertical matches
        for (let c = 0; c < this.size; c++) {
            for (let r = 0; r < this.size - 2; r++) {
                if (this.grid[r][c] && this.grid[r+1][c] && this.grid[r+2][c] &&
                    this.grid[r][c].dataset.type === this.grid[r+1][c].dataset.type &&
                    this.grid[r+1][c].dataset.type === this.grid[r+2][c].dataset.type) {
                    matches.add(this.grid[r][c]);
                    matches.add(this.grid[r+1][c]);
                    matches.add(this.grid[r+2][c]);
                }
            }
        }
        return Array.from(matches);
    }
    
    findMatchGroups() {
        // This is now extremely complex with a physics engine.
        // For this iteration, we'll simplify and check for matches after a swap
        // by quantizing positions to a grid.
        const logicalGrid = Array(this.size).fill(null).map(() => Array(this.size).fill(null));
        const allCandies = Array.from(this.boardElement.children).filter(c => c.classList.contains('candy'));

        for (const candy of allCandies) {
            if (candy.physicsBody) {
                const { x, y } = candy.physicsBody.position;
                const r = Math.round((y - this.candySize / 2) / this.candySize);
                const c = Math.round((x - this.candySize / 2) / this.candySize);
                if (this.isValid(r, c) && !logicalGrid[r][c]) {
                    logicalGrid[r][c] = candy;
                }
            }
        }

        const groups = [];
        const visited = new Set();
        // Temporarily use the old grid logic on our quantized grid
        const originalGrid = this.grid;
        this.grid = logicalGrid;

        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                const candy = this.grid[r][c];
                if (!candy || visited.has(candy)) continue;

                // Horizontal check
                const horizontalMatch = [candy];
                for (let i = c + 1; i < this.size; i++) {
                    const nextCandy = this.grid[r][i];
                    if (nextCandy && nextCandy.dataset.type === candy.dataset.type) {
                        horizontalMatch.push(nextCandy);
                    } else {
                        break;
                    }
                }
                if (horizontalMatch.length >= 3) {
                    groups.push({ candies: horizontalMatch, type: 'horizontal' });
                    horizontalMatch.forEach(c => visited.add(c));
                }

                // Vertical check
                const verticalMatch = [candy];
                for (let i = r + 1; i < this.size; i++) {
                    const nextCandy = this.grid[i][c];
                    if (nextCandy && nextCandy.dataset.type === candy.dataset.type) {
                        verticalMatch.push(nextCandy);
                    } else {
                        break;
                    }
                }
                if (verticalMatch.length >= 3) {
                    groups.push({ candies: verticalMatch, type: 'vertical' });
                    verticalMatch.forEach(c => visited.add(c));
                }
            }
        }
        this.grid = originalGrid; // Restore original grid
        return groups;
    }

    async processMatches(isInitializing = false, swappedCandies = null) {
        if (isInitializing) { // Fallback for initialization
            const initialMatches = this.findAllMatches();
            if (initialMatches.length === 0) return;
            initialMatches.forEach(c => {
                 this.physics.removeCandy(c.physicsBody);
                 c.remove();
            });
            await this.fillBoard();
            return this.processMatches(true);
        }

        const matchGroups = this.findMatchGroups();
        if (matchGroups.length === 0) return false;

        const candiesToRemove = new Set();
        let createdPowerup = false;

        for (const group of matchGroups) {
            // Check for powerup activation
            for (const candy of group.candies) {
                if (candy.dataset.powerup) {
                    this.activatePowerup(candy, candiesToRemove);
                }
            }
        }

        // Sort groups by size to prioritize larger matches for power-ups
        matchGroups.sort((a, b) => b.candies.length - a.candies.length);

        for (const group of matchGroups) {
            const isSwappedCandyInMatch = swappedCandies && group.candies.some(c => swappedCandies.includes(c));
            const canCreatePowerup = isSwappedCandyInMatch || !swappedCandies;
            const candyToConvertToPowerup = swappedCandies ? (group.candies.find(c => swappedCandies.includes(c)) || group.candies[0]) : group.candies[0];

            // Power-up Creation
            if (group.candies.length >= 5 && !createdPowerup && canCreatePowerup) {
                createdPowerup = true;
                candyToConvertToPowerup.dataset.powerup = 'rainbow';
                candyToConvertToPowerup.style.backgroundImage = 'url(candy_chocolate.png)';
                candyToConvertToPowerup.classList.add('powerup-rainbow');
                // Don't change dataset.type, we need it if it's swapped with another powerup
                group.candies.forEach(c => { if (c !== candyToConvertToPowerup) candiesToRemove.add(c); });
                continue;
            }
            
            if (group.candies.length === 4 && !createdPowerup && canCreatePowerup) {
                createdPowerup = true;
                const powerupType = group.type === 'horizontal' ? 'col' : 'row';
                candyToConvertToPowerup.dataset.powerup = powerupType;
                candyToConvertToPowerup.classList.add(`powerup-${powerupType}`);
                group.candies.forEach(c => { if (c !== candyToConvertToPowerup) candiesToRemove.add(c); });
                continue;
            }
            
            group.candies.forEach(c => candiesToRemove.add(c));
        }

        if (candiesToRemove.size > 0) {
            if(!isInitializing) this.onMatch(Array.from(candiesToRemove), !!swappedCandies);
    
            for (const candy of candiesToRemove) {
                candy.classList.add('matched');
                this.physics.removeCandy(candy.physicsBody);
            }
    
            await new Promise(resolve => setTimeout(resolve, 300));
            
            candiesToRemove.forEach(candy => candy.remove());
            
            await this.fillBoard(); // Refill will now use physics
            
            // Give physics time to settle before re-checking
            await new Promise(resolve => setTimeout(resolve, 1000));
            await this.processMatches(isInitializing, null);
        }

        return true;
    }

    activatePowerup(candy, candiesToRemove) {
        const r = parseInt(candy.dataset.row);
        const c = parseInt(candy.dataset.col);
        candiesToRemove.add(candy);

        if (candy.dataset.powerup === 'row') {
            for (let i = 0; i < this.size; i++) {
                if (this.grid[r][i]) candiesToRemove.add(this.grid[r][i]);
            }
        } else if (candy.dataset.powerup === 'col') {
            for (let i = 0; i < this.size; i++) {
                if (this.grid[i][c]) candiesToRemove.add(this.grid[i][c]);
            }
        }
        delete candy.dataset.powerup;
        candy.classList.remove('powerup-row', 'powerup-col');
    }

    async smashCandies(candiesToSmash) {
        if (candiesToSmash.length === 0) return;
        
        // This is a smash, not a player-made match, so isPlayerMove is false.
        this.onMatch(candiesToSmash, false);

        for (const candy of candiesToSmash) {
            candy.classList.add('matched'); // Reuse matched animation
            this.physics.removeCandy(candy.physicsBody);
        }

        await new Promise(resolve => setTimeout(resolve, 300));
        
        candiesToSmash.forEach(candy => candy.remove());
        
        await this.fillBoard();
        
        await this.processMatches(false, null);
    }
    
    async activateRainbowPowerup(rainbowCandy, otherCandy) {
        const targetType = otherCandy.dataset.type;
        const candiesToRemove = new Set();
        candiesToRemove.add(rainbowCandy);

        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                const candy = this.grid[r][c];
                if (candy && candy.dataset.type === targetType) {
                    candiesToRemove.add(candy);
                }
            }
        }

        if (candiesToRemove.size > 0) {
            this.onMatch(Array.from(candiesToRemove), true);

            for (const candy of candiesToRemove) {
                candy.classList.add('matched');
                this.physics.removeCandy(candy.physicsBody);
            }

            await new Promise(resolve => setTimeout(resolve, 300));
            
            candiesToRemove.forEach(candy => candy.remove());
            
            await this.fillBoard();
            
            await this.processMatches(false, null);
        }
    }

    async dropCandies() {
        // This is now handled by the physics engine.
        // We might need to "nudge" bodies to ensure they fall.
        this.physics.engine.world.bodies.forEach(body => {
            if (!body.isStatic) {
                Matter.Body.setAwake(body, true);
            }
        });
        return Promise.resolve();
    }

    async fillBoard() {
        // This is complex. We need to find "empty" spaces and add candies above them.
        // A simple approach: count candies, and if less than total, add new ones at the top.
        const totalCandies = this.size * this.size;
        const currentCandies = this.boardElement.children.length;
        const needed = totalCandies - currentCandies;

        for (let i = 0; i < needed; i++) {
            // Add new candies off-screen according to gravity
            const col = Math.floor(Math.random() * this.size);
            const { x, y } = this.getInitialPosition(-1, col); // Use -1 row to signify "above"
            const type = this.candyTypes[Math.floor(Math.random() * this.candyTypes.length)];
            const candy = document.createElement('div');
            candy.classList.add('candy');
            candy.dataset.type = type;
            candy.style.backgroundImage = `url(${type})`;
            candy.style.width = `${this.candySize}px`;
            candy.style.height = `${this.candySize}px`;
            this.boardElement.appendChild(candy);
            const body = this.physics.addCandy(candy, x, y, this.candySize);
            candy.physicsBody = body;
        }

        return new Promise(resolve => setTimeout(resolve, 500)); // Wait for new candies to start falling
    }

    async setGravity(direction) {
        this.gravityDirection = direction;
        this.physics.setGravity(direction); // Also update physics engine
        await this.dropCandies(); // Just wakes bodies up
        await this.fillBoard();
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for settling
        await this.processMatches(false, null);
    }
}