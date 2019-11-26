class Gridworld {
    constructor(data) {
        this.Rarr =null;
        this.T = null;
        this.data = data;
        this.reset()

    }
    reset(){
        this.gh = this.data.length;
        this.gw = this.data[0].length;
        this.gs = this.gh * this.gw; // number of states

        // specify some rewards
        var Rarr = R.zeros(this.gs);
        var T = R.zeros(this.gs);
        this.data.forEach((rows, rindex)=>{
            rows.forEach((col,cindex)=>{
                if(col===0){
                    T[cindex*this.gh + rindex] = 1;
                    Rarr[cindex*this.gh + rindex] = 0
                }
            })
        })
        this.Rarr = Rarr;
        this.T = T;
    }
    reward(s,a,ns) {
        return this.Rarr[s];
    }
    nextStateDistribution(s,a) {
        // given (s,a) return distribution over s' (in sparse form)
        if(this.T[s] === 1) {
            // cliff! oh no!
            // var ns = 0; // reset to state zero (start)
        } else if(s === 55) {
            // agent wins! teleport to start
            var ns = this.startState();
            while(this.T[ns] === 1) {
                var ns = this.randomState();
            }
        } else {
            // ordinary space
            var nx, ny;
            var x = this.stox(s);
            var y = this.stoy(s);
            if(a === 0) {nx=x-1; ny=y;}
            if(a === 1) {nx=x; ny=y-1;}
            if(a === 2) {nx=x; ny=y+1;}
            if(a === 3) {nx=x+1; ny=y;}
            var ns = nx*this.gh+ny;
            if(this.T[ns] === 1) {
                // actually never mind, this is a wall. reset the agent
                var ns = s;
            }
        }
        // gridworld is deterministic, so return only a single next state
        return ns;
    }
    sampleNextState(s,a) {
        var ns = this.nextStateDistribution(s,a);
        var r = this.Rarr[s]; // observe the raw reward of being in s, taking a, and ending up in ns
        r -= 0.01; // every step takes a bit of negative reward
        var out = {'ns':ns, 'r':r};
        if(s === 55 && ns === 0) {
            // episode is over
            out.reset_episode = true;
        }
        return out;
    }
    allowedActions(s) {
        var x = this.stox(s);
        var y = this.stoy(s);
        var as = [];
        if(x > 0) { as.push(0); }
        if(y > 0) { as.push(1); }
        if(y < this.gh-1) { as.push(2); }
        if(x < this.gw-1) { as.push(3); }
        return as;
    }
    randomState() { return Math.floor(Math.random()*this.gs); }
    startState() { return 0; }
    getNumStates() { return this.gs; }
    getMaxNumActions() { return 4; }
    // private functions
    stox(s) { return Math.floor(s/this.gh); }
    stoy(s) { return s % this.gh; }
    xytos(x,y) { return x*this.gh + y; }


}
class Rl5392 {
    constructor(){
        this.selected =-1;
        this.runValueIteration = this.runValueIteration.bind(this);
        this.evaluatePolicy = this.evaluatePolicy.bind(this);
        this.updatePolicy = this.updatePolicy.bind(this);
        this.resetAll = this.resetAll.bind(this);
    }
    init(){
        let _this = this;
        d3.xml("data/bigarea.xml", (error, data) => {
        }).then(result => {
            const center_LAT = 33.5845,
                center_LON = -101.875;
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
            let grid = boardGrid(config.grid.rows, config.grid.cols);
            let nodeRef = [].map.call(result.querySelectorAll("node"), n => ({
                id: n.getAttribute("id"),
                lat: n.getAttribute("lat"),
                lon: n.getAttribute("lon")
            }));
            ///Way lists
            let ways = [].map.call(result.querySelectorAll("way"), way => ({
                id: way.getAttribute("id"),
                nodes: [].map.call(way.querySelectorAll("nd"), ref => ({
                    ref: nodeRef.find(obj => obj.id === ref.getAttribute("ref"))
                })),
                type: [].map.call(way.querySelectorAll("tag"), tag => tag.getAttribute("k"))
            }));

            let buildings = ways.filter(way => way.type.includes("building"));
            let highways = ways.filter(way => way.type.includes("highway"));


            grid = updateGrid(grid, highways);
            let bg = document.getElementById('draw');
            bg.style.width = '1024px';
            bg.style.height = '512px';
            bg.style.backgroundImage = `url(${Maptexture(center_LON, center_LAT, config.zoom)})`;
            _this.env = new Gridworld(grid);
            _this.agent =new RL.DPAgent(this.env, {'gamma':0.9});
            _this.initGrid();
            _this.drawGrid();
            $("#rewardslider").slider({
                min: -5,
                max: 5.1,
                value: 0,
                step: 0.1,
                slide: function(event, ui) {
                    if(_this.selected >= 0) {
                        _this.env.Rarr[_this.selected] = ui.value;
                        $("#creward").html(ui.value.toFixed(2));
                        _this.drawGrid();
                    } else {
                        $("#creward").html('(select a cell)');
                    }
                }
            });
            $("#toggleValIter").on("click",_this.runValueIteration);
            $("#evaluatePolicy").on("click",_this.evaluatePolicy);
            $("#updatePolicy").on("click",_this.updatePolicy);
            $("#resetAll").on("click",_this.resetAll);
        });




    }
    drawGrid(){
        var gh= this.env.gh; // height in cells
        var gw = this.env.gw; // width in cells
        var gs = this.env.gs; // total number of cells

        // updates the grid with current state of world/agent
        for(var y=0;y<gh;y++) {
            for(var x=0;x<gw;x++) {
                var xcoord = x*this.cs;
                var ycoord = y*this.cs;
                var r=255,g=255,b=255;
                var s = this.env.xytos(x,y);

                var vv = this.agent.V[s];
                var ms = 100;
                if(vv > 0) { g = 255; r = 255 - vv*ms; b = 255 - vv*ms; }
                if(vv < 0) { g = 255 + vv*ms; r = 255; b = 255 + vv*ms; }
                var vcol = 'rgb('+Math.floor(r)+','+Math.floor(g)+','+Math.floor(b)+')';
                if(this.env.T[s] === 1) { vcol = "rgba(0,0,0,0.1)"; var rcol = "rgba(0,0,0,0.1)"; }

                // update colors of rectangles based on value
                var r = this.rs[s];
                if(s === this.selected) {
                    // highlight selected cell
                    r.attr('fill', '#FF0');
                } else {
                    r.attr('fill', vcol);
                }

                // write reward texts
                // var rv = this.env.Rarr[s];
                // var tr = this.trs[s];
                // if(rv !== 0) {
                //     tr.text('R ' + rv.toFixed(1))
                // }

                // skip rest for cliff
                if(this.env.T[s] === 1) continue;

                // // write value
                // var tv = this.tvs[s];
                // tv.text(this.agent.V[s].toFixed(2));


            }
        }
    }
    updatePolicy(){
        let _this = this;
        _this.agent.updatePolicy();
        _this.drawGrid();

    }
    evaluatePolicy(){
        let _this = this;
        _this.agent.evaluatePolicy();
        _this.drawGrid();
    }
    resetAll(){
        let _this = this;
        _this.env.reset();
        _this.agent.reset();
        _this.drawGrid();
    }
    runValueIteration(){

        let _this = this;
        _this.sid =-1;
        if(_this.sid === -1) {
            _this.sid = setInterval(function(){
                _this.agent.evaluatePolicy();
                _this.agent.updatePolicy();
                _this.drawGrid();
            }, 100);
        } else {
            clearInterval(_this.sid);
            _this.sid = -1;
        }
    }
    initGrid(){
        let _this = this;
        var d3elt = d3.select('#draw');
        d3elt.html('');
        this.rs = {},
        this.trs = {},
        this.tvs = {},
        this.pas = {};
        this.cs = 4;  // cell size
        var gh= this.env.gh; // height in cells
        var gw = this.env.gw; // width in cells
        var gs = this.env.gs; // total number of cells

        var w = 1024;
        var h = 512;
        let svg = d3elt.append('svg').attr("id",'svgdraw')
            .attr('width', w).attr('height', h)
            .append('g')
        for(var y=0;y<gh;y++) {
            for(var x=0;x<gw;x++) {
                var xcoord = x*this.cs;
                var ycoord = y*this.cs;
                var s = this.env.xytos(x,y);

                var g = svg.append('g');
                // click callbackfor group
                g.on('click', function(ss) {
                    return function() {
                        _this.cellClicked(ss);
                    } // close over s
                }(s));

                // set up cell rectangles
                var r = g.append('rect')
                    .attr('x', xcoord)
                    .attr('y', ycoord)
                    .attr('height', this.cs)
                    .attr('width', this.cs)
                    .attr('fill', '#FFF')
                    .attr('stroke', 'rgba(0,0,0,0.1)')
                    .attr('stroke-width', 0.01);
                this.rs[s] = r;

                // reward text
                var tr = g.append('text')
                    .attr('x', xcoord + 5)
                    .attr('y', ycoord + this.cs-5)
                    .attr('font-size', 10)
                    .text('');
                this.trs[s] = tr;

                // skip rest for cliffs
                if(this.env.T[s] === 1) { continue; }

                // value text
                var tv = g.append('text')
                    .attr('x', xcoord + this.cs/4)
                    .attr('y', ycoord + this.cs/2)
                    .text('');
                this.tvs[s] = tv;


            }
        }
    }
    cellClicked(s){
        let _this = this;
        if(s === _this.selected) {
            _this.selected = -1; // toggle off
        } else {
            this.selected = s;
            $("#rewardslider").slider('value', _this.env.Rarr[s]);
        }
        this.drawGrid(); // redraw
    }
}
let rl5392 = new Rl5392();
rl5392.init();