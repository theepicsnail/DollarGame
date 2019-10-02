
function compute_normalized_dot(a, b, c) {
    /**
     * Given 3 points (objects with .x and .y), normalize ab and ac, and then compute their dot product.
     */
    let dx1 = a.x-b.x;
    let dy1 = a.y-b.y;
    let dx2 = c.x-b.x;
    let dy2 = c.y-b.y;
    
    let dot = dx1*dx2 + dy1*dy2;
    dot /= Math.hypot(dx1, dy1) * Math.hypot(dx2, dy2);
    console.log(a.x, a.y, b.x, b.y, c.x, c.y, dot);
    return dot;
}

class Lines extends HTMLElement {
    constructor() {
        super();
        this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    }
    connectedCallback() {
        this.appendChild(this.svg);
    }
    addEdge(p1, p2) {
        var line = document.createElementNS(this.svg.namespaceURI, 'line');
        line.setAttribute('x1', `${p1.x}%`);
        line.setAttribute('y1', `${p1.y}%`);
        line.setAttribute('x2', `${p2.x}%`);
        line.setAttribute('y2', `${p2.y}%`);
        this.svg.appendChild(line);
        return line;
    }
    clear() {
        while(this.svg.lastChild) {
            this.svg.removeChild(this.svg.lastChild);
        }
    }
}
customElements.define('game-lines', Lines);

let PersonID = 0;
class Person extends HTMLElement {
    constructor() {
        super();
        this.x = 0;
        this.y = 0;
        this.money = 0;
        this.neighbors = []; // Neighboring Persons
        this.edges = [];    // Neighboring Lines
        this.text = document.createElement("span");
    }
    connectedCallback() {
        this.id = PersonID++;
        this.appendChild(this.text);
        this.onmouseenter = ()=>{
            this.edges.forEach(e=>e.classList.add("highlight"));
        }
        this.onmouseleave = () =>{
            this.edges.forEach(e=>e.classList.remove("highlight"));
        }
        this.onclick = () => {
            this.distributeMoney();
        }
        this.addMoney(0);
        //this.onmousemove = console.log.bind(console);
        //this.text.innerText = `$${this.id}`;
    }
    distanceFrom(point) {
        return Math.hypot(this.x-point.x, this.y - point.y);
    }
    setPosition(x, y) {
        this.x = x;
        this.y = y;
        this.style.left=`${x}vmin`;
        this.style.top=`${y}vmin`;
    }
    addMoney(amount) {
        this.money+= amount;
        if(this.money < 0){
            this.classList.remove("happy")
            this.classList.add("sad")
        } else {
            this.classList.add("happy")
            this.classList.remove("sad")
        }
        this.text.innerText = `$${this.money}`;
    }

    distributeMoney() {
        for(var i = 0 ; i < this.neighbors.length ; i++) {
            this.neighbors[i].addMoney(1);
        }
        this.addMoney(-this.neighbors.length);
    }

    addNeighbor(other, edge) {
        this.neighbors.push(other);
        this.edges.push(edge);
    }
    numNeighbors() {
        return this.neighbors.length;
    }
    hasNeighbor(other) {
        for(var i = 0 ; i < this.neighbors.length ; i++) {
            if(this.neighbors[i] === other){
                return true;
            } 
        }
    }
}
customElements.define('game-person', Person);


class GameController extends HTMLElement {
    constructor() {
        super();
        this.MAX_EDGE_DOT_PRODUCT = .95;
        this.MAX_NEIGHBORS = 5;
        this.MIN_DIST = 10;
        this.number = 0;
    }

    connectedCallback() {
        
        this.input = document.getElementById("number");
        this.input.onchange=(e)=>this.setNumber(parseInt(this.input.value));

        this.neighbors = document.getElementById("neighbors");
        this.neighbors.onchange=(e)=>this.setNeighbors(parseInt(this.neighbors.value));

        this.button = document.getElementById("generate");
        this.button.onclick = this.generate;

        /** @type {HTMLDivElement} */
        this.people = document.getElementById("people");
        /** @type {Lines} */
        this.lines = document.getElementById("lines");
    }

    _clearPeople() {
        PersonID = 0;
        while(this.people.lastChild) {
            this.people.removeChild(this.people.lastChild);
        }
    }


    _guessPosition(out_pos) {
        out_pos.x = Math.random()*80+10;
        out_pos.y = Math.random()*80+10;
        /** @type {Person} */
        let cur = this.people.firstChild;

        while(cur) {
            if(cur.distanceFrom(out_pos) < this.MIN_DIST)
                return false;
            cur = cur.nextSibling;
        }
        return true;
    }

    _placePerson() {
        let pos = {};
        var attempts = 0;
        for(; attempts < 10 ; attempts ++) {
            if(this._guessPosition(pos))
                break
        }
        if(attempts==10)
            return;
        
        let p = document.createElement('game-person');
        p.setPosition(pos.x,pos.y);
        this.people.appendChild(p);
    }

    _generateSortedPeoplePairs() {
        let pairs = [];
        let children = this.people.children;
        for(var i = 0 ; i < children.length ; i++) 
            for(var j = i+1; j < children.length ; j++) {
                pairs.push({
                    p1: children[i],
                    p2: children[j],
                    dist: children[i].distanceFrom(children[j])
                });
            }
        pairs.sort((a,b)=>a.dist - b.dist);
        return pairs;
    }

    _add_edge(a,b) {
        let edge = this.lines.addEdge(a, b);
        a.addNeighbor(b, edge);
        b.addNeighbor(a, edge);
    }

    _generate_mst_edges(pairs) {
        // Use union find to build a minimum spanning tree out of the shorted possible edges.
        let roots = {};
        function getRoot(id) {
            if(roots[id]==undefined) return id;
            return getRoot(roots[id])
        }
        function connected(a, b){
            return getRoot(a) == getRoot(b);
        }
        function connect(a, b) {
            roots[getRoot(a)] = getRoot(b);
        }

        var count = 0;
        for(var i = 0 ; i < pairs.length ; i ++) {
            let a = pairs[i].p1;
            let b = pairs[i].p2;
            if(! connected(a.id, b.id)) {
                connect(a.id, b.id);
                this._add_edge(a,b);
                count++;

                // Finished when we have added (nodes-1) edges.
                if(count == this.number - 1)
                    return;
            }
        }
    }

    _generate_extra_edges(pairs) {
        // Only do the shorter half of the edge list.
        let count = pairs.length/2;
        for(var pairId = 0 ; pairId < count ; pairId++) {
            let pair = pairs[pairId];

            let a = pair.p1;
            let b = pair.p2;

            console.log(a.id, b.id);
            if(a.numNeighbors() >= this.MAX_NEIGHBORS) {
                console.log(a.id + " has too many neighbors");
                continue;
            }
            if(b.numNeighbors() >= this.MAX_NEIGHBORS){
                console.log(b.id + " has too many neighbors");
                continue;
            }
            
            if(a.hasNeighbor(b)) {
                console.log("already neighbors");
                continue;
            }
            
            // Check that the new edge doesn't line up with any existing edges by:
            // check that the maximum dot product between a->b and a->{any existing neighbor}
            // is low enough. (then do the same for b->a vs b->neighbor)
            let bad = false;
            for(var i = 0 ; !bad && i < a.neighbors.length ; i++) {
                if(compute_normalized_dot(b,a,a.neighbors[i]) > this.MAX_EDGE_DOT_PRODUCT) {
                    console.log("Too sharp:", b.id, a.id, a.neighbors[i].id);
                    bad = true;
                    break;
                }
            }
            for(var i = 0 ;!bad &&  i < b.neighbors.length ; i++) {
                if(compute_normalized_dot(a,b,b.neighbors[i]) > this.MAX_EDGE_DOT_PRODUCT) {
                    console.log("Too sharp:", a.id, b.id, b.neighbors[i].id);
                    bad = true;
                    break;
                }
            }
            if(bad) { continue; }

            console.log("Add.");
            this._add_edge(a,b);
        }
    }


    generate = () => {
        this._clearPeople();
        this.lines.clear();


        for(var i = 0 ; i < this.number ; i ++) {
            this._placePerson();
        }
        //this.setNumber(this.people.children.length);

        let pairs = this._generateSortedPeoplePairs();
        this._generate_mst_edges(pairs);
        this._generate_extra_edges(pairs);
        
        let c = this.people.children.length;
        for(let i = 0 ; i < c*2 ; i++ ) {
            this.people.children[(Math.random()*c)|0].distributeMoney();
        }

    }

    setNumber = (value) => {
        if(value < 3 || isNaN(value)) {
            value = 3;
        }
        if(value > 50)
            value = 50;

        this.input.value = value;
        this.number = value;
    }
    setNeighbors = (value) => {
        if(value < 2 || isNaN(value)) {
            value = 2;
        }
        this.neighbors.value = value;
        this.MAX_NEIGHBORS = value;
    }
}
customElements.define('game-controller', GameController);

const controller = document.createElement('game-controller');
document.body.appendChild(controller);
controller.setNumber(5);
controller.generate();