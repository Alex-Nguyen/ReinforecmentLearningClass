const center_LAT = 33.5845,
    center_LON = -101.875;
var trackedAction =[];

const actions = {
    "up":[0,-1],
    "left": [-1,0],
    "down":[0,1],
    "right":[1,0]
};
const config = {
    zoom: 15,
    speed: 1,
    agent: {x: -206, y: 248.44, z: 0},
    plane: {width: 1024, height: 512},
    grid: {
        rows: 128,
        cols: 256,
        cellSize: 4,
        centerX: 512,
        centerY: 256
    }
};
const Maptexture = (lon, lat, zoom) => {
    return `https://api.mapbox.com/styles/v1/mapbox/light-v9/static/${lon},${lat},${zoom},0,0/1024x512?access_token=pk.eyJ1IjoidmluaG50IiwiYSI6ImNqb2VqdXZvaDE4cnkzcG80dXkxZzlhNWcifQ.G6sZ1ukp_DhiSmCvgKblVQ`;
};
const deg2rad = deg => {
    return deg * (Math.PI / 180);
};
const mercatorY = lat => {
    lat = deg2rad(lat);
    return (
        (256 / Math.PI) *
        Math.pow(2, config.zoom) *
        (Math.PI - Math.log(Math.tan(Math.PI / 4 + lat / 2)))
    );
};
const mercatorX = lon => {
    lon = deg2rad(lon);
    return (256 / Math.PI) * Math.pow(2, config.zoom) * (lon + Math.PI);
};
const boardGrid = (rows, cols) => {
    let boards = [];
    for (let y = 0; y < rows; y++) {
        boards[y] = [];
        for (let x = 0; x < cols; x++) {
            boards[y][x] = 0;
        }
    }
    return boards;
};
const lonToGridX = lon => {
    return mercatorX(lon) - cx + config.grid.centerX;
};
const latToGridY = lat => {
    return mercatorY(lat) - cy + config.grid.centerY;
};
const cx = mercatorX(center_LON);
const cy = mercatorY(center_LAT);
const updateGrid = (boards, highways) => {
    for (let highway of highways) {
        for (let n = 0; n < highway.nodes.length - 1; n++) {
            let x1 = mercatorX(highway.nodes[n].ref.lon) - cx + config.grid.centerX;
            let y1 = mercatorY(highway.nodes[n].ref.lat) - cy + config.grid.centerY;

            let x2 =
                mercatorX(highway.nodes[n + 1].ref.lon) - cx + config.grid.centerX;
            let y2 =
                mercatorY(highway.nodes[n + 1].ref.lat) - cy + config.grid.centerY;

            let distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
            let directionX = x2 - x1;
            let directionY = y2 - y1;

            let signX = Math.sign(directionX);
            let signY = Math.sign(directionY);
            let deltaX = directionX / distance;
            let deltaY = directionY / distance;
            for (
                let x = x1, y = y1;
                ;
                x = x + deltaX * config.speed, y = y + deltaY * config.speed
            ) {
                if (signX === Math.sign(x2 - x) && signY === Math.sign(y2 - y)) {
                    let rowY = Math.round(y / config.grid.cellSize);
                    let colX = Math.round(x / config.grid.cellSize);
                    if (
                        colX >= 0 &&
                        colX < config.grid.cols &&
                        rowY >= 0 &&
                        rowY < config.grid.rows
                    ) {
                        boards[rowY][colX] = 1;
                    }
                } else {
                    break;
                }
            }
        }
    }

    return boards;
};
var grid = boardGrid(config.grid.rows, config.grid.cols);
var valueFunction = boardGrid(config.grid.rows, config.grid.cols)
d3.xml("data/bigarea.xml", (error, data) => {
}).then(result => {

    let nodeRef = [].map.call(result.querySelectorAll("node"), n => ({
        id: n.getAttribute("id"),
        lat: n.getAttribute("lat"),
        lon: n.getAttribute("lon")
    }));
    ///Way lists
    let ways = [].map.call(result.querySelectorAll("way"), way => ({
        id: way.getAttribute("id"),
        nodes: [].map.call(way.querySelectorAll("nd"), ref => ({
            ref: nodeRef.find(obj => obj.id == ref.getAttribute("ref"))
        })),
        type: [].map.call(way.querySelectorAll("tag"), tag => tag.getAttribute("k"))
    }));

    let buildings = ways.filter(way => way.type.includes("building"));
    let highways = ways.filter(way => way.type.includes("highway"));


    grid = updateGrid(grid, highways);
    let bg = document.getElementById('background');
    bg.style.width = '1024px';
    bg.style.height = '512px';
    bg.style.backgroundImage = `url(${Maptexture(center_LON, center_LAT, config.zoom)})`;
    let svg = d3.select("#gridworld")
    for (let r = 0; r < 128; r++) {
        for (let c = 0; c < 256; c++) {
            svg.append('rect')
                .attr('x', c * 4)
                .attr('id',`pos-${r}-${c}`)
                .attr('y', r * 4)
                .attr('width', '3px')
                .attr("height", '3px')
                .style('fill', function () {
                    return grid[r][c] === 1 ? 'white' : 'rgba(0,0,0,0.1)'
                })
        }
    }
    let agent  ={x:59,y:139};
    let rescuer = {x:57, y:157};
    let startPos = d3.select(`#pos-${agent.x}-${agent.y}`);
    startPos.style('fill','blue');
    let endPos = d3.select(`#pos-${rescuer.x}-${rescuer.y}`);
    endPos.style('fill','red')
    ReinforcmentLearningAlgorithm(agent,rescuer);
    function ReinforcmentLearningAlgorithm(agent, rescuer) {

       let iterations = 10;
       function getAction(){
           const actionList = ['up','left','down','right']
           return actionList[Math.floor(Math.random()*actionList.length)]
       }

       let steps =1000;

       let simulator = setInterval(function () {
           let a = getAction();
           // console.log(`Action: ${a} - value: `, actions[a]);
           d3.select(`#pos-${agent.x}-${agent.y}`).style('fill','white')
           agent = getNextState(actions[a], agent);
           d3.select(`#pos-${agent.x}-${agent.y}`).style('fill','blue');
           if(agent.x ===rescuer.x&&agent.y===rescuer.y){
               valueFunction[agent.x][agent.y]=1;
               clearInterval(simulator);
               updateValueFuc()
           }
           trackedAction.push(agent)
           steps--;
           if(steps < 1){
               iterations--;
               trackedAction =[];
               agent  ={x:59,y:139}
               document.getElementById('epoch').innerText= iterations
               steps =1000;
               if(iterations===0){
                   clearInterval(simulator)

               }
           }
       },10)
        
    }
    function getNextState(action, currentState){
        let _nextX = currentState.x + action[0];
        let _nextY = currentState.y + action[1];
        if(grid[_nextX][_nextY]===0){
            _nextX = currentState.x;
            _nextY = currentState.y;
        }
        return {
            x: _nextX,
            y: _nextY,
            reward: _nextX===57&&_nextY===157?1:0
        };
    }
    function updateValueFuc() {
        const actionList = ['up','left','down','right']
        trackedAction.forEach(ag=>{
            let reward =0;
            actionList.forEach(a=>{
                let ns = getNextState(actions[a],ag);
                let r = ns.reward;
                reward += 0.25*(r + 0.9*valueFunction[ns.x][ns.y])
            });
            valueFunction[ag.x][ag.y]=reward;

        })
        console.log(valueFunction)
    }
});
