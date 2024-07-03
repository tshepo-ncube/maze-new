const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const cors = require('cors');
app.use(cors());

let gridSize = 5;
let dx;
let dy;
let betta;
let gamma;
let x;
let y;
let EndX;
let EndY;
let vector2D;
let level = 1;
let lives = 5;
let traps = [];
let hearts;

// Beta-gamma accumulator
const globalDataAccumulator = [];
let MAX_DATA_POINTS = 1;

// Player count
let playerCount = 0;

startGame();
setInterval(update, 150);

app.use(express.static(path.join(__dirname, 'public')));
// app.get('/', (req, res) => {
//     res.sendFile(path.join(__dirname, 'public', 'game.html'));
// });

// Sockets
io.on('connection', (socket) => {
    playerCount += 1;
    MAX_DATA_POINTS = playerCount;

    data = {vector2D:vector2D, gridSize:gridSize, x:x, y:y, EndX:EndX, EndY:EndY, traps:traps};
    io.emit('getInitialData', data);

    io.emit('start');

    console.log('User connected');

    socket.on('beta_gamma', (data) => {
        globalDataAccumulator.push(data);
        if (globalDataAccumulator.length > MAX_DATA_POINTS) {
            globalDataAccumulator.shift(); // Remove oldest data
        }
    
        // console.log(`Beta, gamma: ${JSON.stringify(data)}`);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected.')
        playerCount -= 1;

        MAX_DATA_POINTS = playerCount * 3;
    })
    
});

// Run servers
const port = 8080;
server.listen(port, () => {
    console.log(`listening on : ${port}`);
});


function startGame() {

    console.log(`Starting new game: ${gridSize}`);

    // Tell game to start new game
    getInitialData();
    generateMaze();
    // Give vector and gridsize to draw maze        
    // give x,y to draw ball
    // give endx and endy to draw hole
    getTraps();
    // get trap vector to draw trap

    data = {vector2D:vector2D, gridSize:gridSize, x:x, y:y, EndX:EndX, EndY:EndY, traps:traps};
    io.emit('getInitialData', data);

    io.emit('start');
}

function getInitialData() {
    dx = 0;
    dy = 0;
    betta = 0;
    gamma = 0;
    x = 1;
    y = 1;
    EndX = gridSize - 2;
    EndY = gridSize - 2;
}

function generateMaze() {
    vector2D = [];
    for (let i = 0; i < gridSize; i++) {
        vector2D[i] = [];
        for (let j = 0; j < gridSize; j++) {
            if (i % 2 !== 0 && j % 2 !== 0) {
                vector2D[i][j] = 0;
            } else {
                vector2D[i][j] = 1;
            }
        }
    }

    const stack = [];
    const visited = [];

    for (let i = 0; i < gridSize; i++) {
        visited[i] = [];
        for (let j = 0; j < gridSize; j++) {
            visited[i][j] = false;
        }
    }

    const startX = 1;
    const startY = 1;
    const endX = gridSize - 2;
    const endY = gridSize - 2;

    stack.push([startX, startY]);
    visited[startX][startY] = true;
    endFound = false;

    while (stack.length > 0) {
        const current = stack.pop();
        const [x, y] = current;
        const directions = shuffleDirections();

        for (let direction of directions) {
            const newX = x + direction[0] * 2;
            const newY = y + direction[1] * 2;

            
            if (newX >= 1 && newX < gridSize - 1 && newY >= 1 && newY < gridSize - 1 && !visited[newX][newY]) {
                vector2D[(newX + x) / 2][(newY + y) / 2] = 0;
                visited[newX][newY] = true;
                stack.push([newX, newY]);
            }
        }

    }

    vector2D[startX][startY] = 0; 
    vector2D[endX][endY] = 0;
}

function shuffleDirections() {
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    for (let i = directions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [directions[i], directions[j]] = [directions[j], directions[i]];
    }

    return directions;
}

function getTraps(){
    for (let i = 1; i < vector2D.length - 1; i++) {
        for (let j = 1; j < vector2D[i].length - 1; j++) {
            var tel = 0;
            if (vector2D[i+1][j] === 1) tel++;
            if (vector2D[i-1][j] === 1) tel++;
            if (vector2D[i][j+1] === 1) tel++;
            if (vector2D[i][j-1] === 1) tel++;

            if (tel === 3 && !(EndX === j && EndY === i) && vector2D[i][j] === 0 && Math.random() < 0.25)
                traps.push([j,i]);
        }
    }
}

function update() {
    if (lives === 0){
        return;
    }  

    //ctx.clearRect(x * blockSize, y * blockSize, blockSize, blockSize);

    const averageData = globalDataAccumulator.reduce((acc, curr) => {
        acc.beta += curr.beta;
        acc.gamma += curr.gamma;
        return acc;
    }, { beta: 0, gamma: 0});
    averageData.beta /= globalDataAccumulator.length;
    averageData.gamma /= globalDataAccumulator.length;
    betta = averageData.beta;
    gamma = averageData.gamma;

    console.log(`Average values: ${betta}, ${gamma}`);

    dx += Math.sin((gamma || 0) / 180 * Math.PI); // Use 0 if gamma is undefined
    dy += Math.sin((betta || 0) / 180 * Math.PI);

    console.log(`dx, dy: ${dx}, ${dy}`);

    while (dx >= 0.1) {
        dx -= 0.1;
        if (vector2D[Math.round(y)][Math.round(Math.ceil(x + 0.1-0.00001))] === 0 && vector2D[Math.round(y)][Math.round(Math.floor(x + 0.1-0.00001))] === 0 && isWholeNumber(y))
            x+=0.1;
        else
            dx = 0;
        
    }
    while (dx <= -0.1) {
        dx += 0.1;
        if (vector2D[Math.round(y)][Math.round(Math.ceil(x - 0.1+0.00001))] === 0 && vector2D[Math.round(y)][Math.round(Math.floor(x - 0.1+0.00001))] === 0 && (isWholeNumber(y)))
            x-=0.1;
        else 
            dx = 0;     

    }
    while (dy >= 0.1) {
        dy -= 0.1;
        if (vector2D[Math.round(Math.ceil(y + 0.1-0.00001))][Math.round(x)] === 0  && vector2D[Math.round(Math.floor(y + 0.1-0.00001))][Math.round(x)] === 0 && isWholeNumber(x))
            y+=0.1;
        else
            dy = 0;
    }
    while (dy <= -0.1) {
        dy += 0.1;
        if (vector2D[Math.round(Math.ceil(y - 0.1 + 0.00001))][Math.round(x)] === 0  && vector2D[Math.round(Math.floor(y - 0.1 + 0.00001))][Math.round(x)] === 0 && isWholeNumber(x))
            y-=0.1;
        else
            dy = 0;
    }

    function isWholeNumber(num) {
        return Number(num.toFixed(9)) === Number(num.toFixed(0));
    }

    data = {x:x, y:y};
    io.emit('pos_update', data);

    if (Number(x.toFixed(9)) === EndX && Number(y.toFixed(9)) === EndY) {
        let temp = level + 1;
        //alert('Start level ' + temp);
        console.log(`Starting game again.`);

        // sleep(1000);
        level++;
        gridSize += 4;
        startGame();
    }

    for (let trap of traps) {
        const [trapX, trapY] = trap;
        if (trapX === Number(x.toFixed(9)) && trapY === Number(y.toFixed(9))) {
            //alert('Down to ' + lives + ' lives');
            // sleep(1000);
            //tell te remove heart
            lives--;
            startGame(gridSize);
            break; // Exit the loop once we find the trap
        }
    }
}
