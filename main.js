const Spray = require("spray-wrtc");
const NDP = require("foglet-ndp").NDP;
const LaddaProtocol = require("foglet-ndp").LaddaProtocol;


let spray;
let foglet;
let timeline;
let timelineGroups;
let timelineItems;

let endpoint = "https://query.wikidata.org/bigdata/ldf";
let queries = [
   " PREFIX wd: <http://www.wikidata.org/entity/> SELECT * WHERE { ?s ?p wd:Q142. ?s ?p ?o . } LIMIT 5",
   " PREFIX wd: <http://www.wikidata.org/entity/> SELECT * WHERE { ?s ?p wd:Q142. ?s ?p ?o . } OFFSET 5 LIMIT 5",
   " PREFIX wd: <http://www.wikidata.org/entity/> SELECT * WHERE { ?s ?p wd:Q142. ?s ?p ?o . } OFFSET 10 LIMIT 5",
   " PREFIX wd: <http://www.wikidata.org/entity/> SELECT * WHERE { ?s ?p wd:Q142. ?s ?p ?o . } OFFSET 15 LIMIT 5",
   " PREFIX wd: <http://www.wikidata.org/entity/> SELECT * WHERE { ?s ?p wd:Q142. ?s ?p ?o . } OFFSET 20 LIMIT 5",
   " PREFIX wd: <http://www.wikidata.org/entity/> SELECT * WHERE { ?s ?p wd:Q142. ?s ?p ?o . } OFFSET 25 LIMIT 5",
   " PREFIX wd: <http://www.wikidata.org/entity/> SELECT * WHERE { ?s ?p wd:Q142. ?s ?p ?o . } OFFSET 30 LIMIT 5",
   " PREFIX wd: <http://www.wikidata.org/entity/> SELECT * WHERE { ?s ?p wd:Q142. ?s ?p ?o . } OFFSET 35 LIMIT 5",
   " PREFIX wd: <http://www.wikidata.org/entity/> SELECT * WHERE { ?s ?p wd:Q142. ?s ?p ?o . } OFFSET 40 LIMIT 5",
   " PREFIX wd: <http://www.wikidata.org/entity/> SELECT * WHERE { ?s ?p wd:Q142. ?s ?p ?o . } OFFSET 45 LIMIT 5"
];
let executedQueries;
let delegationNumber = 2;

let globalStartTime;
let globalExecutionTime;
let cumulatedExecutionTime;
let improvementRatio;

// Connect to ICE server
$(document).ready(function() {

    /* Haven't spent time on this ajax stuff,
        We should probably change some settings. */
    $.ajax({
        url : "https://service.xirsys.com/ice",
        data : {
            ident: "folkvir",
            secret: "a0fe3e18-c9da-11e6-8f98-9ac41bd47f24",
            domain: "foglet-examples.herokuapp.com",
            application: "foglet-examples",
            room: "sparqldistribution",
            secure: 1
        },
        success: function(response, status) {
            let iceServers;
            if (response.d.iceServers) {
                iceServers = response.d.iceServers;
            }

            spray = new Spray({
                protocol: "sprayExample",
                webrtc: {
                    trickle: true,
                    iceServers: iceServers
                },
                deltatime: 1000 * 60 * 15,
                timeout: 1000 * 60 * 60
            });

            createFoglet();
            createTimeline();
        }
    });

});

/* Create foglet and initiate connection */
function createFoglet() {
    foglet = new NDP({
        spray: spray,
        room: "sparqldistribution",
        signalingServer: "https://foglet-examples.herokuapp.com/",
        delegationProtocol: new LaddaProtocol()
    });

    foglet.init();

    foglet.onUnicast(function(id, message) {
        if (message.type === 'request') {
            onReceiveRequest(id, message);
        }
    });

    foglet.events.on("ndp-execute", function(message) {
        // Here, we should receive an event when we start to execute a query
    });

    foglet.events.on("ndp-delegate", function(message) {
        // Here, we should receive an event when we start to delegate a query
    });

    foglet.events.on("ndp-answer", function(message) {
        onReceiveAnswer(message);
    });

    foglet.connection().then(function(s) {
        onFogletConnected();
    });
}

/* Create the timeline */
function createTimeline() {

    timeline = new vis.Timeline($('#timeline')[0]);
    timelineGroups = new vis.DataSet();
    timelineItems = new vis.DataSet();
    timeline.setOptions({
        stack: false,
        showCurrentTime: false
    });
    timeline.setGroups(timelineGroups);
    timeline.setItems(timelineItems);

    timeline.on('select', function(e) {
        if (e.items[0])
            onItemSelected(timelineItems.get(e.items[0]));
    });
}

/* Send the queries */
function sendQueries() {

    updateNeighboursCount();

    foglet.delegationProtocol.nbDestinations = delegationNumber;

    // Initialize variables
    executedQueries = 0;
    globalStartTime = vis.moment(new Date());
    cumulatedExecutionTime = vis.moment.duration();

    foglet.send(queries, endpoint);

    $('#send_queries').addClass("disabled");
}

/* Update neighbours count */
function updateNeighboursCount() {
    // TO DO: Understand why it never changes...
    console.log(foglet.getNeighbours().length);
}

/* Executed when the foglet is connected */
function onFogletConnected() {
    console.log("You are now connected!");
    updateNeighboursCount();
    $('#send_queries').removeClass("disabled");
}

/* Executed when a Sparql query is received to be executed */
function onReceiveRequest(id, message) {
    updateNeighboursCount();
    console.log('You are executing a query from a neighbour!');
}

/* Executed when a Sparql answer is received */
function onReceiveAnswer(message) {
    console.log(message);

    executedQueries++;
    let start = vis.moment(message.startExecutionTime, "h:mm:ss:SSS");
    let end = vis.moment(message.endExecutionTime, "h:mm:ss:SSS");
    cumulatedExecutionTime.add(vis.moment.duration(end.diff(start)));

    // If last query
    if (executedQueries == queries.length) {
        globalExecutionTime = vis.moment.duration(vis.moment(new Date()).diff(globalStartTime));
        improvementRatio = Math.floor((cumulatedExecutionTime.asMilliseconds() / globalExecutionTime.asMilliseconds())*1000)/1000;
        showTimelogs();
    }

    // If new peer
    if (!timelineGroups.get(message.id)) {
        // Add a new group
        timelineGroups.add({
            id: message.id,
            title: message.id
        });
    }

    // Add a new item
    timelineItems.add({
        id: message.qId,
        group: message.id,
        title: message.payload.length+" results",
        content: message.qId,
        start: start,
        end: end,
        message: message
    });

    // Update timeline range
    timeline.setOptions({
        start: timeline.getItemRange().min,
        end: timeline.getItemRange().max
    });
}

function showTimelogs() {
    $('#global_execution_time').html(
        globalExecutionTime.hours()+
        ":"+
        globalExecutionTime.minutes()+
        ":"+
        globalExecutionTime.seconds()+
        ","+
        ("000"+globalExecutionTime.milliseconds())
            .substr((""+globalExecutionTime.milliseconds()).length)
    );
    $('#cumulated_execution_time').html(
        cumulatedExecutionTime.hours()+
        ":"+
        cumulatedExecutionTime.minutes()+
        ":"+
        cumulatedExecutionTime.seconds()+
        ","+
        ("000"+cumulatedExecutionTime.milliseconds())
            .substr((""+cumulatedExecutionTime.milliseconds()).length)
    );
    $('#improvement_ratio').html(improvementRatio);
}

function onItemSelected(item) {
    $('#item').show();
    $('#item .qId').html(item.message.qId);
    $('#item .id').html(item.message.id);
    $('#item .query').html(item.message.query);
    $('#item .payload').html(JSON.stringify(item.message.payload, null, 4));
}
