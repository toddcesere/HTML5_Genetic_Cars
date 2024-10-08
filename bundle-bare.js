(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
/* globals document confirm btoa */
/* globals b2Vec2 */
// Global Vars

var worldRun = require("./world/run.js");

var graph_fns = require("./draw/plot-graphs.js");
var plot_graphs = graph_fns.plotGraphs;


// ======= WORLD STATE ======

var $graphList = document.querySelector("#graph-list");
var $graphTemplate = document.querySelector("#graph-template");

function stringToHTML(s){
  var temp = document.createElement('div');
  temp.innerHTML = s;
  return temp.children[0];
}

var states, runners, results, graphState = {};

function updateUI(key, scores){
  var $graph = $graphList.querySelector("#graph-" + key);
  var $newGraph = stringToHTML($graphTemplate.innerHTML);
  $newGraph.id = "graph-" + key;
  if($graph){
    $graphList.replaceChild($graph, $newGraph);
  } else {
    $graphList.appendChild($newGraph);
  }
  console.log($newGraph);
  var scatterPlotElem = $newGraph.querySelector(".scatterplot");
  scatterPlotElem.id = "graph-" + key + "-scatter";
  graphState[key] = plot_graphs(
    $newGraph.querySelector(".graphcanvas"),
    $newGraph.querySelector(".topscores"),
    scatterPlotElem,
    graphState[key],
    scores,
    {}
  );
}

var generationConfig = require("./generation-config");

var box2dfps = 60;
var max_car_health = box2dfps * 10;

var world_def = {
  gravity: new b2Vec2(0.0, -9.81),
  doSleep: true,
  floorseed: btoa(Math.seedrandom()),
  tileDimensions: new b2Vec2(1.5, 0.03),
  maxFloorTiles: 200,
  mutable_floor: false,
  box2dfps: box2dfps,
  motorSpeed: 20,
  max_car_health: max_car_health,
  schema: generationConfig.constants.schema
}

var manageRound = {
  genetic: require("./machine-learning/genetic-algorithm/manage-round.js"),
  annealing: require("./machine-learning/simulated-annealing/manage-round.js"),
};

var createListeners = function(key){
  return {
    preCarStep: function(){},
    carStep: function(){},
    carDeath: function(carInfo){
      carInfo.score.i = states[key].counter;
    },
    generationEnd: function(results){
      handleRoundEnd(key, results);
    }
  }
}

function generationZero(){
  var obj = Object.keys(manageRound).reduce(function(obj, key){
    obj.states[key] = manageRound[key].generationZero(generationConfig());
    obj.runners[key] = worldRun(
      world_def, obj.states[key].generation, createListeners(key)
    );
    obj.results[key] = [];
    graphState[key] = {}
    return obj;
  }, {states: {}, runners: {}, results: {}});
  states = obj.states;
  runners = obj.runners;
  results = obj.results;
}

function handleRoundEnd(key, scores){
  var previousCounter = states[key].counter;
  states[key] = manageRound[key].nextGeneration(
    states[key], scores, generationConfig()
  );
  runners[key] = worldRun(
    world_def, states[key].generation, createListeners(key)
  );
  if(states[key].counter === previousCounter){
    console.log(results);
    results[key] = results[key].concat(scores);
  } else {
    handleGenerationEnd(key);
    results[key] = [];
  }
}

function runRound(){
  var toRun = new Map();
  Object.keys(states).forEach(function(key){ toRun.set(key, states[key].counter) });
  console.log(toRun);
  while(toRun.size){
    console.log("running");
    Array.from(toRun.keys()).forEach(function(key){
      if(states[key].counter === toRun.get(key)){
        runners[key].step();
      } else {
        toRun.delete(key);
      }
    });
  }
}

function handleGenerationEnd(key){
  var scores = results[key];
  scores.sort(function (a, b) {
    if (a.score.v > b.score.v) {
      return -1
    } else {
      return 1
    }
  })
  updateUI(key, scores);
  results[key] = [];
}

function cw_resetPopulationUI() {
  $graphList.innerHTML = "";
}

function cw_resetWorld() {
  cw_resetPopulationUI();
  Math.seedrandom();
  generationZero();
}

document.querySelector("#new-population").addEventListener("click", function(){
  cw_resetPopulationUI()
  generationZero();
})


document.querySelector("#confirm-reset").addEventListener("click", function(){
  cw_confirmResetWorld()
})

document.querySelector("#fast-forward").addEventListener("click", function(){
  runRound();
})

function cw_confirmResetWorld() {
  if (confirm('Really reset world?')) {
    cw_resetWorld();
  } else {
    return false;
  }
}

cw_resetWorld();

},{"./draw/plot-graphs.js":6,"./generation-config":10,"./machine-learning/genetic-algorithm/manage-round.js":14,"./machine-learning/simulated-annealing/manage-round.js":16,"./world/run.js":17}],2:[function(require,module,exports){
module.exports={
  "wheelCount": 2,
  "wheelMinRadius": 0.2,
  "wheelRadiusRange": 0.5,
  "wheelMinDensity": 40,
  "wheelDensityRange": 100,
  "wheelMinFrictionExponent": -2,
  "wheelFrictionExponentRange": 3,
  "chassisDensityRange": 300,
  "chassisMinDensity": 30,
  "chassisMinAxis": 0.1,
  "chassisAxisRange": 1.1
}

},{}],3:[function(require,module,exports){
var carConstants = require("./car-constants.json");

module.exports = {
  worldDef: worldDef,
  carConstants: getCarConstants,
  generateSchema: generateSchema
}

function worldDef(){
  var box2dfps = 60;
  return {
    gravity: { y: 0 },
    doSleep: true,
    floorseed: "abc",
    maxFloorTiles: 200,
    mutable_floor: false,
    motorSpeed: 20,
    box2dfps: box2dfps,
    max_car_health: box2dfps * 10,
    tileDimensions: {
      width: 1.5,
      height: 0.03
    }
  };
}

function getCarConstants(){
  return carConstants;
}

function generateSchema(values){
  return {
    wheel_radius: {
      type: "float",
      length: values.wheelCount,
      min: values.wheelMinRadius,
      range: values.wheelRadiusRange,
      factor: 1,
    },
    wheel_density: {
      type: "float",
      length: values.wheelCount,
      min: values.wheelMinDensity,
      range: values.wheelDensityRange,
      factor: 1,
    },
    wheel_friction_exponent: {
      type: "float",
      length: values.wheelCount,
      min: values.wheelMinFrictionExponent,
      range: values.wheelFrictionExponentRange,
      factor: 1,
    },
    chassis_density: {
      type: "float",
      length: 1,
      min: values.chassisDensityRange,
      range: values.chassisMinDensity,
      factor: 1,
    },
    vertex_list: {
      type: "float",
      length: 12,
      min: values.chassisMinAxis,
      range: values.chassisAxisRange,
      factor: 1,
    },
    wheel_vertex: {
      type: "shuffle",
      length: 8,
      limit: values.wheelCount,
      factor: 1,
    },
  };
}

},{"./car-constants.json":2}],4:[function(require,module,exports){
/*
  globals b2RevoluteJointDef b2Vec2 b2BodyDef b2Body b2FixtureDef b2PolygonShape b2CircleShape
*/

var createInstance = require("../machine-learning/create-instance");

module.exports = defToCar;

function defToCar(normal_def, world, constants){
  var car_def = createInstance.applyTypes(constants.schema, normal_def)
  var instance = {};
  instance.chassis = createChassis(
    world, car_def.vertex_list, car_def.chassis_density
  );

  // Keep track of the lowest point so that we can place the car on the ground
  var relativeBottom = 100;
  // Loop through the vertices of the chassis to find the lowest point
  for (var i = 0; i < instance.chassis.vertex_list.length; i++) {
    if (instance.chassis.vertex_list[i].y < relativeBottom) {
      relativeBottom = instance.chassis.vertex_list[i].y;
    }
  }

  var i;

  var wheelCount = car_def.wheel_radius.length;

  instance.wheels = [];
  for (i = 0; i < wheelCount; i++) {
    instance.wheels[i] = createWheel(
      world,
      car_def.wheel_radius[i],
      car_def.wheel_density[i],
      car_def.wheel_friction_exponent[i]
    );
  }

  var carmass = instance.chassis.GetMass();
  for (i = 0; i < wheelCount; i++) {
    carmass += instance.wheels[i].GetMass();
  }

  var joint_def = new b2RevoluteJointDef();

  for (i = 0; i < wheelCount; i++) {
    var torque = carmass * -constants.gravity.y / car_def.wheel_radius[i];

    var randvertex = instance.chassis.vertex_list[car_def.wheel_vertex[i]];

    // Keep track of the lowest point of the wheels.
    var relativeWheelBottom = randvertex.y - car_def.wheel_radius[i];
    if (relativeWheelBottom < relativeBottom) {
      relativeBottom = relativeWheelBottom;
    }

    joint_def.localAnchorA.Set(randvertex.x, randvertex.y);
    joint_def.localAnchorB.Set(0, 0);
    joint_def.maxMotorTorque = torque;
    joint_def.motorSpeed = -constants.motorSpeed;
    joint_def.enableMotor = true;
    joint_def.bodyA = instance.chassis;
    joint_def.bodyB = instance.wheels[i];
    world.CreateJoint(joint_def);
  }

  // Set the car on the ground by setting the position of the chassis and then positioning the wheels where there are already attached. If I don't do this than the physics yanks the joints together so hard that it can send the car spinning or make it enter the ground.
  var position = instance.chassis.GetPosition();
  instance.chassis.SetPosition({x: position.x, y: - relativeBottom + world.startHeight});
  for (i = 0; i < wheelCount; i++) {
    var randvertex = instance.chassis.vertex_list[car_def.wheel_vertex[i]];
    instance.wheels[i].SetPosition(instance.chassis.GetWorldPoint(randvertex));
  }

  return instance;
}

function createChassis(world, vertexs, density) {

  var vertex_list = new Array();
  vertex_list.push(new b2Vec2(vertexs[0], 0));
  vertex_list.push(new b2Vec2(vertexs[1], vertexs[2]));
  vertex_list.push(new b2Vec2(0, vertexs[3]));
  vertex_list.push(new b2Vec2(-vertexs[4], vertexs[5]));
  vertex_list.push(new b2Vec2(-vertexs[6], 0));
  vertex_list.push(new b2Vec2(-vertexs[7], -vertexs[8]));
  vertex_list.push(new b2Vec2(0, -vertexs[9]));
  vertex_list.push(new b2Vec2(vertexs[10], -vertexs[11]));

  var body_def = new b2BodyDef();
  body_def.type = b2Body.b2_dynamicBody;
  body_def.position.Set(0.0, 4.0);

  var body = world.CreateBody(body_def);

  createChassisPart(body, vertex_list[0], vertex_list[1], density);
  createChassisPart(body, vertex_list[1], vertex_list[2], density);
  createChassisPart(body, vertex_list[2], vertex_list[3], density);
  createChassisPart(body, vertex_list[3], vertex_list[4], density);
  createChassisPart(body, vertex_list[4], vertex_list[5], density);
  createChassisPart(body, vertex_list[5], vertex_list[6], density);
  createChassisPart(body, vertex_list[6], vertex_list[7], density);
  createChassisPart(body, vertex_list[7], vertex_list[0], density);

  body.vertex_list = vertex_list;

  return body;
}


function createChassisPart(body, vertex1, vertex2, density) {
  var vertex_list = new Array();
  vertex_list.push(vertex1);
  vertex_list.push(vertex2);
  vertex_list.push(b2Vec2.Make(0, 0));
  var fix_def = new b2FixtureDef();
  fix_def.shape = new b2PolygonShape();
  fix_def.density = density;
  fix_def.friction = 10;
  fix_def.restitution = 0.2;
  fix_def.filter.groupIndex = -1;
  fix_def.shape.SetAsArray(vertex_list, 3);

  body.CreateFixture(fix_def);
}

function createWheel(world, radius, density, friction_exponent) {
  var body_def = new b2BodyDef();
  body_def.type = b2Body.b2_dynamicBody;
  body_def.position.Set(0, 0);

  var body = world.CreateBody(body_def);

  var fix_def = new b2FixtureDef();
  fix_def.shape = new b2CircleShape(radius);
  fix_def.density = density;
  fix_def.friction = Math.pow(10, friction_exponent);
  fix_def.restitution = 0.2;
  fix_def.filter.groupIndex = -1;

  body.CreateFixture(fix_def);
  return body;
}

},{"../machine-learning/create-instance":13}],5:[function(require,module,exports){


module.exports = {
  getInitialState: getInitialState,
  updateState: updateState,
  getStatus: getStatus,
  calculateScore: calculateScore,
};

function getInitialState(world_def){
  return {
    frames: 0,
    health: world_def.max_car_health,
    maxPositiony: 0,
    minPositiony: 0,
    maxPositionx: 0,
  };
}

function updateState(constants, worldConstruct, state){
  if(state.health <= 0){
    throw new Error("Already Dead");
  }
  if(state.maxPositionx > constants.finishLine){
    throw new Error("already Finished");
  }

  // console.log(state);
  // check health
  var position = worldConstruct.chassis.GetPosition();
  // check if car reached end of the path
  var nextState = {
    frames: state.frames + 1,
    maxPositionx: position.x > state.maxPositionx ? position.x : state.maxPositionx,
    maxPositiony: position.y > state.maxPositiony ? position.y : state.maxPositiony,
    minPositiony: position.y < state.minPositiony ? position.y : state.minPositiony
  };

  if (position.x > constants.finishLine) {
    return nextState;
  }

  if (position.x > state.maxPositionx + 0.001) {
    nextState.health = constants.max_car_health;
    return nextState;
  }
  nextState.health = state.health - 0.1;
  if (Math.abs(worldConstruct.chassis.GetLinearVelocity().x) < 0.001) {
    nextState.health -= 5;
  }
  return nextState;
}

function getStatus(state, constants){
  if(hasFailed(state, constants)) return -1;
  if(hasSuccess(state, constants)) return 1;
  return 0;
}

function hasFailed(state /*, constants */){
  return state.health <= 0;
}
function hasSuccess(state, constants){
  return state.maxPositionx > constants.finishLine;
}

function calculateScore(state, constants){
  var avgspeed = (state.maxPositionx / state.frames) * constants.box2dfps;
  var position = state.maxPositionx;
  var score = position + avgspeed;
  return {
    v: score,
    s: avgspeed,
    x: position,
    y: state.maxPositiony,
    y2: state.minPositiony
  }
}

},{}],6:[function(require,module,exports){
var scatterPlot = require("./scatter-plot");

module.exports = {
  plotGraphs: function(graphElem, topScoresElem, scatterPlotElem, lastState, scores, config) {
    lastState = lastState || {};
    var generationSize = scores.length
    var graphcanvas = graphElem;
    var graphctx = graphcanvas.getContext("2d");
    var graphwidth = 400;
    var graphheight = 250;
    var nextState = cw_storeGraphScores(
      lastState, scores, generationSize
    );
    console.log(scores, nextState);
    cw_clearGraphics(graphcanvas, graphctx, graphwidth, graphheight);
    cw_plotAverage(nextState, graphctx);
    cw_plotElite(nextState, graphctx);
    cw_plotTop(nextState, graphctx);
    cw_listTopScores(topScoresElem, nextState);
    nextState.scatterGraph = drawAllResults(
      scatterPlotElem, config, nextState, lastState.scatterGraph
    );
    return nextState;
  },
  clearGraphics: function(graphElem) {
    var graphcanvas = graphElem;
    var graphctx = graphcanvas.getContext("2d");
    var graphwidth = 400;
    var graphheight = 250;
    cw_clearGraphics(graphcanvas, graphctx, graphwidth, graphheight);
  }
};


function cw_storeGraphScores(lastState, cw_carScores, generationSize) {
  console.log(cw_carScores);
  return {
    cw_topScores: (lastState.cw_topScores || [])
    .concat([cw_carScores[0].score]),
    cw_graphAverage: (lastState.cw_graphAverage || []).concat([
      cw_average(cw_carScores, generationSize)
    ]),
    cw_graphElite: (lastState.cw_graphElite || []).concat([
      cw_eliteaverage(cw_carScores, generationSize)
    ]),
    cw_graphTop: (lastState.cw_graphTop || []).concat([
      cw_carScores[0].score.v
    ]),
    allResults: (lastState.allResults || []).concat(cw_carScores),
  }
}

function cw_plotTop(state, graphctx) {
  var cw_graphTop = state.cw_graphTop;
  var graphsize = cw_graphTop.length;
  graphctx.strokeStyle = "#C83B3B";
  graphctx.beginPath();
  graphctx.moveTo(0, 0);
  for (var k = 0; k < graphsize; k++) {
    graphctx.lineTo(400 * (k + 1) / graphsize, cw_graphTop[k]);
  }
  graphctx.stroke();
}

function cw_plotElite(state, graphctx) {
  var cw_graphElite = state.cw_graphElite;
  var graphsize = cw_graphElite.length;
  graphctx.strokeStyle = "#7BC74D";
  graphctx.beginPath();
  graphctx.moveTo(0, 0);
  for (var k = 0; k < graphsize; k++) {
    graphctx.lineTo(400 * (k + 1) / graphsize, cw_graphElite[k]);
  }
  graphctx.stroke();
}

function cw_plotAverage(state, graphctx) {
  var cw_graphAverage = state.cw_graphAverage;
  var graphsize = cw_graphAverage.length;
  graphctx.strokeStyle = "#3F72AF";
  graphctx.beginPath();
  graphctx.moveTo(0, 0);
  for (var k = 0; k < graphsize; k++) {
    graphctx.lineTo(400 * (k + 1) / graphsize, cw_graphAverage[k]);
  }
  graphctx.stroke();
}


function cw_eliteaverage(scores, generationSize) {
  var sum = 0;
  for (var k = 0; k < Math.floor(generationSize / 2); k++) {
    sum += scores[k].score.v;
  }
  return sum / Math.floor(generationSize / 2);
}

function cw_average(scores, generationSize) {
  var sum = 0;
  for (var k = 0; k < generationSize; k++) {
    sum += scores[k].score.v;
  }
  return sum / generationSize;
}

function cw_clearGraphics(graphcanvas, graphctx, graphwidth, graphheight) {
  graphcanvas.width = graphcanvas.width;
  graphctx.translate(0, graphheight);
  graphctx.scale(1, -1);
  graphctx.lineWidth = 1;
  graphctx.strokeStyle = "#3F72AF";
  graphctx.beginPath();
  graphctx.moveTo(0, graphheight / 2);
  graphctx.lineTo(graphwidth, graphheight / 2);
  graphctx.moveTo(0, graphheight / 4);
  graphctx.lineTo(graphwidth, graphheight / 4);
  graphctx.moveTo(0, graphheight * 3 / 4);
  graphctx.lineTo(graphwidth, graphheight * 3 / 4);
  graphctx.stroke();
}

function cw_listTopScores(elem, state) {
  var cw_topScores = state.cw_topScores;
  var ts = elem;
  ts.innerHTML = "<b>Top Scores:</b><br />";
  cw_topScores.sort(function (a, b) {
    if (a.v > b.v) {
      return -1
    } else {
      return 1
    }
  });

  for (var k = 0; k < Math.min(10, cw_topScores.length); k++) {
    var topScore = cw_topScores[k];
    // console.log(topScore);
    var n = "#" + (k + 1) + ":";
    var score = Math.round(topScore.v * 100) / 100;
    var distance = "d:" + Math.round(topScore.x * 100) / 100;
    var yrange =  "h:" + Math.round(topScore.y2 * 100) / 100 + "/" + Math.round(topScore.y * 100) / 100 + "m";
    var gen = "(Gen " + cw_topScores[k].i + ")"

    ts.innerHTML +=  [n, score, distance, yrange, gen].join(" ") + "<br />";
  }
}

function drawAllResults(scatterPlotElem, config, allResults, previousGraph){
  if(!scatterPlotElem) return;
  return scatterPlot(scatterPlotElem, allResults, config.propertyMap, previousGraph)
}

},{"./scatter-plot":7}],7:[function(require,module,exports){
/* globals vis Highcharts */

// Called when the Visualization API is loaded.

module.exports = highCharts;
function highCharts(elem, scores){
  var keys = Object.keys(scores[0].def);
  keys = keys.reduce(function(curArray, key){
    var l = scores[0].def[key].length;
    var subArray = [];
    for(var i = 0; i < l; i++){
      subArray.push(key + "." + i);
    }
    return curArray.concat(subArray);
  }, []);
  function retrieveValue(obj, path){
    return path.split(".").reduce(function(curValue, key){
      return curValue[key];
    }, obj);
  }

  var dataObj = Object.keys(scores).reduce(function(kv, score){
    keys.forEach(function(key){
      kv[key].data.push([
        retrieveValue(score.def, key), score.score.v
      ])
    })
    return kv;
  }, keys.reduce(function(kv, key){
    kv[key] = {
      name: key,
      data: [],
    }
    return kv;
  }, {}))
  Highcharts.chart(elem.id, {
      chart: {
          type: 'scatter',
          zoomType: 'xy'
      },
      title: {
          text: 'Property Value to Score'
      },
      xAxis: {
          title: {
              enabled: true,
              text: 'Normalized'
          },
          startOnTick: true,
          endOnTick: true,
          showLastLabel: true
      },
      yAxis: {
          title: {
              text: 'Score'
          }
      },
      legend: {
          layout: 'vertical',
          align: 'left',
          verticalAlign: 'top',
          x: 100,
          y: 70,
          floating: true,
          backgroundColor: (Highcharts.theme && Highcharts.theme.legendBackgroundColor) || '#FFFFFF',
          borderWidth: 1
      },
      plotOptions: {
          scatter: {
              marker: {
                  radius: 5,
                  states: {
                      hover: {
                          enabled: true,
                          lineColor: 'rgb(100,100,100)'
                      }
                  }
              },
              states: {
                  hover: {
                      marker: {
                          enabled: false
                      }
                  }
              },
              tooltip: {
                  headerFormat: '<b>{series.name}</b><br>',
                  pointFormat: '{point.x}, {point.y}'
              }
          }
      },
      series: keys.map(function(key){
        return dataObj[key];
      })
  });
}

function visChart(elem, scores, propertyMap, graph) {

  // Create and populate a data table.
  var data = new vis.DataSet();
  scores.forEach(function(scoreInfo){
    data.add({
      x: getProperty(scoreInfo, propertyMap.x),
      y: getProperty(scoreInfo, propertyMap.x),
      z: getProperty(scoreInfo, propertyMap.z),
      style: getProperty(scoreInfo, propertyMap.z),
      // extra: def.ancestry
    });
  });

  function getProperty(info, key){
    if(key === "score"){
      return info.score.v
    } else {
      return info.def[key];
    }
  }

  // specify options
  var options = {
    width:  '600px',
    height: '600px',
    style: 'dot-size',
    showPerspective: true,
    showLegend: true,
    showGrid: true,
    showShadow: false,

    // Option tooltip can be true, false, or a function returning a string with HTML contents
    tooltip: function (point) {
      // parameter point contains properties x, y, z, and data
      // data is the original object passed to the point constructor
      return 'score: <b>' + point.z + '</b><br>'; // + point.data.extra;
    },

    // Tooltip default styling can be overridden
    tooltipStyle: {
      content: {
        background    : 'rgba(255, 255, 255, 0.7)',
        padding       : '10px',
        borderRadius  : '10px'
      },
      line: {
        borderLeft    : '1px dotted rgba(0, 0, 0, 0.5)'
      },
      dot: {
        border        : '5px solid rgba(0, 0, 0, 0.5)'
      }
    },

    keepAspectRatio: true,
    verticalRatio: 0.5
  };

  var camera = graph ? graph.getCameraPosition() : null;

  // create our graph
  var container = elem;
  graph = new vis.Graph3d(container, data, options);

  if (camera) graph.setCameraPosition(camera); // restore camera position
  return graph;
}

},{}],8:[function(require,module,exports){

module.exports = generateRandom;
function generateRandom(){
  return Math.random();
}

},{}],9:[function(require,module,exports){
// http://sunmingtao.blogspot.com/2016/11/inbreeding-coefficient.html
module.exports = getInbreedingCoefficient;

function getInbreedingCoefficient(child){
  var nameIndex = new Map();
  var flagged = new Set();
  var convergencePoints = new Set();
  createAncestryMap(child, []);

  var storedCoefficients = new Map();

  return Array.from(convergencePoints.values()).reduce(function(sum, point){
    var iCo = getCoefficient(point);
    return sum + iCo;
  }, 0);

  function createAncestryMap(initNode){
    var itemsInQueue = [{ node: initNode, path: [] }];
    do{
      var item = itemsInQueue.shift();
      var node = item.node;
      var path = item.path;
      if(processItem(node, path)){
        var nextPath = [ node.id ].concat(path);
        itemsInQueue = itemsInQueue.concat(node.ancestry.map(function(parent){
          return {
            node: parent,
            path: nextPath
          };
        }));
      }
    }while(itemsInQueue.length);


    function processItem(node, path){
      var newAncestor = !nameIndex.has(node.id);
      if(newAncestor){
        nameIndex.set(node.id, {
          parents: (node.ancestry || []).map(function(parent){
            return parent.id;
          }),
          id: node.id,
          children: [],
          convergences: [],
        });
      } else {

        flagged.add(node.id)
        nameIndex.get(node.id).children.forEach(function(childIdentifier){
          var offsets = findConvergence(childIdentifier.path, path);
          if(!offsets){
            return;
          }
          var childID = path[offsets[1]];
          convergencePoints.add(childID);
          nameIndex.get(childID).convergences.push({
            parent: node.id,
            offsets: offsets,
          });
        });
      }

      if(path.length){
        nameIndex.get(node.id).children.push({
          child: path[0],
          path: path
        });
      }

      if(!newAncestor){
        return;
      }
      if(!node.ancestry){
        return;
      }
      return true;
    }
  }

  function getCoefficient(id){
    if(storedCoefficients.has(id)){
      return storedCoefficients.get(id);
    }
    var node = nameIndex.get(id);
    var val = node.convergences.reduce(function(sum, point){
      return sum + Math.pow(1 / 2, point.offsets.reduce(function(sum, value){
        return sum + value;
      }, 1)) * (1 + getCoefficient(point.parent));
    }, 0);
    storedCoefficients.set(id, val);

    return val;

  }
  function findConvergence(listA, listB){
    var ci, cj, li, lj;
    outerloop:
    for(ci = 0, li = listA.length; ci < li; ci++){
      for(cj = 0, lj = listB.length; cj < lj; cj++){
        if(listA[ci] === listB[cj]){
          break outerloop;
        }
      }
    }
    if(ci === li){
      return false;
    }
    return [ci, cj];
  }
}

},{}],10:[function(require,module,exports){
var carConstruct = require("../car-schema/construct.js");

var carConstants = carConstruct.carConstants();

var schema = carConstruct.generateSchema(carConstants);
var pickParent = require("./pickParent");
var selectFromAllParents = require("./selectFromAllParents");
const constants = {
  generationSize: 20,
  schema: schema,
  championLength: 1,
  mutation_range: 1,
  gen_mutation: 0.05,
};
module.exports = function(){
  var currentChoices = new Map();
  return Object.assign(
    {},
    constants,
    {
      selectFromAllParents: selectFromAllParents,
      generateRandom: require("./generateRandom"),
      pickParent: pickParent.bind(void 0, currentChoices),
    }
  );
}
module.exports.constants = constants

},{"../car-schema/construct.js":3,"./generateRandom":8,"./pickParent":11,"./selectFromAllParents":12}],11:[function(require,module,exports){
var nAttributes = 15;
module.exports = pickParent;

function pickParent(currentChoices, chooseId, key /* , parents */){
  if(!currentChoices.has(chooseId)){
    currentChoices.set(chooseId, initializePick())
  }
  // console.log(chooseId);
  var state = currentChoices.get(chooseId);
  // console.log(state.curparent);
  state.i++
  if(["wheel_radius", "wheel_vertex", "wheel_density", "wheel_friction_exponent"].indexOf(key) > -1){
    state.curparent = cw_chooseParent(state);
    return state.curparent;
  }
  state.curparent = cw_chooseParent(state);
  return state.curparent;

  function cw_chooseParent(state) {
    var curparent = state.curparent;
    var attributeIndex = state.i;
    var swapPoint1 = state.swapPoint1
    var swapPoint2 = state.swapPoint2
    // console.log(swapPoint1, swapPoint2, attributeIndex)
    if ((swapPoint1 == attributeIndex) || (swapPoint2 == attributeIndex)) {
      return curparent == 1 ? 0 : 1
    }
    return curparent
  }

  function initializePick(){
    var curparent = 0;

    var swapPoint1 = Math.floor(Math.random() * (nAttributes));
    var swapPoint2 = swapPoint1;
    while (swapPoint2 == swapPoint1) {
      swapPoint2 = Math.floor(Math.random() * (nAttributes));
    }
    var i = 0;
    return {
      curparent: curparent,
      i: i,
      swapPoint1: swapPoint1,
      swapPoint2: swapPoint2
    }
  }
}

},{}],12:[function(require,module,exports){
var getInbreedingCoefficient = require("./inbreeding-coefficient");

module.exports = simpleSelect;

function simpleSelect(parents){
  var totalParents = parents.length
  var r = Math.random();
  if (r == 0)
    return 0;
  return Math.floor(-Math.log(r) * totalParents) % totalParents;
}

function selectFromAllParents(parents, parentList, previousParentIndex) {
  var previousParent = parents[previousParentIndex];
  var validParents = parents.filter(function(parent, i){
    if(previousParentIndex === i){
      return false;
    }
    if(!previousParent){
      return true;
    }
    var child = {
      id: Math.random().toString(32),
      ancestry: [previousParent, parent].map(function(p){
        return {
          id: p.def.id,
          ancestry: p.def.ancestry
        }
      })
    }
    var iCo = getInbreedingCoefficient(child);
    console.log("inbreeding coefficient", iCo)
    if(iCo > 0.25){
      return false;
    }
    return true;
  })
  if(validParents.length === 0){
    return Math.floor(Math.random() * parents.length)
  }
  var totalScore = validParents.reduce(function(sum, parent){
    return sum + parent.score.v;
  }, 0);
  var r = totalScore * Math.random();
  for(var i = 0; i < validParents.length; i++){
    var score = validParents[i].score.v;
    if(r > score){
      r = r - score;
    } else {
      break;
    }
  }
  return i;
}

},{"./inbreeding-coefficient":9}],13:[function(require,module,exports){
var random = require("./random.js");

module.exports = {
  createGenerationZero(schema, generator){
    return Object.keys(schema).reduce(function(instance, key){
      var schemaProp = schema[key];
      var values = random.createNormals(schemaProp, generator);
      instance[key] = values;
      return instance;
    }, { id: Math.random().toString(32) });
  },
  createCrossBreed(schema, parents, parentChooser){
    var id = Math.random().toString(32);
    return Object.keys(schema).reduce(function(crossDef, key){
      var schemaDef = schema[key];
      var values = [];
      for(var i = 0, l = schemaDef.length; i < l; i++){
        var p = parentChooser(id, key, parents);
        values.push(parents[p][key][i]);
      }
      crossDef[key] = values;
      return crossDef;
    }, {
      id: id,
      ancestry: parents.map(function(parent){
        return {
          id: parent.id,
          ancestry: parent.ancestry,
        };
      })
    });
  },
  createMutatedClone(schema, generator, parent, factor, chanceToMutate){
    return Object.keys(schema).reduce(function(clone, key){
      var schemaProp = schema[key];
      var originalValues = parent[key];
      var values = random.mutateNormals(
        schemaProp, generator, originalValues, factor, chanceToMutate
      );
      clone[key] = values;
      return clone;
    }, {
      id: parent.id,
      ancestry: parent.ancestry
    });
  },
  applyTypes(schema, parent){
    return Object.keys(schema).reduce(function(clone, key){
      var schemaProp = schema[key];
      var originalValues = parent[key];
      var values;
      switch(schemaProp.type){
        case "shuffle" :
          values = random.mapToShuffle(schemaProp, originalValues); break;
        case "float" :
          values = random.mapToFloat(schemaProp, originalValues); break;
        case "integer":
          values = random.mapToInteger(schemaProp, originalValues); break;
        default:
          throw new Error(`Unknown type ${schemaProp.type} of schema for key ${key}`);
      }
      clone[key] = values;
      return clone;
    }, {
      id: parent.id,
      ancestry: parent.ancestry
    });
  },
}

},{"./random.js":15}],14:[function(require,module,exports){
var create = require("../create-instance");

module.exports = {
  generationZero: generationZero,
  nextGeneration: nextGeneration
}

function generationZero(config){
  var generationSize = config.generationSize,
  schema = config.schema;
  var cw_carGeneration = [];
  for (var k = 0; k < generationSize; k++) {
    var def = create.createGenerationZero(schema, function(){
      return Math.random()
    });
    def.index = k;
    cw_carGeneration.push(def);
  }
  return {
    counter: 0,
    generation: cw_carGeneration,
  };
}

function nextGeneration(
  previousState,
  scores,
  config
){
  var champion_length = config.championLength,
    generationSize = config.generationSize,
    selectFromAllParents = config.selectFromAllParents;

  var newGeneration = new Array();
  var newborn;
  var allTimeBest = previousState.allTimeBest;
  if (!allTimeBest || scores[0].score.v > allTimeBest.best_score) {
    allTimeBest = scores[0].def;
    allTimeBest.is_all_time_best = true;
  }
  var allTimeBestAdded = false;
  for (var k = 0; k < champion_length; k++) {
    scores[k].def.is_elite = true;
    scores[k].def.index = k;
    newGeneration.push(scores[k].def);
    if (scores[k].score.v > scores[k].def.best_score) {
      scores[k].def.best_score = scores[k].score.v;
    }
    if (allTimeBest.id == scores[k].def.id) {
      allTimeBestAdded = true;
    }
  }
  if (!allTimeBestAdded) {
    allTimeBest.is_elite = false;
    newGeneration.push(allTimeBest);
  }
  var parentList = [];
  for (k = champion_length; k < generationSize; k++) {
    var parent1 = selectFromAllParents(scores, parentList);
    var parent2 = parent1;
    while (parent2 == parent1) {
      parent2 = selectFromAllParents(scores, parentList, parent1);
    }
    var pair = [parent1, parent2]
    parentList.push(pair);
    newborn = makeChild(config,
      pair.map(function(parent) { return scores[parent].def; })
    );
    newborn = mutate(config, newborn);
    newborn.is_elite = false;
    newborn.index = k;
    newGeneration.push(newborn);
  }

  return {
    counter: previousState.counter + 1,
    generation: newGeneration,
    allTimeBest: allTimeBest
  };
}


function makeChild(config, parents){
  var schema = config.schema,
    pickParent = config.pickParent;
  return create.createCrossBreed(schema, parents, pickParent)
}


function mutate(config, parent){
  var schema = config.schema,
    mutation_range = config.mutation_range,
    gen_mutation = config.gen_mutation,
    generateRandom = config.generateRandom;
  return create.createMutatedClone(
    schema,
    generateRandom,
    parent,
    Math.max(mutation_range),
    gen_mutation
  )
}

},{"../create-instance":13}],15:[function(require,module,exports){


const random = {
  shuffleIntegers(prop, generator){
    return random.mapToShuffle(prop, random.createNormals({
      length: prop.length || 10,
      inclusive: true,
    }, generator));
  },
  createIntegers(prop, generator){
    return random.mapToInteger(prop, random.createNormals({
      length: prop.length,
      inclusive: true,
    }, generator));
  },
  createFloats(prop, generator){
    return random.mapToFloat(prop, random.createNormals({
      length: prop.length,
      inclusive: true,
    }, generator));
  },
  createNormals(prop, generator){
    var l = prop.length;
    var values = [];
    for(var i = 0; i < l; i++){
      values.push(
        createNormal(prop, generator)
      );
    }
    return values;
  },
  mutateShuffle(
    prop, generator, originalValues, mutation_range, chanceToMutate
  ){
    return random.mapToShuffle(prop, random.mutateNormals(
      prop, generator, originalValues, mutation_range, chanceToMutate
    ));
  },
  mutateIntegers(prop, generator, originalValues, mutation_range, chanceToMutate){
    return random.mapToInteger(prop, random.mutateNormals(
      prop, generator, originalValues, mutation_range, chanceToMutate
    ));
  },
  mutateFloats(prop, generator, originalValues, mutation_range, chanceToMutate){
    return random.mapToFloat(prop, random.mutateNormals(
      prop, generator, originalValues, mutation_range, chanceToMutate
    ));
  },
  mapToShuffle(prop, normals){
    var offset = prop.offset || 0;
    var limit = prop.limit || prop.length;
    var sorted = normals.slice().sort(function(a, b){
      return a - b;
    });
    return normals.map(function(val){
      return sorted.indexOf(val);
    }).map(function(i){
      return i + offset;
    }).slice(0, limit);
  },
  mapToInteger(prop, normals){
    prop = {
      min: prop.min || 0,
      range: prop.range || 10,
      length: prop.length
    }
    return random.mapToFloat(prop, normals).map(function(float){
      return Math.round(float);
    });
  },
  mapToFloat(prop, normals){
    prop = {
      min: prop.min || 0,
      range: prop.range || 1
    }
    return normals.map(function(normal){
      var min = prop.min;
      var range = prop.range;
      return min + normal * range
    })
  },
  mutateNormals(prop, generator, originalValues, mutation_range, chanceToMutate){
    var factor = (prop.factor || 1) * mutation_range
    return originalValues.map(function(originalValue){
      if(generator() > chanceToMutate){
        return originalValue;
      }
      return mutateNormal(
        prop, generator, originalValue, factor
      );
    });
  }
};

module.exports = random;

function mutateNormal(prop, generator, originalValue, mutation_range){
  if(mutation_range > 1){
    throw new Error("Cannot mutate beyond bounds");
  }
  var newMin = originalValue - 0.5;
  if (newMin < 0) newMin = 0;
  if (newMin + mutation_range  > 1)
    newMin = 1 - mutation_range;
  var rangeValue = createNormal({
    inclusive: true,
  }, generator);
  return newMin + rangeValue * mutation_range;
}

function createNormal(prop, generator){
  if(!prop.inclusive){
    return generator();
  } else {
    return generator() < 0.5 ?
    generator() :
    1 - generator();
  }
}

},{}],16:[function(require,module,exports){
var create = require("../create-instance");

module.exports = {
  generationZero: generationZero,
  nextGeneration: nextGeneration,
}

function generationZero(config){
  var oldStructure = create.createGenerationZero(
    config.schema, config.generateRandom
  );
  var newStructure = createStructure(config, 1, oldStructure);

  var k = 0;

  return {
    counter: 0,
    k: k,
    generation: [newStructure, oldStructure]
  }
}

function nextGeneration(previousState, scores, config){
  var nextState = {
    k: (previousState.k + 1)%config.generationSize,
    counter: previousState.counter + (previousState.k === config.generationSize ? 1 : 0)
  };
  // gradually get closer to zero temperature (but never hit it)
  var oldDef = previousState.curDef || previousState.generation[1];
  var oldScore = previousState.score || scores[1].score.v;

  var newDef = previousState.generation[0];
  var newScore = scores[0].score.v;


  var temp = Math.pow(Math.E, -nextState.counter / config.generationSize);

  var scoreDiff = newScore - oldScore;
  // If the next point is higher, change location
  if(scoreDiff > 0){
    nextState.curDef = newDef;
    nextState.score = newScore;
    // Else we want to increase likelyhood of changing location as we get
  } else if(Math.random() > Math.exp(-scoreDiff/(nextState.k * temp))){
    nextState.curDef = newDef;
    nextState.score = newScore;
  } else {
    nextState.curDef = oldDef;
    nextState.score = oldScore;
  }

  console.log(previousState, nextState);

  nextState.generation = [createStructure(config, temp, nextState.curDef)];

  return nextState;
}


function createStructure(config, mutation_range, parent){
  var schema = config.schema,
    gen_mutation = 1,
    generateRandom = config.generateRandom;
  return create.createMutatedClone(
    schema,
    generateRandom,
    parent,
    mutation_range,
    gen_mutation
  )

}

},{"../create-instance":13}],17:[function(require,module,exports){
/* globals btoa */
var setupScene = require("./setup-scene");
var carRun = require("../car-schema/run");
var defToCar = require("../car-schema/def-to-car");

module.exports = runDefs;
function runDefs(world_def, defs, listeners) {
  if (world_def.mutable_floor) {
    // GHOST DISABLED
    world_def.floorseed = btoa(Math.seedrandom());
  }

  var scene = setupScene(world_def);
  scene.world.Step(1 / world_def.box2dfps, 20, 20);
  console.log("about to build cars");
  var cars = defs.map((def, i) => {
    return {
      index: i,
      def: def,
      car: defToCar(def, scene.world, world_def),
      state: carRun.getInitialState(world_def)
    };
  });
  var alivecars = cars;
  return {
    scene: scene,
    cars: cars,
    step: function () {
      if (alivecars.length === 0) {
        throw new Error("no more cars");
      }
      scene.world.Step(1 / world_def.box2dfps, 20, 20);
      listeners.preCarStep();
      alivecars = alivecars.filter(function (car) {
        car.state = carRun.updateState(
          world_def, car.car, car.state
        );
        var status = carRun.getStatus(car.state, world_def);
        listeners.carStep(car);
        if (status === 0) {
          return true;
        }
        car.score = carRun.calculateScore(car.state, world_def);
        listeners.carDeath(car);

        var world = scene.world;
        var worldCar = car.car;
        world.DestroyBody(worldCar.chassis);

        for (var w = 0; w < worldCar.wheels.length; w++) {
          world.DestroyBody(worldCar.wheels[w]);
        }

        return false;
      })
      if (alivecars.length === 0) {
        listeners.generationEnd(cars);
      }
    }
  }

}

},{"../car-schema/def-to-car":4,"../car-schema/run":5,"./setup-scene":18}],18:[function(require,module,exports){
/* globals b2World b2Vec2 b2BodyDef b2FixtureDef b2PolygonShape */

/*

world_def = {
  gravity: {x, y},
  doSleep: boolean,
  floorseed: string,
  tileDimensions,
  maxFloorTiles,
  mutable_floor: boolean
}

*/

module.exports = function(world_def){

  var world = new b2World(world_def.gravity, world_def.doSleep);
  var floorTiles = cw_createFloor(
    world,
    world_def.floorseed,
    world_def.tileDimensions,
    world_def.maxFloorTiles,
    world_def.mutable_floor
  );

  var last_tile = floorTiles[
    floorTiles.length - 1
  ];
  var last_fixture = last_tile.GetFixtureList();
  var last_tile_position = last_tile.GetWorldPoint(
    last_fixture.GetShape().m_vertices[3]
  );

  // Loop through first several tiles to find a safe height for placing cars
  world.startHeight = -10;
  for (var i = 0; i < 20; i++) {
    var tile = floorTiles[i];
    var fixture = tile.GetFixtureList();
    var topRightVertice = tile.GetWorldPoint(fixture.GetShape().m_vertices[3]);
    var topLeftVertice = tile.GetWorldPoint(fixture.GetShape().m_vertices[0]);
    if (topRightVertice.y > world.startHeight) {
      world.startHeight = topRightVertice.y;
    }
    if (topLeftVertice.y > world.startHeight) {
      world.startHeight = topLeftVertice.y;
    }
    if (topRightVertice.x > 2) {
      break;
    }
  }
  world.finishLine = last_tile_position.x;
  return {
    world: world,
    floorTiles: floorTiles,
    finishLine: last_tile_position.x
  };
}

function cw_createFloor(world, floorseed, dimensions, maxFloorTiles, mutable_floor) {
  var last_tile = null;
  var tile_position = new b2Vec2(-5, 0);
  var cw_floorTiles = [];
  Math.seedrandom(floorseed);
  for (var k = 0; k < maxFloorTiles; k++) {
    if (!mutable_floor) {
      // keep old impossible tracks if not using mutable floors
      last_tile = cw_createFloorTile(
        world, dimensions, tile_position, (Math.random() * 3 - 1.5) * 1.5 * k / maxFloorTiles
      );
    } else {
      // if path is mutable over races, create smoother tracks
      last_tile = cw_createFloorTile(
        world, dimensions, tile_position, (Math.random() * 3 - 1.5) * 1.2 * k / maxFloorTiles
      );
    }
    cw_floorTiles.push(last_tile);
    var last_fixture = last_tile.GetFixtureList();
    tile_position = last_tile.GetWorldPoint(last_fixture.GetShape().m_vertices[3]);
  }
  return cw_floorTiles;
}


function cw_createFloorTile(world, dim, position, angle) {
  var body_def = new b2BodyDef();

  body_def.position.Set(position.x, position.y);
  var body = world.CreateBody(body_def);
  var fix_def = new b2FixtureDef();
  fix_def.shape = new b2PolygonShape();
  fix_def.friction = 0.5;

  var coords = new Array();
  coords.push(new b2Vec2(0, 0));
  coords.push(new b2Vec2(0, -dim.y));
  coords.push(new b2Vec2(dim.x, -dim.y));
  coords.push(new b2Vec2(dim.x, 0));

  var center = new b2Vec2(0, 0);

  var newcoords = cw_rotateFloorTile(coords, center, angle);

  fix_def.shape.SetAsArray(newcoords);

  body.CreateFixture(fix_def);
  return body;
}

function cw_rotateFloorTile(coords, center, angle) {
  return coords.map(function(coord){
    return {
      x: Math.cos(angle) * (coord.x - center.x) - Math.sin(angle) * (coord.y - center.y) + center.x,
      y: Math.sin(angle) * (coord.x - center.x) + Math.cos(angle) * (coord.y - center.y) + center.y,
    };
  });
}

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvYmFyZS5qcyIsInNyYy9jYXItc2NoZW1hL2Nhci1jb25zdGFudHMuanNvbiIsInNyYy9jYXItc2NoZW1hL2NvbnN0cnVjdC5qcyIsInNyYy9jYXItc2NoZW1hL2RlZi10by1jYXIuanMiLCJzcmMvY2FyLXNjaGVtYS9ydW4uanMiLCJzcmMvZHJhdy9wbG90LWdyYXBocy5qcyIsInNyYy9kcmF3L3NjYXR0ZXItcGxvdC5qcyIsInNyYy9nZW5lcmF0aW9uLWNvbmZpZy9nZW5lcmF0ZVJhbmRvbS5qcyIsInNyYy9nZW5lcmF0aW9uLWNvbmZpZy9pbmJyZWVkaW5nLWNvZWZmaWNpZW50LmpzIiwic3JjL2dlbmVyYXRpb24tY29uZmlnL2luZGV4LmpzIiwic3JjL2dlbmVyYXRpb24tY29uZmlnL3BpY2tQYXJlbnQuanMiLCJzcmMvZ2VuZXJhdGlvbi1jb25maWcvc2VsZWN0RnJvbUFsbFBhcmVudHMuanMiLCJzcmMvbWFjaGluZS1sZWFybmluZy9jcmVhdGUtaW5zdGFuY2UuanMiLCJzcmMvbWFjaGluZS1sZWFybmluZy9nZW5ldGljLWFsZ29yaXRobS9tYW5hZ2Utcm91bmQuanMiLCJzcmMvbWFjaGluZS1sZWFybmluZy9yYW5kb20uanMiLCJzcmMvbWFjaGluZS1sZWFybmluZy9zaW11bGF0ZWQtYW5uZWFsaW5nL21hbmFnZS1yb3VuZC5qcyIsInNyYy93b3JsZC9ydW4uanMiLCJzcmMvd29ybGQvc2V0dXAtc2NlbmUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9LQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0lBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiLyogZ2xvYmFscyBkb2N1bWVudCBjb25maXJtIGJ0b2EgKi9cbi8qIGdsb2JhbHMgYjJWZWMyICovXG4vLyBHbG9iYWwgVmFyc1xuXG52YXIgd29ybGRSdW4gPSByZXF1aXJlKFwiLi93b3JsZC9ydW4uanNcIik7XG5cbnZhciBncmFwaF9mbnMgPSByZXF1aXJlKFwiLi9kcmF3L3Bsb3QtZ3JhcGhzLmpzXCIpO1xudmFyIHBsb3RfZ3JhcGhzID0gZ3JhcGhfZm5zLnBsb3RHcmFwaHM7XG5cblxuLy8gPT09PT09PSBXT1JMRCBTVEFURSA9PT09PT1cblxudmFyICRncmFwaExpc3QgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiI2dyYXBoLWxpc3RcIik7XG52YXIgJGdyYXBoVGVtcGxhdGUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiI2dyYXBoLXRlbXBsYXRlXCIpO1xuXG5mdW5jdGlvbiBzdHJpbmdUb0hUTUwocyl7XG4gIHZhciB0ZW1wID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIHRlbXAuaW5uZXJIVE1MID0gcztcbiAgcmV0dXJuIHRlbXAuY2hpbGRyZW5bMF07XG59XG5cbnZhciBzdGF0ZXMsIHJ1bm5lcnMsIHJlc3VsdHMsIGdyYXBoU3RhdGUgPSB7fTtcblxuZnVuY3Rpb24gdXBkYXRlVUkoa2V5LCBzY29yZXMpe1xuICB2YXIgJGdyYXBoID0gJGdyYXBoTGlzdC5xdWVyeVNlbGVjdG9yKFwiI2dyYXBoLVwiICsga2V5KTtcbiAgdmFyICRuZXdHcmFwaCA9IHN0cmluZ1RvSFRNTCgkZ3JhcGhUZW1wbGF0ZS5pbm5lckhUTUwpO1xuICAkbmV3R3JhcGguaWQgPSBcImdyYXBoLVwiICsga2V5O1xuICBpZigkZ3JhcGgpe1xuICAgICRncmFwaExpc3QucmVwbGFjZUNoaWxkKCRncmFwaCwgJG5ld0dyYXBoKTtcbiAgfSBlbHNlIHtcbiAgICAkZ3JhcGhMaXN0LmFwcGVuZENoaWxkKCRuZXdHcmFwaCk7XG4gIH1cbiAgY29uc29sZS5sb2coJG5ld0dyYXBoKTtcbiAgdmFyIHNjYXR0ZXJQbG90RWxlbSA9ICRuZXdHcmFwaC5xdWVyeVNlbGVjdG9yKFwiLnNjYXR0ZXJwbG90XCIpO1xuICBzY2F0dGVyUGxvdEVsZW0uaWQgPSBcImdyYXBoLVwiICsga2V5ICsgXCItc2NhdHRlclwiO1xuICBncmFwaFN0YXRlW2tleV0gPSBwbG90X2dyYXBocyhcbiAgICAkbmV3R3JhcGgucXVlcnlTZWxlY3RvcihcIi5ncmFwaGNhbnZhc1wiKSxcbiAgICAkbmV3R3JhcGgucXVlcnlTZWxlY3RvcihcIi50b3BzY29yZXNcIiksXG4gICAgc2NhdHRlclBsb3RFbGVtLFxuICAgIGdyYXBoU3RhdGVba2V5XSxcbiAgICBzY29yZXMsXG4gICAge31cbiAgKTtcbn1cblxudmFyIGdlbmVyYXRpb25Db25maWcgPSByZXF1aXJlKFwiLi9nZW5lcmF0aW9uLWNvbmZpZ1wiKTtcblxudmFyIGJveDJkZnBzID0gNjA7XG52YXIgbWF4X2Nhcl9oZWFsdGggPSBib3gyZGZwcyAqIDEwO1xuXG52YXIgd29ybGRfZGVmID0ge1xuICBncmF2aXR5OiBuZXcgYjJWZWMyKDAuMCwgLTkuODEpLFxuICBkb1NsZWVwOiB0cnVlLFxuICBmbG9vcnNlZWQ6IGJ0b2EoTWF0aC5zZWVkcmFuZG9tKCkpLFxuICB0aWxlRGltZW5zaW9uczogbmV3IGIyVmVjMigxLjUsIDAuMDMpLFxuICBtYXhGbG9vclRpbGVzOiAyMDAsXG4gIG11dGFibGVfZmxvb3I6IGZhbHNlLFxuICBib3gyZGZwczogYm94MmRmcHMsXG4gIG1vdG9yU3BlZWQ6IDIwLFxuICBtYXhfY2FyX2hlYWx0aDogbWF4X2Nhcl9oZWFsdGgsXG4gIHNjaGVtYTogZ2VuZXJhdGlvbkNvbmZpZy5jb25zdGFudHMuc2NoZW1hXG59XG5cbnZhciBtYW5hZ2VSb3VuZCA9IHtcbiAgZ2VuZXRpYzogcmVxdWlyZShcIi4vbWFjaGluZS1sZWFybmluZy9nZW5ldGljLWFsZ29yaXRobS9tYW5hZ2Utcm91bmQuanNcIiksXG4gIGFubmVhbGluZzogcmVxdWlyZShcIi4vbWFjaGluZS1sZWFybmluZy9zaW11bGF0ZWQtYW5uZWFsaW5nL21hbmFnZS1yb3VuZC5qc1wiKSxcbn07XG5cbnZhciBjcmVhdGVMaXN0ZW5lcnMgPSBmdW5jdGlvbihrZXkpe1xuICByZXR1cm4ge1xuICAgIHByZUNhclN0ZXA6IGZ1bmN0aW9uKCl7fSxcbiAgICBjYXJTdGVwOiBmdW5jdGlvbigpe30sXG4gICAgY2FyRGVhdGg6IGZ1bmN0aW9uKGNhckluZm8pe1xuICAgICAgY2FySW5mby5zY29yZS5pID0gc3RhdGVzW2tleV0uY291bnRlcjtcbiAgICB9LFxuICAgIGdlbmVyYXRpb25FbmQ6IGZ1bmN0aW9uKHJlc3VsdHMpe1xuICAgICAgaGFuZGxlUm91bmRFbmQoa2V5LCByZXN1bHRzKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGlvblplcm8oKXtcbiAgdmFyIG9iaiA9IE9iamVjdC5rZXlzKG1hbmFnZVJvdW5kKS5yZWR1Y2UoZnVuY3Rpb24ob2JqLCBrZXkpe1xuICAgIG9iai5zdGF0ZXNba2V5XSA9IG1hbmFnZVJvdW5kW2tleV0uZ2VuZXJhdGlvblplcm8oZ2VuZXJhdGlvbkNvbmZpZygpKTtcbiAgICBvYmoucnVubmVyc1trZXldID0gd29ybGRSdW4oXG4gICAgICB3b3JsZF9kZWYsIG9iai5zdGF0ZXNba2V5XS5nZW5lcmF0aW9uLCBjcmVhdGVMaXN0ZW5lcnMoa2V5KVxuICAgICk7XG4gICAgb2JqLnJlc3VsdHNba2V5XSA9IFtdO1xuICAgIGdyYXBoU3RhdGVba2V5XSA9IHt9XG4gICAgcmV0dXJuIG9iajtcbiAgfSwge3N0YXRlczoge30sIHJ1bm5lcnM6IHt9LCByZXN1bHRzOiB7fX0pO1xuICBzdGF0ZXMgPSBvYmouc3RhdGVzO1xuICBydW5uZXJzID0gb2JqLnJ1bm5lcnM7XG4gIHJlc3VsdHMgPSBvYmoucmVzdWx0cztcbn1cblxuZnVuY3Rpb24gaGFuZGxlUm91bmRFbmQoa2V5LCBzY29yZXMpe1xuICB2YXIgcHJldmlvdXNDb3VudGVyID0gc3RhdGVzW2tleV0uY291bnRlcjtcbiAgc3RhdGVzW2tleV0gPSBtYW5hZ2VSb3VuZFtrZXldLm5leHRHZW5lcmF0aW9uKFxuICAgIHN0YXRlc1trZXldLCBzY29yZXMsIGdlbmVyYXRpb25Db25maWcoKVxuICApO1xuICBydW5uZXJzW2tleV0gPSB3b3JsZFJ1bihcbiAgICB3b3JsZF9kZWYsIHN0YXRlc1trZXldLmdlbmVyYXRpb24sIGNyZWF0ZUxpc3RlbmVycyhrZXkpXG4gICk7XG4gIGlmKHN0YXRlc1trZXldLmNvdW50ZXIgPT09IHByZXZpb3VzQ291bnRlcil7XG4gICAgY29uc29sZS5sb2cocmVzdWx0cyk7XG4gICAgcmVzdWx0c1trZXldID0gcmVzdWx0c1trZXldLmNvbmNhdChzY29yZXMpO1xuICB9IGVsc2Uge1xuICAgIGhhbmRsZUdlbmVyYXRpb25FbmQoa2V5KTtcbiAgICByZXN1bHRzW2tleV0gPSBbXTtcbiAgfVxufVxuXG5mdW5jdGlvbiBydW5Sb3VuZCgpe1xuICB2YXIgdG9SdW4gPSBuZXcgTWFwKCk7XG4gIE9iamVjdC5rZXlzKHN0YXRlcykuZm9yRWFjaChmdW5jdGlvbihrZXkpeyB0b1J1bi5zZXQoa2V5LCBzdGF0ZXNba2V5XS5jb3VudGVyKSB9KTtcbiAgY29uc29sZS5sb2codG9SdW4pO1xuICB3aGlsZSh0b1J1bi5zaXplKXtcbiAgICBjb25zb2xlLmxvZyhcInJ1bm5pbmdcIik7XG4gICAgQXJyYXkuZnJvbSh0b1J1bi5rZXlzKCkpLmZvckVhY2goZnVuY3Rpb24oa2V5KXtcbiAgICAgIGlmKHN0YXRlc1trZXldLmNvdW50ZXIgPT09IHRvUnVuLmdldChrZXkpKXtcbiAgICAgICAgcnVubmVyc1trZXldLnN0ZXAoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRvUnVuLmRlbGV0ZShrZXkpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGhhbmRsZUdlbmVyYXRpb25FbmQoa2V5KXtcbiAgdmFyIHNjb3JlcyA9IHJlc3VsdHNba2V5XTtcbiAgc2NvcmVzLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICBpZiAoYS5zY29yZS52ID4gYi5zY29yZS52KSB7XG4gICAgICByZXR1cm4gLTFcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIDFcbiAgICB9XG4gIH0pXG4gIHVwZGF0ZVVJKGtleSwgc2NvcmVzKTtcbiAgcmVzdWx0c1trZXldID0gW107XG59XG5cbmZ1bmN0aW9uIGN3X3Jlc2V0UG9wdWxhdGlvblVJKCkge1xuICAkZ3JhcGhMaXN0LmlubmVySFRNTCA9IFwiXCI7XG59XG5cbmZ1bmN0aW9uIGN3X3Jlc2V0V29ybGQoKSB7XG4gIGN3X3Jlc2V0UG9wdWxhdGlvblVJKCk7XG4gIE1hdGguc2VlZHJhbmRvbSgpO1xuICBnZW5lcmF0aW9uWmVybygpO1xufVxuXG5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiI25ldy1wb3B1bGF0aW9uXCIpLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBmdW5jdGlvbigpe1xuICBjd19yZXNldFBvcHVsYXRpb25VSSgpXG4gIGdlbmVyYXRpb25aZXJvKCk7XG59KVxuXG5cbmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIjY29uZmlybS1yZXNldFwiKS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgZnVuY3Rpb24oKXtcbiAgY3dfY29uZmlybVJlc2V0V29ybGQoKVxufSlcblxuZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIiNmYXN0LWZvcndhcmRcIikuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGZ1bmN0aW9uKCl7XG4gIHJ1blJvdW5kKCk7XG59KVxuXG5mdW5jdGlvbiBjd19jb25maXJtUmVzZXRXb3JsZCgpIHtcbiAgaWYgKGNvbmZpcm0oJ1JlYWxseSByZXNldCB3b3JsZD8nKSkge1xuICAgIGN3X3Jlc2V0V29ybGQoKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuY3dfcmVzZXRXb3JsZCgpO1xuIiwibW9kdWxlLmV4cG9ydHM9e1xuICBcIndoZWVsQ291bnRcIjogMixcbiAgXCJ3aGVlbE1pblJhZGl1c1wiOiAwLjIsXG4gIFwid2hlZWxSYWRpdXNSYW5nZVwiOiAwLjUsXG4gIFwid2hlZWxNaW5EZW5zaXR5XCI6IDQwLFxuICBcIndoZWVsRGVuc2l0eVJhbmdlXCI6IDEwMCxcbiAgXCJ3aGVlbE1pbkZyaWN0aW9uRXhwb25lbnRcIjogLTIsXG4gIFwid2hlZWxGcmljdGlvbkV4cG9uZW50UmFuZ2VcIjogMyxcbiAgXCJjaGFzc2lzRGVuc2l0eVJhbmdlXCI6IDMwMCxcbiAgXCJjaGFzc2lzTWluRGVuc2l0eVwiOiAzMCxcbiAgXCJjaGFzc2lzTWluQXhpc1wiOiAwLjEsXG4gIFwiY2hhc3Npc0F4aXNSYW5nZVwiOiAxLjFcbn1cbiIsInZhciBjYXJDb25zdGFudHMgPSByZXF1aXJlKFwiLi9jYXItY29uc3RhbnRzLmpzb25cIik7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICB3b3JsZERlZjogd29ybGREZWYsXG4gIGNhckNvbnN0YW50czogZ2V0Q2FyQ29uc3RhbnRzLFxuICBnZW5lcmF0ZVNjaGVtYTogZ2VuZXJhdGVTY2hlbWFcbn1cblxuZnVuY3Rpb24gd29ybGREZWYoKXtcbiAgdmFyIGJveDJkZnBzID0gNjA7XG4gIHJldHVybiB7XG4gICAgZ3Jhdml0eTogeyB5OiAwIH0sXG4gICAgZG9TbGVlcDogdHJ1ZSxcbiAgICBmbG9vcnNlZWQ6IFwiYWJjXCIsXG4gICAgbWF4Rmxvb3JUaWxlczogMjAwLFxuICAgIG11dGFibGVfZmxvb3I6IGZhbHNlLFxuICAgIG1vdG9yU3BlZWQ6IDIwLFxuICAgIGJveDJkZnBzOiBib3gyZGZwcyxcbiAgICBtYXhfY2FyX2hlYWx0aDogYm94MmRmcHMgKiAxMCxcbiAgICB0aWxlRGltZW5zaW9uczoge1xuICAgICAgd2lkdGg6IDEuNSxcbiAgICAgIGhlaWdodDogMC4wM1xuICAgIH1cbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0Q2FyQ29uc3RhbnRzKCl7XG4gIHJldHVybiBjYXJDb25zdGFudHM7XG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRlU2NoZW1hKHZhbHVlcyl7XG4gIHJldHVybiB7XG4gICAgd2hlZWxfcmFkaXVzOiB7XG4gICAgICB0eXBlOiBcImZsb2F0XCIsXG4gICAgICBsZW5ndGg6IHZhbHVlcy53aGVlbENvdW50LFxuICAgICAgbWluOiB2YWx1ZXMud2hlZWxNaW5SYWRpdXMsXG4gICAgICByYW5nZTogdmFsdWVzLndoZWVsUmFkaXVzUmFuZ2UsXG4gICAgICBmYWN0b3I6IDEsXG4gICAgfSxcbiAgICB3aGVlbF9kZW5zaXR5OiB7XG4gICAgICB0eXBlOiBcImZsb2F0XCIsXG4gICAgICBsZW5ndGg6IHZhbHVlcy53aGVlbENvdW50LFxuICAgICAgbWluOiB2YWx1ZXMud2hlZWxNaW5EZW5zaXR5LFxuICAgICAgcmFuZ2U6IHZhbHVlcy53aGVlbERlbnNpdHlSYW5nZSxcbiAgICAgIGZhY3RvcjogMSxcbiAgICB9LFxuICAgIHdoZWVsX2ZyaWN0aW9uX2V4cG9uZW50OiB7XG4gICAgICB0eXBlOiBcImZsb2F0XCIsXG4gICAgICBsZW5ndGg6IHZhbHVlcy53aGVlbENvdW50LFxuICAgICAgbWluOiB2YWx1ZXMud2hlZWxNaW5GcmljdGlvbkV4cG9uZW50LFxuICAgICAgcmFuZ2U6IHZhbHVlcy53aGVlbEZyaWN0aW9uRXhwb25lbnRSYW5nZSxcbiAgICAgIGZhY3RvcjogMSxcbiAgICB9LFxuICAgIGNoYXNzaXNfZGVuc2l0eToge1xuICAgICAgdHlwZTogXCJmbG9hdFwiLFxuICAgICAgbGVuZ3RoOiAxLFxuICAgICAgbWluOiB2YWx1ZXMuY2hhc3Npc0RlbnNpdHlSYW5nZSxcbiAgICAgIHJhbmdlOiB2YWx1ZXMuY2hhc3Npc01pbkRlbnNpdHksXG4gICAgICBmYWN0b3I6IDEsXG4gICAgfSxcbiAgICB2ZXJ0ZXhfbGlzdDoge1xuICAgICAgdHlwZTogXCJmbG9hdFwiLFxuICAgICAgbGVuZ3RoOiAxMixcbiAgICAgIG1pbjogdmFsdWVzLmNoYXNzaXNNaW5BeGlzLFxuICAgICAgcmFuZ2U6IHZhbHVlcy5jaGFzc2lzQXhpc1JhbmdlLFxuICAgICAgZmFjdG9yOiAxLFxuICAgIH0sXG4gICAgd2hlZWxfdmVydGV4OiB7XG4gICAgICB0eXBlOiBcInNodWZmbGVcIixcbiAgICAgIGxlbmd0aDogOCxcbiAgICAgIGxpbWl0OiB2YWx1ZXMud2hlZWxDb3VudCxcbiAgICAgIGZhY3RvcjogMSxcbiAgICB9LFxuICB9O1xufVxuIiwiLypcbiAgZ2xvYmFscyBiMlJldm9sdXRlSm9pbnREZWYgYjJWZWMyIGIyQm9keURlZiBiMkJvZHkgYjJGaXh0dXJlRGVmIGIyUG9seWdvblNoYXBlIGIyQ2lyY2xlU2hhcGVcbiovXG5cbnZhciBjcmVhdGVJbnN0YW5jZSA9IHJlcXVpcmUoXCIuLi9tYWNoaW5lLWxlYXJuaW5nL2NyZWF0ZS1pbnN0YW5jZVwiKTtcblxubW9kdWxlLmV4cG9ydHMgPSBkZWZUb0NhcjtcblxuZnVuY3Rpb24gZGVmVG9DYXIobm9ybWFsX2RlZiwgd29ybGQsIGNvbnN0YW50cyl7XG4gIHZhciBjYXJfZGVmID0gY3JlYXRlSW5zdGFuY2UuYXBwbHlUeXBlcyhjb25zdGFudHMuc2NoZW1hLCBub3JtYWxfZGVmKVxuICB2YXIgaW5zdGFuY2UgPSB7fTtcbiAgaW5zdGFuY2UuY2hhc3NpcyA9IGNyZWF0ZUNoYXNzaXMoXG4gICAgd29ybGQsIGNhcl9kZWYudmVydGV4X2xpc3QsIGNhcl9kZWYuY2hhc3Npc19kZW5zaXR5XG4gICk7XG5cbiAgLy8gS2VlcCB0cmFjayBvZiB0aGUgbG93ZXN0IHBvaW50IHNvIHRoYXQgd2UgY2FuIHBsYWNlIHRoZSBjYXIgb24gdGhlIGdyb3VuZFxuICB2YXIgcmVsYXRpdmVCb3R0b20gPSAxMDA7XG4gIC8vIExvb3AgdGhyb3VnaCB0aGUgdmVydGljZXMgb2YgdGhlIGNoYXNzaXMgdG8gZmluZCB0aGUgbG93ZXN0IHBvaW50XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgaW5zdGFuY2UuY2hhc3Npcy52ZXJ0ZXhfbGlzdC5sZW5ndGg7IGkrKykge1xuICAgIGlmIChpbnN0YW5jZS5jaGFzc2lzLnZlcnRleF9saXN0W2ldLnkgPCByZWxhdGl2ZUJvdHRvbSkge1xuICAgICAgcmVsYXRpdmVCb3R0b20gPSBpbnN0YW5jZS5jaGFzc2lzLnZlcnRleF9saXN0W2ldLnk7XG4gICAgfVxuICB9XG5cbiAgdmFyIGk7XG5cbiAgdmFyIHdoZWVsQ291bnQgPSBjYXJfZGVmLndoZWVsX3JhZGl1cy5sZW5ndGg7XG5cbiAgaW5zdGFuY2Uud2hlZWxzID0gW107XG4gIGZvciAoaSA9IDA7IGkgPCB3aGVlbENvdW50OyBpKyspIHtcbiAgICBpbnN0YW5jZS53aGVlbHNbaV0gPSBjcmVhdGVXaGVlbChcbiAgICAgIHdvcmxkLFxuICAgICAgY2FyX2RlZi53aGVlbF9yYWRpdXNbaV0sXG4gICAgICBjYXJfZGVmLndoZWVsX2RlbnNpdHlbaV0sXG4gICAgICBjYXJfZGVmLndoZWVsX2ZyaWN0aW9uX2V4cG9uZW50W2ldXG4gICAgKTtcbiAgfVxuXG4gIHZhciBjYXJtYXNzID0gaW5zdGFuY2UuY2hhc3Npcy5HZXRNYXNzKCk7XG4gIGZvciAoaSA9IDA7IGkgPCB3aGVlbENvdW50OyBpKyspIHtcbiAgICBjYXJtYXNzICs9IGluc3RhbmNlLndoZWVsc1tpXS5HZXRNYXNzKCk7XG4gIH1cblxuICB2YXIgam9pbnRfZGVmID0gbmV3IGIyUmV2b2x1dGVKb2ludERlZigpO1xuXG4gIGZvciAoaSA9IDA7IGkgPCB3aGVlbENvdW50OyBpKyspIHtcbiAgICB2YXIgdG9ycXVlID0gY2FybWFzcyAqIC1jb25zdGFudHMuZ3Jhdml0eS55IC8gY2FyX2RlZi53aGVlbF9yYWRpdXNbaV07XG5cbiAgICB2YXIgcmFuZHZlcnRleCA9IGluc3RhbmNlLmNoYXNzaXMudmVydGV4X2xpc3RbY2FyX2RlZi53aGVlbF92ZXJ0ZXhbaV1dO1xuXG4gICAgLy8gS2VlcCB0cmFjayBvZiB0aGUgbG93ZXN0IHBvaW50IG9mIHRoZSB3aGVlbHMuXG4gICAgdmFyIHJlbGF0aXZlV2hlZWxCb3R0b20gPSByYW5kdmVydGV4LnkgLSBjYXJfZGVmLndoZWVsX3JhZGl1c1tpXTtcbiAgICBpZiAocmVsYXRpdmVXaGVlbEJvdHRvbSA8IHJlbGF0aXZlQm90dG9tKSB7XG4gICAgICByZWxhdGl2ZUJvdHRvbSA9IHJlbGF0aXZlV2hlZWxCb3R0b207XG4gICAgfVxuXG4gICAgam9pbnRfZGVmLmxvY2FsQW5jaG9yQS5TZXQocmFuZHZlcnRleC54LCByYW5kdmVydGV4LnkpO1xuICAgIGpvaW50X2RlZi5sb2NhbEFuY2hvckIuU2V0KDAsIDApO1xuICAgIGpvaW50X2RlZi5tYXhNb3RvclRvcnF1ZSA9IHRvcnF1ZTtcbiAgICBqb2ludF9kZWYubW90b3JTcGVlZCA9IC1jb25zdGFudHMubW90b3JTcGVlZDtcbiAgICBqb2ludF9kZWYuZW5hYmxlTW90b3IgPSB0cnVlO1xuICAgIGpvaW50X2RlZi5ib2R5QSA9IGluc3RhbmNlLmNoYXNzaXM7XG4gICAgam9pbnRfZGVmLmJvZHlCID0gaW5zdGFuY2Uud2hlZWxzW2ldO1xuICAgIHdvcmxkLkNyZWF0ZUpvaW50KGpvaW50X2RlZik7XG4gIH1cblxuICAvLyBTZXQgdGhlIGNhciBvbiB0aGUgZ3JvdW5kIGJ5IHNldHRpbmcgdGhlIHBvc2l0aW9uIG9mIHRoZSBjaGFzc2lzIGFuZCB0aGVuIHBvc2l0aW9uaW5nIHRoZSB3aGVlbHMgd2hlcmUgdGhlcmUgYXJlIGFscmVhZHkgYXR0YWNoZWQuIElmIEkgZG9uJ3QgZG8gdGhpcyB0aGFuIHRoZSBwaHlzaWNzIHlhbmtzIHRoZSBqb2ludHMgdG9nZXRoZXIgc28gaGFyZCB0aGF0IGl0IGNhbiBzZW5kIHRoZSBjYXIgc3Bpbm5pbmcgb3IgbWFrZSBpdCBlbnRlciB0aGUgZ3JvdW5kLlxuICB2YXIgcG9zaXRpb24gPSBpbnN0YW5jZS5jaGFzc2lzLkdldFBvc2l0aW9uKCk7XG4gIGluc3RhbmNlLmNoYXNzaXMuU2V0UG9zaXRpb24oe3g6IHBvc2l0aW9uLngsIHk6IC0gcmVsYXRpdmVCb3R0b20gKyB3b3JsZC5zdGFydEhlaWdodH0pO1xuICBmb3IgKGkgPSAwOyBpIDwgd2hlZWxDb3VudDsgaSsrKSB7XG4gICAgdmFyIHJhbmR2ZXJ0ZXggPSBpbnN0YW5jZS5jaGFzc2lzLnZlcnRleF9saXN0W2Nhcl9kZWYud2hlZWxfdmVydGV4W2ldXTtcbiAgICBpbnN0YW5jZS53aGVlbHNbaV0uU2V0UG9zaXRpb24oaW5zdGFuY2UuY2hhc3Npcy5HZXRXb3JsZFBvaW50KHJhbmR2ZXJ0ZXgpKTtcbiAgfVxuXG4gIHJldHVybiBpbnN0YW5jZTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlQ2hhc3Npcyh3b3JsZCwgdmVydGV4cywgZGVuc2l0eSkge1xuXG4gIHZhciB2ZXJ0ZXhfbGlzdCA9IG5ldyBBcnJheSgpO1xuICB2ZXJ0ZXhfbGlzdC5wdXNoKG5ldyBiMlZlYzIodmVydGV4c1swXSwgMCkpO1xuICB2ZXJ0ZXhfbGlzdC5wdXNoKG5ldyBiMlZlYzIodmVydGV4c1sxXSwgdmVydGV4c1syXSkpO1xuICB2ZXJ0ZXhfbGlzdC5wdXNoKG5ldyBiMlZlYzIoMCwgdmVydGV4c1szXSkpO1xuICB2ZXJ0ZXhfbGlzdC5wdXNoKG5ldyBiMlZlYzIoLXZlcnRleHNbNF0sIHZlcnRleHNbNV0pKTtcbiAgdmVydGV4X2xpc3QucHVzaChuZXcgYjJWZWMyKC12ZXJ0ZXhzWzZdLCAwKSk7XG4gIHZlcnRleF9saXN0LnB1c2gobmV3IGIyVmVjMigtdmVydGV4c1s3XSwgLXZlcnRleHNbOF0pKTtcbiAgdmVydGV4X2xpc3QucHVzaChuZXcgYjJWZWMyKDAsIC12ZXJ0ZXhzWzldKSk7XG4gIHZlcnRleF9saXN0LnB1c2gobmV3IGIyVmVjMih2ZXJ0ZXhzWzEwXSwgLXZlcnRleHNbMTFdKSk7XG5cbiAgdmFyIGJvZHlfZGVmID0gbmV3IGIyQm9keURlZigpO1xuICBib2R5X2RlZi50eXBlID0gYjJCb2R5LmIyX2R5bmFtaWNCb2R5O1xuICBib2R5X2RlZi5wb3NpdGlvbi5TZXQoMC4wLCA0LjApO1xuXG4gIHZhciBib2R5ID0gd29ybGQuQ3JlYXRlQm9keShib2R5X2RlZik7XG5cbiAgY3JlYXRlQ2hhc3Npc1BhcnQoYm9keSwgdmVydGV4X2xpc3RbMF0sIHZlcnRleF9saXN0WzFdLCBkZW5zaXR5KTtcbiAgY3JlYXRlQ2hhc3Npc1BhcnQoYm9keSwgdmVydGV4X2xpc3RbMV0sIHZlcnRleF9saXN0WzJdLCBkZW5zaXR5KTtcbiAgY3JlYXRlQ2hhc3Npc1BhcnQoYm9keSwgdmVydGV4X2xpc3RbMl0sIHZlcnRleF9saXN0WzNdLCBkZW5zaXR5KTtcbiAgY3JlYXRlQ2hhc3Npc1BhcnQoYm9keSwgdmVydGV4X2xpc3RbM10sIHZlcnRleF9saXN0WzRdLCBkZW5zaXR5KTtcbiAgY3JlYXRlQ2hhc3Npc1BhcnQoYm9keSwgdmVydGV4X2xpc3RbNF0sIHZlcnRleF9saXN0WzVdLCBkZW5zaXR5KTtcbiAgY3JlYXRlQ2hhc3Npc1BhcnQoYm9keSwgdmVydGV4X2xpc3RbNV0sIHZlcnRleF9saXN0WzZdLCBkZW5zaXR5KTtcbiAgY3JlYXRlQ2hhc3Npc1BhcnQoYm9keSwgdmVydGV4X2xpc3RbNl0sIHZlcnRleF9saXN0WzddLCBkZW5zaXR5KTtcbiAgY3JlYXRlQ2hhc3Npc1BhcnQoYm9keSwgdmVydGV4X2xpc3RbN10sIHZlcnRleF9saXN0WzBdLCBkZW5zaXR5KTtcblxuICBib2R5LnZlcnRleF9saXN0ID0gdmVydGV4X2xpc3Q7XG5cbiAgcmV0dXJuIGJvZHk7XG59XG5cblxuZnVuY3Rpb24gY3JlYXRlQ2hhc3Npc1BhcnQoYm9keSwgdmVydGV4MSwgdmVydGV4MiwgZGVuc2l0eSkge1xuICB2YXIgdmVydGV4X2xpc3QgPSBuZXcgQXJyYXkoKTtcbiAgdmVydGV4X2xpc3QucHVzaCh2ZXJ0ZXgxKTtcbiAgdmVydGV4X2xpc3QucHVzaCh2ZXJ0ZXgyKTtcbiAgdmVydGV4X2xpc3QucHVzaChiMlZlYzIuTWFrZSgwLCAwKSk7XG4gIHZhciBmaXhfZGVmID0gbmV3IGIyRml4dHVyZURlZigpO1xuICBmaXhfZGVmLnNoYXBlID0gbmV3IGIyUG9seWdvblNoYXBlKCk7XG4gIGZpeF9kZWYuZGVuc2l0eSA9IGRlbnNpdHk7XG4gIGZpeF9kZWYuZnJpY3Rpb24gPSAxMDtcbiAgZml4X2RlZi5yZXN0aXR1dGlvbiA9IDAuMjtcbiAgZml4X2RlZi5maWx0ZXIuZ3JvdXBJbmRleCA9IC0xO1xuICBmaXhfZGVmLnNoYXBlLlNldEFzQXJyYXkodmVydGV4X2xpc3QsIDMpO1xuXG4gIGJvZHkuQ3JlYXRlRml4dHVyZShmaXhfZGVmKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlV2hlZWwod29ybGQsIHJhZGl1cywgZGVuc2l0eSwgZnJpY3Rpb25fZXhwb25lbnQpIHtcbiAgdmFyIGJvZHlfZGVmID0gbmV3IGIyQm9keURlZigpO1xuICBib2R5X2RlZi50eXBlID0gYjJCb2R5LmIyX2R5bmFtaWNCb2R5O1xuICBib2R5X2RlZi5wb3NpdGlvbi5TZXQoMCwgMCk7XG5cbiAgdmFyIGJvZHkgPSB3b3JsZC5DcmVhdGVCb2R5KGJvZHlfZGVmKTtcblxuICB2YXIgZml4X2RlZiA9IG5ldyBiMkZpeHR1cmVEZWYoKTtcbiAgZml4X2RlZi5zaGFwZSA9IG5ldyBiMkNpcmNsZVNoYXBlKHJhZGl1cyk7XG4gIGZpeF9kZWYuZGVuc2l0eSA9IGRlbnNpdHk7XG4gIGZpeF9kZWYuZnJpY3Rpb24gPSBNYXRoLnBvdygxMCwgZnJpY3Rpb25fZXhwb25lbnQpO1xuICBmaXhfZGVmLnJlc3RpdHV0aW9uID0gMC4yO1xuICBmaXhfZGVmLmZpbHRlci5ncm91cEluZGV4ID0gLTE7XG5cbiAgYm9keS5DcmVhdGVGaXh0dXJlKGZpeF9kZWYpO1xuICByZXR1cm4gYm9keTtcbn1cbiIsIlxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgZ2V0SW5pdGlhbFN0YXRlOiBnZXRJbml0aWFsU3RhdGUsXG4gIHVwZGF0ZVN0YXRlOiB1cGRhdGVTdGF0ZSxcbiAgZ2V0U3RhdHVzOiBnZXRTdGF0dXMsXG4gIGNhbGN1bGF0ZVNjb3JlOiBjYWxjdWxhdGVTY29yZSxcbn07XG5cbmZ1bmN0aW9uIGdldEluaXRpYWxTdGF0ZSh3b3JsZF9kZWYpe1xuICByZXR1cm4ge1xuICAgIGZyYW1lczogMCxcbiAgICBoZWFsdGg6IHdvcmxkX2RlZi5tYXhfY2FyX2hlYWx0aCxcbiAgICBtYXhQb3NpdGlvbnk6IDAsXG4gICAgbWluUG9zaXRpb255OiAwLFxuICAgIG1heFBvc2l0aW9ueDogMCxcbiAgfTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlU3RhdGUoY29uc3RhbnRzLCB3b3JsZENvbnN0cnVjdCwgc3RhdGUpe1xuICBpZihzdGF0ZS5oZWFsdGggPD0gMCl7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiQWxyZWFkeSBEZWFkXCIpO1xuICB9XG4gIGlmKHN0YXRlLm1heFBvc2l0aW9ueCA+IGNvbnN0YW50cy5maW5pc2hMaW5lKXtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJhbHJlYWR5IEZpbmlzaGVkXCIpO1xuICB9XG5cbiAgLy8gY29uc29sZS5sb2coc3RhdGUpO1xuICAvLyBjaGVjayBoZWFsdGhcbiAgdmFyIHBvc2l0aW9uID0gd29ybGRDb25zdHJ1Y3QuY2hhc3Npcy5HZXRQb3NpdGlvbigpO1xuICAvLyBjaGVjayBpZiBjYXIgcmVhY2hlZCBlbmQgb2YgdGhlIHBhdGhcbiAgdmFyIG5leHRTdGF0ZSA9IHtcbiAgICBmcmFtZXM6IHN0YXRlLmZyYW1lcyArIDEsXG4gICAgbWF4UG9zaXRpb254OiBwb3NpdGlvbi54ID4gc3RhdGUubWF4UG9zaXRpb254ID8gcG9zaXRpb24ueCA6IHN0YXRlLm1heFBvc2l0aW9ueCxcbiAgICBtYXhQb3NpdGlvbnk6IHBvc2l0aW9uLnkgPiBzdGF0ZS5tYXhQb3NpdGlvbnkgPyBwb3NpdGlvbi55IDogc3RhdGUubWF4UG9zaXRpb255LFxuICAgIG1pblBvc2l0aW9ueTogcG9zaXRpb24ueSA8IHN0YXRlLm1pblBvc2l0aW9ueSA/IHBvc2l0aW9uLnkgOiBzdGF0ZS5taW5Qb3NpdGlvbnlcbiAgfTtcblxuICBpZiAocG9zaXRpb24ueCA+IGNvbnN0YW50cy5maW5pc2hMaW5lKSB7XG4gICAgcmV0dXJuIG5leHRTdGF0ZTtcbiAgfVxuXG4gIGlmIChwb3NpdGlvbi54ID4gc3RhdGUubWF4UG9zaXRpb254ICsgMC4wMDEpIHtcbiAgICBuZXh0U3RhdGUuaGVhbHRoID0gY29uc3RhbnRzLm1heF9jYXJfaGVhbHRoO1xuICAgIHJldHVybiBuZXh0U3RhdGU7XG4gIH1cbiAgbmV4dFN0YXRlLmhlYWx0aCA9IHN0YXRlLmhlYWx0aCAtIDAuMTtcbiAgaWYgKE1hdGguYWJzKHdvcmxkQ29uc3RydWN0LmNoYXNzaXMuR2V0TGluZWFyVmVsb2NpdHkoKS54KSA8IDAuMDAxKSB7XG4gICAgbmV4dFN0YXRlLmhlYWx0aCAtPSA1O1xuICB9XG4gIHJldHVybiBuZXh0U3RhdGU7XG59XG5cbmZ1bmN0aW9uIGdldFN0YXR1cyhzdGF0ZSwgY29uc3RhbnRzKXtcbiAgaWYoaGFzRmFpbGVkKHN0YXRlLCBjb25zdGFudHMpKSByZXR1cm4gLTE7XG4gIGlmKGhhc1N1Y2Nlc3Moc3RhdGUsIGNvbnN0YW50cykpIHJldHVybiAxO1xuICByZXR1cm4gMDtcbn1cblxuZnVuY3Rpb24gaGFzRmFpbGVkKHN0YXRlIC8qLCBjb25zdGFudHMgKi8pe1xuICByZXR1cm4gc3RhdGUuaGVhbHRoIDw9IDA7XG59XG5mdW5jdGlvbiBoYXNTdWNjZXNzKHN0YXRlLCBjb25zdGFudHMpe1xuICByZXR1cm4gc3RhdGUubWF4UG9zaXRpb254ID4gY29uc3RhbnRzLmZpbmlzaExpbmU7XG59XG5cbmZ1bmN0aW9uIGNhbGN1bGF0ZVNjb3JlKHN0YXRlLCBjb25zdGFudHMpe1xuICB2YXIgYXZnc3BlZWQgPSAoc3RhdGUubWF4UG9zaXRpb254IC8gc3RhdGUuZnJhbWVzKSAqIGNvbnN0YW50cy5ib3gyZGZwcztcbiAgdmFyIHBvc2l0aW9uID0gc3RhdGUubWF4UG9zaXRpb254O1xuICB2YXIgc2NvcmUgPSBwb3NpdGlvbiArIGF2Z3NwZWVkO1xuICByZXR1cm4ge1xuICAgIHY6IHNjb3JlLFxuICAgIHM6IGF2Z3NwZWVkLFxuICAgIHg6IHBvc2l0aW9uLFxuICAgIHk6IHN0YXRlLm1heFBvc2l0aW9ueSxcbiAgICB5Mjogc3RhdGUubWluUG9zaXRpb255XG4gIH1cbn1cbiIsInZhciBzY2F0dGVyUGxvdCA9IHJlcXVpcmUoXCIuL3NjYXR0ZXItcGxvdFwiKTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIHBsb3RHcmFwaHM6IGZ1bmN0aW9uKGdyYXBoRWxlbSwgdG9wU2NvcmVzRWxlbSwgc2NhdHRlclBsb3RFbGVtLCBsYXN0U3RhdGUsIHNjb3JlcywgY29uZmlnKSB7XG4gICAgbGFzdFN0YXRlID0gbGFzdFN0YXRlIHx8IHt9O1xuICAgIHZhciBnZW5lcmF0aW9uU2l6ZSA9IHNjb3Jlcy5sZW5ndGhcbiAgICB2YXIgZ3JhcGhjYW52YXMgPSBncmFwaEVsZW07XG4gICAgdmFyIGdyYXBoY3R4ID0gZ3JhcGhjYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpO1xuICAgIHZhciBncmFwaHdpZHRoID0gNDAwO1xuICAgIHZhciBncmFwaGhlaWdodCA9IDI1MDtcbiAgICB2YXIgbmV4dFN0YXRlID0gY3dfc3RvcmVHcmFwaFNjb3JlcyhcbiAgICAgIGxhc3RTdGF0ZSwgc2NvcmVzLCBnZW5lcmF0aW9uU2l6ZVxuICAgICk7XG4gICAgY29uc29sZS5sb2coc2NvcmVzLCBuZXh0U3RhdGUpO1xuICAgIGN3X2NsZWFyR3JhcGhpY3MoZ3JhcGhjYW52YXMsIGdyYXBoY3R4LCBncmFwaHdpZHRoLCBncmFwaGhlaWdodCk7XG4gICAgY3dfcGxvdEF2ZXJhZ2UobmV4dFN0YXRlLCBncmFwaGN0eCk7XG4gICAgY3dfcGxvdEVsaXRlKG5leHRTdGF0ZSwgZ3JhcGhjdHgpO1xuICAgIGN3X3Bsb3RUb3AobmV4dFN0YXRlLCBncmFwaGN0eCk7XG4gICAgY3dfbGlzdFRvcFNjb3Jlcyh0b3BTY29yZXNFbGVtLCBuZXh0U3RhdGUpO1xuICAgIG5leHRTdGF0ZS5zY2F0dGVyR3JhcGggPSBkcmF3QWxsUmVzdWx0cyhcbiAgICAgIHNjYXR0ZXJQbG90RWxlbSwgY29uZmlnLCBuZXh0U3RhdGUsIGxhc3RTdGF0ZS5zY2F0dGVyR3JhcGhcbiAgICApO1xuICAgIHJldHVybiBuZXh0U3RhdGU7XG4gIH0sXG4gIGNsZWFyR3JhcGhpY3M6IGZ1bmN0aW9uKGdyYXBoRWxlbSkge1xuICAgIHZhciBncmFwaGNhbnZhcyA9IGdyYXBoRWxlbTtcbiAgICB2YXIgZ3JhcGhjdHggPSBncmFwaGNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIik7XG4gICAgdmFyIGdyYXBod2lkdGggPSA0MDA7XG4gICAgdmFyIGdyYXBoaGVpZ2h0ID0gMjUwO1xuICAgIGN3X2NsZWFyR3JhcGhpY3MoZ3JhcGhjYW52YXMsIGdyYXBoY3R4LCBncmFwaHdpZHRoLCBncmFwaGhlaWdodCk7XG4gIH1cbn07XG5cblxuZnVuY3Rpb24gY3dfc3RvcmVHcmFwaFNjb3JlcyhsYXN0U3RhdGUsIGN3X2NhclNjb3JlcywgZ2VuZXJhdGlvblNpemUpIHtcbiAgY29uc29sZS5sb2coY3dfY2FyU2NvcmVzKTtcbiAgcmV0dXJuIHtcbiAgICBjd190b3BTY29yZXM6IChsYXN0U3RhdGUuY3dfdG9wU2NvcmVzIHx8IFtdKVxuICAgIC5jb25jYXQoW2N3X2NhclNjb3Jlc1swXS5zY29yZV0pLFxuICAgIGN3X2dyYXBoQXZlcmFnZTogKGxhc3RTdGF0ZS5jd19ncmFwaEF2ZXJhZ2UgfHwgW10pLmNvbmNhdChbXG4gICAgICBjd19hdmVyYWdlKGN3X2NhclNjb3JlcywgZ2VuZXJhdGlvblNpemUpXG4gICAgXSksXG4gICAgY3dfZ3JhcGhFbGl0ZTogKGxhc3RTdGF0ZS5jd19ncmFwaEVsaXRlIHx8IFtdKS5jb25jYXQoW1xuICAgICAgY3dfZWxpdGVhdmVyYWdlKGN3X2NhclNjb3JlcywgZ2VuZXJhdGlvblNpemUpXG4gICAgXSksXG4gICAgY3dfZ3JhcGhUb3A6IChsYXN0U3RhdGUuY3dfZ3JhcGhUb3AgfHwgW10pLmNvbmNhdChbXG4gICAgICBjd19jYXJTY29yZXNbMF0uc2NvcmUudlxuICAgIF0pLFxuICAgIGFsbFJlc3VsdHM6IChsYXN0U3RhdGUuYWxsUmVzdWx0cyB8fCBbXSkuY29uY2F0KGN3X2NhclNjb3JlcyksXG4gIH1cbn1cblxuZnVuY3Rpb24gY3dfcGxvdFRvcChzdGF0ZSwgZ3JhcGhjdHgpIHtcbiAgdmFyIGN3X2dyYXBoVG9wID0gc3RhdGUuY3dfZ3JhcGhUb3A7XG4gIHZhciBncmFwaHNpemUgPSBjd19ncmFwaFRvcC5sZW5ndGg7XG4gIGdyYXBoY3R4LnN0cm9rZVN0eWxlID0gXCIjQzgzQjNCXCI7XG4gIGdyYXBoY3R4LmJlZ2luUGF0aCgpO1xuICBncmFwaGN0eC5tb3ZlVG8oMCwgMCk7XG4gIGZvciAodmFyIGsgPSAwOyBrIDwgZ3JhcGhzaXplOyBrKyspIHtcbiAgICBncmFwaGN0eC5saW5lVG8oNDAwICogKGsgKyAxKSAvIGdyYXBoc2l6ZSwgY3dfZ3JhcGhUb3Bba10pO1xuICB9XG4gIGdyYXBoY3R4LnN0cm9rZSgpO1xufVxuXG5mdW5jdGlvbiBjd19wbG90RWxpdGUoc3RhdGUsIGdyYXBoY3R4KSB7XG4gIHZhciBjd19ncmFwaEVsaXRlID0gc3RhdGUuY3dfZ3JhcGhFbGl0ZTtcbiAgdmFyIGdyYXBoc2l6ZSA9IGN3X2dyYXBoRWxpdGUubGVuZ3RoO1xuICBncmFwaGN0eC5zdHJva2VTdHlsZSA9IFwiIzdCQzc0RFwiO1xuICBncmFwaGN0eC5iZWdpblBhdGgoKTtcbiAgZ3JhcGhjdHgubW92ZVRvKDAsIDApO1xuICBmb3IgKHZhciBrID0gMDsgayA8IGdyYXBoc2l6ZTsgaysrKSB7XG4gICAgZ3JhcGhjdHgubGluZVRvKDQwMCAqIChrICsgMSkgLyBncmFwaHNpemUsIGN3X2dyYXBoRWxpdGVba10pO1xuICB9XG4gIGdyYXBoY3R4LnN0cm9rZSgpO1xufVxuXG5mdW5jdGlvbiBjd19wbG90QXZlcmFnZShzdGF0ZSwgZ3JhcGhjdHgpIHtcbiAgdmFyIGN3X2dyYXBoQXZlcmFnZSA9IHN0YXRlLmN3X2dyYXBoQXZlcmFnZTtcbiAgdmFyIGdyYXBoc2l6ZSA9IGN3X2dyYXBoQXZlcmFnZS5sZW5ndGg7XG4gIGdyYXBoY3R4LnN0cm9rZVN0eWxlID0gXCIjM0Y3MkFGXCI7XG4gIGdyYXBoY3R4LmJlZ2luUGF0aCgpO1xuICBncmFwaGN0eC5tb3ZlVG8oMCwgMCk7XG4gIGZvciAodmFyIGsgPSAwOyBrIDwgZ3JhcGhzaXplOyBrKyspIHtcbiAgICBncmFwaGN0eC5saW5lVG8oNDAwICogKGsgKyAxKSAvIGdyYXBoc2l6ZSwgY3dfZ3JhcGhBdmVyYWdlW2tdKTtcbiAgfVxuICBncmFwaGN0eC5zdHJva2UoKTtcbn1cblxuXG5mdW5jdGlvbiBjd19lbGl0ZWF2ZXJhZ2Uoc2NvcmVzLCBnZW5lcmF0aW9uU2l6ZSkge1xuICB2YXIgc3VtID0gMDtcbiAgZm9yICh2YXIgayA9IDA7IGsgPCBNYXRoLmZsb29yKGdlbmVyYXRpb25TaXplIC8gMik7IGsrKykge1xuICAgIHN1bSArPSBzY29yZXNba10uc2NvcmUudjtcbiAgfVxuICByZXR1cm4gc3VtIC8gTWF0aC5mbG9vcihnZW5lcmF0aW9uU2l6ZSAvIDIpO1xufVxuXG5mdW5jdGlvbiBjd19hdmVyYWdlKHNjb3JlcywgZ2VuZXJhdGlvblNpemUpIHtcbiAgdmFyIHN1bSA9IDA7XG4gIGZvciAodmFyIGsgPSAwOyBrIDwgZ2VuZXJhdGlvblNpemU7IGsrKykge1xuICAgIHN1bSArPSBzY29yZXNba10uc2NvcmUudjtcbiAgfVxuICByZXR1cm4gc3VtIC8gZ2VuZXJhdGlvblNpemU7XG59XG5cbmZ1bmN0aW9uIGN3X2NsZWFyR3JhcGhpY3MoZ3JhcGhjYW52YXMsIGdyYXBoY3R4LCBncmFwaHdpZHRoLCBncmFwaGhlaWdodCkge1xuICBncmFwaGNhbnZhcy53aWR0aCA9IGdyYXBoY2FudmFzLndpZHRoO1xuICBncmFwaGN0eC50cmFuc2xhdGUoMCwgZ3JhcGhoZWlnaHQpO1xuICBncmFwaGN0eC5zY2FsZSgxLCAtMSk7XG4gIGdyYXBoY3R4LmxpbmVXaWR0aCA9IDE7XG4gIGdyYXBoY3R4LnN0cm9rZVN0eWxlID0gXCIjM0Y3MkFGXCI7XG4gIGdyYXBoY3R4LmJlZ2luUGF0aCgpO1xuICBncmFwaGN0eC5tb3ZlVG8oMCwgZ3JhcGhoZWlnaHQgLyAyKTtcbiAgZ3JhcGhjdHgubGluZVRvKGdyYXBod2lkdGgsIGdyYXBoaGVpZ2h0IC8gMik7XG4gIGdyYXBoY3R4Lm1vdmVUbygwLCBncmFwaGhlaWdodCAvIDQpO1xuICBncmFwaGN0eC5saW5lVG8oZ3JhcGh3aWR0aCwgZ3JhcGhoZWlnaHQgLyA0KTtcbiAgZ3JhcGhjdHgubW92ZVRvKDAsIGdyYXBoaGVpZ2h0ICogMyAvIDQpO1xuICBncmFwaGN0eC5saW5lVG8oZ3JhcGh3aWR0aCwgZ3JhcGhoZWlnaHQgKiAzIC8gNCk7XG4gIGdyYXBoY3R4LnN0cm9rZSgpO1xufVxuXG5mdW5jdGlvbiBjd19saXN0VG9wU2NvcmVzKGVsZW0sIHN0YXRlKSB7XG4gIHZhciBjd190b3BTY29yZXMgPSBzdGF0ZS5jd190b3BTY29yZXM7XG4gIHZhciB0cyA9IGVsZW07XG4gIHRzLmlubmVySFRNTCA9IFwiPGI+VG9wIFNjb3Jlczo8L2I+PGJyIC8+XCI7XG4gIGN3X3RvcFNjb3Jlcy5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgaWYgKGEudiA+IGIudikge1xuICAgICAgcmV0dXJuIC0xXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAxXG4gICAgfVxuICB9KTtcblxuICBmb3IgKHZhciBrID0gMDsgayA8IE1hdGgubWluKDEwLCBjd190b3BTY29yZXMubGVuZ3RoKTsgaysrKSB7XG4gICAgdmFyIHRvcFNjb3JlID0gY3dfdG9wU2NvcmVzW2tdO1xuICAgIC8vIGNvbnNvbGUubG9nKHRvcFNjb3JlKTtcbiAgICB2YXIgbiA9IFwiI1wiICsgKGsgKyAxKSArIFwiOlwiO1xuICAgIHZhciBzY29yZSA9IE1hdGgucm91bmQodG9wU2NvcmUudiAqIDEwMCkgLyAxMDA7XG4gICAgdmFyIGRpc3RhbmNlID0gXCJkOlwiICsgTWF0aC5yb3VuZCh0b3BTY29yZS54ICogMTAwKSAvIDEwMDtcbiAgICB2YXIgeXJhbmdlID0gIFwiaDpcIiArIE1hdGgucm91bmQodG9wU2NvcmUueTIgKiAxMDApIC8gMTAwICsgXCIvXCIgKyBNYXRoLnJvdW5kKHRvcFNjb3JlLnkgKiAxMDApIC8gMTAwICsgXCJtXCI7XG4gICAgdmFyIGdlbiA9IFwiKEdlbiBcIiArIGN3X3RvcFNjb3Jlc1trXS5pICsgXCIpXCJcblxuICAgIHRzLmlubmVySFRNTCArPSAgW24sIHNjb3JlLCBkaXN0YW5jZSwgeXJhbmdlLCBnZW5dLmpvaW4oXCIgXCIpICsgXCI8YnIgLz5cIjtcbiAgfVxufVxuXG5mdW5jdGlvbiBkcmF3QWxsUmVzdWx0cyhzY2F0dGVyUGxvdEVsZW0sIGNvbmZpZywgYWxsUmVzdWx0cywgcHJldmlvdXNHcmFwaCl7XG4gIGlmKCFzY2F0dGVyUGxvdEVsZW0pIHJldHVybjtcbiAgcmV0dXJuIHNjYXR0ZXJQbG90KHNjYXR0ZXJQbG90RWxlbSwgYWxsUmVzdWx0cywgY29uZmlnLnByb3BlcnR5TWFwLCBwcmV2aW91c0dyYXBoKVxufVxuIiwiLyogZ2xvYmFscyB2aXMgSGlnaGNoYXJ0cyAqL1xuXG4vLyBDYWxsZWQgd2hlbiB0aGUgVmlzdWFsaXphdGlvbiBBUEkgaXMgbG9hZGVkLlxuXG5tb2R1bGUuZXhwb3J0cyA9IGhpZ2hDaGFydHM7XG5mdW5jdGlvbiBoaWdoQ2hhcnRzKGVsZW0sIHNjb3Jlcyl7XG4gIHZhciBrZXlzID0gT2JqZWN0LmtleXMoc2NvcmVzWzBdLmRlZik7XG4gIGtleXMgPSBrZXlzLnJlZHVjZShmdW5jdGlvbihjdXJBcnJheSwga2V5KXtcbiAgICB2YXIgbCA9IHNjb3Jlc1swXS5kZWZba2V5XS5sZW5ndGg7XG4gICAgdmFyIHN1YkFycmF5ID0gW107XG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGw7IGkrKyl7XG4gICAgICBzdWJBcnJheS5wdXNoKGtleSArIFwiLlwiICsgaSk7XG4gICAgfVxuICAgIHJldHVybiBjdXJBcnJheS5jb25jYXQoc3ViQXJyYXkpO1xuICB9LCBbXSk7XG4gIGZ1bmN0aW9uIHJldHJpZXZlVmFsdWUob2JqLCBwYXRoKXtcbiAgICByZXR1cm4gcGF0aC5zcGxpdChcIi5cIikucmVkdWNlKGZ1bmN0aW9uKGN1clZhbHVlLCBrZXkpe1xuICAgICAgcmV0dXJuIGN1clZhbHVlW2tleV07XG4gICAgfSwgb2JqKTtcbiAgfVxuXG4gIHZhciBkYXRhT2JqID0gT2JqZWN0LmtleXMoc2NvcmVzKS5yZWR1Y2UoZnVuY3Rpb24oa3YsIHNjb3JlKXtcbiAgICBrZXlzLmZvckVhY2goZnVuY3Rpb24oa2V5KXtcbiAgICAgIGt2W2tleV0uZGF0YS5wdXNoKFtcbiAgICAgICAgcmV0cmlldmVWYWx1ZShzY29yZS5kZWYsIGtleSksIHNjb3JlLnNjb3JlLnZcbiAgICAgIF0pXG4gICAgfSlcbiAgICByZXR1cm4ga3Y7XG4gIH0sIGtleXMucmVkdWNlKGZ1bmN0aW9uKGt2LCBrZXkpe1xuICAgIGt2W2tleV0gPSB7XG4gICAgICBuYW1lOiBrZXksXG4gICAgICBkYXRhOiBbXSxcbiAgICB9XG4gICAgcmV0dXJuIGt2O1xuICB9LCB7fSkpXG4gIEhpZ2hjaGFydHMuY2hhcnQoZWxlbS5pZCwge1xuICAgICAgY2hhcnQ6IHtcbiAgICAgICAgICB0eXBlOiAnc2NhdHRlcicsXG4gICAgICAgICAgem9vbVR5cGU6ICd4eSdcbiAgICAgIH0sXG4gICAgICB0aXRsZToge1xuICAgICAgICAgIHRleHQ6ICdQcm9wZXJ0eSBWYWx1ZSB0byBTY29yZSdcbiAgICAgIH0sXG4gICAgICB4QXhpczoge1xuICAgICAgICAgIHRpdGxlOiB7XG4gICAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICAgIHRleHQ6ICdOb3JtYWxpemVkJ1xuICAgICAgICAgIH0sXG4gICAgICAgICAgc3RhcnRPblRpY2s6IHRydWUsXG4gICAgICAgICAgZW5kT25UaWNrOiB0cnVlLFxuICAgICAgICAgIHNob3dMYXN0TGFiZWw6IHRydWVcbiAgICAgIH0sXG4gICAgICB5QXhpczoge1xuICAgICAgICAgIHRpdGxlOiB7XG4gICAgICAgICAgICAgIHRleHQ6ICdTY29yZSdcbiAgICAgICAgICB9XG4gICAgICB9LFxuICAgICAgbGVnZW5kOiB7XG4gICAgICAgICAgbGF5b3V0OiAndmVydGljYWwnLFxuICAgICAgICAgIGFsaWduOiAnbGVmdCcsXG4gICAgICAgICAgdmVydGljYWxBbGlnbjogJ3RvcCcsXG4gICAgICAgICAgeDogMTAwLFxuICAgICAgICAgIHk6IDcwLFxuICAgICAgICAgIGZsb2F0aW5nOiB0cnVlLFxuICAgICAgICAgIGJhY2tncm91bmRDb2xvcjogKEhpZ2hjaGFydHMudGhlbWUgJiYgSGlnaGNoYXJ0cy50aGVtZS5sZWdlbmRCYWNrZ3JvdW5kQ29sb3IpIHx8ICcjRkZGRkZGJyxcbiAgICAgICAgICBib3JkZXJXaWR0aDogMVxuICAgICAgfSxcbiAgICAgIHBsb3RPcHRpb25zOiB7XG4gICAgICAgICAgc2NhdHRlcjoge1xuICAgICAgICAgICAgICBtYXJrZXI6IHtcbiAgICAgICAgICAgICAgICAgIHJhZGl1czogNSxcbiAgICAgICAgICAgICAgICAgIHN0YXRlczoge1xuICAgICAgICAgICAgICAgICAgICAgIGhvdmVyOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGxpbmVDb2xvcjogJ3JnYigxMDAsMTAwLDEwMCknXG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBzdGF0ZXM6IHtcbiAgICAgICAgICAgICAgICAgIGhvdmVyOiB7XG4gICAgICAgICAgICAgICAgICAgICAgbWFya2VyOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGVuYWJsZWQ6IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB0b29sdGlwOiB7XG4gICAgICAgICAgICAgICAgICBoZWFkZXJGb3JtYXQ6ICc8Yj57c2VyaWVzLm5hbWV9PC9iPjxicj4nLFxuICAgICAgICAgICAgICAgICAgcG9pbnRGb3JtYXQ6ICd7cG9pbnQueH0sIHtwb2ludC55fSdcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBzZXJpZXM6IGtleXMubWFwKGZ1bmN0aW9uKGtleSl7XG4gICAgICAgIHJldHVybiBkYXRhT2JqW2tleV07XG4gICAgICB9KVxuICB9KTtcbn1cblxuZnVuY3Rpb24gdmlzQ2hhcnQoZWxlbSwgc2NvcmVzLCBwcm9wZXJ0eU1hcCwgZ3JhcGgpIHtcblxuICAvLyBDcmVhdGUgYW5kIHBvcHVsYXRlIGEgZGF0YSB0YWJsZS5cbiAgdmFyIGRhdGEgPSBuZXcgdmlzLkRhdGFTZXQoKTtcbiAgc2NvcmVzLmZvckVhY2goZnVuY3Rpb24oc2NvcmVJbmZvKXtcbiAgICBkYXRhLmFkZCh7XG4gICAgICB4OiBnZXRQcm9wZXJ0eShzY29yZUluZm8sIHByb3BlcnR5TWFwLngpLFxuICAgICAgeTogZ2V0UHJvcGVydHkoc2NvcmVJbmZvLCBwcm9wZXJ0eU1hcC54KSxcbiAgICAgIHo6IGdldFByb3BlcnR5KHNjb3JlSW5mbywgcHJvcGVydHlNYXAueiksXG4gICAgICBzdHlsZTogZ2V0UHJvcGVydHkoc2NvcmVJbmZvLCBwcm9wZXJ0eU1hcC56KSxcbiAgICAgIC8vIGV4dHJhOiBkZWYuYW5jZXN0cnlcbiAgICB9KTtcbiAgfSk7XG5cbiAgZnVuY3Rpb24gZ2V0UHJvcGVydHkoaW5mbywga2V5KXtcbiAgICBpZihrZXkgPT09IFwic2NvcmVcIil7XG4gICAgICByZXR1cm4gaW5mby5zY29yZS52XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBpbmZvLmRlZltrZXldO1xuICAgIH1cbiAgfVxuXG4gIC8vIHNwZWNpZnkgb3B0aW9uc1xuICB2YXIgb3B0aW9ucyA9IHtcbiAgICB3aWR0aDogICc2MDBweCcsXG4gICAgaGVpZ2h0OiAnNjAwcHgnLFxuICAgIHN0eWxlOiAnZG90LXNpemUnLFxuICAgIHNob3dQZXJzcGVjdGl2ZTogdHJ1ZSxcbiAgICBzaG93TGVnZW5kOiB0cnVlLFxuICAgIHNob3dHcmlkOiB0cnVlLFxuICAgIHNob3dTaGFkb3c6IGZhbHNlLFxuXG4gICAgLy8gT3B0aW9uIHRvb2x0aXAgY2FuIGJlIHRydWUsIGZhbHNlLCBvciBhIGZ1bmN0aW9uIHJldHVybmluZyBhIHN0cmluZyB3aXRoIEhUTUwgY29udGVudHNcbiAgICB0b29sdGlwOiBmdW5jdGlvbiAocG9pbnQpIHtcbiAgICAgIC8vIHBhcmFtZXRlciBwb2ludCBjb250YWlucyBwcm9wZXJ0aWVzIHgsIHksIHosIGFuZCBkYXRhXG4gICAgICAvLyBkYXRhIGlzIHRoZSBvcmlnaW5hbCBvYmplY3QgcGFzc2VkIHRvIHRoZSBwb2ludCBjb25zdHJ1Y3RvclxuICAgICAgcmV0dXJuICdzY29yZTogPGI+JyArIHBvaW50LnogKyAnPC9iPjxicj4nOyAvLyArIHBvaW50LmRhdGEuZXh0cmE7XG4gICAgfSxcblxuICAgIC8vIFRvb2x0aXAgZGVmYXVsdCBzdHlsaW5nIGNhbiBiZSBvdmVycmlkZGVuXG4gICAgdG9vbHRpcFN0eWxlOiB7XG4gICAgICBjb250ZW50OiB7XG4gICAgICAgIGJhY2tncm91bmQgICAgOiAncmdiYSgyNTUsIDI1NSwgMjU1LCAwLjcpJyxcbiAgICAgICAgcGFkZGluZyAgICAgICA6ICcxMHB4JyxcbiAgICAgICAgYm9yZGVyUmFkaXVzICA6ICcxMHB4J1xuICAgICAgfSxcbiAgICAgIGxpbmU6IHtcbiAgICAgICAgYm9yZGVyTGVmdCAgICA6ICcxcHggZG90dGVkIHJnYmEoMCwgMCwgMCwgMC41KSdcbiAgICAgIH0sXG4gICAgICBkb3Q6IHtcbiAgICAgICAgYm9yZGVyICAgICAgICA6ICc1cHggc29saWQgcmdiYSgwLCAwLCAwLCAwLjUpJ1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBrZWVwQXNwZWN0UmF0aW86IHRydWUsXG4gICAgdmVydGljYWxSYXRpbzogMC41XG4gIH07XG5cbiAgdmFyIGNhbWVyYSA9IGdyYXBoID8gZ3JhcGguZ2V0Q2FtZXJhUG9zaXRpb24oKSA6IG51bGw7XG5cbiAgLy8gY3JlYXRlIG91ciBncmFwaFxuICB2YXIgY29udGFpbmVyID0gZWxlbTtcbiAgZ3JhcGggPSBuZXcgdmlzLkdyYXBoM2QoY29udGFpbmVyLCBkYXRhLCBvcHRpb25zKTtcblxuICBpZiAoY2FtZXJhKSBncmFwaC5zZXRDYW1lcmFQb3NpdGlvbihjYW1lcmEpOyAvLyByZXN0b3JlIGNhbWVyYSBwb3NpdGlvblxuICByZXR1cm4gZ3JhcGg7XG59XG4iLCJcbm1vZHVsZS5leHBvcnRzID0gZ2VuZXJhdGVSYW5kb207XG5mdW5jdGlvbiBnZW5lcmF0ZVJhbmRvbSgpe1xuICByZXR1cm4gTWF0aC5yYW5kb20oKTtcbn1cbiIsIi8vIGh0dHA6Ly9zdW5taW5ndGFvLmJsb2dzcG90LmNvbS8yMDE2LzExL2luYnJlZWRpbmctY29lZmZpY2llbnQuaHRtbFxubW9kdWxlLmV4cG9ydHMgPSBnZXRJbmJyZWVkaW5nQ29lZmZpY2llbnQ7XG5cbmZ1bmN0aW9uIGdldEluYnJlZWRpbmdDb2VmZmljaWVudChjaGlsZCl7XG4gIHZhciBuYW1lSW5kZXggPSBuZXcgTWFwKCk7XG4gIHZhciBmbGFnZ2VkID0gbmV3IFNldCgpO1xuICB2YXIgY29udmVyZ2VuY2VQb2ludHMgPSBuZXcgU2V0KCk7XG4gIGNyZWF0ZUFuY2VzdHJ5TWFwKGNoaWxkLCBbXSk7XG5cbiAgdmFyIHN0b3JlZENvZWZmaWNpZW50cyA9IG5ldyBNYXAoKTtcblxuICByZXR1cm4gQXJyYXkuZnJvbShjb252ZXJnZW5jZVBvaW50cy52YWx1ZXMoKSkucmVkdWNlKGZ1bmN0aW9uKHN1bSwgcG9pbnQpe1xuICAgIHZhciBpQ28gPSBnZXRDb2VmZmljaWVudChwb2ludCk7XG4gICAgcmV0dXJuIHN1bSArIGlDbztcbiAgfSwgMCk7XG5cbiAgZnVuY3Rpb24gY3JlYXRlQW5jZXN0cnlNYXAoaW5pdE5vZGUpe1xuICAgIHZhciBpdGVtc0luUXVldWUgPSBbeyBub2RlOiBpbml0Tm9kZSwgcGF0aDogW10gfV07XG4gICAgZG97XG4gICAgICB2YXIgaXRlbSA9IGl0ZW1zSW5RdWV1ZS5zaGlmdCgpO1xuICAgICAgdmFyIG5vZGUgPSBpdGVtLm5vZGU7XG4gICAgICB2YXIgcGF0aCA9IGl0ZW0ucGF0aDtcbiAgICAgIGlmKHByb2Nlc3NJdGVtKG5vZGUsIHBhdGgpKXtcbiAgICAgICAgdmFyIG5leHRQYXRoID0gWyBub2RlLmlkIF0uY29uY2F0KHBhdGgpO1xuICAgICAgICBpdGVtc0luUXVldWUgPSBpdGVtc0luUXVldWUuY29uY2F0KG5vZGUuYW5jZXN0cnkubWFwKGZ1bmN0aW9uKHBhcmVudCl7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIG5vZGU6IHBhcmVudCxcbiAgICAgICAgICAgIHBhdGg6IG5leHRQYXRoXG4gICAgICAgICAgfTtcbiAgICAgICAgfSkpO1xuICAgICAgfVxuICAgIH13aGlsZShpdGVtc0luUXVldWUubGVuZ3RoKTtcblxuXG4gICAgZnVuY3Rpb24gcHJvY2Vzc0l0ZW0obm9kZSwgcGF0aCl7XG4gICAgICB2YXIgbmV3QW5jZXN0b3IgPSAhbmFtZUluZGV4Lmhhcyhub2RlLmlkKTtcbiAgICAgIGlmKG5ld0FuY2VzdG9yKXtcbiAgICAgICAgbmFtZUluZGV4LnNldChub2RlLmlkLCB7XG4gICAgICAgICAgcGFyZW50czogKG5vZGUuYW5jZXN0cnkgfHwgW10pLm1hcChmdW5jdGlvbihwYXJlbnQpe1xuICAgICAgICAgICAgcmV0dXJuIHBhcmVudC5pZDtcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBpZDogbm9kZS5pZCxcbiAgICAgICAgICBjaGlsZHJlbjogW10sXG4gICAgICAgICAgY29udmVyZ2VuY2VzOiBbXSxcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuXG4gICAgICAgIGZsYWdnZWQuYWRkKG5vZGUuaWQpXG4gICAgICAgIG5hbWVJbmRleC5nZXQobm9kZS5pZCkuY2hpbGRyZW4uZm9yRWFjaChmdW5jdGlvbihjaGlsZElkZW50aWZpZXIpe1xuICAgICAgICAgIHZhciBvZmZzZXRzID0gZmluZENvbnZlcmdlbmNlKGNoaWxkSWRlbnRpZmllci5wYXRoLCBwYXRoKTtcbiAgICAgICAgICBpZighb2Zmc2V0cyl7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIHZhciBjaGlsZElEID0gcGF0aFtvZmZzZXRzWzFdXTtcbiAgICAgICAgICBjb252ZXJnZW5jZVBvaW50cy5hZGQoY2hpbGRJRCk7XG4gICAgICAgICAgbmFtZUluZGV4LmdldChjaGlsZElEKS5jb252ZXJnZW5jZXMucHVzaCh7XG4gICAgICAgICAgICBwYXJlbnQ6IG5vZGUuaWQsXG4gICAgICAgICAgICBvZmZzZXRzOiBvZmZzZXRzLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgaWYocGF0aC5sZW5ndGgpe1xuICAgICAgICBuYW1lSW5kZXguZ2V0KG5vZGUuaWQpLmNoaWxkcmVuLnB1c2goe1xuICAgICAgICAgIGNoaWxkOiBwYXRoWzBdLFxuICAgICAgICAgIHBhdGg6IHBhdGhcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIGlmKCFuZXdBbmNlc3Rvcil7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmKCFub2RlLmFuY2VzdHJ5KXtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0Q29lZmZpY2llbnQoaWQpe1xuICAgIGlmKHN0b3JlZENvZWZmaWNpZW50cy5oYXMoaWQpKXtcbiAgICAgIHJldHVybiBzdG9yZWRDb2VmZmljaWVudHMuZ2V0KGlkKTtcbiAgICB9XG4gICAgdmFyIG5vZGUgPSBuYW1lSW5kZXguZ2V0KGlkKTtcbiAgICB2YXIgdmFsID0gbm9kZS5jb252ZXJnZW5jZXMucmVkdWNlKGZ1bmN0aW9uKHN1bSwgcG9pbnQpe1xuICAgICAgcmV0dXJuIHN1bSArIE1hdGgucG93KDEgLyAyLCBwb2ludC5vZmZzZXRzLnJlZHVjZShmdW5jdGlvbihzdW0sIHZhbHVlKXtcbiAgICAgICAgcmV0dXJuIHN1bSArIHZhbHVlO1xuICAgICAgfSwgMSkpICogKDEgKyBnZXRDb2VmZmljaWVudChwb2ludC5wYXJlbnQpKTtcbiAgICB9LCAwKTtcbiAgICBzdG9yZWRDb2VmZmljaWVudHMuc2V0KGlkLCB2YWwpO1xuXG4gICAgcmV0dXJuIHZhbDtcblxuICB9XG4gIGZ1bmN0aW9uIGZpbmRDb252ZXJnZW5jZShsaXN0QSwgbGlzdEIpe1xuICAgIHZhciBjaSwgY2osIGxpLCBsajtcbiAgICBvdXRlcmxvb3A6XG4gICAgZm9yKGNpID0gMCwgbGkgPSBsaXN0QS5sZW5ndGg7IGNpIDwgbGk7IGNpKyspe1xuICAgICAgZm9yKGNqID0gMCwgbGogPSBsaXN0Qi5sZW5ndGg7IGNqIDwgbGo7IGNqKyspe1xuICAgICAgICBpZihsaXN0QVtjaV0gPT09IGxpc3RCW2NqXSl7XG4gICAgICAgICAgYnJlYWsgb3V0ZXJsb29wO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmKGNpID09PSBsaSl7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiBbY2ksIGNqXTtcbiAgfVxufVxuIiwidmFyIGNhckNvbnN0cnVjdCA9IHJlcXVpcmUoXCIuLi9jYXItc2NoZW1hL2NvbnN0cnVjdC5qc1wiKTtcblxudmFyIGNhckNvbnN0YW50cyA9IGNhckNvbnN0cnVjdC5jYXJDb25zdGFudHMoKTtcblxudmFyIHNjaGVtYSA9IGNhckNvbnN0cnVjdC5nZW5lcmF0ZVNjaGVtYShjYXJDb25zdGFudHMpO1xudmFyIHBpY2tQYXJlbnQgPSByZXF1aXJlKFwiLi9waWNrUGFyZW50XCIpO1xudmFyIHNlbGVjdEZyb21BbGxQYXJlbnRzID0gcmVxdWlyZShcIi4vc2VsZWN0RnJvbUFsbFBhcmVudHNcIik7XG5jb25zdCBjb25zdGFudHMgPSB7XG4gIGdlbmVyYXRpb25TaXplOiAyMCxcbiAgc2NoZW1hOiBzY2hlbWEsXG4gIGNoYW1waW9uTGVuZ3RoOiAxLFxuICBtdXRhdGlvbl9yYW5nZTogMSxcbiAgZ2VuX211dGF0aW9uOiAwLjA1LFxufTtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKXtcbiAgdmFyIGN1cnJlbnRDaG9pY2VzID0gbmV3IE1hcCgpO1xuICByZXR1cm4gT2JqZWN0LmFzc2lnbihcbiAgICB7fSxcbiAgICBjb25zdGFudHMsXG4gICAge1xuICAgICAgc2VsZWN0RnJvbUFsbFBhcmVudHM6IHNlbGVjdEZyb21BbGxQYXJlbnRzLFxuICAgICAgZ2VuZXJhdGVSYW5kb206IHJlcXVpcmUoXCIuL2dlbmVyYXRlUmFuZG9tXCIpLFxuICAgICAgcGlja1BhcmVudDogcGlja1BhcmVudC5iaW5kKHZvaWQgMCwgY3VycmVudENob2ljZXMpLFxuICAgIH1cbiAgKTtcbn1cbm1vZHVsZS5leHBvcnRzLmNvbnN0YW50cyA9IGNvbnN0YW50c1xuIiwidmFyIG5BdHRyaWJ1dGVzID0gMTU7XG5tb2R1bGUuZXhwb3J0cyA9IHBpY2tQYXJlbnQ7XG5cbmZ1bmN0aW9uIHBpY2tQYXJlbnQoY3VycmVudENob2ljZXMsIGNob29zZUlkLCBrZXkgLyogLCBwYXJlbnRzICovKXtcbiAgaWYoIWN1cnJlbnRDaG9pY2VzLmhhcyhjaG9vc2VJZCkpe1xuICAgIGN1cnJlbnRDaG9pY2VzLnNldChjaG9vc2VJZCwgaW5pdGlhbGl6ZVBpY2soKSlcbiAgfVxuICAvLyBjb25zb2xlLmxvZyhjaG9vc2VJZCk7XG4gIHZhciBzdGF0ZSA9IGN1cnJlbnRDaG9pY2VzLmdldChjaG9vc2VJZCk7XG4gIC8vIGNvbnNvbGUubG9nKHN0YXRlLmN1cnBhcmVudCk7XG4gIHN0YXRlLmkrK1xuICBpZihbXCJ3aGVlbF9yYWRpdXNcIiwgXCJ3aGVlbF92ZXJ0ZXhcIiwgXCJ3aGVlbF9kZW5zaXR5XCIsIFwid2hlZWxfZnJpY3Rpb25fZXhwb25lbnRcIl0uaW5kZXhPZihrZXkpID4gLTEpe1xuICAgIHN0YXRlLmN1cnBhcmVudCA9IGN3X2Nob29zZVBhcmVudChzdGF0ZSk7XG4gICAgcmV0dXJuIHN0YXRlLmN1cnBhcmVudDtcbiAgfVxuICBzdGF0ZS5jdXJwYXJlbnQgPSBjd19jaG9vc2VQYXJlbnQoc3RhdGUpO1xuICByZXR1cm4gc3RhdGUuY3VycGFyZW50O1xuXG4gIGZ1bmN0aW9uIGN3X2Nob29zZVBhcmVudChzdGF0ZSkge1xuICAgIHZhciBjdXJwYXJlbnQgPSBzdGF0ZS5jdXJwYXJlbnQ7XG4gICAgdmFyIGF0dHJpYnV0ZUluZGV4ID0gc3RhdGUuaTtcbiAgICB2YXIgc3dhcFBvaW50MSA9IHN0YXRlLnN3YXBQb2ludDFcbiAgICB2YXIgc3dhcFBvaW50MiA9IHN0YXRlLnN3YXBQb2ludDJcbiAgICAvLyBjb25zb2xlLmxvZyhzd2FwUG9pbnQxLCBzd2FwUG9pbnQyLCBhdHRyaWJ1dGVJbmRleClcbiAgICBpZiAoKHN3YXBQb2ludDEgPT0gYXR0cmlidXRlSW5kZXgpIHx8IChzd2FwUG9pbnQyID09IGF0dHJpYnV0ZUluZGV4KSkge1xuICAgICAgcmV0dXJuIGN1cnBhcmVudCA9PSAxID8gMCA6IDFcbiAgICB9XG4gICAgcmV0dXJuIGN1cnBhcmVudFxuICB9XG5cbiAgZnVuY3Rpb24gaW5pdGlhbGl6ZVBpY2soKXtcbiAgICB2YXIgY3VycGFyZW50ID0gMDtcblxuICAgIHZhciBzd2FwUG9pbnQxID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogKG5BdHRyaWJ1dGVzKSk7XG4gICAgdmFyIHN3YXBQb2ludDIgPSBzd2FwUG9pbnQxO1xuICAgIHdoaWxlIChzd2FwUG9pbnQyID09IHN3YXBQb2ludDEpIHtcbiAgICAgIHN3YXBQb2ludDIgPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAobkF0dHJpYnV0ZXMpKTtcbiAgICB9XG4gICAgdmFyIGkgPSAwO1xuICAgIHJldHVybiB7XG4gICAgICBjdXJwYXJlbnQ6IGN1cnBhcmVudCxcbiAgICAgIGk6IGksXG4gICAgICBzd2FwUG9pbnQxOiBzd2FwUG9pbnQxLFxuICAgICAgc3dhcFBvaW50Mjogc3dhcFBvaW50MlxuICAgIH1cbiAgfVxufVxuIiwidmFyIGdldEluYnJlZWRpbmdDb2VmZmljaWVudCA9IHJlcXVpcmUoXCIuL2luYnJlZWRpbmctY29lZmZpY2llbnRcIik7XG5cbm1vZHVsZS5leHBvcnRzID0gc2ltcGxlU2VsZWN0O1xuXG5mdW5jdGlvbiBzaW1wbGVTZWxlY3QocGFyZW50cyl7XG4gIHZhciB0b3RhbFBhcmVudHMgPSBwYXJlbnRzLmxlbmd0aFxuICB2YXIgciA9IE1hdGgucmFuZG9tKCk7XG4gIGlmIChyID09IDApXG4gICAgcmV0dXJuIDA7XG4gIHJldHVybiBNYXRoLmZsb29yKC1NYXRoLmxvZyhyKSAqIHRvdGFsUGFyZW50cykgJSB0b3RhbFBhcmVudHM7XG59XG5cbmZ1bmN0aW9uIHNlbGVjdEZyb21BbGxQYXJlbnRzKHBhcmVudHMsIHBhcmVudExpc3QsIHByZXZpb3VzUGFyZW50SW5kZXgpIHtcbiAgdmFyIHByZXZpb3VzUGFyZW50ID0gcGFyZW50c1twcmV2aW91c1BhcmVudEluZGV4XTtcbiAgdmFyIHZhbGlkUGFyZW50cyA9IHBhcmVudHMuZmlsdGVyKGZ1bmN0aW9uKHBhcmVudCwgaSl7XG4gICAgaWYocHJldmlvdXNQYXJlbnRJbmRleCA9PT0gaSl7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGlmKCFwcmV2aW91c1BhcmVudCl7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgdmFyIGNoaWxkID0ge1xuICAgICAgaWQ6IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzIpLFxuICAgICAgYW5jZXN0cnk6IFtwcmV2aW91c1BhcmVudCwgcGFyZW50XS5tYXAoZnVuY3Rpb24ocCl7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgaWQ6IHAuZGVmLmlkLFxuICAgICAgICAgIGFuY2VzdHJ5OiBwLmRlZi5hbmNlc3RyeVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH1cbiAgICB2YXIgaUNvID0gZ2V0SW5icmVlZGluZ0NvZWZmaWNpZW50KGNoaWxkKTtcbiAgICBjb25zb2xlLmxvZyhcImluYnJlZWRpbmcgY29lZmZpY2llbnRcIiwgaUNvKVxuICAgIGlmKGlDbyA+IDAuMjUpe1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSlcbiAgaWYodmFsaWRQYXJlbnRzLmxlbmd0aCA9PT0gMCl7XG4gICAgcmV0dXJuIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIHBhcmVudHMubGVuZ3RoKVxuICB9XG4gIHZhciB0b3RhbFNjb3JlID0gdmFsaWRQYXJlbnRzLnJlZHVjZShmdW5jdGlvbihzdW0sIHBhcmVudCl7XG4gICAgcmV0dXJuIHN1bSArIHBhcmVudC5zY29yZS52O1xuICB9LCAwKTtcbiAgdmFyIHIgPSB0b3RhbFNjb3JlICogTWF0aC5yYW5kb20oKTtcbiAgZm9yKHZhciBpID0gMDsgaSA8IHZhbGlkUGFyZW50cy5sZW5ndGg7IGkrKyl7XG4gICAgdmFyIHNjb3JlID0gdmFsaWRQYXJlbnRzW2ldLnNjb3JlLnY7XG4gICAgaWYociA+IHNjb3JlKXtcbiAgICAgIHIgPSByIC0gc2NvcmU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuICByZXR1cm4gaTtcbn1cbiIsInZhciByYW5kb20gPSByZXF1aXJlKFwiLi9yYW5kb20uanNcIik7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBjcmVhdGVHZW5lcmF0aW9uWmVybyhzY2hlbWEsIGdlbmVyYXRvcil7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHNjaGVtYSkucmVkdWNlKGZ1bmN0aW9uKGluc3RhbmNlLCBrZXkpe1xuICAgICAgdmFyIHNjaGVtYVByb3AgPSBzY2hlbWFba2V5XTtcbiAgICAgIHZhciB2YWx1ZXMgPSByYW5kb20uY3JlYXRlTm9ybWFscyhzY2hlbWFQcm9wLCBnZW5lcmF0b3IpO1xuICAgICAgaW5zdGFuY2Vba2V5XSA9IHZhbHVlcztcbiAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICB9LCB7IGlkOiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDMyKSB9KTtcbiAgfSxcbiAgY3JlYXRlQ3Jvc3NCcmVlZChzY2hlbWEsIHBhcmVudHMsIHBhcmVudENob29zZXIpe1xuICAgIHZhciBpZCA9IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzIpO1xuICAgIHJldHVybiBPYmplY3Qua2V5cyhzY2hlbWEpLnJlZHVjZShmdW5jdGlvbihjcm9zc0RlZiwga2V5KXtcbiAgICAgIHZhciBzY2hlbWFEZWYgPSBzY2hlbWFba2V5XTtcbiAgICAgIHZhciB2YWx1ZXMgPSBbXTtcbiAgICAgIGZvcih2YXIgaSA9IDAsIGwgPSBzY2hlbWFEZWYubGVuZ3RoOyBpIDwgbDsgaSsrKXtcbiAgICAgICAgdmFyIHAgPSBwYXJlbnRDaG9vc2VyKGlkLCBrZXksIHBhcmVudHMpO1xuICAgICAgICB2YWx1ZXMucHVzaChwYXJlbnRzW3BdW2tleV1baV0pO1xuICAgICAgfVxuICAgICAgY3Jvc3NEZWZba2V5XSA9IHZhbHVlcztcbiAgICAgIHJldHVybiBjcm9zc0RlZjtcbiAgICB9LCB7XG4gICAgICBpZDogaWQsXG4gICAgICBhbmNlc3RyeTogcGFyZW50cy5tYXAoZnVuY3Rpb24ocGFyZW50KXtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBpZDogcGFyZW50LmlkLFxuICAgICAgICAgIGFuY2VzdHJ5OiBwYXJlbnQuYW5jZXN0cnksXG4gICAgICAgIH07XG4gICAgICB9KVxuICAgIH0pO1xuICB9LFxuICBjcmVhdGVNdXRhdGVkQ2xvbmUoc2NoZW1hLCBnZW5lcmF0b3IsIHBhcmVudCwgZmFjdG9yLCBjaGFuY2VUb011dGF0ZSl7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHNjaGVtYSkucmVkdWNlKGZ1bmN0aW9uKGNsb25lLCBrZXkpe1xuICAgICAgdmFyIHNjaGVtYVByb3AgPSBzY2hlbWFba2V5XTtcbiAgICAgIHZhciBvcmlnaW5hbFZhbHVlcyA9IHBhcmVudFtrZXldO1xuICAgICAgdmFyIHZhbHVlcyA9IHJhbmRvbS5tdXRhdGVOb3JtYWxzKFxuICAgICAgICBzY2hlbWFQcm9wLCBnZW5lcmF0b3IsIG9yaWdpbmFsVmFsdWVzLCBmYWN0b3IsIGNoYW5jZVRvTXV0YXRlXG4gICAgICApO1xuICAgICAgY2xvbmVba2V5XSA9IHZhbHVlcztcbiAgICAgIHJldHVybiBjbG9uZTtcbiAgICB9LCB7XG4gICAgICBpZDogcGFyZW50LmlkLFxuICAgICAgYW5jZXN0cnk6IHBhcmVudC5hbmNlc3RyeVxuICAgIH0pO1xuICB9LFxuICBhcHBseVR5cGVzKHNjaGVtYSwgcGFyZW50KXtcbiAgICByZXR1cm4gT2JqZWN0LmtleXMoc2NoZW1hKS5yZWR1Y2UoZnVuY3Rpb24oY2xvbmUsIGtleSl7XG4gICAgICB2YXIgc2NoZW1hUHJvcCA9IHNjaGVtYVtrZXldO1xuICAgICAgdmFyIG9yaWdpbmFsVmFsdWVzID0gcGFyZW50W2tleV07XG4gICAgICB2YXIgdmFsdWVzO1xuICAgICAgc3dpdGNoKHNjaGVtYVByb3AudHlwZSl7XG4gICAgICAgIGNhc2UgXCJzaHVmZmxlXCIgOlxuICAgICAgICAgIHZhbHVlcyA9IHJhbmRvbS5tYXBUb1NodWZmbGUoc2NoZW1hUHJvcCwgb3JpZ2luYWxWYWx1ZXMpOyBicmVhaztcbiAgICAgICAgY2FzZSBcImZsb2F0XCIgOlxuICAgICAgICAgIHZhbHVlcyA9IHJhbmRvbS5tYXBUb0Zsb2F0KHNjaGVtYVByb3AsIG9yaWdpbmFsVmFsdWVzKTsgYnJlYWs7XG4gICAgICAgIGNhc2UgXCJpbnRlZ2VyXCI6XG4gICAgICAgICAgdmFsdWVzID0gcmFuZG9tLm1hcFRvSW50ZWdlcihzY2hlbWFQcm9wLCBvcmlnaW5hbFZhbHVlcyk7IGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biB0eXBlICR7c2NoZW1hUHJvcC50eXBlfSBvZiBzY2hlbWEgZm9yIGtleSAke2tleX1gKTtcbiAgICAgIH1cbiAgICAgIGNsb25lW2tleV0gPSB2YWx1ZXM7XG4gICAgICByZXR1cm4gY2xvbmU7XG4gICAgfSwge1xuICAgICAgaWQ6IHBhcmVudC5pZCxcbiAgICAgIGFuY2VzdHJ5OiBwYXJlbnQuYW5jZXN0cnlcbiAgICB9KTtcbiAgfSxcbn1cbiIsInZhciBjcmVhdGUgPSByZXF1aXJlKFwiLi4vY3JlYXRlLWluc3RhbmNlXCIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgZ2VuZXJhdGlvblplcm86IGdlbmVyYXRpb25aZXJvLFxuICBuZXh0R2VuZXJhdGlvbjogbmV4dEdlbmVyYXRpb25cbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGlvblplcm8oY29uZmlnKXtcbiAgdmFyIGdlbmVyYXRpb25TaXplID0gY29uZmlnLmdlbmVyYXRpb25TaXplLFxuICBzY2hlbWEgPSBjb25maWcuc2NoZW1hO1xuICB2YXIgY3dfY2FyR2VuZXJhdGlvbiA9IFtdO1xuICBmb3IgKHZhciBrID0gMDsgayA8IGdlbmVyYXRpb25TaXplOyBrKyspIHtcbiAgICB2YXIgZGVmID0gY3JlYXRlLmNyZWF0ZUdlbmVyYXRpb25aZXJvKHNjaGVtYSwgZnVuY3Rpb24oKXtcbiAgICAgIHJldHVybiBNYXRoLnJhbmRvbSgpXG4gICAgfSk7XG4gICAgZGVmLmluZGV4ID0gaztcbiAgICBjd19jYXJHZW5lcmF0aW9uLnB1c2goZGVmKTtcbiAgfVxuICByZXR1cm4ge1xuICAgIGNvdW50ZXI6IDAsXG4gICAgZ2VuZXJhdGlvbjogY3dfY2FyR2VuZXJhdGlvbixcbiAgfTtcbn1cblxuZnVuY3Rpb24gbmV4dEdlbmVyYXRpb24oXG4gIHByZXZpb3VzU3RhdGUsXG4gIHNjb3JlcyxcbiAgY29uZmlnXG4pe1xuICB2YXIgY2hhbXBpb25fbGVuZ3RoID0gY29uZmlnLmNoYW1waW9uTGVuZ3RoLFxuICAgIGdlbmVyYXRpb25TaXplID0gY29uZmlnLmdlbmVyYXRpb25TaXplLFxuICAgIHNlbGVjdEZyb21BbGxQYXJlbnRzID0gY29uZmlnLnNlbGVjdEZyb21BbGxQYXJlbnRzO1xuXG4gIHZhciBuZXdHZW5lcmF0aW9uID0gbmV3IEFycmF5KCk7XG4gIHZhciBuZXdib3JuO1xuICB2YXIgYWxsVGltZUJlc3QgPSBwcmV2aW91c1N0YXRlLmFsbFRpbWVCZXN0O1xuICBpZiAoIWFsbFRpbWVCZXN0IHx8IHNjb3Jlc1swXS5zY29yZS52ID4gYWxsVGltZUJlc3QuYmVzdF9zY29yZSkge1xuICAgIGFsbFRpbWVCZXN0ID0gc2NvcmVzWzBdLmRlZjtcbiAgICBhbGxUaW1lQmVzdC5pc19hbGxfdGltZV9iZXN0ID0gdHJ1ZTtcbiAgfVxuICB2YXIgYWxsVGltZUJlc3RBZGRlZCA9IGZhbHNlO1xuICBmb3IgKHZhciBrID0gMDsgayA8IGNoYW1waW9uX2xlbmd0aDsgaysrKSB7XG4gICAgc2NvcmVzW2tdLmRlZi5pc19lbGl0ZSA9IHRydWU7XG4gICAgc2NvcmVzW2tdLmRlZi5pbmRleCA9IGs7XG4gICAgbmV3R2VuZXJhdGlvbi5wdXNoKHNjb3Jlc1trXS5kZWYpO1xuICAgIGlmIChzY29yZXNba10uc2NvcmUudiA+IHNjb3Jlc1trXS5kZWYuYmVzdF9zY29yZSkge1xuICAgICAgc2NvcmVzW2tdLmRlZi5iZXN0X3Njb3JlID0gc2NvcmVzW2tdLnNjb3JlLnY7XG4gICAgfVxuICAgIGlmIChhbGxUaW1lQmVzdC5pZCA9PSBzY29yZXNba10uZGVmLmlkKSB7XG4gICAgICBhbGxUaW1lQmVzdEFkZGVkID0gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgaWYgKCFhbGxUaW1lQmVzdEFkZGVkKSB7XG4gICAgYWxsVGltZUJlc3QuaXNfZWxpdGUgPSBmYWxzZTtcbiAgICBuZXdHZW5lcmF0aW9uLnB1c2goYWxsVGltZUJlc3QpO1xuICB9XG4gIHZhciBwYXJlbnRMaXN0ID0gW107XG4gIGZvciAoayA9IGNoYW1waW9uX2xlbmd0aDsgayA8IGdlbmVyYXRpb25TaXplOyBrKyspIHtcbiAgICB2YXIgcGFyZW50MSA9IHNlbGVjdEZyb21BbGxQYXJlbnRzKHNjb3JlcywgcGFyZW50TGlzdCk7XG4gICAgdmFyIHBhcmVudDIgPSBwYXJlbnQxO1xuICAgIHdoaWxlIChwYXJlbnQyID09IHBhcmVudDEpIHtcbiAgICAgIHBhcmVudDIgPSBzZWxlY3RGcm9tQWxsUGFyZW50cyhzY29yZXMsIHBhcmVudExpc3QsIHBhcmVudDEpO1xuICAgIH1cbiAgICB2YXIgcGFpciA9IFtwYXJlbnQxLCBwYXJlbnQyXVxuICAgIHBhcmVudExpc3QucHVzaChwYWlyKTtcbiAgICBuZXdib3JuID0gbWFrZUNoaWxkKGNvbmZpZyxcbiAgICAgIHBhaXIubWFwKGZ1bmN0aW9uKHBhcmVudCkgeyByZXR1cm4gc2NvcmVzW3BhcmVudF0uZGVmOyB9KVxuICAgICk7XG4gICAgbmV3Ym9ybiA9IG11dGF0ZShjb25maWcsIG5ld2Jvcm4pO1xuICAgIG5ld2Jvcm4uaXNfZWxpdGUgPSBmYWxzZTtcbiAgICBuZXdib3JuLmluZGV4ID0gaztcbiAgICBuZXdHZW5lcmF0aW9uLnB1c2gobmV3Ym9ybik7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGNvdW50ZXI6IHByZXZpb3VzU3RhdGUuY291bnRlciArIDEsXG4gICAgZ2VuZXJhdGlvbjogbmV3R2VuZXJhdGlvbixcbiAgICBhbGxUaW1lQmVzdDogYWxsVGltZUJlc3RcbiAgfTtcbn1cblxuXG5mdW5jdGlvbiBtYWtlQ2hpbGQoY29uZmlnLCBwYXJlbnRzKXtcbiAgdmFyIHNjaGVtYSA9IGNvbmZpZy5zY2hlbWEsXG4gICAgcGlja1BhcmVudCA9IGNvbmZpZy5waWNrUGFyZW50O1xuICByZXR1cm4gY3JlYXRlLmNyZWF0ZUNyb3NzQnJlZWQoc2NoZW1hLCBwYXJlbnRzLCBwaWNrUGFyZW50KVxufVxuXG5cbmZ1bmN0aW9uIG11dGF0ZShjb25maWcsIHBhcmVudCl7XG4gIHZhciBzY2hlbWEgPSBjb25maWcuc2NoZW1hLFxuICAgIG11dGF0aW9uX3JhbmdlID0gY29uZmlnLm11dGF0aW9uX3JhbmdlLFxuICAgIGdlbl9tdXRhdGlvbiA9IGNvbmZpZy5nZW5fbXV0YXRpb24sXG4gICAgZ2VuZXJhdGVSYW5kb20gPSBjb25maWcuZ2VuZXJhdGVSYW5kb207XG4gIHJldHVybiBjcmVhdGUuY3JlYXRlTXV0YXRlZENsb25lKFxuICAgIHNjaGVtYSxcbiAgICBnZW5lcmF0ZVJhbmRvbSxcbiAgICBwYXJlbnQsXG4gICAgTWF0aC5tYXgobXV0YXRpb25fcmFuZ2UpLFxuICAgIGdlbl9tdXRhdGlvblxuICApXG59XG4iLCJcblxuY29uc3QgcmFuZG9tID0ge1xuICBzaHVmZmxlSW50ZWdlcnMocHJvcCwgZ2VuZXJhdG9yKXtcbiAgICByZXR1cm4gcmFuZG9tLm1hcFRvU2h1ZmZsZShwcm9wLCByYW5kb20uY3JlYXRlTm9ybWFscyh7XG4gICAgICBsZW5ndGg6IHByb3AubGVuZ3RoIHx8IDEwLFxuICAgICAgaW5jbHVzaXZlOiB0cnVlLFxuICAgIH0sIGdlbmVyYXRvcikpO1xuICB9LFxuICBjcmVhdGVJbnRlZ2Vycyhwcm9wLCBnZW5lcmF0b3Ipe1xuICAgIHJldHVybiByYW5kb20ubWFwVG9JbnRlZ2VyKHByb3AsIHJhbmRvbS5jcmVhdGVOb3JtYWxzKHtcbiAgICAgIGxlbmd0aDogcHJvcC5sZW5ndGgsXG4gICAgICBpbmNsdXNpdmU6IHRydWUsXG4gICAgfSwgZ2VuZXJhdG9yKSk7XG4gIH0sXG4gIGNyZWF0ZUZsb2F0cyhwcm9wLCBnZW5lcmF0b3Ipe1xuICAgIHJldHVybiByYW5kb20ubWFwVG9GbG9hdChwcm9wLCByYW5kb20uY3JlYXRlTm9ybWFscyh7XG4gICAgICBsZW5ndGg6IHByb3AubGVuZ3RoLFxuICAgICAgaW5jbHVzaXZlOiB0cnVlLFxuICAgIH0sIGdlbmVyYXRvcikpO1xuICB9LFxuICBjcmVhdGVOb3JtYWxzKHByb3AsIGdlbmVyYXRvcil7XG4gICAgdmFyIGwgPSBwcm9wLmxlbmd0aDtcbiAgICB2YXIgdmFsdWVzID0gW107XG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGw7IGkrKyl7XG4gICAgICB2YWx1ZXMucHVzaChcbiAgICAgICAgY3JlYXRlTm9ybWFsKHByb3AsIGdlbmVyYXRvcilcbiAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZXM7XG4gIH0sXG4gIG11dGF0ZVNodWZmbGUoXG4gICAgcHJvcCwgZ2VuZXJhdG9yLCBvcmlnaW5hbFZhbHVlcywgbXV0YXRpb25fcmFuZ2UsIGNoYW5jZVRvTXV0YXRlXG4gICl7XG4gICAgcmV0dXJuIHJhbmRvbS5tYXBUb1NodWZmbGUocHJvcCwgcmFuZG9tLm11dGF0ZU5vcm1hbHMoXG4gICAgICBwcm9wLCBnZW5lcmF0b3IsIG9yaWdpbmFsVmFsdWVzLCBtdXRhdGlvbl9yYW5nZSwgY2hhbmNlVG9NdXRhdGVcbiAgICApKTtcbiAgfSxcbiAgbXV0YXRlSW50ZWdlcnMocHJvcCwgZ2VuZXJhdG9yLCBvcmlnaW5hbFZhbHVlcywgbXV0YXRpb25fcmFuZ2UsIGNoYW5jZVRvTXV0YXRlKXtcbiAgICByZXR1cm4gcmFuZG9tLm1hcFRvSW50ZWdlcihwcm9wLCByYW5kb20ubXV0YXRlTm9ybWFscyhcbiAgICAgIHByb3AsIGdlbmVyYXRvciwgb3JpZ2luYWxWYWx1ZXMsIG11dGF0aW9uX3JhbmdlLCBjaGFuY2VUb011dGF0ZVxuICAgICkpO1xuICB9LFxuICBtdXRhdGVGbG9hdHMocHJvcCwgZ2VuZXJhdG9yLCBvcmlnaW5hbFZhbHVlcywgbXV0YXRpb25fcmFuZ2UsIGNoYW5jZVRvTXV0YXRlKXtcbiAgICByZXR1cm4gcmFuZG9tLm1hcFRvRmxvYXQocHJvcCwgcmFuZG9tLm11dGF0ZU5vcm1hbHMoXG4gICAgICBwcm9wLCBnZW5lcmF0b3IsIG9yaWdpbmFsVmFsdWVzLCBtdXRhdGlvbl9yYW5nZSwgY2hhbmNlVG9NdXRhdGVcbiAgICApKTtcbiAgfSxcbiAgbWFwVG9TaHVmZmxlKHByb3AsIG5vcm1hbHMpe1xuICAgIHZhciBvZmZzZXQgPSBwcm9wLm9mZnNldCB8fCAwO1xuICAgIHZhciBsaW1pdCA9IHByb3AubGltaXQgfHwgcHJvcC5sZW5ndGg7XG4gICAgdmFyIHNvcnRlZCA9IG5vcm1hbHMuc2xpY2UoKS5zb3J0KGZ1bmN0aW9uKGEsIGIpe1xuICAgICAgcmV0dXJuIGEgLSBiO1xuICAgIH0pO1xuICAgIHJldHVybiBub3JtYWxzLm1hcChmdW5jdGlvbih2YWwpe1xuICAgICAgcmV0dXJuIHNvcnRlZC5pbmRleE9mKHZhbCk7XG4gICAgfSkubWFwKGZ1bmN0aW9uKGkpe1xuICAgICAgcmV0dXJuIGkgKyBvZmZzZXQ7XG4gICAgfSkuc2xpY2UoMCwgbGltaXQpO1xuICB9LFxuICBtYXBUb0ludGVnZXIocHJvcCwgbm9ybWFscyl7XG4gICAgcHJvcCA9IHtcbiAgICAgIG1pbjogcHJvcC5taW4gfHwgMCxcbiAgICAgIHJhbmdlOiBwcm9wLnJhbmdlIHx8IDEwLFxuICAgICAgbGVuZ3RoOiBwcm9wLmxlbmd0aFxuICAgIH1cbiAgICByZXR1cm4gcmFuZG9tLm1hcFRvRmxvYXQocHJvcCwgbm9ybWFscykubWFwKGZ1bmN0aW9uKGZsb2F0KXtcbiAgICAgIHJldHVybiBNYXRoLnJvdW5kKGZsb2F0KTtcbiAgICB9KTtcbiAgfSxcbiAgbWFwVG9GbG9hdChwcm9wLCBub3JtYWxzKXtcbiAgICBwcm9wID0ge1xuICAgICAgbWluOiBwcm9wLm1pbiB8fCAwLFxuICAgICAgcmFuZ2U6IHByb3AucmFuZ2UgfHwgMVxuICAgIH1cbiAgICByZXR1cm4gbm9ybWFscy5tYXAoZnVuY3Rpb24obm9ybWFsKXtcbiAgICAgIHZhciBtaW4gPSBwcm9wLm1pbjtcbiAgICAgIHZhciByYW5nZSA9IHByb3AucmFuZ2U7XG4gICAgICByZXR1cm4gbWluICsgbm9ybWFsICogcmFuZ2VcbiAgICB9KVxuICB9LFxuICBtdXRhdGVOb3JtYWxzKHByb3AsIGdlbmVyYXRvciwgb3JpZ2luYWxWYWx1ZXMsIG11dGF0aW9uX3JhbmdlLCBjaGFuY2VUb011dGF0ZSl7XG4gICAgdmFyIGZhY3RvciA9IChwcm9wLmZhY3RvciB8fCAxKSAqIG11dGF0aW9uX3JhbmdlXG4gICAgcmV0dXJuIG9yaWdpbmFsVmFsdWVzLm1hcChmdW5jdGlvbihvcmlnaW5hbFZhbHVlKXtcbiAgICAgIGlmKGdlbmVyYXRvcigpID4gY2hhbmNlVG9NdXRhdGUpe1xuICAgICAgICByZXR1cm4gb3JpZ2luYWxWYWx1ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtdXRhdGVOb3JtYWwoXG4gICAgICAgIHByb3AsIGdlbmVyYXRvciwgb3JpZ2luYWxWYWx1ZSwgZmFjdG9yXG4gICAgICApO1xuICAgIH0pO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHJhbmRvbTtcblxuZnVuY3Rpb24gbXV0YXRlTm9ybWFsKHByb3AsIGdlbmVyYXRvciwgb3JpZ2luYWxWYWx1ZSwgbXV0YXRpb25fcmFuZ2Upe1xuICBpZihtdXRhdGlvbl9yYW5nZSA+IDEpe1xuICAgIHRocm93IG5ldyBFcnJvcihcIkNhbm5vdCBtdXRhdGUgYmV5b25kIGJvdW5kc1wiKTtcbiAgfVxuICB2YXIgbmV3TWluID0gb3JpZ2luYWxWYWx1ZSAtIDAuNTtcbiAgaWYgKG5ld01pbiA8IDApIG5ld01pbiA9IDA7XG4gIGlmIChuZXdNaW4gKyBtdXRhdGlvbl9yYW5nZSAgPiAxKVxuICAgIG5ld01pbiA9IDEgLSBtdXRhdGlvbl9yYW5nZTtcbiAgdmFyIHJhbmdlVmFsdWUgPSBjcmVhdGVOb3JtYWwoe1xuICAgIGluY2x1c2l2ZTogdHJ1ZSxcbiAgfSwgZ2VuZXJhdG9yKTtcbiAgcmV0dXJuIG5ld01pbiArIHJhbmdlVmFsdWUgKiBtdXRhdGlvbl9yYW5nZTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlTm9ybWFsKHByb3AsIGdlbmVyYXRvcil7XG4gIGlmKCFwcm9wLmluY2x1c2l2ZSl7XG4gICAgcmV0dXJuIGdlbmVyYXRvcigpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBnZW5lcmF0b3IoKSA8IDAuNSA/XG4gICAgZ2VuZXJhdG9yKCkgOlxuICAgIDEgLSBnZW5lcmF0b3IoKTtcbiAgfVxufVxuIiwidmFyIGNyZWF0ZSA9IHJlcXVpcmUoXCIuLi9jcmVhdGUtaW5zdGFuY2VcIik7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBnZW5lcmF0aW9uWmVybzogZ2VuZXJhdGlvblplcm8sXG4gIG5leHRHZW5lcmF0aW9uOiBuZXh0R2VuZXJhdGlvbixcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGlvblplcm8oY29uZmlnKXtcbiAgdmFyIG9sZFN0cnVjdHVyZSA9IGNyZWF0ZS5jcmVhdGVHZW5lcmF0aW9uWmVybyhcbiAgICBjb25maWcuc2NoZW1hLCBjb25maWcuZ2VuZXJhdGVSYW5kb21cbiAgKTtcbiAgdmFyIG5ld1N0cnVjdHVyZSA9IGNyZWF0ZVN0cnVjdHVyZShjb25maWcsIDEsIG9sZFN0cnVjdHVyZSk7XG5cbiAgdmFyIGsgPSAwO1xuXG4gIHJldHVybiB7XG4gICAgY291bnRlcjogMCxcbiAgICBrOiBrLFxuICAgIGdlbmVyYXRpb246IFtuZXdTdHJ1Y3R1cmUsIG9sZFN0cnVjdHVyZV1cbiAgfVxufVxuXG5mdW5jdGlvbiBuZXh0R2VuZXJhdGlvbihwcmV2aW91c1N0YXRlLCBzY29yZXMsIGNvbmZpZyl7XG4gIHZhciBuZXh0U3RhdGUgPSB7XG4gICAgazogKHByZXZpb3VzU3RhdGUuayArIDEpJWNvbmZpZy5nZW5lcmF0aW9uU2l6ZSxcbiAgICBjb3VudGVyOiBwcmV2aW91c1N0YXRlLmNvdW50ZXIgKyAocHJldmlvdXNTdGF0ZS5rID09PSBjb25maWcuZ2VuZXJhdGlvblNpemUgPyAxIDogMClcbiAgfTtcbiAgLy8gZ3JhZHVhbGx5IGdldCBjbG9zZXIgdG8gemVybyB0ZW1wZXJhdHVyZSAoYnV0IG5ldmVyIGhpdCBpdClcbiAgdmFyIG9sZERlZiA9IHByZXZpb3VzU3RhdGUuY3VyRGVmIHx8IHByZXZpb3VzU3RhdGUuZ2VuZXJhdGlvblsxXTtcbiAgdmFyIG9sZFNjb3JlID0gcHJldmlvdXNTdGF0ZS5zY29yZSB8fCBzY29yZXNbMV0uc2NvcmUudjtcblxuICB2YXIgbmV3RGVmID0gcHJldmlvdXNTdGF0ZS5nZW5lcmF0aW9uWzBdO1xuICB2YXIgbmV3U2NvcmUgPSBzY29yZXNbMF0uc2NvcmUudjtcblxuXG4gIHZhciB0ZW1wID0gTWF0aC5wb3coTWF0aC5FLCAtbmV4dFN0YXRlLmNvdW50ZXIgLyBjb25maWcuZ2VuZXJhdGlvblNpemUpO1xuXG4gIHZhciBzY29yZURpZmYgPSBuZXdTY29yZSAtIG9sZFNjb3JlO1xuICAvLyBJZiB0aGUgbmV4dCBwb2ludCBpcyBoaWdoZXIsIGNoYW5nZSBsb2NhdGlvblxuICBpZihzY29yZURpZmYgPiAwKXtcbiAgICBuZXh0U3RhdGUuY3VyRGVmID0gbmV3RGVmO1xuICAgIG5leHRTdGF0ZS5zY29yZSA9IG5ld1Njb3JlO1xuICAgIC8vIEVsc2Ugd2Ugd2FudCB0byBpbmNyZWFzZSBsaWtlbHlob29kIG9mIGNoYW5naW5nIGxvY2F0aW9uIGFzIHdlIGdldFxuICB9IGVsc2UgaWYoTWF0aC5yYW5kb20oKSA+IE1hdGguZXhwKC1zY29yZURpZmYvKG5leHRTdGF0ZS5rICogdGVtcCkpKXtcbiAgICBuZXh0U3RhdGUuY3VyRGVmID0gbmV3RGVmO1xuICAgIG5leHRTdGF0ZS5zY29yZSA9IG5ld1Njb3JlO1xuICB9IGVsc2Uge1xuICAgIG5leHRTdGF0ZS5jdXJEZWYgPSBvbGREZWY7XG4gICAgbmV4dFN0YXRlLnNjb3JlID0gb2xkU2NvcmU7XG4gIH1cblxuICBjb25zb2xlLmxvZyhwcmV2aW91c1N0YXRlLCBuZXh0U3RhdGUpO1xuXG4gIG5leHRTdGF0ZS5nZW5lcmF0aW9uID0gW2NyZWF0ZVN0cnVjdHVyZShjb25maWcsIHRlbXAsIG5leHRTdGF0ZS5jdXJEZWYpXTtcblxuICByZXR1cm4gbmV4dFN0YXRlO1xufVxuXG5cbmZ1bmN0aW9uIGNyZWF0ZVN0cnVjdHVyZShjb25maWcsIG11dGF0aW9uX3JhbmdlLCBwYXJlbnQpe1xuICB2YXIgc2NoZW1hID0gY29uZmlnLnNjaGVtYSxcbiAgICBnZW5fbXV0YXRpb24gPSAxLFxuICAgIGdlbmVyYXRlUmFuZG9tID0gY29uZmlnLmdlbmVyYXRlUmFuZG9tO1xuICByZXR1cm4gY3JlYXRlLmNyZWF0ZU11dGF0ZWRDbG9uZShcbiAgICBzY2hlbWEsXG4gICAgZ2VuZXJhdGVSYW5kb20sXG4gICAgcGFyZW50LFxuICAgIG11dGF0aW9uX3JhbmdlLFxuICAgIGdlbl9tdXRhdGlvblxuICApXG5cbn1cbiIsIi8qIGdsb2JhbHMgYnRvYSAqL1xudmFyIHNldHVwU2NlbmUgPSByZXF1aXJlKFwiLi9zZXR1cC1zY2VuZVwiKTtcbnZhciBjYXJSdW4gPSByZXF1aXJlKFwiLi4vY2FyLXNjaGVtYS9ydW5cIik7XG52YXIgZGVmVG9DYXIgPSByZXF1aXJlKFwiLi4vY2FyLXNjaGVtYS9kZWYtdG8tY2FyXCIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHJ1bkRlZnM7XG5mdW5jdGlvbiBydW5EZWZzKHdvcmxkX2RlZiwgZGVmcywgbGlzdGVuZXJzKSB7XG4gIGlmICh3b3JsZF9kZWYubXV0YWJsZV9mbG9vcikge1xuICAgIC8vIEdIT1NUIERJU0FCTEVEXG4gICAgd29ybGRfZGVmLmZsb29yc2VlZCA9IGJ0b2EoTWF0aC5zZWVkcmFuZG9tKCkpO1xuICB9XG5cbiAgdmFyIHNjZW5lID0gc2V0dXBTY2VuZSh3b3JsZF9kZWYpO1xuICBzY2VuZS53b3JsZC5TdGVwKDEgLyB3b3JsZF9kZWYuYm94MmRmcHMsIDIwLCAyMCk7XG4gIGNvbnNvbGUubG9nKFwiYWJvdXQgdG8gYnVpbGQgY2Fyc1wiKTtcbiAgdmFyIGNhcnMgPSBkZWZzLm1hcCgoZGVmLCBpKSA9PiB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGluZGV4OiBpLFxuICAgICAgZGVmOiBkZWYsXG4gICAgICBjYXI6IGRlZlRvQ2FyKGRlZiwgc2NlbmUud29ybGQsIHdvcmxkX2RlZiksXG4gICAgICBzdGF0ZTogY2FyUnVuLmdldEluaXRpYWxTdGF0ZSh3b3JsZF9kZWYpXG4gICAgfTtcbiAgfSk7XG4gIHZhciBhbGl2ZWNhcnMgPSBjYXJzO1xuICByZXR1cm4ge1xuICAgIHNjZW5lOiBzY2VuZSxcbiAgICBjYXJzOiBjYXJzLFxuICAgIHN0ZXA6IGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmIChhbGl2ZWNhcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIm5vIG1vcmUgY2Fyc1wiKTtcbiAgICAgIH1cbiAgICAgIHNjZW5lLndvcmxkLlN0ZXAoMSAvIHdvcmxkX2RlZi5ib3gyZGZwcywgMjAsIDIwKTtcbiAgICAgIGxpc3RlbmVycy5wcmVDYXJTdGVwKCk7XG4gICAgICBhbGl2ZWNhcnMgPSBhbGl2ZWNhcnMuZmlsdGVyKGZ1bmN0aW9uIChjYXIpIHtcbiAgICAgICAgY2FyLnN0YXRlID0gY2FyUnVuLnVwZGF0ZVN0YXRlKFxuICAgICAgICAgIHdvcmxkX2RlZiwgY2FyLmNhciwgY2FyLnN0YXRlXG4gICAgICAgICk7XG4gICAgICAgIHZhciBzdGF0dXMgPSBjYXJSdW4uZ2V0U3RhdHVzKGNhci5zdGF0ZSwgd29ybGRfZGVmKTtcbiAgICAgICAgbGlzdGVuZXJzLmNhclN0ZXAoY2FyKTtcbiAgICAgICAgaWYgKHN0YXR1cyA9PT0gMCkge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGNhci5zY29yZSA9IGNhclJ1bi5jYWxjdWxhdGVTY29yZShjYXIuc3RhdGUsIHdvcmxkX2RlZik7XG4gICAgICAgIGxpc3RlbmVycy5jYXJEZWF0aChjYXIpO1xuXG4gICAgICAgIHZhciB3b3JsZCA9IHNjZW5lLndvcmxkO1xuICAgICAgICB2YXIgd29ybGRDYXIgPSBjYXIuY2FyO1xuICAgICAgICB3b3JsZC5EZXN0cm95Qm9keSh3b3JsZENhci5jaGFzc2lzKTtcblxuICAgICAgICBmb3IgKHZhciB3ID0gMDsgdyA8IHdvcmxkQ2FyLndoZWVscy5sZW5ndGg7IHcrKykge1xuICAgICAgICAgIHdvcmxkLkRlc3Ryb3lCb2R5KHdvcmxkQ2FyLndoZWVsc1t3XSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9KVxuICAgICAgaWYgKGFsaXZlY2Fycy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgbGlzdGVuZXJzLmdlbmVyYXRpb25FbmQoY2Fycyk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbn1cbiIsIi8qIGdsb2JhbHMgYjJXb3JsZCBiMlZlYzIgYjJCb2R5RGVmIGIyRml4dHVyZURlZiBiMlBvbHlnb25TaGFwZSAqL1xuXG4vKlxuXG53b3JsZF9kZWYgPSB7XG4gIGdyYXZpdHk6IHt4LCB5fSxcbiAgZG9TbGVlcDogYm9vbGVhbixcbiAgZmxvb3JzZWVkOiBzdHJpbmcsXG4gIHRpbGVEaW1lbnNpb25zLFxuICBtYXhGbG9vclRpbGVzLFxuICBtdXRhYmxlX2Zsb29yOiBib29sZWFuXG59XG5cbiovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24od29ybGRfZGVmKXtcblxuICB2YXIgd29ybGQgPSBuZXcgYjJXb3JsZCh3b3JsZF9kZWYuZ3Jhdml0eSwgd29ybGRfZGVmLmRvU2xlZXApO1xuICB2YXIgZmxvb3JUaWxlcyA9IGN3X2NyZWF0ZUZsb29yKFxuICAgIHdvcmxkLFxuICAgIHdvcmxkX2RlZi5mbG9vcnNlZWQsXG4gICAgd29ybGRfZGVmLnRpbGVEaW1lbnNpb25zLFxuICAgIHdvcmxkX2RlZi5tYXhGbG9vclRpbGVzLFxuICAgIHdvcmxkX2RlZi5tdXRhYmxlX2Zsb29yXG4gICk7XG5cbiAgdmFyIGxhc3RfdGlsZSA9IGZsb29yVGlsZXNbXG4gICAgZmxvb3JUaWxlcy5sZW5ndGggLSAxXG4gIF07XG4gIHZhciBsYXN0X2ZpeHR1cmUgPSBsYXN0X3RpbGUuR2V0Rml4dHVyZUxpc3QoKTtcbiAgdmFyIGxhc3RfdGlsZV9wb3NpdGlvbiA9IGxhc3RfdGlsZS5HZXRXb3JsZFBvaW50KFxuICAgIGxhc3RfZml4dHVyZS5HZXRTaGFwZSgpLm1fdmVydGljZXNbM11cbiAgKTtcblxuICAvLyBMb29wIHRocm91Z2ggZmlyc3Qgc2V2ZXJhbCB0aWxlcyB0byBmaW5kIGEgc2FmZSBoZWlnaHQgZm9yIHBsYWNpbmcgY2Fyc1xuICB3b3JsZC5zdGFydEhlaWdodCA9IC0xMDtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCAyMDsgaSsrKSB7XG4gICAgdmFyIHRpbGUgPSBmbG9vclRpbGVzW2ldO1xuICAgIHZhciBmaXh0dXJlID0gdGlsZS5HZXRGaXh0dXJlTGlzdCgpO1xuICAgIHZhciB0b3BSaWdodFZlcnRpY2UgPSB0aWxlLkdldFdvcmxkUG9pbnQoZml4dHVyZS5HZXRTaGFwZSgpLm1fdmVydGljZXNbM10pO1xuICAgIHZhciB0b3BMZWZ0VmVydGljZSA9IHRpbGUuR2V0V29ybGRQb2ludChmaXh0dXJlLkdldFNoYXBlKCkubV92ZXJ0aWNlc1swXSk7XG4gICAgaWYgKHRvcFJpZ2h0VmVydGljZS55ID4gd29ybGQuc3RhcnRIZWlnaHQpIHtcbiAgICAgIHdvcmxkLnN0YXJ0SGVpZ2h0ID0gdG9wUmlnaHRWZXJ0aWNlLnk7XG4gICAgfVxuICAgIGlmICh0b3BMZWZ0VmVydGljZS55ID4gd29ybGQuc3RhcnRIZWlnaHQpIHtcbiAgICAgIHdvcmxkLnN0YXJ0SGVpZ2h0ID0gdG9wTGVmdFZlcnRpY2UueTtcbiAgICB9XG4gICAgaWYgKHRvcFJpZ2h0VmVydGljZS54ID4gMikge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG4gIHdvcmxkLmZpbmlzaExpbmUgPSBsYXN0X3RpbGVfcG9zaXRpb24ueDtcbiAgcmV0dXJuIHtcbiAgICB3b3JsZDogd29ybGQsXG4gICAgZmxvb3JUaWxlczogZmxvb3JUaWxlcyxcbiAgICBmaW5pc2hMaW5lOiBsYXN0X3RpbGVfcG9zaXRpb24ueFxuICB9O1xufVxuXG5mdW5jdGlvbiBjd19jcmVhdGVGbG9vcih3b3JsZCwgZmxvb3JzZWVkLCBkaW1lbnNpb25zLCBtYXhGbG9vclRpbGVzLCBtdXRhYmxlX2Zsb29yKSB7XG4gIHZhciBsYXN0X3RpbGUgPSBudWxsO1xuICB2YXIgdGlsZV9wb3NpdGlvbiA9IG5ldyBiMlZlYzIoLTUsIDApO1xuICB2YXIgY3dfZmxvb3JUaWxlcyA9IFtdO1xuICBNYXRoLnNlZWRyYW5kb20oZmxvb3JzZWVkKTtcbiAgZm9yICh2YXIgayA9IDA7IGsgPCBtYXhGbG9vclRpbGVzOyBrKyspIHtcbiAgICBpZiAoIW11dGFibGVfZmxvb3IpIHtcbiAgICAgIC8vIGtlZXAgb2xkIGltcG9zc2libGUgdHJhY2tzIGlmIG5vdCB1c2luZyBtdXRhYmxlIGZsb29yc1xuICAgICAgbGFzdF90aWxlID0gY3dfY3JlYXRlRmxvb3JUaWxlKFxuICAgICAgICB3b3JsZCwgZGltZW5zaW9ucywgdGlsZV9wb3NpdGlvbiwgKE1hdGgucmFuZG9tKCkgKiAzIC0gMS41KSAqIDEuNSAqIGsgLyBtYXhGbG9vclRpbGVzXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBpZiBwYXRoIGlzIG11dGFibGUgb3ZlciByYWNlcywgY3JlYXRlIHNtb290aGVyIHRyYWNrc1xuICAgICAgbGFzdF90aWxlID0gY3dfY3JlYXRlRmxvb3JUaWxlKFxuICAgICAgICB3b3JsZCwgZGltZW5zaW9ucywgdGlsZV9wb3NpdGlvbiwgKE1hdGgucmFuZG9tKCkgKiAzIC0gMS41KSAqIDEuMiAqIGsgLyBtYXhGbG9vclRpbGVzXG4gICAgICApO1xuICAgIH1cbiAgICBjd19mbG9vclRpbGVzLnB1c2gobGFzdF90aWxlKTtcbiAgICB2YXIgbGFzdF9maXh0dXJlID0gbGFzdF90aWxlLkdldEZpeHR1cmVMaXN0KCk7XG4gICAgdGlsZV9wb3NpdGlvbiA9IGxhc3RfdGlsZS5HZXRXb3JsZFBvaW50KGxhc3RfZml4dHVyZS5HZXRTaGFwZSgpLm1fdmVydGljZXNbM10pO1xuICB9XG4gIHJldHVybiBjd19mbG9vclRpbGVzO1xufVxuXG5cbmZ1bmN0aW9uIGN3X2NyZWF0ZUZsb29yVGlsZSh3b3JsZCwgZGltLCBwb3NpdGlvbiwgYW5nbGUpIHtcbiAgdmFyIGJvZHlfZGVmID0gbmV3IGIyQm9keURlZigpO1xuXG4gIGJvZHlfZGVmLnBvc2l0aW9uLlNldChwb3NpdGlvbi54LCBwb3NpdGlvbi55KTtcbiAgdmFyIGJvZHkgPSB3b3JsZC5DcmVhdGVCb2R5KGJvZHlfZGVmKTtcbiAgdmFyIGZpeF9kZWYgPSBuZXcgYjJGaXh0dXJlRGVmKCk7XG4gIGZpeF9kZWYuc2hhcGUgPSBuZXcgYjJQb2x5Z29uU2hhcGUoKTtcbiAgZml4X2RlZi5mcmljdGlvbiA9IDAuNTtcblxuICB2YXIgY29vcmRzID0gbmV3IEFycmF5KCk7XG4gIGNvb3Jkcy5wdXNoKG5ldyBiMlZlYzIoMCwgMCkpO1xuICBjb29yZHMucHVzaChuZXcgYjJWZWMyKDAsIC1kaW0ueSkpO1xuICBjb29yZHMucHVzaChuZXcgYjJWZWMyKGRpbS54LCAtZGltLnkpKTtcbiAgY29vcmRzLnB1c2gobmV3IGIyVmVjMihkaW0ueCwgMCkpO1xuXG4gIHZhciBjZW50ZXIgPSBuZXcgYjJWZWMyKDAsIDApO1xuXG4gIHZhciBuZXdjb29yZHMgPSBjd19yb3RhdGVGbG9vclRpbGUoY29vcmRzLCBjZW50ZXIsIGFuZ2xlKTtcblxuICBmaXhfZGVmLnNoYXBlLlNldEFzQXJyYXkobmV3Y29vcmRzKTtcblxuICBib2R5LkNyZWF0ZUZpeHR1cmUoZml4X2RlZik7XG4gIHJldHVybiBib2R5O1xufVxuXG5mdW5jdGlvbiBjd19yb3RhdGVGbG9vclRpbGUoY29vcmRzLCBjZW50ZXIsIGFuZ2xlKSB7XG4gIHJldHVybiBjb29yZHMubWFwKGZ1bmN0aW9uKGNvb3JkKXtcbiAgICByZXR1cm4ge1xuICAgICAgeDogTWF0aC5jb3MoYW5nbGUpICogKGNvb3JkLnggLSBjZW50ZXIueCkgLSBNYXRoLnNpbihhbmdsZSkgKiAoY29vcmQueSAtIGNlbnRlci55KSArIGNlbnRlci54LFxuICAgICAgeTogTWF0aC5zaW4oYW5nbGUpICogKGNvb3JkLnggLSBjZW50ZXIueCkgKyBNYXRoLmNvcyhhbmdsZSkgKiAoY29vcmQueSAtIGNlbnRlci55KSArIGNlbnRlci55LFxuICAgIH07XG4gIH0pO1xufVxuIl19
