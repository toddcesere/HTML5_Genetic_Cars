(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
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

},{}],2:[function(require,module,exports){
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

},{"./car-constants.json":1}],3:[function(require,module,exports){
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

},{"../machine-learning/create-instance":20}],4:[function(require,module,exports){


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

},{}],5:[function(require,module,exports){
/* globals document */

var run = require("../car-schema/run");

/* ========================================================================= */
/* === Car ================================================================= */
var cw_Car = function () {
  this.__constructor.apply(this, arguments);
}

cw_Car.prototype.__constructor = function (car) {
  this.car = car;
  this.car_def = car.def;
  var car_def = this.car_def;

  this.frames = 0;
  this.alive = true;
  this.is_elite = car.def.is_elite;
  this.healthBar = document.getElementById("health" + car_def.index).style;
  this.healthBarText = document.getElementById("health" + car_def.index).nextSibling.nextSibling;
  this.healthBarText.innerHTML = car_def.index;
  this.minimapmarker = document.getElementById("bar" + car_def.index);

  if (this.is_elite) {
    this.healthBar.backgroundColor = "#3F72AF";
    this.minimapmarker.style.borderLeft = "1px solid #3F72AF";
    this.minimapmarker.innerHTML = car_def.index;
  } else {
    this.healthBar.backgroundColor = "#F7C873";
    this.minimapmarker.style.borderLeft = "1px solid #F7C873";
    this.minimapmarker.innerHTML = car_def.index;
  }

}

cw_Car.prototype.getPosition = function () {
  return this.car.car.chassis.GetPosition();
}

cw_Car.prototype.kill = function (currentRunner, constants) {
  this.minimapmarker.style.borderLeft = "1px solid #3F72AF";
  var finishLine = currentRunner.scene.finishLine
  var max_car_health = constants.max_car_health;
  var status = run.getStatus(this.car.state, {
    finishLine: finishLine,
    max_car_health: max_car_health,
  })
  switch(status){
    case 1: {
      this.healthBar.width = "0";
      break
    }
    case -1: {
      this.healthBarText.innerHTML = "&dagger;";
      this.healthBar.width = "0";
      break
    }
  }
  this.alive = false;

}

module.exports = cw_Car;

},{"../car-schema/run":4}],6:[function(require,module,exports){

var cw_drawVirtualPoly = require("./draw-virtual-poly");
var cw_drawCircle = require("./draw-circle");

module.exports = function(car_constants, myCar, camera, ctx){
  var camera_x = camera.pos.x;
  var zoom = camera.zoom;

  var wheelMinDensity = car_constants.wheelMinDensity;
  var wheelDensityRange = car_constants.wheelDensityRange;
  var wheelMinFrictionExponent = car_constants.wheelMinFrictionExponent;
  var wheelFrictionExponentRange = car_constants.wheelFrictionExponentRange;

  if (!myCar.alive) {
    return;
  }
  var myCarPos = myCar.getPosition();

  if (myCarPos.x < (camera_x - 5)) {
    // too far behind, don't draw
    return;
  }

  ctx.lineWidth = 1 / zoom;

  var wheels = myCar.car.car.wheels;

  for (var i = 0; i < wheels.length; i++) {
    var wheel = wheels[i];
    for (var fixture = wheel.GetFixtureList(); fixture; fixture = fixture.m_next) {
      var shape = fixture.GetShape();
      var color = Math.round(255 - (255 * (fixture.m_density - wheelMinDensity)) / wheelDensityRange).toString();
      var rgbcolor = "rgb(" + color + "," + color + "," + color + ")";
      ctx.strokeStyle = "rgb(" + Math.round(255 * (Math.log10(fixture.m_friction) - wheelMinFrictionExponent) / wheelFrictionExponentRange).toString() + ", 0, 0)";
      cw_drawCircle(ctx, wheel, shape.m_p, shape.m_radius, wheel.m_sweep.a, rgbcolor);
    }
  }

  if (myCar.is_elite) {
    ctx.strokeStyle = "#3F72AF";
    ctx.fillStyle = "#DBE2EF";
  } else {
    ctx.strokeStyle = "#F7C873";
    ctx.fillStyle = "#FAEBCD";
  }
  ctx.beginPath();

  var chassis = myCar.car.car.chassis;

  for (f = chassis.GetFixtureList(); f; f = f.m_next) {
    var cs = f.GetShape();
    cw_drawVirtualPoly(ctx, chassis, cs.m_vertices, cs.m_vertexCount);
  }
  ctx.fill();
  ctx.stroke();
}

},{"./draw-circle":7,"./draw-virtual-poly":9}],7:[function(require,module,exports){

module.exports = cw_drawCircle;

function cw_drawCircle(ctx, body, center, radius, angle, color) {
  var p = body.GetWorldPoint(center);
  ctx.fillStyle = color;

  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI, true);

  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + radius * Math.cos(angle), p.y + radius * Math.sin(angle));

  ctx.fill();
  ctx.stroke();
}

},{}],8:[function(require,module,exports){
var cw_drawVirtualPoly = require("./draw-virtual-poly");
module.exports = function(ctx, camera, cw_floorTiles) {
  var camera_x = camera.pos.x;
  var zoom = camera.zoom;
  ctx.strokeStyle = "#000";
  ctx.fillStyle = "#777";
  ctx.lineWidth = 1 / zoom;
  ctx.beginPath();

  var k;
  if(camera.pos.x - 10 > 0){
    k = Math.floor((camera.pos.x - 10) / 1.5);
  } else {
    k = 0;
  }

  // console.log(k);

  outer_loop:
    for (k; k < cw_floorTiles.length; k++) {
      var b = cw_floorTiles[k];
      for (var f = b.GetFixtureList(); f; f = f.m_next) {
        var s = f.GetShape();
        var shapePosition = b.GetWorldPoint(s.m_vertices[0]).x;
        if ((shapePosition > (camera_x - 5)) && (shapePosition < (camera_x + 10))) {
          cw_drawVirtualPoly(ctx, b, s.m_vertices, s.m_vertexCount);
        }
        if (shapePosition > camera_x + 10) {
          break outer_loop;
        }
      }
    }
  ctx.fill();
  ctx.stroke();
}

},{"./draw-virtual-poly":9}],9:[function(require,module,exports){


module.exports = function(ctx, body, vtx, n_vtx) {
  // set strokestyle and fillstyle before call
  // call beginPath before call

  var p0 = body.GetWorldPoint(vtx[0]);
  ctx.moveTo(p0.x, p0.y);
  for (var i = 1; i < n_vtx; i++) {
    var p = body.GetWorldPoint(vtx[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.lineTo(p0.x, p0.y);
}

},{}],10:[function(require,module,exports){
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

},{"./scatter-plot":11}],11:[function(require,module,exports){
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

},{}],12:[function(require,module,exports){

module.exports = generateRandom;
function generateRandom(){
  return Math.random();
}

},{}],13:[function(require,module,exports){
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

},{}],14:[function(require,module,exports){
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

},{"../car-schema/construct.js":2,"./generateRandom":12,"./pickParent":15,"./selectFromAllParents":16}],15:[function(require,module,exports){
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

},{}],16:[function(require,module,exports){
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

},{"./inbreeding-coefficient":13}],17:[function(require,module,exports){

module.exports = function(car) {
  var out = {
    chassis: ghost_get_chassis(car.chassis),
    wheels: [],
    pos: {x: car.chassis.GetPosition().x, y: car.chassis.GetPosition().y}
  };

  for (var i = 0; i < car.wheels.length; i++) {
    out.wheels[i] = ghost_get_wheel(car.wheels[i]);
  }

  return out;
}

function ghost_get_chassis(c) {
  var gc = [];

  for (var f = c.GetFixtureList(); f; f = f.m_next) {
    var s = f.GetShape();

    var p = {
      vtx: [],
      num: 0
    }

    p.num = s.m_vertexCount;

    for (var i = 0; i < s.m_vertexCount; i++) {
      p.vtx.push(c.GetWorldPoint(s.m_vertices[i]));
    }

    gc.push(p);
  }

  return gc;
}

function ghost_get_wheel(w) {
  var gw = [];

  for (var f = w.GetFixtureList(); f; f = f.m_next) {
    var s = f.GetShape();

    var c = {
      pos: w.GetWorldPoint(s.m_p),
      rad: s.m_radius,
      ang: w.m_sweep.a
    }

    gw.push(c);
  }

  return gw;
}

},{}],18:[function(require,module,exports){

var ghost_get_frame = require("./car-to-ghost.js");

var enable_ghost = true;

module.exports = {
  ghost_create_replay: ghost_create_replay,
  ghost_create_ghost: ghost_create_ghost,
  ghost_pause: ghost_pause,
  ghost_resume: ghost_resume,
  ghost_get_position: ghost_get_position,
  ghost_compare_to_replay: ghost_compare_to_replay,
  ghost_move_frame: ghost_move_frame,
  ghost_add_replay_frame: ghost_add_replay_frame,
  ghost_draw_frame: ghost_draw_frame,
  ghost_reset_ghost: ghost_reset_ghost
}

function ghost_create_replay() {
  if (!enable_ghost)
    return null;

  return {
    num_frames: 0,
    frames: [],
  }
}

function ghost_create_ghost() {
  if (!enable_ghost)
    return null;

  return {
    replay: null,
    frame: 0,
    dist: -100
  }
}

function ghost_reset_ghost(ghost) {
  if (!enable_ghost)
    return;
  if (ghost == null)
    return;
  ghost.frame = 0;
}

function ghost_pause(ghost) {
  if (ghost != null)
    ghost.old_frame = ghost.frame;
  ghost_reset_ghost(ghost);
}

function ghost_resume(ghost) {
  if (ghost != null)
    ghost.frame = ghost.old_frame;
}

function ghost_get_position(ghost) {
  if (!enable_ghost)
    return;
  if (ghost == null)
    return;
  if (ghost.frame < 0)
    return;
  if (ghost.replay == null)
    return;
  var frame = ghost.replay.frames[ghost.frame];
  return frame.pos;
}

function ghost_compare_to_replay(replay, ghost, max) {
  if (!enable_ghost)
    return;
  if (ghost == null)
    return;
  if (replay == null)
    return;

  if (ghost.dist < max) {
    ghost.replay = replay;
    ghost.dist = max;
    ghost.frame = 0;
  }
}

function ghost_move_frame(ghost) {
  if (!enable_ghost)
    return;
  if (ghost == null)
    return;
  if (ghost.replay == null)
    return;
  ghost.frame++;
  if (ghost.frame >= ghost.replay.num_frames)
    ghost.frame = ghost.replay.num_frames - 1;
}

function ghost_add_replay_frame(replay, car) {
  if (!enable_ghost)
    return;
  if (replay == null)
    return;

  var frame = ghost_get_frame(car);
  replay.frames.push(frame);
  replay.num_frames++;
}

function ghost_draw_frame(ctx, ghost, camera) {
  var zoom = camera.zoom;
  if (!enable_ghost)
    return;
  if (ghost == null)
    return;
  if (ghost.frame < 0)
    return;
  if (ghost.replay == null)
    return;

  var frame = ghost.replay.frames[ghost.frame];

  // wheel style
  ctx.fillStyle = "#eee";
  ctx.strokeStyle = "#aaa";
  ctx.lineWidth = 1 / zoom;

  for (var i = 0; i < frame.wheels.length; i++) {
    for (var w in frame.wheels[i]) {
      ghost_draw_circle(ctx, frame.wheels[i][w].pos, frame.wheels[i][w].rad, frame.wheels[i][w].ang);
    }
  }

  // chassis style
  ctx.strokeStyle = "#aaa";
  ctx.fillStyle = "#eee";
  ctx.lineWidth = 1 / zoom;
  ctx.beginPath();
  for (var c in frame.chassis)
    ghost_draw_poly(ctx, frame.chassis[c].vtx, frame.chassis[c].num);
  ctx.fill();
  ctx.stroke();
}

function ghost_draw_poly(ctx, vtx, n_vtx) {
  ctx.moveTo(vtx[0].x, vtx[0].y);
  for (var i = 1; i < n_vtx; i++) {
    ctx.lineTo(vtx[i].x, vtx[i].y);
  }
  ctx.lineTo(vtx[0].x, vtx[0].y);
}

function ghost_draw_circle(ctx, center, radius, angle) {
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI, true);

  ctx.moveTo(center.x, center.y);
  ctx.lineTo(center.x + radius * Math.cos(angle), center.y + radius * Math.sin(angle));

  ctx.fill();
  ctx.stroke();
}

},{"./car-to-ghost.js":17}],19:[function(require,module,exports){
/* globals document performance localStorage alert confirm btoa HTMLDivElement */
/* globals b2Vec2 */
// Global Vars

var worldRun = require("./world/run.js");
var carConstruct = require("./car-schema/construct.js");

var manageRound = require("./machine-learning/genetic-algorithm/manage-round.js");

var ghost_fns = require("./ghost/index.js");

var drawCar = require("./draw/draw-car.js");
var graph_fns = require("./draw/plot-graphs.js");
var plot_graphs = graph_fns.plotGraphs;
var cw_clearGraphics = graph_fns.clearGraphics;
var cw_drawFloor = require("./draw/draw-floor.js");

var ghost_draw_frame = ghost_fns.ghost_draw_frame;
var ghost_create_ghost = ghost_fns.ghost_create_ghost;
var ghost_add_replay_frame = ghost_fns.ghost_add_replay_frame;
var ghost_compare_to_replay = ghost_fns.ghost_compare_to_replay;
var ghost_get_position = ghost_fns.ghost_get_position;
var ghost_move_frame = ghost_fns.ghost_move_frame;
var ghost_reset_ghost = ghost_fns.ghost_reset_ghost
var ghost_pause = ghost_fns.ghost_pause;
var ghost_resume = ghost_fns.ghost_resume;
var ghost_create_replay = ghost_fns.ghost_create_replay;

var cw_Car = require("./draw/draw-car-stats.js");
var ghost;
var carMap = new Map();

var doDraw = true;
var cw_paused = false;

var box2dfps = 60;
var screenfps = 60;
var skipTicks = Math.round(1000 / box2dfps);
var maxFrameSkip = skipTicks * 2;

var canvas = document.getElementById("mainbox");
var ctx = canvas.getContext("2d");

var camera = {
  speed: 0.05,
  pos: {
    x: 0, y: 0
  },
  target: -1,
  zoom: 70
}

var minimapcamera = document.getElementById("minimapcamera").style;
var minimapholder = document.querySelector("#minimapholder");

var minimapcanvas = document.getElementById("minimap");
var minimapctx = minimapcanvas.getContext("2d");
var minimapscale = 3;
var minimapfogdistance = 0;
var fogdistance = document.getElementById("minimapfog").style;


var carConstants = carConstruct.carConstants();


var max_car_health = box2dfps * 10;

var cw_ghostReplayInterval = null;

var distanceMeter = document.getElementById("distancemeter");
var heightMeter = document.getElementById("heightmeter");

var leaderPosition = {
  x: 0, y: 0
}

minimapcamera.width = 12 * minimapscale + "px";
minimapcamera.height = 6 * minimapscale + "px";


// ======= WORLD STATE ======
var generationConfig = require("./generation-config");


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

var cw_deadCars;
var graphState = {
  cw_topScores: [],
  cw_graphAverage: [],
  cw_graphElite: [],
  cw_graphTop: [],
};

function resetGraphState(){
  graphState = {
    cw_topScores: [],
    cw_graphAverage: [],
    cw_graphElite: [],
    cw_graphTop: [],
  };
}



// ==========================

var generationState;

// ======== Activity State ====
var currentRunner;
var loops = 0;
var nextGameTick = (new Date).getTime();

function showDistance(distance, height) {
  distanceMeter.innerHTML = distance + " meters<br />";
  heightMeter.innerHTML = height + " meters";
  if (distance > minimapfogdistance) {
    fogdistance.width = 800 - Math.round(distance + 15) * minimapscale + "px";
    minimapfogdistance = distance;
  }
}



/* === END Car ============================================================= */
/* ========================================================================= */


/* ========================================================================= */
/* ==== Generation ========================================================= */

function cw_generationZero() {

  generationState = manageRound.generationZero(generationConfig());
}

function resetCarUI(){
  cw_deadCars = 0;
  leaderPosition = {
    x: 0, y: 0
  };
  document.getElementById("generation").innerHTML = generationState.counter.toString();
  document.getElementById("cars").innerHTML = "";
  document.getElementById("population").innerHTML = generationConfig.constants.generationSize.toString();
}

/* ==== END Genration ====================================================== */
/* ========================================================================= */

/* ========================================================================= */
/* ==== Drawing ============================================================ */

function cw_drawScreen() {
  var floorTiles = currentRunner.scene.floorTiles;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  cw_setCameraPosition();
  var camera_x = camera.pos.x;
  var camera_y = camera.pos.y;
  var zoom = camera.zoom;
  ctx.translate(200 - (camera_x * zoom), 200 + (camera_y * zoom));
  ctx.scale(zoom, -zoom);
  cw_drawFloor(ctx, camera, floorTiles);
  ghost_draw_frame(ctx, ghost, camera);
  cw_drawCars();
  ctx.restore();
}

function cw_minimapCamera(/* x, y*/) {
  var camera_x = camera.pos.x
  var camera_y = camera.pos.y
  minimapcamera.left = Math.round((2 + camera_x) * minimapscale) + "px";
  minimapcamera.top = Math.round((31 - camera_y) * minimapscale) + "px";
}

function cw_setCameraTarget(k) {
  camera.target = k;
}

function cw_setCameraPosition() {
  var cameraTargetPosition
  if (camera.target !== -1) {
    cameraTargetPosition = carMap.get(camera.target).getPosition();
  } else {
    cameraTargetPosition = leaderPosition;
  }
  var diff_y = camera.pos.y - cameraTargetPosition.y;
  var diff_x = camera.pos.x - cameraTargetPosition.x;
  camera.pos.y -= camera.speed * diff_y;
  camera.pos.x -= camera.speed * diff_x;
  cw_minimapCamera(camera.pos.x, camera.pos.y);
}

function cw_drawGhostReplay() {
  var floorTiles = currentRunner.scene.floorTiles;
  var carPosition = ghost_get_position(ghost);
  camera.pos.x = carPosition.x;
  camera.pos.y = carPosition.y;
  cw_minimapCamera(camera.pos.x, camera.pos.y);
  showDistance(
    Math.round(carPosition.x * 100) / 100,
    Math.round(carPosition.y * 100) / 100
  );
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(
    200 - (carPosition.x * camera.zoom),
    200 + (carPosition.y * camera.zoom)
  );
  ctx.scale(camera.zoom, -camera.zoom);
  ghost_draw_frame(ctx, ghost);
  ghost_move_frame(ghost);
  cw_drawFloor(ctx, camera, floorTiles);
  ctx.restore();
}


function cw_drawCars() {
  var cw_carArray = Array.from(carMap.values());
  for (var k = (cw_carArray.length - 1); k >= 0; k--) {
    var myCar = cw_carArray[k];
    drawCar(carConstants, myCar, camera, ctx)
  }
}

function toggleDisplay() {
  canvas.width = canvas.width;
  if (doDraw) {
    doDraw = false;
    cw_stopSimulation();
    cw_runningInterval = setInterval(function () {
      var time = performance.now() + (1000 / screenfps);
      while (time > performance.now()) {
        simulationStep();
      }
    }, 1);
  } else {
    doDraw = true;
    clearInterval(cw_runningInterval);
    cw_startSimulation();
  }
}

function cw_drawMiniMap() {
  var floorTiles = currentRunner.scene.floorTiles;
  var last_tile = null;
  var tile_position = new b2Vec2(-5, 0);
  minimapfogdistance = 0;
  fogdistance.width = "800px";
  minimapcanvas.width = minimapcanvas.width;
  minimapctx.strokeStyle = "#3F72AF";
  minimapctx.beginPath();
  minimapctx.moveTo(0, 35 * minimapscale);
  for (var k = 0; k < floorTiles.length; k++) {
    last_tile = floorTiles[k];
    var last_fixture = last_tile.GetFixtureList();
    var last_world_coords = last_tile.GetWorldPoint(last_fixture.GetShape().m_vertices[3]);
    tile_position = last_world_coords;
    minimapctx.lineTo((tile_position.x + 5) * minimapscale, (-tile_position.y + 35) * minimapscale);
  }
  minimapctx.stroke();
}

/* ==== END Drawing ======================================================== */
/* ========================================================================= */
var uiListeners = {
  preCarStep: function(){
    ghost_move_frame(ghost);
  },
  carStep(car){
    updateCarUI(car);
  },
  carDeath(carInfo){

    var k = carInfo.index;

    var car = carInfo.car, score = carInfo.score;
    carMap.get(carInfo).kill(currentRunner, world_def);

    // refocus camera to leader on death
    if (camera.target == carInfo) {
      cw_setCameraTarget(-1);
    }
    // console.log(score);
    carMap.delete(carInfo);
    ghost_compare_to_replay(car.replay, ghost, score.v);
    score.i = generationState.counter;

    cw_deadCars++;
    var generationSize = generationConfig.constants.generationSize;
    document.getElementById("population").innerHTML = (generationSize - cw_deadCars).toString();

    // console.log(leaderPosition.leader, k)
    if (leaderPosition.leader == k) {
      // leader is dead, find new leader
      cw_findLeader();
    }
  },
  generationEnd(results){
    cleanupRound(results);
    return cw_newRound(results);
  }
}

function simulationStep() {  
  currentRunner.step();
  showDistance(
    Math.round(leaderPosition.x * 100) / 100,
    Math.round(leaderPosition.y * 100) / 100
  );
}

function gameLoop() {
  loops = 0;
  while (!cw_paused && (new Date).getTime() > nextGameTick && loops < maxFrameSkip) {   
    nextGameTick += skipTicks;
    loops++;
  }
  simulationStep();
  cw_drawScreen();

  if(!cw_paused) window.requestAnimationFrame(gameLoop);
}

function updateCarUI(carInfo){
  var k = carInfo.index;
  var car = carMap.get(carInfo);
  var position = car.getPosition();

  ghost_add_replay_frame(car.replay, car.car.car);
  car.minimapmarker.style.left = Math.round((position.x + 5) * minimapscale) + "px";
  car.healthBar.width = Math.round((car.car.state.health / max_car_health) * 100) + "%";
  if (position.x > leaderPosition.x) {
    leaderPosition = position;
    leaderPosition.leader = k;
    // console.log("new leader: ", k);
  }
}

function cw_findLeader() {
  var lead = 0;
  var cw_carArray = Array.from(carMap.values());
  for (var k = 0; k < cw_carArray.length; k++) {
    if (!cw_carArray[k].alive) {
      continue;
    }
    var position = cw_carArray[k].getPosition();
    if (position.x > lead) {
      leaderPosition = position;
      leaderPosition.leader = k;
    }
  }
}

function fastForward(){
  var gen = generationState.counter;
  while(gen === generationState.counter){
    currentRunner.step();
  }
}

function cleanupRound(results){

  results.sort(function (a, b) {
    if (a.score.v > b.score.v) {
      return -1
    } else {
      return 1
    }
  })
  graphState = plot_graphs(
    document.getElementById("graphcanvas"),
    document.getElementById("topscores"),
    null,
    graphState,
    results
  );
}

function cw_newRound(results) {
  camera.pos.x = camera.pos.y = 0;
  cw_setCameraTarget(-1);

  generationState = manageRound.nextGeneration(
    generationState, results, generationConfig()
  );
  if (world_def.mutable_floor) {
    // GHOST DISABLED
    ghost = null;
    world_def.floorseed = btoa(Math.seedrandom());
  } else {
    // RE-ENABLE GHOST
    ghost_reset_ghost(ghost);
  }
  currentRunner = worldRun(world_def, generationState.generation, uiListeners);
  setupCarUI();
  cw_drawMiniMap();
  resetCarUI();
}

function cw_startSimulation() {
  cw_paused = false;
  window.requestAnimationFrame(gameLoop);
}

function cw_stopSimulation() {
  cw_paused = true;
}

function cw_clearPopulationWorld() {
  carMap.forEach(function(car){
    car.kill(currentRunner, world_def);
  });
}

function cw_resetPopulationUI() {
  document.getElementById("generation").innerHTML = "";
  document.getElementById("cars").innerHTML = "";
  document.getElementById("topscores").innerHTML = "";
  cw_clearGraphics(document.getElementById("graphcanvas"));
  resetGraphState();
}

function cw_resetWorld() {
  doDraw = true;
  cw_stopSimulation();
  world_def.floorseed = document.getElementById("newseed").value;
  cw_clearPopulationWorld();
  cw_resetPopulationUI();

  Math.seedrandom();
  cw_generationZero();
  currentRunner = worldRun(
    world_def, generationState.generation, uiListeners
  );

  ghost = ghost_create_ghost();
  resetCarUI();
  setupCarUI()
  cw_drawMiniMap();

  cw_startSimulation();
}

function setupCarUI(){
  currentRunner.cars.map(function(carInfo){
    var car = new cw_Car(carInfo, carMap);
    carMap.set(carInfo, car);
    car.replay = ghost_create_replay();
    ghost_add_replay_frame(car.replay, car.car.car);
  })
}


document.querySelector("#fast-forward").addEventListener("click", function(){
  fastForward()
});

document.querySelector("#save-progress").addEventListener("click", function(){
  saveProgress()
});

document.querySelector("#restore-progress").addEventListener("click", function(){
  restoreProgress()
});

document.querySelector("#toggle-display").addEventListener("click", function(){
  toggleDisplay()
})

document.querySelector("#new-population").addEventListener("click", function(){
  cw_resetPopulationUI()
  cw_generationZero();
  ghost = ghost_create_ghost();
  resetCarUI();
})

function saveProgress() {
  localStorage.cw_savedGeneration = JSON.stringify(generationState.generation);
  localStorage.cw_genCounter = generationState.counter;
  localStorage.cw_ghost = JSON.stringify(ghost);
  localStorage.cw_topScores = JSON.stringify(graphState.cw_topScores);
  localStorage.cw_floorSeed = world_def.floorseed;
}

function restoreProgress() {
  if (typeof localStorage.cw_savedGeneration == 'undefined' || localStorage.cw_savedGeneration == null) {
    alert("No saved progress found");
    return;
  }
  cw_stopSimulation();
  generationState.generation = JSON.parse(localStorage.cw_savedGeneration);
  generationState.counter = localStorage.cw_genCounter;
  ghost = JSON.parse(localStorage.cw_ghost);
  graphState.cw_topScores = JSON.parse(localStorage.cw_topScores);
  world_def.floorseed = localStorage.cw_floorSeed;
  document.getElementById("newseed").value = world_def.floorseed;

  currentRunner = worldRun(world_def, generationState.generation, uiListeners);
  cw_drawMiniMap();
  Math.seedrandom();

  resetCarUI();
  cw_startSimulation();
}

document.querySelector("#confirm-reset").addEventListener("click", function(){
  cw_confirmResetWorld()
})

function cw_confirmResetWorld() {
  if (confirm('Really reset world?')) {
    cw_resetWorld();
  } else {
    return false;
  }
}

// ghost replay stuff


function cw_pauseSimulation() {
  cw_paused = true;
  ghost_pause(ghost);
}

function cw_resumeSimulation() {
  cw_paused = false;
  ghost_resume(ghost);
  window.requestAnimationFrame(gameLoop);
}

function cw_startGhostReplay() {
  if (!doDraw) {
    toggleDisplay();
  }
  cw_pauseSimulation();
  cw_ghostReplayInterval = setInterval(cw_drawGhostReplay, Math.round(1000 / screenfps));
}

function cw_stopGhostReplay() {
  clearInterval(cw_ghostReplayInterval);
  cw_ghostReplayInterval = null;
  cw_findLeader();
  camera.pos.x = leaderPosition.x;
  camera.pos.y = leaderPosition.y;
  cw_resumeSimulation();
}

document.querySelector("#toggle-ghost").addEventListener("click", function(e){
  cw_toggleGhostReplay(e.target)
})

function cw_toggleGhostReplay(button) {
  if (cw_ghostReplayInterval == null) {
    cw_startGhostReplay();
    button.value = "Resume simulation";
  } else {
    cw_stopGhostReplay();
    button.value = "View top replay";
  }
}
// ghost replay stuff END

// initial stuff, only called once (hopefully)
function cw_init() {
  // clone silver dot and health bar
  var mmm = document.getElementsByName('minimapmarker')[0];
  var hbar = document.getElementsByName('healthbar')[0];
  var generationSize = generationConfig.constants.generationSize;

  for (var k = 0; k < generationSize; k++) {

    // minimap markers
    var newbar = mmm.cloneNode(true);
    newbar.id = "bar" + k;
    newbar.style.paddingTop = k * 9 + "px";
    minimapholder.appendChild(newbar);

    // health bars
    var newhealth = hbar.cloneNode(true);
    newhealth.getElementsByTagName("DIV")[0].id = "health" + k;
    newhealth.car_index = k;
    document.getElementById("health").appendChild(newhealth);
  }
  mmm.parentNode.removeChild(mmm);
  hbar.parentNode.removeChild(hbar);
  world_def.floorseed = btoa(Math.seedrandom());
  cw_generationZero();
  ghost = ghost_create_ghost();
  resetCarUI();
  currentRunner = worldRun(world_def, generationState.generation, uiListeners);
  setupCarUI();
  cw_drawMiniMap();
  window.requestAnimationFrame(gameLoop);
  
}

function relMouseCoords(event) {
  var totalOffsetX = 0;
  var totalOffsetY = 0;
  var canvasX = 0;
  var canvasY = 0;
  var currentElement = this;

  do {
    totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft;
    totalOffsetY += currentElement.offsetTop - currentElement.scrollTop;
    currentElement = currentElement.offsetParent
  }
  while (currentElement);

  canvasX = event.pageX - totalOffsetX;
  canvasY = event.pageY - totalOffsetY;

  return {x: canvasX, y: canvasY}
}
HTMLDivElement.prototype.relMouseCoords = relMouseCoords;
minimapholder.onclick = function (event) {
  var coords = minimapholder.relMouseCoords(event);
  var cw_carArray = Array.from(carMap.values());
  var closest = {
    value: cw_carArray[0].car,
    dist: Math.abs(((cw_carArray[0].getPosition().x + 6) * minimapscale) - coords.x),
    x: cw_carArray[0].getPosition().x
  }

  var maxX = 0;
  for (var i = 0; i < cw_carArray.length; i++) {
    var pos = cw_carArray[i].getPosition();
    var dist = Math.abs(((pos.x + 6) * minimapscale) - coords.x);
    if (dist < closest.dist) {
      closest.value = cw_carArray.car;
      closest.dist = dist;
      closest.x = pos.x;
    }
    maxX = Math.max(pos.x, maxX);
  }

  if (closest.x == maxX) { // focus on leader again
    cw_setCameraTarget(-1);
  } else {
    cw_setCameraTarget(closest.value);
  }
}


document.querySelector("#mutationrate").addEventListener("change", function(e){
  var elem = e.target
  cw_setMutation(elem.options[elem.selectedIndex].value)
})

document.querySelector("#mutationsize").addEventListener("change", function(e){
  var elem = e.target
  cw_setMutationRange(elem.options[elem.selectedIndex].value)
})

document.querySelector("#floor").addEventListener("change", function(e){
  var elem = e.target
  cw_setMutableFloor(elem.options[elem.selectedIndex].value)
});

document.querySelector("#gravity").addEventListener("change", function(e){
  var elem = e.target
  cw_setGravity(elem.options[elem.selectedIndex].value)
})

document.querySelector("#elitesize").addEventListener("change", function(e){
  var elem = e.target
  cw_setEliteSize(elem.options[elem.selectedIndex].value)
})

function cw_setMutation(mutation) {
  generationConfig.constants.gen_mutation = parseFloat(mutation);
}

function cw_setMutationRange(range) {
  generationConfig.constants.mutation_range = parseFloat(range);
}

function cw_setMutableFloor(choice) {
  world_def.mutable_floor = (choice == 1);
}

function cw_setGravity(choice) {
  world_def.gravity = new b2Vec2(0.0, -parseFloat(choice));
  var world = currentRunner.scene.world
  // CHECK GRAVITY CHANGES
  if (world.GetGravity().y != world_def.gravity.y) {
    world.SetGravity(world_def.gravity);
  }
}

function cw_setEliteSize(clones) {
  generationConfig.constants.championLength = parseInt(clones, 10);
}

cw_init();

},{"./car-schema/construct.js":2,"./draw/draw-car-stats.js":5,"./draw/draw-car.js":6,"./draw/draw-floor.js":8,"./draw/plot-graphs.js":10,"./generation-config":14,"./ghost/index.js":18,"./machine-learning/genetic-algorithm/manage-round.js":21,"./world/run.js":23}],20:[function(require,module,exports){
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

},{"./random.js":22}],21:[function(require,module,exports){
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
  for (var k = 0; k < champion_length; k++) {``
    scores[k].def.is_elite = true;
    scores[k].def.index = k;
    newGeneration.push(scores[k].def);
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

},{"../create-instance":20}],22:[function(require,module,exports){


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

},{}],23:[function(require,module,exports){
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

},{"../car-schema/def-to-car":3,"../car-schema/run":4,"./setup-scene":24}],24:[function(require,module,exports){
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

},{}]},{},[19])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvY2FyLXNjaGVtYS9jYXItY29uc3RhbnRzLmpzb24iLCJzcmMvY2FyLXNjaGVtYS9jb25zdHJ1Y3QuanMiLCJzcmMvY2FyLXNjaGVtYS9kZWYtdG8tY2FyLmpzIiwic3JjL2Nhci1zY2hlbWEvcnVuLmpzIiwic3JjL2RyYXcvZHJhdy1jYXItc3RhdHMuanMiLCJzcmMvZHJhdy9kcmF3LWNhci5qcyIsInNyYy9kcmF3L2RyYXctY2lyY2xlLmpzIiwic3JjL2RyYXcvZHJhdy1mbG9vci5qcyIsInNyYy9kcmF3L2RyYXctdmlydHVhbC1wb2x5LmpzIiwic3JjL2RyYXcvcGxvdC1ncmFwaHMuanMiLCJzcmMvZHJhdy9zY2F0dGVyLXBsb3QuanMiLCJzcmMvZ2VuZXJhdGlvbi1jb25maWcvZ2VuZXJhdGVSYW5kb20uanMiLCJzcmMvZ2VuZXJhdGlvbi1jb25maWcvaW5icmVlZGluZy1jb2VmZmljaWVudC5qcyIsInNyYy9nZW5lcmF0aW9uLWNvbmZpZy9pbmRleC5qcyIsInNyYy9nZW5lcmF0aW9uLWNvbmZpZy9waWNrUGFyZW50LmpzIiwic3JjL2dlbmVyYXRpb24tY29uZmlnL3NlbGVjdEZyb21BbGxQYXJlbnRzLmpzIiwic3JjL2dob3N0L2Nhci10by1naG9zdC5qcyIsInNyYy9naG9zdC9pbmRleC5qcyIsInNyYy9pbmRleC5qcyIsInNyYy9tYWNoaW5lLWxlYXJuaW5nL2NyZWF0ZS1pbnN0YW5jZS5qcyIsInNyYy9tYWNoaW5lLWxlYXJuaW5nL2dlbmV0aWMtYWxnb3JpdGhtL21hbmFnZS1yb3VuZC5qcyIsInNyYy9tYWNoaW5lLWxlYXJuaW5nL3JhbmRvbS5qcyIsInNyYy93b3JsZC9ydW4uanMiLCJzcmMvd29ybGQvc2V0dXAtc2NlbmUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0lBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0c0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJtb2R1bGUuZXhwb3J0cz17XG4gIFwid2hlZWxDb3VudFwiOiAyLFxuICBcIndoZWVsTWluUmFkaXVzXCI6IDAuMixcbiAgXCJ3aGVlbFJhZGl1c1JhbmdlXCI6IDAuNSxcbiAgXCJ3aGVlbE1pbkRlbnNpdHlcIjogNDAsXG4gIFwid2hlZWxEZW5zaXR5UmFuZ2VcIjogMTAwLFxuICBcIndoZWVsTWluRnJpY3Rpb25FeHBvbmVudFwiOiAtMixcbiAgXCJ3aGVlbEZyaWN0aW9uRXhwb25lbnRSYW5nZVwiOiAzLFxuICBcImNoYXNzaXNEZW5zaXR5UmFuZ2VcIjogMzAwLFxuICBcImNoYXNzaXNNaW5EZW5zaXR5XCI6IDMwLFxuICBcImNoYXNzaXNNaW5BeGlzXCI6IDAuMSxcbiAgXCJjaGFzc2lzQXhpc1JhbmdlXCI6IDEuMVxufVxuIiwidmFyIGNhckNvbnN0YW50cyA9IHJlcXVpcmUoXCIuL2Nhci1jb25zdGFudHMuanNvblwiKTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIHdvcmxkRGVmOiB3b3JsZERlZixcbiAgY2FyQ29uc3RhbnRzOiBnZXRDYXJDb25zdGFudHMsXG4gIGdlbmVyYXRlU2NoZW1hOiBnZW5lcmF0ZVNjaGVtYVxufVxuXG5mdW5jdGlvbiB3b3JsZERlZigpe1xuICB2YXIgYm94MmRmcHMgPSA2MDtcbiAgcmV0dXJuIHtcbiAgICBncmF2aXR5OiB7IHk6IDAgfSxcbiAgICBkb1NsZWVwOiB0cnVlLFxuICAgIGZsb29yc2VlZDogXCJhYmNcIixcbiAgICBtYXhGbG9vclRpbGVzOiAyMDAsXG4gICAgbXV0YWJsZV9mbG9vcjogZmFsc2UsXG4gICAgbW90b3JTcGVlZDogMjAsXG4gICAgYm94MmRmcHM6IGJveDJkZnBzLFxuICAgIG1heF9jYXJfaGVhbHRoOiBib3gyZGZwcyAqIDEwLFxuICAgIHRpbGVEaW1lbnNpb25zOiB7XG4gICAgICB3aWR0aDogMS41LFxuICAgICAgaGVpZ2h0OiAwLjAzXG4gICAgfVxuICB9O1xufVxuXG5mdW5jdGlvbiBnZXRDYXJDb25zdGFudHMoKXtcbiAgcmV0dXJuIGNhckNvbnN0YW50cztcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVTY2hlbWEodmFsdWVzKXtcbiAgcmV0dXJuIHtcbiAgICB3aGVlbF9yYWRpdXM6IHtcbiAgICAgIHR5cGU6IFwiZmxvYXRcIixcbiAgICAgIGxlbmd0aDogdmFsdWVzLndoZWVsQ291bnQsXG4gICAgICBtaW46IHZhbHVlcy53aGVlbE1pblJhZGl1cyxcbiAgICAgIHJhbmdlOiB2YWx1ZXMud2hlZWxSYWRpdXNSYW5nZSxcbiAgICAgIGZhY3RvcjogMSxcbiAgICB9LFxuICAgIHdoZWVsX2RlbnNpdHk6IHtcbiAgICAgIHR5cGU6IFwiZmxvYXRcIixcbiAgICAgIGxlbmd0aDogdmFsdWVzLndoZWVsQ291bnQsXG4gICAgICBtaW46IHZhbHVlcy53aGVlbE1pbkRlbnNpdHksXG4gICAgICByYW5nZTogdmFsdWVzLndoZWVsRGVuc2l0eVJhbmdlLFxuICAgICAgZmFjdG9yOiAxLFxuICAgIH0sXG4gICAgd2hlZWxfZnJpY3Rpb25fZXhwb25lbnQ6IHtcbiAgICAgIHR5cGU6IFwiZmxvYXRcIixcbiAgICAgIGxlbmd0aDogdmFsdWVzLndoZWVsQ291bnQsXG4gICAgICBtaW46IHZhbHVlcy53aGVlbE1pbkZyaWN0aW9uRXhwb25lbnQsXG4gICAgICByYW5nZTogdmFsdWVzLndoZWVsRnJpY3Rpb25FeHBvbmVudFJhbmdlLFxuICAgICAgZmFjdG9yOiAxLFxuICAgIH0sXG4gICAgY2hhc3Npc19kZW5zaXR5OiB7XG4gICAgICB0eXBlOiBcImZsb2F0XCIsXG4gICAgICBsZW5ndGg6IDEsXG4gICAgICBtaW46IHZhbHVlcy5jaGFzc2lzRGVuc2l0eVJhbmdlLFxuICAgICAgcmFuZ2U6IHZhbHVlcy5jaGFzc2lzTWluRGVuc2l0eSxcbiAgICAgIGZhY3RvcjogMSxcbiAgICB9LFxuICAgIHZlcnRleF9saXN0OiB7XG4gICAgICB0eXBlOiBcImZsb2F0XCIsXG4gICAgICBsZW5ndGg6IDEyLFxuICAgICAgbWluOiB2YWx1ZXMuY2hhc3Npc01pbkF4aXMsXG4gICAgICByYW5nZTogdmFsdWVzLmNoYXNzaXNBeGlzUmFuZ2UsXG4gICAgICBmYWN0b3I6IDEsXG4gICAgfSxcbiAgICB3aGVlbF92ZXJ0ZXg6IHtcbiAgICAgIHR5cGU6IFwic2h1ZmZsZVwiLFxuICAgICAgbGVuZ3RoOiA4LFxuICAgICAgbGltaXQ6IHZhbHVlcy53aGVlbENvdW50LFxuICAgICAgZmFjdG9yOiAxLFxuICAgIH0sXG4gIH07XG59XG4iLCIvKlxuICBnbG9iYWxzIGIyUmV2b2x1dGVKb2ludERlZiBiMlZlYzIgYjJCb2R5RGVmIGIyQm9keSBiMkZpeHR1cmVEZWYgYjJQb2x5Z29uU2hhcGUgYjJDaXJjbGVTaGFwZVxuKi9cblxudmFyIGNyZWF0ZUluc3RhbmNlID0gcmVxdWlyZShcIi4uL21hY2hpbmUtbGVhcm5pbmcvY3JlYXRlLWluc3RhbmNlXCIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGRlZlRvQ2FyO1xuXG5mdW5jdGlvbiBkZWZUb0Nhcihub3JtYWxfZGVmLCB3b3JsZCwgY29uc3RhbnRzKXtcbiAgdmFyIGNhcl9kZWYgPSBjcmVhdGVJbnN0YW5jZS5hcHBseVR5cGVzKGNvbnN0YW50cy5zY2hlbWEsIG5vcm1hbF9kZWYpXG4gIHZhciBpbnN0YW5jZSA9IHt9O1xuICBpbnN0YW5jZS5jaGFzc2lzID0gY3JlYXRlQ2hhc3NpcyhcbiAgICB3b3JsZCwgY2FyX2RlZi52ZXJ0ZXhfbGlzdCwgY2FyX2RlZi5jaGFzc2lzX2RlbnNpdHlcbiAgKTtcblxuICAvLyBLZWVwIHRyYWNrIG9mIHRoZSBsb3dlc3QgcG9pbnQgc28gdGhhdCB3ZSBjYW4gcGxhY2UgdGhlIGNhciBvbiB0aGUgZ3JvdW5kXG4gIHZhciByZWxhdGl2ZUJvdHRvbSA9IDEwMDtcbiAgLy8gTG9vcCB0aHJvdWdoIHRoZSB2ZXJ0aWNlcyBvZiB0aGUgY2hhc3NpcyB0byBmaW5kIHRoZSBsb3dlc3QgcG9pbnRcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBpbnN0YW5jZS5jaGFzc2lzLnZlcnRleF9saXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKGluc3RhbmNlLmNoYXNzaXMudmVydGV4X2xpc3RbaV0ueSA8IHJlbGF0aXZlQm90dG9tKSB7XG4gICAgICByZWxhdGl2ZUJvdHRvbSA9IGluc3RhbmNlLmNoYXNzaXMudmVydGV4X2xpc3RbaV0ueTtcbiAgICB9XG4gIH1cblxuICB2YXIgaTtcblxuICB2YXIgd2hlZWxDb3VudCA9IGNhcl9kZWYud2hlZWxfcmFkaXVzLmxlbmd0aDtcblxuICBpbnN0YW5jZS53aGVlbHMgPSBbXTtcbiAgZm9yIChpID0gMDsgaSA8IHdoZWVsQ291bnQ7IGkrKykge1xuICAgIGluc3RhbmNlLndoZWVsc1tpXSA9IGNyZWF0ZVdoZWVsKFxuICAgICAgd29ybGQsXG4gICAgICBjYXJfZGVmLndoZWVsX3JhZGl1c1tpXSxcbiAgICAgIGNhcl9kZWYud2hlZWxfZGVuc2l0eVtpXSxcbiAgICAgIGNhcl9kZWYud2hlZWxfZnJpY3Rpb25fZXhwb25lbnRbaV1cbiAgICApO1xuICB9XG5cbiAgdmFyIGNhcm1hc3MgPSBpbnN0YW5jZS5jaGFzc2lzLkdldE1hc3MoKTtcbiAgZm9yIChpID0gMDsgaSA8IHdoZWVsQ291bnQ7IGkrKykge1xuICAgIGNhcm1hc3MgKz0gaW5zdGFuY2Uud2hlZWxzW2ldLkdldE1hc3MoKTtcbiAgfVxuXG4gIHZhciBqb2ludF9kZWYgPSBuZXcgYjJSZXZvbHV0ZUpvaW50RGVmKCk7XG5cbiAgZm9yIChpID0gMDsgaSA8IHdoZWVsQ291bnQ7IGkrKykge1xuICAgIHZhciB0b3JxdWUgPSBjYXJtYXNzICogLWNvbnN0YW50cy5ncmF2aXR5LnkgLyBjYXJfZGVmLndoZWVsX3JhZGl1c1tpXTtcblxuICAgIHZhciByYW5kdmVydGV4ID0gaW5zdGFuY2UuY2hhc3Npcy52ZXJ0ZXhfbGlzdFtjYXJfZGVmLndoZWVsX3ZlcnRleFtpXV07XG5cbiAgICAvLyBLZWVwIHRyYWNrIG9mIHRoZSBsb3dlc3QgcG9pbnQgb2YgdGhlIHdoZWVscy5cbiAgICB2YXIgcmVsYXRpdmVXaGVlbEJvdHRvbSA9IHJhbmR2ZXJ0ZXgueSAtIGNhcl9kZWYud2hlZWxfcmFkaXVzW2ldO1xuICAgIGlmIChyZWxhdGl2ZVdoZWVsQm90dG9tIDwgcmVsYXRpdmVCb3R0b20pIHtcbiAgICAgIHJlbGF0aXZlQm90dG9tID0gcmVsYXRpdmVXaGVlbEJvdHRvbTtcbiAgICB9XG5cbiAgICBqb2ludF9kZWYubG9jYWxBbmNob3JBLlNldChyYW5kdmVydGV4LngsIHJhbmR2ZXJ0ZXgueSk7XG4gICAgam9pbnRfZGVmLmxvY2FsQW5jaG9yQi5TZXQoMCwgMCk7XG4gICAgam9pbnRfZGVmLm1heE1vdG9yVG9ycXVlID0gdG9ycXVlO1xuICAgIGpvaW50X2RlZi5tb3RvclNwZWVkID0gLWNvbnN0YW50cy5tb3RvclNwZWVkO1xuICAgIGpvaW50X2RlZi5lbmFibGVNb3RvciA9IHRydWU7XG4gICAgam9pbnRfZGVmLmJvZHlBID0gaW5zdGFuY2UuY2hhc3NpcztcbiAgICBqb2ludF9kZWYuYm9keUIgPSBpbnN0YW5jZS53aGVlbHNbaV07XG4gICAgd29ybGQuQ3JlYXRlSm9pbnQoam9pbnRfZGVmKTtcbiAgfVxuXG4gIC8vIFNldCB0aGUgY2FyIG9uIHRoZSBncm91bmQgYnkgc2V0dGluZyB0aGUgcG9zaXRpb24gb2YgdGhlIGNoYXNzaXMgYW5kIHRoZW4gcG9zaXRpb25pbmcgdGhlIHdoZWVscyB3aGVyZSB0aGVyZSBhcmUgYWxyZWFkeSBhdHRhY2hlZC4gSWYgSSBkb24ndCBkbyB0aGlzIHRoYW4gdGhlIHBoeXNpY3MgeWFua3MgdGhlIGpvaW50cyB0b2dldGhlciBzbyBoYXJkIHRoYXQgaXQgY2FuIHNlbmQgdGhlIGNhciBzcGlubmluZyBvciBtYWtlIGl0IGVudGVyIHRoZSBncm91bmQuXG4gIHZhciBwb3NpdGlvbiA9IGluc3RhbmNlLmNoYXNzaXMuR2V0UG9zaXRpb24oKTtcbiAgaW5zdGFuY2UuY2hhc3Npcy5TZXRQb3NpdGlvbih7eDogcG9zaXRpb24ueCwgeTogLSByZWxhdGl2ZUJvdHRvbSArIHdvcmxkLnN0YXJ0SGVpZ2h0fSk7XG4gIGZvciAoaSA9IDA7IGkgPCB3aGVlbENvdW50OyBpKyspIHtcbiAgICB2YXIgcmFuZHZlcnRleCA9IGluc3RhbmNlLmNoYXNzaXMudmVydGV4X2xpc3RbY2FyX2RlZi53aGVlbF92ZXJ0ZXhbaV1dO1xuICAgIGluc3RhbmNlLndoZWVsc1tpXS5TZXRQb3NpdGlvbihpbnN0YW5jZS5jaGFzc2lzLkdldFdvcmxkUG9pbnQocmFuZHZlcnRleCkpO1xuICB9XG5cbiAgcmV0dXJuIGluc3RhbmNlO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVDaGFzc2lzKHdvcmxkLCB2ZXJ0ZXhzLCBkZW5zaXR5KSB7XG5cbiAgdmFyIHZlcnRleF9saXN0ID0gbmV3IEFycmF5KCk7XG4gIHZlcnRleF9saXN0LnB1c2gobmV3IGIyVmVjMih2ZXJ0ZXhzWzBdLCAwKSk7XG4gIHZlcnRleF9saXN0LnB1c2gobmV3IGIyVmVjMih2ZXJ0ZXhzWzFdLCB2ZXJ0ZXhzWzJdKSk7XG4gIHZlcnRleF9saXN0LnB1c2gobmV3IGIyVmVjMigwLCB2ZXJ0ZXhzWzNdKSk7XG4gIHZlcnRleF9saXN0LnB1c2gobmV3IGIyVmVjMigtdmVydGV4c1s0XSwgdmVydGV4c1s1XSkpO1xuICB2ZXJ0ZXhfbGlzdC5wdXNoKG5ldyBiMlZlYzIoLXZlcnRleHNbNl0sIDApKTtcbiAgdmVydGV4X2xpc3QucHVzaChuZXcgYjJWZWMyKC12ZXJ0ZXhzWzddLCAtdmVydGV4c1s4XSkpO1xuICB2ZXJ0ZXhfbGlzdC5wdXNoKG5ldyBiMlZlYzIoMCwgLXZlcnRleHNbOV0pKTtcbiAgdmVydGV4X2xpc3QucHVzaChuZXcgYjJWZWMyKHZlcnRleHNbMTBdLCAtdmVydGV4c1sxMV0pKTtcblxuICB2YXIgYm9keV9kZWYgPSBuZXcgYjJCb2R5RGVmKCk7XG4gIGJvZHlfZGVmLnR5cGUgPSBiMkJvZHkuYjJfZHluYW1pY0JvZHk7XG4gIGJvZHlfZGVmLnBvc2l0aW9uLlNldCgwLjAsIDQuMCk7XG5cbiAgdmFyIGJvZHkgPSB3b3JsZC5DcmVhdGVCb2R5KGJvZHlfZGVmKTtcblxuICBjcmVhdGVDaGFzc2lzUGFydChib2R5LCB2ZXJ0ZXhfbGlzdFswXSwgdmVydGV4X2xpc3RbMV0sIGRlbnNpdHkpO1xuICBjcmVhdGVDaGFzc2lzUGFydChib2R5LCB2ZXJ0ZXhfbGlzdFsxXSwgdmVydGV4X2xpc3RbMl0sIGRlbnNpdHkpO1xuICBjcmVhdGVDaGFzc2lzUGFydChib2R5LCB2ZXJ0ZXhfbGlzdFsyXSwgdmVydGV4X2xpc3RbM10sIGRlbnNpdHkpO1xuICBjcmVhdGVDaGFzc2lzUGFydChib2R5LCB2ZXJ0ZXhfbGlzdFszXSwgdmVydGV4X2xpc3RbNF0sIGRlbnNpdHkpO1xuICBjcmVhdGVDaGFzc2lzUGFydChib2R5LCB2ZXJ0ZXhfbGlzdFs0XSwgdmVydGV4X2xpc3RbNV0sIGRlbnNpdHkpO1xuICBjcmVhdGVDaGFzc2lzUGFydChib2R5LCB2ZXJ0ZXhfbGlzdFs1XSwgdmVydGV4X2xpc3RbNl0sIGRlbnNpdHkpO1xuICBjcmVhdGVDaGFzc2lzUGFydChib2R5LCB2ZXJ0ZXhfbGlzdFs2XSwgdmVydGV4X2xpc3RbN10sIGRlbnNpdHkpO1xuICBjcmVhdGVDaGFzc2lzUGFydChib2R5LCB2ZXJ0ZXhfbGlzdFs3XSwgdmVydGV4X2xpc3RbMF0sIGRlbnNpdHkpO1xuXG4gIGJvZHkudmVydGV4X2xpc3QgPSB2ZXJ0ZXhfbGlzdDtcblxuICByZXR1cm4gYm9keTtcbn1cblxuXG5mdW5jdGlvbiBjcmVhdGVDaGFzc2lzUGFydChib2R5LCB2ZXJ0ZXgxLCB2ZXJ0ZXgyLCBkZW5zaXR5KSB7XG4gIHZhciB2ZXJ0ZXhfbGlzdCA9IG5ldyBBcnJheSgpO1xuICB2ZXJ0ZXhfbGlzdC5wdXNoKHZlcnRleDEpO1xuICB2ZXJ0ZXhfbGlzdC5wdXNoKHZlcnRleDIpO1xuICB2ZXJ0ZXhfbGlzdC5wdXNoKGIyVmVjMi5NYWtlKDAsIDApKTtcbiAgdmFyIGZpeF9kZWYgPSBuZXcgYjJGaXh0dXJlRGVmKCk7XG4gIGZpeF9kZWYuc2hhcGUgPSBuZXcgYjJQb2x5Z29uU2hhcGUoKTtcbiAgZml4X2RlZi5kZW5zaXR5ID0gZGVuc2l0eTtcbiAgZml4X2RlZi5mcmljdGlvbiA9IDEwO1xuICBmaXhfZGVmLnJlc3RpdHV0aW9uID0gMC4yO1xuICBmaXhfZGVmLmZpbHRlci5ncm91cEluZGV4ID0gLTE7XG4gIGZpeF9kZWYuc2hhcGUuU2V0QXNBcnJheSh2ZXJ0ZXhfbGlzdCwgMyk7XG5cbiAgYm9keS5DcmVhdGVGaXh0dXJlKGZpeF9kZWYpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVXaGVlbCh3b3JsZCwgcmFkaXVzLCBkZW5zaXR5LCBmcmljdGlvbl9leHBvbmVudCkge1xuICB2YXIgYm9keV9kZWYgPSBuZXcgYjJCb2R5RGVmKCk7XG4gIGJvZHlfZGVmLnR5cGUgPSBiMkJvZHkuYjJfZHluYW1pY0JvZHk7XG4gIGJvZHlfZGVmLnBvc2l0aW9uLlNldCgwLCAwKTtcblxuICB2YXIgYm9keSA9IHdvcmxkLkNyZWF0ZUJvZHkoYm9keV9kZWYpO1xuXG4gIHZhciBmaXhfZGVmID0gbmV3IGIyRml4dHVyZURlZigpO1xuICBmaXhfZGVmLnNoYXBlID0gbmV3IGIyQ2lyY2xlU2hhcGUocmFkaXVzKTtcbiAgZml4X2RlZi5kZW5zaXR5ID0gZGVuc2l0eTtcbiAgZml4X2RlZi5mcmljdGlvbiA9IE1hdGgucG93KDEwLCBmcmljdGlvbl9leHBvbmVudCk7XG4gIGZpeF9kZWYucmVzdGl0dXRpb24gPSAwLjI7XG4gIGZpeF9kZWYuZmlsdGVyLmdyb3VwSW5kZXggPSAtMTtcblxuICBib2R5LkNyZWF0ZUZpeHR1cmUoZml4X2RlZik7XG4gIHJldHVybiBib2R5O1xufVxuIiwiXG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBnZXRJbml0aWFsU3RhdGU6IGdldEluaXRpYWxTdGF0ZSxcbiAgdXBkYXRlU3RhdGU6IHVwZGF0ZVN0YXRlLFxuICBnZXRTdGF0dXM6IGdldFN0YXR1cyxcbiAgY2FsY3VsYXRlU2NvcmU6IGNhbGN1bGF0ZVNjb3JlLFxufTtcblxuZnVuY3Rpb24gZ2V0SW5pdGlhbFN0YXRlKHdvcmxkX2RlZil7XG4gIHJldHVybiB7XG4gICAgZnJhbWVzOiAwLFxuICAgIGhlYWx0aDogd29ybGRfZGVmLm1heF9jYXJfaGVhbHRoLFxuICAgIG1heFBvc2l0aW9ueTogMCxcbiAgICBtaW5Qb3NpdGlvbnk6IDAsXG4gICAgbWF4UG9zaXRpb254OiAwLFxuICB9O1xufVxuXG5mdW5jdGlvbiB1cGRhdGVTdGF0ZShjb25zdGFudHMsIHdvcmxkQ29uc3RydWN0LCBzdGF0ZSl7XG4gIGlmKHN0YXRlLmhlYWx0aCA8PSAwKXtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJBbHJlYWR5IERlYWRcIik7XG4gIH1cbiAgaWYoc3RhdGUubWF4UG9zaXRpb254ID4gY29uc3RhbnRzLmZpbmlzaExpbmUpe1xuICAgIHRocm93IG5ldyBFcnJvcihcImFscmVhZHkgRmluaXNoZWRcIik7XG4gIH1cblxuICAvLyBjb25zb2xlLmxvZyhzdGF0ZSk7XG4gIC8vIGNoZWNrIGhlYWx0aFxuICB2YXIgcG9zaXRpb24gPSB3b3JsZENvbnN0cnVjdC5jaGFzc2lzLkdldFBvc2l0aW9uKCk7XG4gIC8vIGNoZWNrIGlmIGNhciByZWFjaGVkIGVuZCBvZiB0aGUgcGF0aFxuICB2YXIgbmV4dFN0YXRlID0ge1xuICAgIGZyYW1lczogc3RhdGUuZnJhbWVzICsgMSxcbiAgICBtYXhQb3NpdGlvbng6IHBvc2l0aW9uLnggPiBzdGF0ZS5tYXhQb3NpdGlvbnggPyBwb3NpdGlvbi54IDogc3RhdGUubWF4UG9zaXRpb254LFxuICAgIG1heFBvc2l0aW9ueTogcG9zaXRpb24ueSA+IHN0YXRlLm1heFBvc2l0aW9ueSA/IHBvc2l0aW9uLnkgOiBzdGF0ZS5tYXhQb3NpdGlvbnksXG4gICAgbWluUG9zaXRpb255OiBwb3NpdGlvbi55IDwgc3RhdGUubWluUG9zaXRpb255ID8gcG9zaXRpb24ueSA6IHN0YXRlLm1pblBvc2l0aW9ueVxuICB9O1xuXG4gIGlmIChwb3NpdGlvbi54ID4gY29uc3RhbnRzLmZpbmlzaExpbmUpIHtcbiAgICByZXR1cm4gbmV4dFN0YXRlO1xuICB9XG5cbiAgaWYgKHBvc2l0aW9uLnggPiBzdGF0ZS5tYXhQb3NpdGlvbnggKyAwLjAwMSkge1xuICAgIG5leHRTdGF0ZS5oZWFsdGggPSBjb25zdGFudHMubWF4X2Nhcl9oZWFsdGg7XG4gICAgcmV0dXJuIG5leHRTdGF0ZTtcbiAgfVxuICBuZXh0U3RhdGUuaGVhbHRoID0gc3RhdGUuaGVhbHRoIC0gMC4xO1xuICBpZiAoTWF0aC5hYnMod29ybGRDb25zdHJ1Y3QuY2hhc3Npcy5HZXRMaW5lYXJWZWxvY2l0eSgpLngpIDwgMC4wMDEpIHtcbiAgICBuZXh0U3RhdGUuaGVhbHRoIC09IDU7XG4gIH1cbiAgcmV0dXJuIG5leHRTdGF0ZTtcbn1cblxuZnVuY3Rpb24gZ2V0U3RhdHVzKHN0YXRlLCBjb25zdGFudHMpe1xuICBpZihoYXNGYWlsZWQoc3RhdGUsIGNvbnN0YW50cykpIHJldHVybiAtMTtcbiAgaWYoaGFzU3VjY2VzcyhzdGF0ZSwgY29uc3RhbnRzKSkgcmV0dXJuIDE7XG4gIHJldHVybiAwO1xufVxuXG5mdW5jdGlvbiBoYXNGYWlsZWQoc3RhdGUgLyosIGNvbnN0YW50cyAqLyl7XG4gIHJldHVybiBzdGF0ZS5oZWFsdGggPD0gMDtcbn1cbmZ1bmN0aW9uIGhhc1N1Y2Nlc3Moc3RhdGUsIGNvbnN0YW50cyl7XG4gIHJldHVybiBzdGF0ZS5tYXhQb3NpdGlvbnggPiBjb25zdGFudHMuZmluaXNoTGluZTtcbn1cblxuZnVuY3Rpb24gY2FsY3VsYXRlU2NvcmUoc3RhdGUsIGNvbnN0YW50cyl7XG4gIHZhciBhdmdzcGVlZCA9IChzdGF0ZS5tYXhQb3NpdGlvbnggLyBzdGF0ZS5mcmFtZXMpICogY29uc3RhbnRzLmJveDJkZnBzO1xuICB2YXIgcG9zaXRpb24gPSBzdGF0ZS5tYXhQb3NpdGlvbng7XG4gIHZhciBzY29yZSA9IHBvc2l0aW9uICsgYXZnc3BlZWQ7XG4gIHJldHVybiB7XG4gICAgdjogc2NvcmUsXG4gICAgczogYXZnc3BlZWQsXG4gICAgeDogcG9zaXRpb24sXG4gICAgeTogc3RhdGUubWF4UG9zaXRpb255LFxuICAgIHkyOiBzdGF0ZS5taW5Qb3NpdGlvbnlcbiAgfVxufVxuIiwiLyogZ2xvYmFscyBkb2N1bWVudCAqL1xuXG52YXIgcnVuID0gcmVxdWlyZShcIi4uL2Nhci1zY2hlbWEvcnVuXCIpO1xuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG4vKiA9PT0gQ2FyID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG52YXIgY3dfQ2FyID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLl9fY29uc3RydWN0b3IuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn1cblxuY3dfQ2FyLnByb3RvdHlwZS5fX2NvbnN0cnVjdG9yID0gZnVuY3Rpb24gKGNhcikge1xuICB0aGlzLmNhciA9IGNhcjtcbiAgdGhpcy5jYXJfZGVmID0gY2FyLmRlZjtcbiAgdmFyIGNhcl9kZWYgPSB0aGlzLmNhcl9kZWY7XG5cbiAgdGhpcy5mcmFtZXMgPSAwO1xuICB0aGlzLmFsaXZlID0gdHJ1ZTtcbiAgdGhpcy5pc19lbGl0ZSA9IGNhci5kZWYuaXNfZWxpdGU7XG4gIHRoaXMuaGVhbHRoQmFyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJoZWFsdGhcIiArIGNhcl9kZWYuaW5kZXgpLnN0eWxlO1xuICB0aGlzLmhlYWx0aEJhclRleHQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImhlYWx0aFwiICsgY2FyX2RlZi5pbmRleCkubmV4dFNpYmxpbmcubmV4dFNpYmxpbmc7XG4gIHRoaXMuaGVhbHRoQmFyVGV4dC5pbm5lckhUTUwgPSBjYXJfZGVmLmluZGV4O1xuICB0aGlzLm1pbmltYXBtYXJrZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImJhclwiICsgY2FyX2RlZi5pbmRleCk7XG5cbiAgaWYgKHRoaXMuaXNfZWxpdGUpIHtcbiAgICB0aGlzLmhlYWx0aEJhci5iYWNrZ3JvdW5kQ29sb3IgPSBcIiMzRjcyQUZcIjtcbiAgICB0aGlzLm1pbmltYXBtYXJrZXIuc3R5bGUuYm9yZGVyTGVmdCA9IFwiMXB4IHNvbGlkICMzRjcyQUZcIjtcbiAgICB0aGlzLm1pbmltYXBtYXJrZXIuaW5uZXJIVE1MID0gY2FyX2RlZi5pbmRleDtcbiAgfSBlbHNlIHtcbiAgICB0aGlzLmhlYWx0aEJhci5iYWNrZ3JvdW5kQ29sb3IgPSBcIiNGN0M4NzNcIjtcbiAgICB0aGlzLm1pbmltYXBtYXJrZXIuc3R5bGUuYm9yZGVyTGVmdCA9IFwiMXB4IHNvbGlkICNGN0M4NzNcIjtcbiAgICB0aGlzLm1pbmltYXBtYXJrZXIuaW5uZXJIVE1MID0gY2FyX2RlZi5pbmRleDtcbiAgfVxuXG59XG5cbmN3X0Nhci5wcm90b3R5cGUuZ2V0UG9zaXRpb24gPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLmNhci5jYXIuY2hhc3Npcy5HZXRQb3NpdGlvbigpO1xufVxuXG5jd19DYXIucHJvdG90eXBlLmtpbGwgPSBmdW5jdGlvbiAoY3VycmVudFJ1bm5lciwgY29uc3RhbnRzKSB7XG4gIHRoaXMubWluaW1hcG1hcmtlci5zdHlsZS5ib3JkZXJMZWZ0ID0gXCIxcHggc29saWQgIzNGNzJBRlwiO1xuICB2YXIgZmluaXNoTGluZSA9IGN1cnJlbnRSdW5uZXIuc2NlbmUuZmluaXNoTGluZVxuICB2YXIgbWF4X2Nhcl9oZWFsdGggPSBjb25zdGFudHMubWF4X2Nhcl9oZWFsdGg7XG4gIHZhciBzdGF0dXMgPSBydW4uZ2V0U3RhdHVzKHRoaXMuY2FyLnN0YXRlLCB7XG4gICAgZmluaXNoTGluZTogZmluaXNoTGluZSxcbiAgICBtYXhfY2FyX2hlYWx0aDogbWF4X2Nhcl9oZWFsdGgsXG4gIH0pXG4gIHN3aXRjaChzdGF0dXMpe1xuICAgIGNhc2UgMToge1xuICAgICAgdGhpcy5oZWFsdGhCYXIud2lkdGggPSBcIjBcIjtcbiAgICAgIGJyZWFrXG4gICAgfVxuICAgIGNhc2UgLTE6IHtcbiAgICAgIHRoaXMuaGVhbHRoQmFyVGV4dC5pbm5lckhUTUwgPSBcIiZkYWdnZXI7XCI7XG4gICAgICB0aGlzLmhlYWx0aEJhci53aWR0aCA9IFwiMFwiO1xuICAgICAgYnJlYWtcbiAgICB9XG4gIH1cbiAgdGhpcy5hbGl2ZSA9IGZhbHNlO1xuXG59XG5cbm1vZHVsZS5leHBvcnRzID0gY3dfQ2FyO1xuIiwiXG52YXIgY3dfZHJhd1ZpcnR1YWxQb2x5ID0gcmVxdWlyZShcIi4vZHJhdy12aXJ0dWFsLXBvbHlcIik7XG52YXIgY3dfZHJhd0NpcmNsZSA9IHJlcXVpcmUoXCIuL2RyYXctY2lyY2xlXCIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGNhcl9jb25zdGFudHMsIG15Q2FyLCBjYW1lcmEsIGN0eCl7XG4gIHZhciBjYW1lcmFfeCA9IGNhbWVyYS5wb3MueDtcbiAgdmFyIHpvb20gPSBjYW1lcmEuem9vbTtcblxuICB2YXIgd2hlZWxNaW5EZW5zaXR5ID0gY2FyX2NvbnN0YW50cy53aGVlbE1pbkRlbnNpdHk7XG4gIHZhciB3aGVlbERlbnNpdHlSYW5nZSA9IGNhcl9jb25zdGFudHMud2hlZWxEZW5zaXR5UmFuZ2U7XG4gIHZhciB3aGVlbE1pbkZyaWN0aW9uRXhwb25lbnQgPSBjYXJfY29uc3RhbnRzLndoZWVsTWluRnJpY3Rpb25FeHBvbmVudDtcbiAgdmFyIHdoZWVsRnJpY3Rpb25FeHBvbmVudFJhbmdlID0gY2FyX2NvbnN0YW50cy53aGVlbEZyaWN0aW9uRXhwb25lbnRSYW5nZTtcblxuICBpZiAoIW15Q2FyLmFsaXZlKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIHZhciBteUNhclBvcyA9IG15Q2FyLmdldFBvc2l0aW9uKCk7XG5cbiAgaWYgKG15Q2FyUG9zLnggPCAoY2FtZXJhX3ggLSA1KSkge1xuICAgIC8vIHRvbyBmYXIgYmVoaW5kLCBkb24ndCBkcmF3XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY3R4LmxpbmVXaWR0aCA9IDEgLyB6b29tO1xuXG4gIHZhciB3aGVlbHMgPSBteUNhci5jYXIuY2FyLndoZWVscztcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IHdoZWVscy5sZW5ndGg7IGkrKykge1xuICAgIHZhciB3aGVlbCA9IHdoZWVsc1tpXTtcbiAgICBmb3IgKHZhciBmaXh0dXJlID0gd2hlZWwuR2V0Rml4dHVyZUxpc3QoKTsgZml4dHVyZTsgZml4dHVyZSA9IGZpeHR1cmUubV9uZXh0KSB7XG4gICAgICB2YXIgc2hhcGUgPSBmaXh0dXJlLkdldFNoYXBlKCk7XG4gICAgICB2YXIgY29sb3IgPSBNYXRoLnJvdW5kKDI1NSAtICgyNTUgKiAoZml4dHVyZS5tX2RlbnNpdHkgLSB3aGVlbE1pbkRlbnNpdHkpKSAvIHdoZWVsRGVuc2l0eVJhbmdlKS50b1N0cmluZygpO1xuICAgICAgdmFyIHJnYmNvbG9yID0gXCJyZ2IoXCIgKyBjb2xvciArIFwiLFwiICsgY29sb3IgKyBcIixcIiArIGNvbG9yICsgXCIpXCI7XG4gICAgICBjdHguc3Ryb2tlU3R5bGUgPSBcInJnYihcIiArIE1hdGgucm91bmQoMjU1ICogKE1hdGgubG9nMTAoZml4dHVyZS5tX2ZyaWN0aW9uKSAtIHdoZWVsTWluRnJpY3Rpb25FeHBvbmVudCkgLyB3aGVlbEZyaWN0aW9uRXhwb25lbnRSYW5nZSkudG9TdHJpbmcoKSArIFwiLCAwLCAwKVwiO1xuICAgICAgY3dfZHJhd0NpcmNsZShjdHgsIHdoZWVsLCBzaGFwZS5tX3AsIHNoYXBlLm1fcmFkaXVzLCB3aGVlbC5tX3N3ZWVwLmEsIHJnYmNvbG9yKTtcbiAgICB9XG4gIH1cblxuICBpZiAobXlDYXIuaXNfZWxpdGUpIHtcbiAgICBjdHguc3Ryb2tlU3R5bGUgPSBcIiMzRjcyQUZcIjtcbiAgICBjdHguZmlsbFN0eWxlID0gXCIjREJFMkVGXCI7XG4gIH0gZWxzZSB7XG4gICAgY3R4LnN0cm9rZVN0eWxlID0gXCIjRjdDODczXCI7XG4gICAgY3R4LmZpbGxTdHlsZSA9IFwiI0ZBRUJDRFwiO1xuICB9XG4gIGN0eC5iZWdpblBhdGgoKTtcblxuICB2YXIgY2hhc3NpcyA9IG15Q2FyLmNhci5jYXIuY2hhc3NpcztcblxuICBmb3IgKGYgPSBjaGFzc2lzLkdldEZpeHR1cmVMaXN0KCk7IGY7IGYgPSBmLm1fbmV4dCkge1xuICAgIHZhciBjcyA9IGYuR2V0U2hhcGUoKTtcbiAgICBjd19kcmF3VmlydHVhbFBvbHkoY3R4LCBjaGFzc2lzLCBjcy5tX3ZlcnRpY2VzLCBjcy5tX3ZlcnRleENvdW50KTtcbiAgfVxuICBjdHguZmlsbCgpO1xuICBjdHguc3Ryb2tlKCk7XG59XG4iLCJcbm1vZHVsZS5leHBvcnRzID0gY3dfZHJhd0NpcmNsZTtcblxuZnVuY3Rpb24gY3dfZHJhd0NpcmNsZShjdHgsIGJvZHksIGNlbnRlciwgcmFkaXVzLCBhbmdsZSwgY29sb3IpIHtcbiAgdmFyIHAgPSBib2R5LkdldFdvcmxkUG9pbnQoY2VudGVyKTtcbiAgY3R4LmZpbGxTdHlsZSA9IGNvbG9yO1xuXG4gIGN0eC5iZWdpblBhdGgoKTtcbiAgY3R4LmFyYyhwLngsIHAueSwgcmFkaXVzLCAwLCAyICogTWF0aC5QSSwgdHJ1ZSk7XG5cbiAgY3R4Lm1vdmVUbyhwLngsIHAueSk7XG4gIGN0eC5saW5lVG8ocC54ICsgcmFkaXVzICogTWF0aC5jb3MoYW5nbGUpLCBwLnkgKyByYWRpdXMgKiBNYXRoLnNpbihhbmdsZSkpO1xuXG4gIGN0eC5maWxsKCk7XG4gIGN0eC5zdHJva2UoKTtcbn1cbiIsInZhciBjd19kcmF3VmlydHVhbFBvbHkgPSByZXF1aXJlKFwiLi9kcmF3LXZpcnR1YWwtcG9seVwiKTtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oY3R4LCBjYW1lcmEsIGN3X2Zsb29yVGlsZXMpIHtcbiAgdmFyIGNhbWVyYV94ID0gY2FtZXJhLnBvcy54O1xuICB2YXIgem9vbSA9IGNhbWVyYS56b29tO1xuICBjdHguc3Ryb2tlU3R5bGUgPSBcIiMwMDBcIjtcbiAgY3R4LmZpbGxTdHlsZSA9IFwiIzc3N1wiO1xuICBjdHgubGluZVdpZHRoID0gMSAvIHpvb207XG4gIGN0eC5iZWdpblBhdGgoKTtcblxuICB2YXIgaztcbiAgaWYoY2FtZXJhLnBvcy54IC0gMTAgPiAwKXtcbiAgICBrID0gTWF0aC5mbG9vcigoY2FtZXJhLnBvcy54IC0gMTApIC8gMS41KTtcbiAgfSBlbHNlIHtcbiAgICBrID0gMDtcbiAgfVxuXG4gIC8vIGNvbnNvbGUubG9nKGspO1xuXG4gIG91dGVyX2xvb3A6XG4gICAgZm9yIChrOyBrIDwgY3dfZmxvb3JUaWxlcy5sZW5ndGg7IGsrKykge1xuICAgICAgdmFyIGIgPSBjd19mbG9vclRpbGVzW2tdO1xuICAgICAgZm9yICh2YXIgZiA9IGIuR2V0Rml4dHVyZUxpc3QoKTsgZjsgZiA9IGYubV9uZXh0KSB7XG4gICAgICAgIHZhciBzID0gZi5HZXRTaGFwZSgpO1xuICAgICAgICB2YXIgc2hhcGVQb3NpdGlvbiA9IGIuR2V0V29ybGRQb2ludChzLm1fdmVydGljZXNbMF0pLng7XG4gICAgICAgIGlmICgoc2hhcGVQb3NpdGlvbiA+IChjYW1lcmFfeCAtIDUpKSAmJiAoc2hhcGVQb3NpdGlvbiA8IChjYW1lcmFfeCArIDEwKSkpIHtcbiAgICAgICAgICBjd19kcmF3VmlydHVhbFBvbHkoY3R4LCBiLCBzLm1fdmVydGljZXMsIHMubV92ZXJ0ZXhDb3VudCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHNoYXBlUG9zaXRpb24gPiBjYW1lcmFfeCArIDEwKSB7XG4gICAgICAgICAgYnJlYWsgb3V0ZXJfbG9vcDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgY3R4LmZpbGwoKTtcbiAgY3R4LnN0cm9rZSgpO1xufVxuIiwiXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oY3R4LCBib2R5LCB2dHgsIG5fdnR4KSB7XG4gIC8vIHNldCBzdHJva2VzdHlsZSBhbmQgZmlsbHN0eWxlIGJlZm9yZSBjYWxsXG4gIC8vIGNhbGwgYmVnaW5QYXRoIGJlZm9yZSBjYWxsXG5cbiAgdmFyIHAwID0gYm9keS5HZXRXb3JsZFBvaW50KHZ0eFswXSk7XG4gIGN0eC5tb3ZlVG8ocDAueCwgcDAueSk7XG4gIGZvciAodmFyIGkgPSAxOyBpIDwgbl92dHg7IGkrKykge1xuICAgIHZhciBwID0gYm9keS5HZXRXb3JsZFBvaW50KHZ0eFtpXSk7XG4gICAgY3R4LmxpbmVUbyhwLngsIHAueSk7XG4gIH1cbiAgY3R4LmxpbmVUbyhwMC54LCBwMC55KTtcbn1cbiIsInZhciBzY2F0dGVyUGxvdCA9IHJlcXVpcmUoXCIuL3NjYXR0ZXItcGxvdFwiKTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIHBsb3RHcmFwaHM6IGZ1bmN0aW9uKGdyYXBoRWxlbSwgdG9wU2NvcmVzRWxlbSwgc2NhdHRlclBsb3RFbGVtLCBsYXN0U3RhdGUsIHNjb3JlcywgY29uZmlnKSB7XG4gICAgbGFzdFN0YXRlID0gbGFzdFN0YXRlIHx8IHt9O1xuICAgIHZhciBnZW5lcmF0aW9uU2l6ZSA9IHNjb3Jlcy5sZW5ndGhcbiAgICB2YXIgZ3JhcGhjYW52YXMgPSBncmFwaEVsZW07XG4gICAgdmFyIGdyYXBoY3R4ID0gZ3JhcGhjYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpO1xuICAgIHZhciBncmFwaHdpZHRoID0gNDAwO1xuICAgIHZhciBncmFwaGhlaWdodCA9IDI1MDtcbiAgICB2YXIgbmV4dFN0YXRlID0gY3dfc3RvcmVHcmFwaFNjb3JlcyhcbiAgICAgIGxhc3RTdGF0ZSwgc2NvcmVzLCBnZW5lcmF0aW9uU2l6ZVxuICAgICk7XG4gICAgY29uc29sZS5sb2coc2NvcmVzLCBuZXh0U3RhdGUpO1xuICAgIGN3X2NsZWFyR3JhcGhpY3MoZ3JhcGhjYW52YXMsIGdyYXBoY3R4LCBncmFwaHdpZHRoLCBncmFwaGhlaWdodCk7XG4gICAgY3dfcGxvdEF2ZXJhZ2UobmV4dFN0YXRlLCBncmFwaGN0eCk7XG4gICAgY3dfcGxvdEVsaXRlKG5leHRTdGF0ZSwgZ3JhcGhjdHgpO1xuICAgIGN3X3Bsb3RUb3AobmV4dFN0YXRlLCBncmFwaGN0eCk7XG4gICAgY3dfbGlzdFRvcFNjb3Jlcyh0b3BTY29yZXNFbGVtLCBuZXh0U3RhdGUpO1xuICAgIG5leHRTdGF0ZS5zY2F0dGVyR3JhcGggPSBkcmF3QWxsUmVzdWx0cyhcbiAgICAgIHNjYXR0ZXJQbG90RWxlbSwgY29uZmlnLCBuZXh0U3RhdGUsIGxhc3RTdGF0ZS5zY2F0dGVyR3JhcGhcbiAgICApO1xuICAgIHJldHVybiBuZXh0U3RhdGU7XG4gIH0sXG4gIGNsZWFyR3JhcGhpY3M6IGZ1bmN0aW9uKGdyYXBoRWxlbSkge1xuICAgIHZhciBncmFwaGNhbnZhcyA9IGdyYXBoRWxlbTtcbiAgICB2YXIgZ3JhcGhjdHggPSBncmFwaGNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIik7XG4gICAgdmFyIGdyYXBod2lkdGggPSA0MDA7XG4gICAgdmFyIGdyYXBoaGVpZ2h0ID0gMjUwO1xuICAgIGN3X2NsZWFyR3JhcGhpY3MoZ3JhcGhjYW52YXMsIGdyYXBoY3R4LCBncmFwaHdpZHRoLCBncmFwaGhlaWdodCk7XG4gIH1cbn07XG5cblxuZnVuY3Rpb24gY3dfc3RvcmVHcmFwaFNjb3JlcyhsYXN0U3RhdGUsIGN3X2NhclNjb3JlcywgZ2VuZXJhdGlvblNpemUpIHtcbiAgY29uc29sZS5sb2coY3dfY2FyU2NvcmVzKTtcbiAgcmV0dXJuIHtcbiAgICBjd190b3BTY29yZXM6IChsYXN0U3RhdGUuY3dfdG9wU2NvcmVzIHx8IFtdKVxuICAgIC5jb25jYXQoW2N3X2NhclNjb3Jlc1swXS5zY29yZV0pLFxuICAgIGN3X2dyYXBoQXZlcmFnZTogKGxhc3RTdGF0ZS5jd19ncmFwaEF2ZXJhZ2UgfHwgW10pLmNvbmNhdChbXG4gICAgICBjd19hdmVyYWdlKGN3X2NhclNjb3JlcywgZ2VuZXJhdGlvblNpemUpXG4gICAgXSksXG4gICAgY3dfZ3JhcGhFbGl0ZTogKGxhc3RTdGF0ZS5jd19ncmFwaEVsaXRlIHx8IFtdKS5jb25jYXQoW1xuICAgICAgY3dfZWxpdGVhdmVyYWdlKGN3X2NhclNjb3JlcywgZ2VuZXJhdGlvblNpemUpXG4gICAgXSksXG4gICAgY3dfZ3JhcGhUb3A6IChsYXN0U3RhdGUuY3dfZ3JhcGhUb3AgfHwgW10pLmNvbmNhdChbXG4gICAgICBjd19jYXJTY29yZXNbMF0uc2NvcmUudlxuICAgIF0pLFxuICAgIGFsbFJlc3VsdHM6IChsYXN0U3RhdGUuYWxsUmVzdWx0cyB8fCBbXSkuY29uY2F0KGN3X2NhclNjb3JlcyksXG4gIH1cbn1cblxuZnVuY3Rpb24gY3dfcGxvdFRvcChzdGF0ZSwgZ3JhcGhjdHgpIHtcbiAgdmFyIGN3X2dyYXBoVG9wID0gc3RhdGUuY3dfZ3JhcGhUb3A7XG4gIHZhciBncmFwaHNpemUgPSBjd19ncmFwaFRvcC5sZW5ndGg7XG4gIGdyYXBoY3R4LnN0cm9rZVN0eWxlID0gXCIjQzgzQjNCXCI7XG4gIGdyYXBoY3R4LmJlZ2luUGF0aCgpO1xuICBncmFwaGN0eC5tb3ZlVG8oMCwgMCk7XG4gIGZvciAodmFyIGsgPSAwOyBrIDwgZ3JhcGhzaXplOyBrKyspIHtcbiAgICBncmFwaGN0eC5saW5lVG8oNDAwICogKGsgKyAxKSAvIGdyYXBoc2l6ZSwgY3dfZ3JhcGhUb3Bba10pO1xuICB9XG4gIGdyYXBoY3R4LnN0cm9rZSgpO1xufVxuXG5mdW5jdGlvbiBjd19wbG90RWxpdGUoc3RhdGUsIGdyYXBoY3R4KSB7XG4gIHZhciBjd19ncmFwaEVsaXRlID0gc3RhdGUuY3dfZ3JhcGhFbGl0ZTtcbiAgdmFyIGdyYXBoc2l6ZSA9IGN3X2dyYXBoRWxpdGUubGVuZ3RoO1xuICBncmFwaGN0eC5zdHJva2VTdHlsZSA9IFwiIzdCQzc0RFwiO1xuICBncmFwaGN0eC5iZWdpblBhdGgoKTtcbiAgZ3JhcGhjdHgubW92ZVRvKDAsIDApO1xuICBmb3IgKHZhciBrID0gMDsgayA8IGdyYXBoc2l6ZTsgaysrKSB7XG4gICAgZ3JhcGhjdHgubGluZVRvKDQwMCAqIChrICsgMSkgLyBncmFwaHNpemUsIGN3X2dyYXBoRWxpdGVba10pO1xuICB9XG4gIGdyYXBoY3R4LnN0cm9rZSgpO1xufVxuXG5mdW5jdGlvbiBjd19wbG90QXZlcmFnZShzdGF0ZSwgZ3JhcGhjdHgpIHtcbiAgdmFyIGN3X2dyYXBoQXZlcmFnZSA9IHN0YXRlLmN3X2dyYXBoQXZlcmFnZTtcbiAgdmFyIGdyYXBoc2l6ZSA9IGN3X2dyYXBoQXZlcmFnZS5sZW5ndGg7XG4gIGdyYXBoY3R4LnN0cm9rZVN0eWxlID0gXCIjM0Y3MkFGXCI7XG4gIGdyYXBoY3R4LmJlZ2luUGF0aCgpO1xuICBncmFwaGN0eC5tb3ZlVG8oMCwgMCk7XG4gIGZvciAodmFyIGsgPSAwOyBrIDwgZ3JhcGhzaXplOyBrKyspIHtcbiAgICBncmFwaGN0eC5saW5lVG8oNDAwICogKGsgKyAxKSAvIGdyYXBoc2l6ZSwgY3dfZ3JhcGhBdmVyYWdlW2tdKTtcbiAgfVxuICBncmFwaGN0eC5zdHJva2UoKTtcbn1cblxuXG5mdW5jdGlvbiBjd19lbGl0ZWF2ZXJhZ2Uoc2NvcmVzLCBnZW5lcmF0aW9uU2l6ZSkge1xuICB2YXIgc3VtID0gMDtcbiAgZm9yICh2YXIgayA9IDA7IGsgPCBNYXRoLmZsb29yKGdlbmVyYXRpb25TaXplIC8gMik7IGsrKykge1xuICAgIHN1bSArPSBzY29yZXNba10uc2NvcmUudjtcbiAgfVxuICByZXR1cm4gc3VtIC8gTWF0aC5mbG9vcihnZW5lcmF0aW9uU2l6ZSAvIDIpO1xufVxuXG5mdW5jdGlvbiBjd19hdmVyYWdlKHNjb3JlcywgZ2VuZXJhdGlvblNpemUpIHtcbiAgdmFyIHN1bSA9IDA7XG4gIGZvciAodmFyIGsgPSAwOyBrIDwgZ2VuZXJhdGlvblNpemU7IGsrKykge1xuICAgIHN1bSArPSBzY29yZXNba10uc2NvcmUudjtcbiAgfVxuICByZXR1cm4gc3VtIC8gZ2VuZXJhdGlvblNpemU7XG59XG5cbmZ1bmN0aW9uIGN3X2NsZWFyR3JhcGhpY3MoZ3JhcGhjYW52YXMsIGdyYXBoY3R4LCBncmFwaHdpZHRoLCBncmFwaGhlaWdodCkge1xuICBncmFwaGNhbnZhcy53aWR0aCA9IGdyYXBoY2FudmFzLndpZHRoO1xuICBncmFwaGN0eC50cmFuc2xhdGUoMCwgZ3JhcGhoZWlnaHQpO1xuICBncmFwaGN0eC5zY2FsZSgxLCAtMSk7XG4gIGdyYXBoY3R4LmxpbmVXaWR0aCA9IDE7XG4gIGdyYXBoY3R4LnN0cm9rZVN0eWxlID0gXCIjM0Y3MkFGXCI7XG4gIGdyYXBoY3R4LmJlZ2luUGF0aCgpO1xuICBncmFwaGN0eC5tb3ZlVG8oMCwgZ3JhcGhoZWlnaHQgLyAyKTtcbiAgZ3JhcGhjdHgubGluZVRvKGdyYXBod2lkdGgsIGdyYXBoaGVpZ2h0IC8gMik7XG4gIGdyYXBoY3R4Lm1vdmVUbygwLCBncmFwaGhlaWdodCAvIDQpO1xuICBncmFwaGN0eC5saW5lVG8oZ3JhcGh3aWR0aCwgZ3JhcGhoZWlnaHQgLyA0KTtcbiAgZ3JhcGhjdHgubW92ZVRvKDAsIGdyYXBoaGVpZ2h0ICogMyAvIDQpO1xuICBncmFwaGN0eC5saW5lVG8oZ3JhcGh3aWR0aCwgZ3JhcGhoZWlnaHQgKiAzIC8gNCk7XG4gIGdyYXBoY3R4LnN0cm9rZSgpO1xufVxuXG5mdW5jdGlvbiBjd19saXN0VG9wU2NvcmVzKGVsZW0sIHN0YXRlKSB7XG4gIHZhciBjd190b3BTY29yZXMgPSBzdGF0ZS5jd190b3BTY29yZXM7XG4gIHZhciB0cyA9IGVsZW07XG4gIHRzLmlubmVySFRNTCA9IFwiPGI+VG9wIFNjb3Jlczo8L2I+PGJyIC8+XCI7XG4gIGN3X3RvcFNjb3Jlcy5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgaWYgKGEudiA+IGIudikge1xuICAgICAgcmV0dXJuIC0xXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAxXG4gICAgfVxuICB9KTtcblxuICBmb3IgKHZhciBrID0gMDsgayA8IE1hdGgubWluKDEwLCBjd190b3BTY29yZXMubGVuZ3RoKTsgaysrKSB7XG4gICAgdmFyIHRvcFNjb3JlID0gY3dfdG9wU2NvcmVzW2tdO1xuICAgIC8vIGNvbnNvbGUubG9nKHRvcFNjb3JlKTtcbiAgICB2YXIgbiA9IFwiI1wiICsgKGsgKyAxKSArIFwiOlwiO1xuICAgIHZhciBzY29yZSA9IE1hdGgucm91bmQodG9wU2NvcmUudiAqIDEwMCkgLyAxMDA7XG4gICAgdmFyIGRpc3RhbmNlID0gXCJkOlwiICsgTWF0aC5yb3VuZCh0b3BTY29yZS54ICogMTAwKSAvIDEwMDtcbiAgICB2YXIgeXJhbmdlID0gIFwiaDpcIiArIE1hdGgucm91bmQodG9wU2NvcmUueTIgKiAxMDApIC8gMTAwICsgXCIvXCIgKyBNYXRoLnJvdW5kKHRvcFNjb3JlLnkgKiAxMDApIC8gMTAwICsgXCJtXCI7XG4gICAgdmFyIGdlbiA9IFwiKEdlbiBcIiArIGN3X3RvcFNjb3Jlc1trXS5pICsgXCIpXCJcblxuICAgIHRzLmlubmVySFRNTCArPSAgW24sIHNjb3JlLCBkaXN0YW5jZSwgeXJhbmdlLCBnZW5dLmpvaW4oXCIgXCIpICsgXCI8YnIgLz5cIjtcbiAgfVxufVxuXG5mdW5jdGlvbiBkcmF3QWxsUmVzdWx0cyhzY2F0dGVyUGxvdEVsZW0sIGNvbmZpZywgYWxsUmVzdWx0cywgcHJldmlvdXNHcmFwaCl7XG4gIGlmKCFzY2F0dGVyUGxvdEVsZW0pIHJldHVybjtcbiAgcmV0dXJuIHNjYXR0ZXJQbG90KHNjYXR0ZXJQbG90RWxlbSwgYWxsUmVzdWx0cywgY29uZmlnLnByb3BlcnR5TWFwLCBwcmV2aW91c0dyYXBoKVxufVxuIiwiLyogZ2xvYmFscyB2aXMgSGlnaGNoYXJ0cyAqL1xuXG4vLyBDYWxsZWQgd2hlbiB0aGUgVmlzdWFsaXphdGlvbiBBUEkgaXMgbG9hZGVkLlxuXG5tb2R1bGUuZXhwb3J0cyA9IGhpZ2hDaGFydHM7XG5mdW5jdGlvbiBoaWdoQ2hhcnRzKGVsZW0sIHNjb3Jlcyl7XG4gIHZhciBrZXlzID0gT2JqZWN0LmtleXMoc2NvcmVzWzBdLmRlZik7XG4gIGtleXMgPSBrZXlzLnJlZHVjZShmdW5jdGlvbihjdXJBcnJheSwga2V5KXtcbiAgICB2YXIgbCA9IHNjb3Jlc1swXS5kZWZba2V5XS5sZW5ndGg7XG4gICAgdmFyIHN1YkFycmF5ID0gW107XG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGw7IGkrKyl7XG4gICAgICBzdWJBcnJheS5wdXNoKGtleSArIFwiLlwiICsgaSk7XG4gICAgfVxuICAgIHJldHVybiBjdXJBcnJheS5jb25jYXQoc3ViQXJyYXkpO1xuICB9LCBbXSk7XG4gIGZ1bmN0aW9uIHJldHJpZXZlVmFsdWUob2JqLCBwYXRoKXtcbiAgICByZXR1cm4gcGF0aC5zcGxpdChcIi5cIikucmVkdWNlKGZ1bmN0aW9uKGN1clZhbHVlLCBrZXkpe1xuICAgICAgcmV0dXJuIGN1clZhbHVlW2tleV07XG4gICAgfSwgb2JqKTtcbiAgfVxuXG4gIHZhciBkYXRhT2JqID0gT2JqZWN0LmtleXMoc2NvcmVzKS5yZWR1Y2UoZnVuY3Rpb24oa3YsIHNjb3JlKXtcbiAgICBrZXlzLmZvckVhY2goZnVuY3Rpb24oa2V5KXtcbiAgICAgIGt2W2tleV0uZGF0YS5wdXNoKFtcbiAgICAgICAgcmV0cmlldmVWYWx1ZShzY29yZS5kZWYsIGtleSksIHNjb3JlLnNjb3JlLnZcbiAgICAgIF0pXG4gICAgfSlcbiAgICByZXR1cm4ga3Y7XG4gIH0sIGtleXMucmVkdWNlKGZ1bmN0aW9uKGt2LCBrZXkpe1xuICAgIGt2W2tleV0gPSB7XG4gICAgICBuYW1lOiBrZXksXG4gICAgICBkYXRhOiBbXSxcbiAgICB9XG4gICAgcmV0dXJuIGt2O1xuICB9LCB7fSkpXG4gIEhpZ2hjaGFydHMuY2hhcnQoZWxlbS5pZCwge1xuICAgICAgY2hhcnQ6IHtcbiAgICAgICAgICB0eXBlOiAnc2NhdHRlcicsXG4gICAgICAgICAgem9vbVR5cGU6ICd4eSdcbiAgICAgIH0sXG4gICAgICB0aXRsZToge1xuICAgICAgICAgIHRleHQ6ICdQcm9wZXJ0eSBWYWx1ZSB0byBTY29yZSdcbiAgICAgIH0sXG4gICAgICB4QXhpczoge1xuICAgICAgICAgIHRpdGxlOiB7XG4gICAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICAgIHRleHQ6ICdOb3JtYWxpemVkJ1xuICAgICAgICAgIH0sXG4gICAgICAgICAgc3RhcnRPblRpY2s6IHRydWUsXG4gICAgICAgICAgZW5kT25UaWNrOiB0cnVlLFxuICAgICAgICAgIHNob3dMYXN0TGFiZWw6IHRydWVcbiAgICAgIH0sXG4gICAgICB5QXhpczoge1xuICAgICAgICAgIHRpdGxlOiB7XG4gICAgICAgICAgICAgIHRleHQ6ICdTY29yZSdcbiAgICAgICAgICB9XG4gICAgICB9LFxuICAgICAgbGVnZW5kOiB7XG4gICAgICAgICAgbGF5b3V0OiAndmVydGljYWwnLFxuICAgICAgICAgIGFsaWduOiAnbGVmdCcsXG4gICAgICAgICAgdmVydGljYWxBbGlnbjogJ3RvcCcsXG4gICAgICAgICAgeDogMTAwLFxuICAgICAgICAgIHk6IDcwLFxuICAgICAgICAgIGZsb2F0aW5nOiB0cnVlLFxuICAgICAgICAgIGJhY2tncm91bmRDb2xvcjogKEhpZ2hjaGFydHMudGhlbWUgJiYgSGlnaGNoYXJ0cy50aGVtZS5sZWdlbmRCYWNrZ3JvdW5kQ29sb3IpIHx8ICcjRkZGRkZGJyxcbiAgICAgICAgICBib3JkZXJXaWR0aDogMVxuICAgICAgfSxcbiAgICAgIHBsb3RPcHRpb25zOiB7XG4gICAgICAgICAgc2NhdHRlcjoge1xuICAgICAgICAgICAgICBtYXJrZXI6IHtcbiAgICAgICAgICAgICAgICAgIHJhZGl1czogNSxcbiAgICAgICAgICAgICAgICAgIHN0YXRlczoge1xuICAgICAgICAgICAgICAgICAgICAgIGhvdmVyOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGxpbmVDb2xvcjogJ3JnYigxMDAsMTAwLDEwMCknXG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBzdGF0ZXM6IHtcbiAgICAgICAgICAgICAgICAgIGhvdmVyOiB7XG4gICAgICAgICAgICAgICAgICAgICAgbWFya2VyOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGVuYWJsZWQ6IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB0b29sdGlwOiB7XG4gICAgICAgICAgICAgICAgICBoZWFkZXJGb3JtYXQ6ICc8Yj57c2VyaWVzLm5hbWV9PC9iPjxicj4nLFxuICAgICAgICAgICAgICAgICAgcG9pbnRGb3JtYXQ6ICd7cG9pbnQueH0sIHtwb2ludC55fSdcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBzZXJpZXM6IGtleXMubWFwKGZ1bmN0aW9uKGtleSl7XG4gICAgICAgIHJldHVybiBkYXRhT2JqW2tleV07XG4gICAgICB9KVxuICB9KTtcbn1cblxuZnVuY3Rpb24gdmlzQ2hhcnQoZWxlbSwgc2NvcmVzLCBwcm9wZXJ0eU1hcCwgZ3JhcGgpIHtcblxuICAvLyBDcmVhdGUgYW5kIHBvcHVsYXRlIGEgZGF0YSB0YWJsZS5cbiAgdmFyIGRhdGEgPSBuZXcgdmlzLkRhdGFTZXQoKTtcbiAgc2NvcmVzLmZvckVhY2goZnVuY3Rpb24oc2NvcmVJbmZvKXtcbiAgICBkYXRhLmFkZCh7XG4gICAgICB4OiBnZXRQcm9wZXJ0eShzY29yZUluZm8sIHByb3BlcnR5TWFwLngpLFxuICAgICAgeTogZ2V0UHJvcGVydHkoc2NvcmVJbmZvLCBwcm9wZXJ0eU1hcC54KSxcbiAgICAgIHo6IGdldFByb3BlcnR5KHNjb3JlSW5mbywgcHJvcGVydHlNYXAueiksXG4gICAgICBzdHlsZTogZ2V0UHJvcGVydHkoc2NvcmVJbmZvLCBwcm9wZXJ0eU1hcC56KSxcbiAgICAgIC8vIGV4dHJhOiBkZWYuYW5jZXN0cnlcbiAgICB9KTtcbiAgfSk7XG5cbiAgZnVuY3Rpb24gZ2V0UHJvcGVydHkoaW5mbywga2V5KXtcbiAgICBpZihrZXkgPT09IFwic2NvcmVcIil7XG4gICAgICByZXR1cm4gaW5mby5zY29yZS52XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBpbmZvLmRlZltrZXldO1xuICAgIH1cbiAgfVxuXG4gIC8vIHNwZWNpZnkgb3B0aW9uc1xuICB2YXIgb3B0aW9ucyA9IHtcbiAgICB3aWR0aDogICc2MDBweCcsXG4gICAgaGVpZ2h0OiAnNjAwcHgnLFxuICAgIHN0eWxlOiAnZG90LXNpemUnLFxuICAgIHNob3dQZXJzcGVjdGl2ZTogdHJ1ZSxcbiAgICBzaG93TGVnZW5kOiB0cnVlLFxuICAgIHNob3dHcmlkOiB0cnVlLFxuICAgIHNob3dTaGFkb3c6IGZhbHNlLFxuXG4gICAgLy8gT3B0aW9uIHRvb2x0aXAgY2FuIGJlIHRydWUsIGZhbHNlLCBvciBhIGZ1bmN0aW9uIHJldHVybmluZyBhIHN0cmluZyB3aXRoIEhUTUwgY29udGVudHNcbiAgICB0b29sdGlwOiBmdW5jdGlvbiAocG9pbnQpIHtcbiAgICAgIC8vIHBhcmFtZXRlciBwb2ludCBjb250YWlucyBwcm9wZXJ0aWVzIHgsIHksIHosIGFuZCBkYXRhXG4gICAgICAvLyBkYXRhIGlzIHRoZSBvcmlnaW5hbCBvYmplY3QgcGFzc2VkIHRvIHRoZSBwb2ludCBjb25zdHJ1Y3RvclxuICAgICAgcmV0dXJuICdzY29yZTogPGI+JyArIHBvaW50LnogKyAnPC9iPjxicj4nOyAvLyArIHBvaW50LmRhdGEuZXh0cmE7XG4gICAgfSxcblxuICAgIC8vIFRvb2x0aXAgZGVmYXVsdCBzdHlsaW5nIGNhbiBiZSBvdmVycmlkZGVuXG4gICAgdG9vbHRpcFN0eWxlOiB7XG4gICAgICBjb250ZW50OiB7XG4gICAgICAgIGJhY2tncm91bmQgICAgOiAncmdiYSgyNTUsIDI1NSwgMjU1LCAwLjcpJyxcbiAgICAgICAgcGFkZGluZyAgICAgICA6ICcxMHB4JyxcbiAgICAgICAgYm9yZGVyUmFkaXVzICA6ICcxMHB4J1xuICAgICAgfSxcbiAgICAgIGxpbmU6IHtcbiAgICAgICAgYm9yZGVyTGVmdCAgICA6ICcxcHggZG90dGVkIHJnYmEoMCwgMCwgMCwgMC41KSdcbiAgICAgIH0sXG4gICAgICBkb3Q6IHtcbiAgICAgICAgYm9yZGVyICAgICAgICA6ICc1cHggc29saWQgcmdiYSgwLCAwLCAwLCAwLjUpJ1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBrZWVwQXNwZWN0UmF0aW86IHRydWUsXG4gICAgdmVydGljYWxSYXRpbzogMC41XG4gIH07XG5cbiAgdmFyIGNhbWVyYSA9IGdyYXBoID8gZ3JhcGguZ2V0Q2FtZXJhUG9zaXRpb24oKSA6IG51bGw7XG5cbiAgLy8gY3JlYXRlIG91ciBncmFwaFxuICB2YXIgY29udGFpbmVyID0gZWxlbTtcbiAgZ3JhcGggPSBuZXcgdmlzLkdyYXBoM2QoY29udGFpbmVyLCBkYXRhLCBvcHRpb25zKTtcblxuICBpZiAoY2FtZXJhKSBncmFwaC5zZXRDYW1lcmFQb3NpdGlvbihjYW1lcmEpOyAvLyByZXN0b3JlIGNhbWVyYSBwb3NpdGlvblxuICByZXR1cm4gZ3JhcGg7XG59XG4iLCJcbm1vZHVsZS5leHBvcnRzID0gZ2VuZXJhdGVSYW5kb207XG5mdW5jdGlvbiBnZW5lcmF0ZVJhbmRvbSgpe1xuICByZXR1cm4gTWF0aC5yYW5kb20oKTtcbn1cbiIsIi8vIGh0dHA6Ly9zdW5taW5ndGFvLmJsb2dzcG90LmNvbS8yMDE2LzExL2luYnJlZWRpbmctY29lZmZpY2llbnQuaHRtbFxubW9kdWxlLmV4cG9ydHMgPSBnZXRJbmJyZWVkaW5nQ29lZmZpY2llbnQ7XG5cbmZ1bmN0aW9uIGdldEluYnJlZWRpbmdDb2VmZmljaWVudChjaGlsZCl7XG4gIHZhciBuYW1lSW5kZXggPSBuZXcgTWFwKCk7XG4gIHZhciBmbGFnZ2VkID0gbmV3IFNldCgpO1xuICB2YXIgY29udmVyZ2VuY2VQb2ludHMgPSBuZXcgU2V0KCk7XG4gIGNyZWF0ZUFuY2VzdHJ5TWFwKGNoaWxkLCBbXSk7XG5cbiAgdmFyIHN0b3JlZENvZWZmaWNpZW50cyA9IG5ldyBNYXAoKTtcblxuICByZXR1cm4gQXJyYXkuZnJvbShjb252ZXJnZW5jZVBvaW50cy52YWx1ZXMoKSkucmVkdWNlKGZ1bmN0aW9uKHN1bSwgcG9pbnQpe1xuICAgIHZhciBpQ28gPSBnZXRDb2VmZmljaWVudChwb2ludCk7XG4gICAgcmV0dXJuIHN1bSArIGlDbztcbiAgfSwgMCk7XG5cbiAgZnVuY3Rpb24gY3JlYXRlQW5jZXN0cnlNYXAoaW5pdE5vZGUpe1xuICAgIHZhciBpdGVtc0luUXVldWUgPSBbeyBub2RlOiBpbml0Tm9kZSwgcGF0aDogW10gfV07XG4gICAgZG97XG4gICAgICB2YXIgaXRlbSA9IGl0ZW1zSW5RdWV1ZS5zaGlmdCgpO1xuICAgICAgdmFyIG5vZGUgPSBpdGVtLm5vZGU7XG4gICAgICB2YXIgcGF0aCA9IGl0ZW0ucGF0aDtcbiAgICAgIGlmKHByb2Nlc3NJdGVtKG5vZGUsIHBhdGgpKXtcbiAgICAgICAgdmFyIG5leHRQYXRoID0gWyBub2RlLmlkIF0uY29uY2F0KHBhdGgpO1xuICAgICAgICBpdGVtc0luUXVldWUgPSBpdGVtc0luUXVldWUuY29uY2F0KG5vZGUuYW5jZXN0cnkubWFwKGZ1bmN0aW9uKHBhcmVudCl7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIG5vZGU6IHBhcmVudCxcbiAgICAgICAgICAgIHBhdGg6IG5leHRQYXRoXG4gICAgICAgICAgfTtcbiAgICAgICAgfSkpO1xuICAgICAgfVxuICAgIH13aGlsZShpdGVtc0luUXVldWUubGVuZ3RoKTtcblxuXG4gICAgZnVuY3Rpb24gcHJvY2Vzc0l0ZW0obm9kZSwgcGF0aCl7XG4gICAgICB2YXIgbmV3QW5jZXN0b3IgPSAhbmFtZUluZGV4Lmhhcyhub2RlLmlkKTtcbiAgICAgIGlmKG5ld0FuY2VzdG9yKXtcbiAgICAgICAgbmFtZUluZGV4LnNldChub2RlLmlkLCB7XG4gICAgICAgICAgcGFyZW50czogKG5vZGUuYW5jZXN0cnkgfHwgW10pLm1hcChmdW5jdGlvbihwYXJlbnQpe1xuICAgICAgICAgICAgcmV0dXJuIHBhcmVudC5pZDtcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBpZDogbm9kZS5pZCxcbiAgICAgICAgICBjaGlsZHJlbjogW10sXG4gICAgICAgICAgY29udmVyZ2VuY2VzOiBbXSxcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuXG4gICAgICAgIGZsYWdnZWQuYWRkKG5vZGUuaWQpXG4gICAgICAgIG5hbWVJbmRleC5nZXQobm9kZS5pZCkuY2hpbGRyZW4uZm9yRWFjaChmdW5jdGlvbihjaGlsZElkZW50aWZpZXIpe1xuICAgICAgICAgIHZhciBvZmZzZXRzID0gZmluZENvbnZlcmdlbmNlKGNoaWxkSWRlbnRpZmllci5wYXRoLCBwYXRoKTtcbiAgICAgICAgICBpZighb2Zmc2V0cyl7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIHZhciBjaGlsZElEID0gcGF0aFtvZmZzZXRzWzFdXTtcbiAgICAgICAgICBjb252ZXJnZW5jZVBvaW50cy5hZGQoY2hpbGRJRCk7XG4gICAgICAgICAgbmFtZUluZGV4LmdldChjaGlsZElEKS5jb252ZXJnZW5jZXMucHVzaCh7XG4gICAgICAgICAgICBwYXJlbnQ6IG5vZGUuaWQsXG4gICAgICAgICAgICBvZmZzZXRzOiBvZmZzZXRzLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgaWYocGF0aC5sZW5ndGgpe1xuICAgICAgICBuYW1lSW5kZXguZ2V0KG5vZGUuaWQpLmNoaWxkcmVuLnB1c2goe1xuICAgICAgICAgIGNoaWxkOiBwYXRoWzBdLFxuICAgICAgICAgIHBhdGg6IHBhdGhcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIGlmKCFuZXdBbmNlc3Rvcil7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmKCFub2RlLmFuY2VzdHJ5KXtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0Q29lZmZpY2llbnQoaWQpe1xuICAgIGlmKHN0b3JlZENvZWZmaWNpZW50cy5oYXMoaWQpKXtcbiAgICAgIHJldHVybiBzdG9yZWRDb2VmZmljaWVudHMuZ2V0KGlkKTtcbiAgICB9XG4gICAgdmFyIG5vZGUgPSBuYW1lSW5kZXguZ2V0KGlkKTtcbiAgICB2YXIgdmFsID0gbm9kZS5jb252ZXJnZW5jZXMucmVkdWNlKGZ1bmN0aW9uKHN1bSwgcG9pbnQpe1xuICAgICAgcmV0dXJuIHN1bSArIE1hdGgucG93KDEgLyAyLCBwb2ludC5vZmZzZXRzLnJlZHVjZShmdW5jdGlvbihzdW0sIHZhbHVlKXtcbiAgICAgICAgcmV0dXJuIHN1bSArIHZhbHVlO1xuICAgICAgfSwgMSkpICogKDEgKyBnZXRDb2VmZmljaWVudChwb2ludC5wYXJlbnQpKTtcbiAgICB9LCAwKTtcbiAgICBzdG9yZWRDb2VmZmljaWVudHMuc2V0KGlkLCB2YWwpO1xuXG4gICAgcmV0dXJuIHZhbDtcblxuICB9XG4gIGZ1bmN0aW9uIGZpbmRDb252ZXJnZW5jZShsaXN0QSwgbGlzdEIpe1xuICAgIHZhciBjaSwgY2osIGxpLCBsajtcbiAgICBvdXRlcmxvb3A6XG4gICAgZm9yKGNpID0gMCwgbGkgPSBsaXN0QS5sZW5ndGg7IGNpIDwgbGk7IGNpKyspe1xuICAgICAgZm9yKGNqID0gMCwgbGogPSBsaXN0Qi5sZW5ndGg7IGNqIDwgbGo7IGNqKyspe1xuICAgICAgICBpZihsaXN0QVtjaV0gPT09IGxpc3RCW2NqXSl7XG4gICAgICAgICAgYnJlYWsgb3V0ZXJsb29wO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmKGNpID09PSBsaSl7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiBbY2ksIGNqXTtcbiAgfVxufVxuIiwidmFyIGNhckNvbnN0cnVjdCA9IHJlcXVpcmUoXCIuLi9jYXItc2NoZW1hL2NvbnN0cnVjdC5qc1wiKTtcblxudmFyIGNhckNvbnN0YW50cyA9IGNhckNvbnN0cnVjdC5jYXJDb25zdGFudHMoKTtcblxudmFyIHNjaGVtYSA9IGNhckNvbnN0cnVjdC5nZW5lcmF0ZVNjaGVtYShjYXJDb25zdGFudHMpO1xudmFyIHBpY2tQYXJlbnQgPSByZXF1aXJlKFwiLi9waWNrUGFyZW50XCIpO1xudmFyIHNlbGVjdEZyb21BbGxQYXJlbnRzID0gcmVxdWlyZShcIi4vc2VsZWN0RnJvbUFsbFBhcmVudHNcIik7XG5jb25zdCBjb25zdGFudHMgPSB7XG4gIGdlbmVyYXRpb25TaXplOiAyMCxcbiAgc2NoZW1hOiBzY2hlbWEsXG4gIGNoYW1waW9uTGVuZ3RoOiAxLFxuICBtdXRhdGlvbl9yYW5nZTogMSxcbiAgZ2VuX211dGF0aW9uOiAwLjA1LFxufTtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKXtcbiAgdmFyIGN1cnJlbnRDaG9pY2VzID0gbmV3IE1hcCgpO1xuICByZXR1cm4gT2JqZWN0LmFzc2lnbihcbiAgICB7fSxcbiAgICBjb25zdGFudHMsXG4gICAge1xuICAgICAgc2VsZWN0RnJvbUFsbFBhcmVudHM6IHNlbGVjdEZyb21BbGxQYXJlbnRzLFxuICAgICAgZ2VuZXJhdGVSYW5kb206IHJlcXVpcmUoXCIuL2dlbmVyYXRlUmFuZG9tXCIpLFxuICAgICAgcGlja1BhcmVudDogcGlja1BhcmVudC5iaW5kKHZvaWQgMCwgY3VycmVudENob2ljZXMpLFxuICAgIH1cbiAgKTtcbn1cbm1vZHVsZS5leHBvcnRzLmNvbnN0YW50cyA9IGNvbnN0YW50c1xuIiwidmFyIG5BdHRyaWJ1dGVzID0gMTU7XG5tb2R1bGUuZXhwb3J0cyA9IHBpY2tQYXJlbnQ7XG5cbmZ1bmN0aW9uIHBpY2tQYXJlbnQoY3VycmVudENob2ljZXMsIGNob29zZUlkLCBrZXkgLyogLCBwYXJlbnRzICovKXtcbiAgaWYoIWN1cnJlbnRDaG9pY2VzLmhhcyhjaG9vc2VJZCkpe1xuICAgIGN1cnJlbnRDaG9pY2VzLnNldChjaG9vc2VJZCwgaW5pdGlhbGl6ZVBpY2soKSlcbiAgfVxuICAvLyBjb25zb2xlLmxvZyhjaG9vc2VJZCk7XG4gIHZhciBzdGF0ZSA9IGN1cnJlbnRDaG9pY2VzLmdldChjaG9vc2VJZCk7XG4gIC8vIGNvbnNvbGUubG9nKHN0YXRlLmN1cnBhcmVudCk7XG4gIHN0YXRlLmkrK1xuICBpZihbXCJ3aGVlbF9yYWRpdXNcIiwgXCJ3aGVlbF92ZXJ0ZXhcIiwgXCJ3aGVlbF9kZW5zaXR5XCIsIFwid2hlZWxfZnJpY3Rpb25fZXhwb25lbnRcIl0uaW5kZXhPZihrZXkpID4gLTEpe1xuICAgIHN0YXRlLmN1cnBhcmVudCA9IGN3X2Nob29zZVBhcmVudChzdGF0ZSk7XG4gICAgcmV0dXJuIHN0YXRlLmN1cnBhcmVudDtcbiAgfVxuICBzdGF0ZS5jdXJwYXJlbnQgPSBjd19jaG9vc2VQYXJlbnQoc3RhdGUpO1xuICByZXR1cm4gc3RhdGUuY3VycGFyZW50O1xuXG4gIGZ1bmN0aW9uIGN3X2Nob29zZVBhcmVudChzdGF0ZSkge1xuICAgIHZhciBjdXJwYXJlbnQgPSBzdGF0ZS5jdXJwYXJlbnQ7XG4gICAgdmFyIGF0dHJpYnV0ZUluZGV4ID0gc3RhdGUuaTtcbiAgICB2YXIgc3dhcFBvaW50MSA9IHN0YXRlLnN3YXBQb2ludDFcbiAgICB2YXIgc3dhcFBvaW50MiA9IHN0YXRlLnN3YXBQb2ludDJcbiAgICAvLyBjb25zb2xlLmxvZyhzd2FwUG9pbnQxLCBzd2FwUG9pbnQyLCBhdHRyaWJ1dGVJbmRleClcbiAgICBpZiAoKHN3YXBQb2ludDEgPT0gYXR0cmlidXRlSW5kZXgpIHx8IChzd2FwUG9pbnQyID09IGF0dHJpYnV0ZUluZGV4KSkge1xuICAgICAgcmV0dXJuIGN1cnBhcmVudCA9PSAxID8gMCA6IDFcbiAgICB9XG4gICAgcmV0dXJuIGN1cnBhcmVudFxuICB9XG5cbiAgZnVuY3Rpb24gaW5pdGlhbGl6ZVBpY2soKXtcbiAgICB2YXIgY3VycGFyZW50ID0gMDtcblxuICAgIHZhciBzd2FwUG9pbnQxID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogKG5BdHRyaWJ1dGVzKSk7XG4gICAgdmFyIHN3YXBQb2ludDIgPSBzd2FwUG9pbnQxO1xuICAgIHdoaWxlIChzd2FwUG9pbnQyID09IHN3YXBQb2ludDEpIHtcbiAgICAgIHN3YXBQb2ludDIgPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAobkF0dHJpYnV0ZXMpKTtcbiAgICB9XG4gICAgdmFyIGkgPSAwO1xuICAgIHJldHVybiB7XG4gICAgICBjdXJwYXJlbnQ6IGN1cnBhcmVudCxcbiAgICAgIGk6IGksXG4gICAgICBzd2FwUG9pbnQxOiBzd2FwUG9pbnQxLFxuICAgICAgc3dhcFBvaW50Mjogc3dhcFBvaW50MlxuICAgIH1cbiAgfVxufVxuIiwidmFyIGdldEluYnJlZWRpbmdDb2VmZmljaWVudCA9IHJlcXVpcmUoXCIuL2luYnJlZWRpbmctY29lZmZpY2llbnRcIik7XG5cbm1vZHVsZS5leHBvcnRzID0gc2ltcGxlU2VsZWN0O1xuXG5mdW5jdGlvbiBzaW1wbGVTZWxlY3QocGFyZW50cyl7XG4gIHZhciB0b3RhbFBhcmVudHMgPSBwYXJlbnRzLmxlbmd0aFxuICB2YXIgciA9IE1hdGgucmFuZG9tKCk7XG4gIGlmIChyID09IDApXG4gICAgcmV0dXJuIDA7XG4gIHJldHVybiBNYXRoLmZsb29yKC1NYXRoLmxvZyhyKSAqIHRvdGFsUGFyZW50cykgJSB0b3RhbFBhcmVudHM7XG59XG5cbmZ1bmN0aW9uIHNlbGVjdEZyb21BbGxQYXJlbnRzKHBhcmVudHMsIHBhcmVudExpc3QsIHByZXZpb3VzUGFyZW50SW5kZXgpIHtcbiAgdmFyIHByZXZpb3VzUGFyZW50ID0gcGFyZW50c1twcmV2aW91c1BhcmVudEluZGV4XTtcbiAgdmFyIHZhbGlkUGFyZW50cyA9IHBhcmVudHMuZmlsdGVyKGZ1bmN0aW9uKHBhcmVudCwgaSl7XG4gICAgaWYocHJldmlvdXNQYXJlbnRJbmRleCA9PT0gaSl7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGlmKCFwcmV2aW91c1BhcmVudCl7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgdmFyIGNoaWxkID0ge1xuICAgICAgaWQ6IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzIpLFxuICAgICAgYW5jZXN0cnk6IFtwcmV2aW91c1BhcmVudCwgcGFyZW50XS5tYXAoZnVuY3Rpb24ocCl7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgaWQ6IHAuZGVmLmlkLFxuICAgICAgICAgIGFuY2VzdHJ5OiBwLmRlZi5hbmNlc3RyeVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH1cbiAgICB2YXIgaUNvID0gZ2V0SW5icmVlZGluZ0NvZWZmaWNpZW50KGNoaWxkKTtcbiAgICBjb25zb2xlLmxvZyhcImluYnJlZWRpbmcgY29lZmZpY2llbnRcIiwgaUNvKVxuICAgIGlmKGlDbyA+IDAuMjUpe1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSlcbiAgaWYodmFsaWRQYXJlbnRzLmxlbmd0aCA9PT0gMCl7XG4gICAgcmV0dXJuIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIHBhcmVudHMubGVuZ3RoKVxuICB9XG4gIHZhciB0b3RhbFNjb3JlID0gdmFsaWRQYXJlbnRzLnJlZHVjZShmdW5jdGlvbihzdW0sIHBhcmVudCl7XG4gICAgcmV0dXJuIHN1bSArIHBhcmVudC5zY29yZS52O1xuICB9LCAwKTtcbiAgdmFyIHIgPSB0b3RhbFNjb3JlICogTWF0aC5yYW5kb20oKTtcbiAgZm9yKHZhciBpID0gMDsgaSA8IHZhbGlkUGFyZW50cy5sZW5ndGg7IGkrKyl7XG4gICAgdmFyIHNjb3JlID0gdmFsaWRQYXJlbnRzW2ldLnNjb3JlLnY7XG4gICAgaWYociA+IHNjb3JlKXtcbiAgICAgIHIgPSByIC0gc2NvcmU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuICByZXR1cm4gaTtcbn1cbiIsIlxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihjYXIpIHtcbiAgdmFyIG91dCA9IHtcbiAgICBjaGFzc2lzOiBnaG9zdF9nZXRfY2hhc3NpcyhjYXIuY2hhc3NpcyksXG4gICAgd2hlZWxzOiBbXSxcbiAgICBwb3M6IHt4OiBjYXIuY2hhc3Npcy5HZXRQb3NpdGlvbigpLngsIHk6IGNhci5jaGFzc2lzLkdldFBvc2l0aW9uKCkueX1cbiAgfTtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGNhci53aGVlbHMubGVuZ3RoOyBpKyspIHtcbiAgICBvdXQud2hlZWxzW2ldID0gZ2hvc3RfZ2V0X3doZWVsKGNhci53aGVlbHNbaV0pO1xuICB9XG5cbiAgcmV0dXJuIG91dDtcbn1cblxuZnVuY3Rpb24gZ2hvc3RfZ2V0X2NoYXNzaXMoYykge1xuICB2YXIgZ2MgPSBbXTtcblxuICBmb3IgKHZhciBmID0gYy5HZXRGaXh0dXJlTGlzdCgpOyBmOyBmID0gZi5tX25leHQpIHtcbiAgICB2YXIgcyA9IGYuR2V0U2hhcGUoKTtcblxuICAgIHZhciBwID0ge1xuICAgICAgdnR4OiBbXSxcbiAgICAgIG51bTogMFxuICAgIH1cblxuICAgIHAubnVtID0gcy5tX3ZlcnRleENvdW50O1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzLm1fdmVydGV4Q291bnQ7IGkrKykge1xuICAgICAgcC52dHgucHVzaChjLkdldFdvcmxkUG9pbnQocy5tX3ZlcnRpY2VzW2ldKSk7XG4gICAgfVxuXG4gICAgZ2MucHVzaChwKTtcbiAgfVxuXG4gIHJldHVybiBnYztcbn1cblxuZnVuY3Rpb24gZ2hvc3RfZ2V0X3doZWVsKHcpIHtcbiAgdmFyIGd3ID0gW107XG5cbiAgZm9yICh2YXIgZiA9IHcuR2V0Rml4dHVyZUxpc3QoKTsgZjsgZiA9IGYubV9uZXh0KSB7XG4gICAgdmFyIHMgPSBmLkdldFNoYXBlKCk7XG5cbiAgICB2YXIgYyA9IHtcbiAgICAgIHBvczogdy5HZXRXb3JsZFBvaW50KHMubV9wKSxcbiAgICAgIHJhZDogcy5tX3JhZGl1cyxcbiAgICAgIGFuZzogdy5tX3N3ZWVwLmFcbiAgICB9XG5cbiAgICBndy5wdXNoKGMpO1xuICB9XG5cbiAgcmV0dXJuIGd3O1xufVxuIiwiXG52YXIgZ2hvc3RfZ2V0X2ZyYW1lID0gcmVxdWlyZShcIi4vY2FyLXRvLWdob3N0LmpzXCIpO1xuXG52YXIgZW5hYmxlX2dob3N0ID0gdHJ1ZTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGdob3N0X2NyZWF0ZV9yZXBsYXk6IGdob3N0X2NyZWF0ZV9yZXBsYXksXG4gIGdob3N0X2NyZWF0ZV9naG9zdDogZ2hvc3RfY3JlYXRlX2dob3N0LFxuICBnaG9zdF9wYXVzZTogZ2hvc3RfcGF1c2UsXG4gIGdob3N0X3Jlc3VtZTogZ2hvc3RfcmVzdW1lLFxuICBnaG9zdF9nZXRfcG9zaXRpb246IGdob3N0X2dldF9wb3NpdGlvbixcbiAgZ2hvc3RfY29tcGFyZV90b19yZXBsYXk6IGdob3N0X2NvbXBhcmVfdG9fcmVwbGF5LFxuICBnaG9zdF9tb3ZlX2ZyYW1lOiBnaG9zdF9tb3ZlX2ZyYW1lLFxuICBnaG9zdF9hZGRfcmVwbGF5X2ZyYW1lOiBnaG9zdF9hZGRfcmVwbGF5X2ZyYW1lLFxuICBnaG9zdF9kcmF3X2ZyYW1lOiBnaG9zdF9kcmF3X2ZyYW1lLFxuICBnaG9zdF9yZXNldF9naG9zdDogZ2hvc3RfcmVzZXRfZ2hvc3Rcbn1cblxuZnVuY3Rpb24gZ2hvc3RfY3JlYXRlX3JlcGxheSgpIHtcbiAgaWYgKCFlbmFibGVfZ2hvc3QpXG4gICAgcmV0dXJuIG51bGw7XG5cbiAgcmV0dXJuIHtcbiAgICBudW1fZnJhbWVzOiAwLFxuICAgIGZyYW1lczogW10sXG4gIH1cbn1cblxuZnVuY3Rpb24gZ2hvc3RfY3JlYXRlX2dob3N0KCkge1xuICBpZiAoIWVuYWJsZV9naG9zdClcbiAgICByZXR1cm4gbnVsbDtcblxuICByZXR1cm4ge1xuICAgIHJlcGxheTogbnVsbCxcbiAgICBmcmFtZTogMCxcbiAgICBkaXN0OiAtMTAwXG4gIH1cbn1cblxuZnVuY3Rpb24gZ2hvc3RfcmVzZXRfZ2hvc3QoZ2hvc3QpIHtcbiAgaWYgKCFlbmFibGVfZ2hvc3QpXG4gICAgcmV0dXJuO1xuICBpZiAoZ2hvc3QgPT0gbnVsbClcbiAgICByZXR1cm47XG4gIGdob3N0LmZyYW1lID0gMDtcbn1cblxuZnVuY3Rpb24gZ2hvc3RfcGF1c2UoZ2hvc3QpIHtcbiAgaWYgKGdob3N0ICE9IG51bGwpXG4gICAgZ2hvc3Qub2xkX2ZyYW1lID0gZ2hvc3QuZnJhbWU7XG4gIGdob3N0X3Jlc2V0X2dob3N0KGdob3N0KTtcbn1cblxuZnVuY3Rpb24gZ2hvc3RfcmVzdW1lKGdob3N0KSB7XG4gIGlmIChnaG9zdCAhPSBudWxsKVxuICAgIGdob3N0LmZyYW1lID0gZ2hvc3Qub2xkX2ZyYW1lO1xufVxuXG5mdW5jdGlvbiBnaG9zdF9nZXRfcG9zaXRpb24oZ2hvc3QpIHtcbiAgaWYgKCFlbmFibGVfZ2hvc3QpXG4gICAgcmV0dXJuO1xuICBpZiAoZ2hvc3QgPT0gbnVsbClcbiAgICByZXR1cm47XG4gIGlmIChnaG9zdC5mcmFtZSA8IDApXG4gICAgcmV0dXJuO1xuICBpZiAoZ2hvc3QucmVwbGF5ID09IG51bGwpXG4gICAgcmV0dXJuO1xuICB2YXIgZnJhbWUgPSBnaG9zdC5yZXBsYXkuZnJhbWVzW2dob3N0LmZyYW1lXTtcbiAgcmV0dXJuIGZyYW1lLnBvcztcbn1cblxuZnVuY3Rpb24gZ2hvc3RfY29tcGFyZV90b19yZXBsYXkocmVwbGF5LCBnaG9zdCwgbWF4KSB7XG4gIGlmICghZW5hYmxlX2dob3N0KVxuICAgIHJldHVybjtcbiAgaWYgKGdob3N0ID09IG51bGwpXG4gICAgcmV0dXJuO1xuICBpZiAocmVwbGF5ID09IG51bGwpXG4gICAgcmV0dXJuO1xuXG4gIGlmIChnaG9zdC5kaXN0IDwgbWF4KSB7XG4gICAgZ2hvc3QucmVwbGF5ID0gcmVwbGF5O1xuICAgIGdob3N0LmRpc3QgPSBtYXg7XG4gICAgZ2hvc3QuZnJhbWUgPSAwO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdob3N0X21vdmVfZnJhbWUoZ2hvc3QpIHtcbiAgaWYgKCFlbmFibGVfZ2hvc3QpXG4gICAgcmV0dXJuO1xuICBpZiAoZ2hvc3QgPT0gbnVsbClcbiAgICByZXR1cm47XG4gIGlmIChnaG9zdC5yZXBsYXkgPT0gbnVsbClcbiAgICByZXR1cm47XG4gIGdob3N0LmZyYW1lKys7XG4gIGlmIChnaG9zdC5mcmFtZSA+PSBnaG9zdC5yZXBsYXkubnVtX2ZyYW1lcylcbiAgICBnaG9zdC5mcmFtZSA9IGdob3N0LnJlcGxheS5udW1fZnJhbWVzIC0gMTtcbn1cblxuZnVuY3Rpb24gZ2hvc3RfYWRkX3JlcGxheV9mcmFtZShyZXBsYXksIGNhcikge1xuICBpZiAoIWVuYWJsZV9naG9zdClcbiAgICByZXR1cm47XG4gIGlmIChyZXBsYXkgPT0gbnVsbClcbiAgICByZXR1cm47XG5cbiAgdmFyIGZyYW1lID0gZ2hvc3RfZ2V0X2ZyYW1lKGNhcik7XG4gIHJlcGxheS5mcmFtZXMucHVzaChmcmFtZSk7XG4gIHJlcGxheS5udW1fZnJhbWVzKys7XG59XG5cbmZ1bmN0aW9uIGdob3N0X2RyYXdfZnJhbWUoY3R4LCBnaG9zdCwgY2FtZXJhKSB7XG4gIHZhciB6b29tID0gY2FtZXJhLnpvb207XG4gIGlmICghZW5hYmxlX2dob3N0KVxuICAgIHJldHVybjtcbiAgaWYgKGdob3N0ID09IG51bGwpXG4gICAgcmV0dXJuO1xuICBpZiAoZ2hvc3QuZnJhbWUgPCAwKVxuICAgIHJldHVybjtcbiAgaWYgKGdob3N0LnJlcGxheSA9PSBudWxsKVxuICAgIHJldHVybjtcblxuICB2YXIgZnJhbWUgPSBnaG9zdC5yZXBsYXkuZnJhbWVzW2dob3N0LmZyYW1lXTtcblxuICAvLyB3aGVlbCBzdHlsZVxuICBjdHguZmlsbFN0eWxlID0gXCIjZWVlXCI7XG4gIGN0eC5zdHJva2VTdHlsZSA9IFwiI2FhYVwiO1xuICBjdHgubGluZVdpZHRoID0gMSAvIHpvb207XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBmcmFtZS53aGVlbHMubGVuZ3RoOyBpKyspIHtcbiAgICBmb3IgKHZhciB3IGluIGZyYW1lLndoZWVsc1tpXSkge1xuICAgICAgZ2hvc3RfZHJhd19jaXJjbGUoY3R4LCBmcmFtZS53aGVlbHNbaV1bd10ucG9zLCBmcmFtZS53aGVlbHNbaV1bd10ucmFkLCBmcmFtZS53aGVlbHNbaV1bd10uYW5nKTtcbiAgICB9XG4gIH1cblxuICAvLyBjaGFzc2lzIHN0eWxlXG4gIGN0eC5zdHJva2VTdHlsZSA9IFwiI2FhYVwiO1xuICBjdHguZmlsbFN0eWxlID0gXCIjZWVlXCI7XG4gIGN0eC5saW5lV2lkdGggPSAxIC8gem9vbTtcbiAgY3R4LmJlZ2luUGF0aCgpO1xuICBmb3IgKHZhciBjIGluIGZyYW1lLmNoYXNzaXMpXG4gICAgZ2hvc3RfZHJhd19wb2x5KGN0eCwgZnJhbWUuY2hhc3Npc1tjXS52dHgsIGZyYW1lLmNoYXNzaXNbY10ubnVtKTtcbiAgY3R4LmZpbGwoKTtcbiAgY3R4LnN0cm9rZSgpO1xufVxuXG5mdW5jdGlvbiBnaG9zdF9kcmF3X3BvbHkoY3R4LCB2dHgsIG5fdnR4KSB7XG4gIGN0eC5tb3ZlVG8odnR4WzBdLngsIHZ0eFswXS55KTtcbiAgZm9yICh2YXIgaSA9IDE7IGkgPCBuX3Z0eDsgaSsrKSB7XG4gICAgY3R4LmxpbmVUbyh2dHhbaV0ueCwgdnR4W2ldLnkpO1xuICB9XG4gIGN0eC5saW5lVG8odnR4WzBdLngsIHZ0eFswXS55KTtcbn1cblxuZnVuY3Rpb24gZ2hvc3RfZHJhd19jaXJjbGUoY3R4LCBjZW50ZXIsIHJhZGl1cywgYW5nbGUpIHtcbiAgY3R4LmJlZ2luUGF0aCgpO1xuICBjdHguYXJjKGNlbnRlci54LCBjZW50ZXIueSwgcmFkaXVzLCAwLCAyICogTWF0aC5QSSwgdHJ1ZSk7XG5cbiAgY3R4Lm1vdmVUbyhjZW50ZXIueCwgY2VudGVyLnkpO1xuICBjdHgubGluZVRvKGNlbnRlci54ICsgcmFkaXVzICogTWF0aC5jb3MoYW5nbGUpLCBjZW50ZXIueSArIHJhZGl1cyAqIE1hdGguc2luKGFuZ2xlKSk7XG5cbiAgY3R4LmZpbGwoKTtcbiAgY3R4LnN0cm9rZSgpO1xufVxuIiwiLyogZ2xvYmFscyBkb2N1bWVudCBwZXJmb3JtYW5jZSBsb2NhbFN0b3JhZ2UgYWxlcnQgY29uZmlybSBidG9hIEhUTUxEaXZFbGVtZW50ICovXG4vKiBnbG9iYWxzIGIyVmVjMiAqL1xuLy8gR2xvYmFsIFZhcnNcblxudmFyIHdvcmxkUnVuID0gcmVxdWlyZShcIi4vd29ybGQvcnVuLmpzXCIpO1xudmFyIGNhckNvbnN0cnVjdCA9IHJlcXVpcmUoXCIuL2Nhci1zY2hlbWEvY29uc3RydWN0LmpzXCIpO1xuXG52YXIgbWFuYWdlUm91bmQgPSByZXF1aXJlKFwiLi9tYWNoaW5lLWxlYXJuaW5nL2dlbmV0aWMtYWxnb3JpdGhtL21hbmFnZS1yb3VuZC5qc1wiKTtcblxudmFyIGdob3N0X2ZucyA9IHJlcXVpcmUoXCIuL2dob3N0L2luZGV4LmpzXCIpO1xuXG52YXIgZHJhd0NhciA9IHJlcXVpcmUoXCIuL2RyYXcvZHJhdy1jYXIuanNcIik7XG52YXIgZ3JhcGhfZm5zID0gcmVxdWlyZShcIi4vZHJhdy9wbG90LWdyYXBocy5qc1wiKTtcbnZhciBwbG90X2dyYXBocyA9IGdyYXBoX2Zucy5wbG90R3JhcGhzO1xudmFyIGN3X2NsZWFyR3JhcGhpY3MgPSBncmFwaF9mbnMuY2xlYXJHcmFwaGljcztcbnZhciBjd19kcmF3Rmxvb3IgPSByZXF1aXJlKFwiLi9kcmF3L2RyYXctZmxvb3IuanNcIik7XG5cbnZhciBnaG9zdF9kcmF3X2ZyYW1lID0gZ2hvc3RfZm5zLmdob3N0X2RyYXdfZnJhbWU7XG52YXIgZ2hvc3RfY3JlYXRlX2dob3N0ID0gZ2hvc3RfZm5zLmdob3N0X2NyZWF0ZV9naG9zdDtcbnZhciBnaG9zdF9hZGRfcmVwbGF5X2ZyYW1lID0gZ2hvc3RfZm5zLmdob3N0X2FkZF9yZXBsYXlfZnJhbWU7XG52YXIgZ2hvc3RfY29tcGFyZV90b19yZXBsYXkgPSBnaG9zdF9mbnMuZ2hvc3RfY29tcGFyZV90b19yZXBsYXk7XG52YXIgZ2hvc3RfZ2V0X3Bvc2l0aW9uID0gZ2hvc3RfZm5zLmdob3N0X2dldF9wb3NpdGlvbjtcbnZhciBnaG9zdF9tb3ZlX2ZyYW1lID0gZ2hvc3RfZm5zLmdob3N0X21vdmVfZnJhbWU7XG52YXIgZ2hvc3RfcmVzZXRfZ2hvc3QgPSBnaG9zdF9mbnMuZ2hvc3RfcmVzZXRfZ2hvc3RcbnZhciBnaG9zdF9wYXVzZSA9IGdob3N0X2Zucy5naG9zdF9wYXVzZTtcbnZhciBnaG9zdF9yZXN1bWUgPSBnaG9zdF9mbnMuZ2hvc3RfcmVzdW1lO1xudmFyIGdob3N0X2NyZWF0ZV9yZXBsYXkgPSBnaG9zdF9mbnMuZ2hvc3RfY3JlYXRlX3JlcGxheTtcblxudmFyIGN3X0NhciA9IHJlcXVpcmUoXCIuL2RyYXcvZHJhdy1jYXItc3RhdHMuanNcIik7XG52YXIgZ2hvc3Q7XG52YXIgY2FyTWFwID0gbmV3IE1hcCgpO1xuXG52YXIgZG9EcmF3ID0gdHJ1ZTtcbnZhciBjd19wYXVzZWQgPSBmYWxzZTtcblxudmFyIGJveDJkZnBzID0gNjA7XG52YXIgc2NyZWVuZnBzID0gNjA7XG52YXIgc2tpcFRpY2tzID0gTWF0aC5yb3VuZCgxMDAwIC8gYm94MmRmcHMpO1xudmFyIG1heEZyYW1lU2tpcCA9IHNraXBUaWNrcyAqIDI7XG5cbnZhciBjYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcIm1haW5ib3hcIik7XG52YXIgY3R4ID0gY2FudmFzLmdldENvbnRleHQoXCIyZFwiKTtcblxudmFyIGNhbWVyYSA9IHtcbiAgc3BlZWQ6IDAuMDUsXG4gIHBvczoge1xuICAgIHg6IDAsIHk6IDBcbiAgfSxcbiAgdGFyZ2V0OiAtMSxcbiAgem9vbTogNzBcbn1cblxudmFyIG1pbmltYXBjYW1lcmEgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcIm1pbmltYXBjYW1lcmFcIikuc3R5bGU7XG52YXIgbWluaW1hcGhvbGRlciA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIjbWluaW1hcGhvbGRlclwiKTtcblxudmFyIG1pbmltYXBjYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcIm1pbmltYXBcIik7XG52YXIgbWluaW1hcGN0eCA9IG1pbmltYXBjYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpO1xudmFyIG1pbmltYXBzY2FsZSA9IDM7XG52YXIgbWluaW1hcGZvZ2Rpc3RhbmNlID0gMDtcbnZhciBmb2dkaXN0YW5jZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwibWluaW1hcGZvZ1wiKS5zdHlsZTtcblxuXG52YXIgY2FyQ29uc3RhbnRzID0gY2FyQ29uc3RydWN0LmNhckNvbnN0YW50cygpO1xuXG5cbnZhciBtYXhfY2FyX2hlYWx0aCA9IGJveDJkZnBzICogMTA7XG5cbnZhciBjd19naG9zdFJlcGxheUludGVydmFsID0gbnVsbDtcblxudmFyIGRpc3RhbmNlTWV0ZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImRpc3RhbmNlbWV0ZXJcIik7XG52YXIgaGVpZ2h0TWV0ZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImhlaWdodG1ldGVyXCIpO1xuXG52YXIgbGVhZGVyUG9zaXRpb24gPSB7XG4gIHg6IDAsIHk6IDBcbn1cblxubWluaW1hcGNhbWVyYS53aWR0aCA9IDEyICogbWluaW1hcHNjYWxlICsgXCJweFwiO1xubWluaW1hcGNhbWVyYS5oZWlnaHQgPSA2ICogbWluaW1hcHNjYWxlICsgXCJweFwiO1xuXG5cbi8vID09PT09PT0gV09STEQgU1RBVEUgPT09PT09XG52YXIgZ2VuZXJhdGlvbkNvbmZpZyA9IHJlcXVpcmUoXCIuL2dlbmVyYXRpb24tY29uZmlnXCIpO1xuXG5cbnZhciB3b3JsZF9kZWYgPSB7XG4gIGdyYXZpdHk6IG5ldyBiMlZlYzIoMC4wLCAtOS44MSksXG4gIGRvU2xlZXA6IHRydWUsXG4gIGZsb29yc2VlZDogYnRvYShNYXRoLnNlZWRyYW5kb20oKSksXG4gIHRpbGVEaW1lbnNpb25zOiBuZXcgYjJWZWMyKDEuNSwgMC4wMyksXG4gIG1heEZsb29yVGlsZXM6IDIwMCxcbiAgbXV0YWJsZV9mbG9vcjogZmFsc2UsXG4gIGJveDJkZnBzOiBib3gyZGZwcyxcbiAgbW90b3JTcGVlZDogMjAsXG4gIG1heF9jYXJfaGVhbHRoOiBtYXhfY2FyX2hlYWx0aCxcbiAgc2NoZW1hOiBnZW5lcmF0aW9uQ29uZmlnLmNvbnN0YW50cy5zY2hlbWFcbn1cblxudmFyIGN3X2RlYWRDYXJzO1xudmFyIGdyYXBoU3RhdGUgPSB7XG4gIGN3X3RvcFNjb3JlczogW10sXG4gIGN3X2dyYXBoQXZlcmFnZTogW10sXG4gIGN3X2dyYXBoRWxpdGU6IFtdLFxuICBjd19ncmFwaFRvcDogW10sXG59O1xuXG5mdW5jdGlvbiByZXNldEdyYXBoU3RhdGUoKXtcbiAgZ3JhcGhTdGF0ZSA9IHtcbiAgICBjd190b3BTY29yZXM6IFtdLFxuICAgIGN3X2dyYXBoQXZlcmFnZTogW10sXG4gICAgY3dfZ3JhcGhFbGl0ZTogW10sXG4gICAgY3dfZ3JhcGhUb3A6IFtdLFxuICB9O1xufVxuXG5cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT1cblxudmFyIGdlbmVyYXRpb25TdGF0ZTtcblxuLy8gPT09PT09PT0gQWN0aXZpdHkgU3RhdGUgPT09PVxudmFyIGN1cnJlbnRSdW5uZXI7XG52YXIgbG9vcHMgPSAwO1xudmFyIG5leHRHYW1lVGljayA9IChuZXcgRGF0ZSkuZ2V0VGltZSgpO1xuXG5mdW5jdGlvbiBzaG93RGlzdGFuY2UoZGlzdGFuY2UsIGhlaWdodCkge1xuICBkaXN0YW5jZU1ldGVyLmlubmVySFRNTCA9IGRpc3RhbmNlICsgXCIgbWV0ZXJzPGJyIC8+XCI7XG4gIGhlaWdodE1ldGVyLmlubmVySFRNTCA9IGhlaWdodCArIFwiIG1ldGVyc1wiO1xuICBpZiAoZGlzdGFuY2UgPiBtaW5pbWFwZm9nZGlzdGFuY2UpIHtcbiAgICBmb2dkaXN0YW5jZS53aWR0aCA9IDgwMCAtIE1hdGgucm91bmQoZGlzdGFuY2UgKyAxNSkgKiBtaW5pbWFwc2NhbGUgKyBcInB4XCI7XG4gICAgbWluaW1hcGZvZ2Rpc3RhbmNlID0gZGlzdGFuY2U7XG4gIH1cbn1cblxuXG5cbi8qID09PSBFTkQgQ2FyID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG4vKiA9PT09IEdlbmVyYXRpb24gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG5cbmZ1bmN0aW9uIGN3X2dlbmVyYXRpb25aZXJvKCkge1xuXG4gIGdlbmVyYXRpb25TdGF0ZSA9IG1hbmFnZVJvdW5kLmdlbmVyYXRpb25aZXJvKGdlbmVyYXRpb25Db25maWcoKSk7XG59XG5cbmZ1bmN0aW9uIHJlc2V0Q2FyVUkoKXtcbiAgY3dfZGVhZENhcnMgPSAwO1xuICBsZWFkZXJQb3NpdGlvbiA9IHtcbiAgICB4OiAwLCB5OiAwXG4gIH07XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiZ2VuZXJhdGlvblwiKS5pbm5lckhUTUwgPSBnZW5lcmF0aW9uU3RhdGUuY291bnRlci50b1N0cmluZygpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImNhcnNcIikuaW5uZXJIVE1MID0gXCJcIjtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJwb3B1bGF0aW9uXCIpLmlubmVySFRNTCA9IGdlbmVyYXRpb25Db25maWcuY29uc3RhbnRzLmdlbmVyYXRpb25TaXplLnRvU3RyaW5nKCk7XG59XG5cbi8qID09PT0gRU5EIEdlbnJhdGlvbiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuLyogPT09PSBEcmF3aW5nID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuXG5mdW5jdGlvbiBjd19kcmF3U2NyZWVuKCkge1xuICB2YXIgZmxvb3JUaWxlcyA9IGN1cnJlbnRSdW5uZXIuc2NlbmUuZmxvb3JUaWxlcztcbiAgY3R4LmNsZWFyUmVjdCgwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQpO1xuICBjdHguc2F2ZSgpO1xuICBjd19zZXRDYW1lcmFQb3NpdGlvbigpO1xuICB2YXIgY2FtZXJhX3ggPSBjYW1lcmEucG9zLng7XG4gIHZhciBjYW1lcmFfeSA9IGNhbWVyYS5wb3MueTtcbiAgdmFyIHpvb20gPSBjYW1lcmEuem9vbTtcbiAgY3R4LnRyYW5zbGF0ZSgyMDAgLSAoY2FtZXJhX3ggKiB6b29tKSwgMjAwICsgKGNhbWVyYV95ICogem9vbSkpO1xuICBjdHguc2NhbGUoem9vbSwgLXpvb20pO1xuICBjd19kcmF3Rmxvb3IoY3R4LCBjYW1lcmEsIGZsb29yVGlsZXMpO1xuICBnaG9zdF9kcmF3X2ZyYW1lKGN0eCwgZ2hvc3QsIGNhbWVyYSk7XG4gIGN3X2RyYXdDYXJzKCk7XG4gIGN0eC5yZXN0b3JlKCk7XG59XG5cbmZ1bmN0aW9uIGN3X21pbmltYXBDYW1lcmEoLyogeCwgeSovKSB7XG4gIHZhciBjYW1lcmFfeCA9IGNhbWVyYS5wb3MueFxuICB2YXIgY2FtZXJhX3kgPSBjYW1lcmEucG9zLnlcbiAgbWluaW1hcGNhbWVyYS5sZWZ0ID0gTWF0aC5yb3VuZCgoMiArIGNhbWVyYV94KSAqIG1pbmltYXBzY2FsZSkgKyBcInB4XCI7XG4gIG1pbmltYXBjYW1lcmEudG9wID0gTWF0aC5yb3VuZCgoMzEgLSBjYW1lcmFfeSkgKiBtaW5pbWFwc2NhbGUpICsgXCJweFwiO1xufVxuXG5mdW5jdGlvbiBjd19zZXRDYW1lcmFUYXJnZXQoaykge1xuICBjYW1lcmEudGFyZ2V0ID0gaztcbn1cblxuZnVuY3Rpb24gY3dfc2V0Q2FtZXJhUG9zaXRpb24oKSB7XG4gIHZhciBjYW1lcmFUYXJnZXRQb3NpdGlvblxuICBpZiAoY2FtZXJhLnRhcmdldCAhPT0gLTEpIHtcbiAgICBjYW1lcmFUYXJnZXRQb3NpdGlvbiA9IGNhck1hcC5nZXQoY2FtZXJhLnRhcmdldCkuZ2V0UG9zaXRpb24oKTtcbiAgfSBlbHNlIHtcbiAgICBjYW1lcmFUYXJnZXRQb3NpdGlvbiA9IGxlYWRlclBvc2l0aW9uO1xuICB9XG4gIHZhciBkaWZmX3kgPSBjYW1lcmEucG9zLnkgLSBjYW1lcmFUYXJnZXRQb3NpdGlvbi55O1xuICB2YXIgZGlmZl94ID0gY2FtZXJhLnBvcy54IC0gY2FtZXJhVGFyZ2V0UG9zaXRpb24ueDtcbiAgY2FtZXJhLnBvcy55IC09IGNhbWVyYS5zcGVlZCAqIGRpZmZfeTtcbiAgY2FtZXJhLnBvcy54IC09IGNhbWVyYS5zcGVlZCAqIGRpZmZfeDtcbiAgY3dfbWluaW1hcENhbWVyYShjYW1lcmEucG9zLngsIGNhbWVyYS5wb3MueSk7XG59XG5cbmZ1bmN0aW9uIGN3X2RyYXdHaG9zdFJlcGxheSgpIHtcbiAgdmFyIGZsb29yVGlsZXMgPSBjdXJyZW50UnVubmVyLnNjZW5lLmZsb29yVGlsZXM7XG4gIHZhciBjYXJQb3NpdGlvbiA9IGdob3N0X2dldF9wb3NpdGlvbihnaG9zdCk7XG4gIGNhbWVyYS5wb3MueCA9IGNhclBvc2l0aW9uLng7XG4gIGNhbWVyYS5wb3MueSA9IGNhclBvc2l0aW9uLnk7XG4gIGN3X21pbmltYXBDYW1lcmEoY2FtZXJhLnBvcy54LCBjYW1lcmEucG9zLnkpO1xuICBzaG93RGlzdGFuY2UoXG4gICAgTWF0aC5yb3VuZChjYXJQb3NpdGlvbi54ICogMTAwKSAvIDEwMCxcbiAgICBNYXRoLnJvdW5kKGNhclBvc2l0aW9uLnkgKiAxMDApIC8gMTAwXG4gICk7XG4gIGN0eC5jbGVhclJlY3QoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTtcbiAgY3R4LnNhdmUoKTtcbiAgY3R4LnRyYW5zbGF0ZShcbiAgICAyMDAgLSAoY2FyUG9zaXRpb24ueCAqIGNhbWVyYS56b29tKSxcbiAgICAyMDAgKyAoY2FyUG9zaXRpb24ueSAqIGNhbWVyYS56b29tKVxuICApO1xuICBjdHguc2NhbGUoY2FtZXJhLnpvb20sIC1jYW1lcmEuem9vbSk7XG4gIGdob3N0X2RyYXdfZnJhbWUoY3R4LCBnaG9zdCk7XG4gIGdob3N0X21vdmVfZnJhbWUoZ2hvc3QpO1xuICBjd19kcmF3Rmxvb3IoY3R4LCBjYW1lcmEsIGZsb29yVGlsZXMpO1xuICBjdHgucmVzdG9yZSgpO1xufVxuXG5cbmZ1bmN0aW9uIGN3X2RyYXdDYXJzKCkge1xuICB2YXIgY3dfY2FyQXJyYXkgPSBBcnJheS5mcm9tKGNhck1hcC52YWx1ZXMoKSk7XG4gIGZvciAodmFyIGsgPSAoY3dfY2FyQXJyYXkubGVuZ3RoIC0gMSk7IGsgPj0gMDsgay0tKSB7XG4gICAgdmFyIG15Q2FyID0gY3dfY2FyQXJyYXlba107XG4gICAgZHJhd0NhcihjYXJDb25zdGFudHMsIG15Q2FyLCBjYW1lcmEsIGN0eClcbiAgfVxufVxuXG5mdW5jdGlvbiB0b2dnbGVEaXNwbGF5KCkge1xuICBjYW52YXMud2lkdGggPSBjYW52YXMud2lkdGg7XG4gIGlmIChkb0RyYXcpIHtcbiAgICBkb0RyYXcgPSBmYWxzZTtcbiAgICBjd19zdG9wU2ltdWxhdGlvbigpO1xuICAgIGN3X3J1bm5pbmdJbnRlcnZhbCA9IHNldEludGVydmFsKGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciB0aW1lID0gcGVyZm9ybWFuY2Uubm93KCkgKyAoMTAwMCAvIHNjcmVlbmZwcyk7XG4gICAgICB3aGlsZSAodGltZSA+IHBlcmZvcm1hbmNlLm5vdygpKSB7XG4gICAgICAgIHNpbXVsYXRpb25TdGVwKCk7XG4gICAgICB9XG4gICAgfSwgMSk7XG4gIH0gZWxzZSB7XG4gICAgZG9EcmF3ID0gdHJ1ZTtcbiAgICBjbGVhckludGVydmFsKGN3X3J1bm5pbmdJbnRlcnZhbCk7XG4gICAgY3dfc3RhcnRTaW11bGF0aW9uKCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gY3dfZHJhd01pbmlNYXAoKSB7XG4gIHZhciBmbG9vclRpbGVzID0gY3VycmVudFJ1bm5lci5zY2VuZS5mbG9vclRpbGVzO1xuICB2YXIgbGFzdF90aWxlID0gbnVsbDtcbiAgdmFyIHRpbGVfcG9zaXRpb24gPSBuZXcgYjJWZWMyKC01LCAwKTtcbiAgbWluaW1hcGZvZ2Rpc3RhbmNlID0gMDtcbiAgZm9nZGlzdGFuY2Uud2lkdGggPSBcIjgwMHB4XCI7XG4gIG1pbmltYXBjYW52YXMud2lkdGggPSBtaW5pbWFwY2FudmFzLndpZHRoO1xuICBtaW5pbWFwY3R4LnN0cm9rZVN0eWxlID0gXCIjM0Y3MkFGXCI7XG4gIG1pbmltYXBjdHguYmVnaW5QYXRoKCk7XG4gIG1pbmltYXBjdHgubW92ZVRvKDAsIDM1ICogbWluaW1hcHNjYWxlKTtcbiAgZm9yICh2YXIgayA9IDA7IGsgPCBmbG9vclRpbGVzLmxlbmd0aDsgaysrKSB7XG4gICAgbGFzdF90aWxlID0gZmxvb3JUaWxlc1trXTtcbiAgICB2YXIgbGFzdF9maXh0dXJlID0gbGFzdF90aWxlLkdldEZpeHR1cmVMaXN0KCk7XG4gICAgdmFyIGxhc3Rfd29ybGRfY29vcmRzID0gbGFzdF90aWxlLkdldFdvcmxkUG9pbnQobGFzdF9maXh0dXJlLkdldFNoYXBlKCkubV92ZXJ0aWNlc1szXSk7XG4gICAgdGlsZV9wb3NpdGlvbiA9IGxhc3Rfd29ybGRfY29vcmRzO1xuICAgIG1pbmltYXBjdHgubGluZVRvKCh0aWxlX3Bvc2l0aW9uLnggKyA1KSAqIG1pbmltYXBzY2FsZSwgKC10aWxlX3Bvc2l0aW9uLnkgKyAzNSkgKiBtaW5pbWFwc2NhbGUpO1xuICB9XG4gIG1pbmltYXBjdHguc3Ryb2tlKCk7XG59XG5cbi8qID09PT0gRU5EIERyYXdpbmcgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cbnZhciB1aUxpc3RlbmVycyA9IHtcbiAgcHJlQ2FyU3RlcDogZnVuY3Rpb24oKXtcbiAgICBnaG9zdF9tb3ZlX2ZyYW1lKGdob3N0KTtcbiAgfSxcbiAgY2FyU3RlcChjYXIpe1xuICAgIHVwZGF0ZUNhclVJKGNhcik7XG4gIH0sXG4gIGNhckRlYXRoKGNhckluZm8pe1xuXG4gICAgdmFyIGsgPSBjYXJJbmZvLmluZGV4O1xuXG4gICAgdmFyIGNhciA9IGNhckluZm8uY2FyLCBzY29yZSA9IGNhckluZm8uc2NvcmU7XG4gICAgY2FyTWFwLmdldChjYXJJbmZvKS5raWxsKGN1cnJlbnRSdW5uZXIsIHdvcmxkX2RlZik7XG5cbiAgICAvLyByZWZvY3VzIGNhbWVyYSB0byBsZWFkZXIgb24gZGVhdGhcbiAgICBpZiAoY2FtZXJhLnRhcmdldCA9PSBjYXJJbmZvKSB7XG4gICAgICBjd19zZXRDYW1lcmFUYXJnZXQoLTEpO1xuICAgIH1cbiAgICAvLyBjb25zb2xlLmxvZyhzY29yZSk7XG4gICAgY2FyTWFwLmRlbGV0ZShjYXJJbmZvKTtcbiAgICBnaG9zdF9jb21wYXJlX3RvX3JlcGxheShjYXIucmVwbGF5LCBnaG9zdCwgc2NvcmUudik7XG4gICAgc2NvcmUuaSA9IGdlbmVyYXRpb25TdGF0ZS5jb3VudGVyO1xuXG4gICAgY3dfZGVhZENhcnMrKztcbiAgICB2YXIgZ2VuZXJhdGlvblNpemUgPSBnZW5lcmF0aW9uQ29uZmlnLmNvbnN0YW50cy5nZW5lcmF0aW9uU2l6ZTtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInBvcHVsYXRpb25cIikuaW5uZXJIVE1MID0gKGdlbmVyYXRpb25TaXplIC0gY3dfZGVhZENhcnMpLnRvU3RyaW5nKCk7XG5cbiAgICAvLyBjb25zb2xlLmxvZyhsZWFkZXJQb3NpdGlvbi5sZWFkZXIsIGspXG4gICAgaWYgKGxlYWRlclBvc2l0aW9uLmxlYWRlciA9PSBrKSB7XG4gICAgICAvLyBsZWFkZXIgaXMgZGVhZCwgZmluZCBuZXcgbGVhZGVyXG4gICAgICBjd19maW5kTGVhZGVyKCk7XG4gICAgfVxuICB9LFxuICBnZW5lcmF0aW9uRW5kKHJlc3VsdHMpe1xuICAgIGNsZWFudXBSb3VuZChyZXN1bHRzKTtcbiAgICByZXR1cm4gY3dfbmV3Um91bmQocmVzdWx0cyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gc2ltdWxhdGlvblN0ZXAoKSB7ICBcbiAgY3VycmVudFJ1bm5lci5zdGVwKCk7XG4gIHNob3dEaXN0YW5jZShcbiAgICBNYXRoLnJvdW5kKGxlYWRlclBvc2l0aW9uLnggKiAxMDApIC8gMTAwLFxuICAgIE1hdGgucm91bmQobGVhZGVyUG9zaXRpb24ueSAqIDEwMCkgLyAxMDBcbiAgKTtcbn1cblxuZnVuY3Rpb24gZ2FtZUxvb3AoKSB7XG4gIGxvb3BzID0gMDtcbiAgd2hpbGUgKCFjd19wYXVzZWQgJiYgKG5ldyBEYXRlKS5nZXRUaW1lKCkgPiBuZXh0R2FtZVRpY2sgJiYgbG9vcHMgPCBtYXhGcmFtZVNraXApIHsgICBcbiAgICBuZXh0R2FtZVRpY2sgKz0gc2tpcFRpY2tzO1xuICAgIGxvb3BzKys7XG4gIH1cbiAgc2ltdWxhdGlvblN0ZXAoKTtcbiAgY3dfZHJhd1NjcmVlbigpO1xuXG4gIGlmKCFjd19wYXVzZWQpIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoZ2FtZUxvb3ApO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVDYXJVSShjYXJJbmZvKXtcbiAgdmFyIGsgPSBjYXJJbmZvLmluZGV4O1xuICB2YXIgY2FyID0gY2FyTWFwLmdldChjYXJJbmZvKTtcbiAgdmFyIHBvc2l0aW9uID0gY2FyLmdldFBvc2l0aW9uKCk7XG5cbiAgZ2hvc3RfYWRkX3JlcGxheV9mcmFtZShjYXIucmVwbGF5LCBjYXIuY2FyLmNhcik7XG4gIGNhci5taW5pbWFwbWFya2VyLnN0eWxlLmxlZnQgPSBNYXRoLnJvdW5kKChwb3NpdGlvbi54ICsgNSkgKiBtaW5pbWFwc2NhbGUpICsgXCJweFwiO1xuICBjYXIuaGVhbHRoQmFyLndpZHRoID0gTWF0aC5yb3VuZCgoY2FyLmNhci5zdGF0ZS5oZWFsdGggLyBtYXhfY2FyX2hlYWx0aCkgKiAxMDApICsgXCIlXCI7XG4gIGlmIChwb3NpdGlvbi54ID4gbGVhZGVyUG9zaXRpb24ueCkge1xuICAgIGxlYWRlclBvc2l0aW9uID0gcG9zaXRpb247XG4gICAgbGVhZGVyUG9zaXRpb24ubGVhZGVyID0gaztcbiAgICAvLyBjb25zb2xlLmxvZyhcIm5ldyBsZWFkZXI6IFwiLCBrKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjd19maW5kTGVhZGVyKCkge1xuICB2YXIgbGVhZCA9IDA7XG4gIHZhciBjd19jYXJBcnJheSA9IEFycmF5LmZyb20oY2FyTWFwLnZhbHVlcygpKTtcbiAgZm9yICh2YXIgayA9IDA7IGsgPCBjd19jYXJBcnJheS5sZW5ndGg7IGsrKykge1xuICAgIGlmICghY3dfY2FyQXJyYXlba10uYWxpdmUpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICB2YXIgcG9zaXRpb24gPSBjd19jYXJBcnJheVtrXS5nZXRQb3NpdGlvbigpO1xuICAgIGlmIChwb3NpdGlvbi54ID4gbGVhZCkge1xuICAgICAgbGVhZGVyUG9zaXRpb24gPSBwb3NpdGlvbjtcbiAgICAgIGxlYWRlclBvc2l0aW9uLmxlYWRlciA9IGs7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGZhc3RGb3J3YXJkKCl7XG4gIHZhciBnZW4gPSBnZW5lcmF0aW9uU3RhdGUuY291bnRlcjtcbiAgd2hpbGUoZ2VuID09PSBnZW5lcmF0aW9uU3RhdGUuY291bnRlcil7XG4gICAgY3VycmVudFJ1bm5lci5zdGVwKCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gY2xlYW51cFJvdW5kKHJlc3VsdHMpe1xuXG4gIHJlc3VsdHMuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgIGlmIChhLnNjb3JlLnYgPiBiLnNjb3JlLnYpIHtcbiAgICAgIHJldHVybiAtMVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gMVxuICAgIH1cbiAgfSlcbiAgZ3JhcGhTdGF0ZSA9IHBsb3RfZ3JhcGhzKFxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiZ3JhcGhjYW52YXNcIiksXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJ0b3BzY29yZXNcIiksXG4gICAgbnVsbCxcbiAgICBncmFwaFN0YXRlLFxuICAgIHJlc3VsdHNcbiAgKTtcbn1cblxuZnVuY3Rpb24gY3dfbmV3Um91bmQocmVzdWx0cykge1xuICBjYW1lcmEucG9zLnggPSBjYW1lcmEucG9zLnkgPSAwO1xuICBjd19zZXRDYW1lcmFUYXJnZXQoLTEpO1xuXG4gIGdlbmVyYXRpb25TdGF0ZSA9IG1hbmFnZVJvdW5kLm5leHRHZW5lcmF0aW9uKFxuICAgIGdlbmVyYXRpb25TdGF0ZSwgcmVzdWx0cywgZ2VuZXJhdGlvbkNvbmZpZygpXG4gICk7XG4gIGlmICh3b3JsZF9kZWYubXV0YWJsZV9mbG9vcikge1xuICAgIC8vIEdIT1NUIERJU0FCTEVEXG4gICAgZ2hvc3QgPSBudWxsO1xuICAgIHdvcmxkX2RlZi5mbG9vcnNlZWQgPSBidG9hKE1hdGguc2VlZHJhbmRvbSgpKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBSRS1FTkFCTEUgR0hPU1RcbiAgICBnaG9zdF9yZXNldF9naG9zdChnaG9zdCk7XG4gIH1cbiAgY3VycmVudFJ1bm5lciA9IHdvcmxkUnVuKHdvcmxkX2RlZiwgZ2VuZXJhdGlvblN0YXRlLmdlbmVyYXRpb24sIHVpTGlzdGVuZXJzKTtcbiAgc2V0dXBDYXJVSSgpO1xuICBjd19kcmF3TWluaU1hcCgpO1xuICByZXNldENhclVJKCk7XG59XG5cbmZ1bmN0aW9uIGN3X3N0YXJ0U2ltdWxhdGlvbigpIHtcbiAgY3dfcGF1c2VkID0gZmFsc2U7XG4gIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoZ2FtZUxvb3ApO1xufVxuXG5mdW5jdGlvbiBjd19zdG9wU2ltdWxhdGlvbigpIHtcbiAgY3dfcGF1c2VkID0gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gY3dfY2xlYXJQb3B1bGF0aW9uV29ybGQoKSB7XG4gIGNhck1hcC5mb3JFYWNoKGZ1bmN0aW9uKGNhcil7XG4gICAgY2FyLmtpbGwoY3VycmVudFJ1bm5lciwgd29ybGRfZGVmKTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGN3X3Jlc2V0UG9wdWxhdGlvblVJKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImdlbmVyYXRpb25cIikuaW5uZXJIVE1MID0gXCJcIjtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJjYXJzXCIpLmlubmVySFRNTCA9IFwiXCI7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwidG9wc2NvcmVzXCIpLmlubmVySFRNTCA9IFwiXCI7XG4gIGN3X2NsZWFyR3JhcGhpY3MoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJncmFwaGNhbnZhc1wiKSk7XG4gIHJlc2V0R3JhcGhTdGF0ZSgpO1xufVxuXG5mdW5jdGlvbiBjd19yZXNldFdvcmxkKCkge1xuICBkb0RyYXcgPSB0cnVlO1xuICBjd19zdG9wU2ltdWxhdGlvbigpO1xuICB3b3JsZF9kZWYuZmxvb3JzZWVkID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJuZXdzZWVkXCIpLnZhbHVlO1xuICBjd19jbGVhclBvcHVsYXRpb25Xb3JsZCgpO1xuICBjd19yZXNldFBvcHVsYXRpb25VSSgpO1xuXG4gIE1hdGguc2VlZHJhbmRvbSgpO1xuICBjd19nZW5lcmF0aW9uWmVybygpO1xuICBjdXJyZW50UnVubmVyID0gd29ybGRSdW4oXG4gICAgd29ybGRfZGVmLCBnZW5lcmF0aW9uU3RhdGUuZ2VuZXJhdGlvbiwgdWlMaXN0ZW5lcnNcbiAgKTtcblxuICBnaG9zdCA9IGdob3N0X2NyZWF0ZV9naG9zdCgpO1xuICByZXNldENhclVJKCk7XG4gIHNldHVwQ2FyVUkoKVxuICBjd19kcmF3TWluaU1hcCgpO1xuXG4gIGN3X3N0YXJ0U2ltdWxhdGlvbigpO1xufVxuXG5mdW5jdGlvbiBzZXR1cENhclVJKCl7XG4gIGN1cnJlbnRSdW5uZXIuY2Fycy5tYXAoZnVuY3Rpb24oY2FySW5mbyl7XG4gICAgdmFyIGNhciA9IG5ldyBjd19DYXIoY2FySW5mbywgY2FyTWFwKTtcbiAgICBjYXJNYXAuc2V0KGNhckluZm8sIGNhcik7XG4gICAgY2FyLnJlcGxheSA9IGdob3N0X2NyZWF0ZV9yZXBsYXkoKTtcbiAgICBnaG9zdF9hZGRfcmVwbGF5X2ZyYW1lKGNhci5yZXBsYXksIGNhci5jYXIuY2FyKTtcbiAgfSlcbn1cblxuXG5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiI2Zhc3QtZm9yd2FyZFwiKS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgZnVuY3Rpb24oKXtcbiAgZmFzdEZvcndhcmQoKVxufSk7XG5cbmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIjc2F2ZS1wcm9ncmVzc1wiKS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgZnVuY3Rpb24oKXtcbiAgc2F2ZVByb2dyZXNzKClcbn0pO1xuXG5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiI3Jlc3RvcmUtcHJvZ3Jlc3NcIikuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGZ1bmN0aW9uKCl7XG4gIHJlc3RvcmVQcm9ncmVzcygpXG59KTtcblxuZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIiN0b2dnbGUtZGlzcGxheVwiKS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgZnVuY3Rpb24oKXtcbiAgdG9nZ2xlRGlzcGxheSgpXG59KVxuXG5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiI25ldy1wb3B1bGF0aW9uXCIpLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBmdW5jdGlvbigpe1xuICBjd19yZXNldFBvcHVsYXRpb25VSSgpXG4gIGN3X2dlbmVyYXRpb25aZXJvKCk7XG4gIGdob3N0ID0gZ2hvc3RfY3JlYXRlX2dob3N0KCk7XG4gIHJlc2V0Q2FyVUkoKTtcbn0pXG5cbmZ1bmN0aW9uIHNhdmVQcm9ncmVzcygpIHtcbiAgbG9jYWxTdG9yYWdlLmN3X3NhdmVkR2VuZXJhdGlvbiA9IEpTT04uc3RyaW5naWZ5KGdlbmVyYXRpb25TdGF0ZS5nZW5lcmF0aW9uKTtcbiAgbG9jYWxTdG9yYWdlLmN3X2dlbkNvdW50ZXIgPSBnZW5lcmF0aW9uU3RhdGUuY291bnRlcjtcbiAgbG9jYWxTdG9yYWdlLmN3X2dob3N0ID0gSlNPTi5zdHJpbmdpZnkoZ2hvc3QpO1xuICBsb2NhbFN0b3JhZ2UuY3dfdG9wU2NvcmVzID0gSlNPTi5zdHJpbmdpZnkoZ3JhcGhTdGF0ZS5jd190b3BTY29yZXMpO1xuICBsb2NhbFN0b3JhZ2UuY3dfZmxvb3JTZWVkID0gd29ybGRfZGVmLmZsb29yc2VlZDtcbn1cblxuZnVuY3Rpb24gcmVzdG9yZVByb2dyZXNzKCkge1xuICBpZiAodHlwZW9mIGxvY2FsU3RvcmFnZS5jd19zYXZlZEdlbmVyYXRpb24gPT0gJ3VuZGVmaW5lZCcgfHwgbG9jYWxTdG9yYWdlLmN3X3NhdmVkR2VuZXJhdGlvbiA9PSBudWxsKSB7XG4gICAgYWxlcnQoXCJObyBzYXZlZCBwcm9ncmVzcyBmb3VuZFwiKTtcbiAgICByZXR1cm47XG4gIH1cbiAgY3dfc3RvcFNpbXVsYXRpb24oKTtcbiAgZ2VuZXJhdGlvblN0YXRlLmdlbmVyYXRpb24gPSBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5jd19zYXZlZEdlbmVyYXRpb24pO1xuICBnZW5lcmF0aW9uU3RhdGUuY291bnRlciA9IGxvY2FsU3RvcmFnZS5jd19nZW5Db3VudGVyO1xuICBnaG9zdCA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmN3X2dob3N0KTtcbiAgZ3JhcGhTdGF0ZS5jd190b3BTY29yZXMgPSBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5jd190b3BTY29yZXMpO1xuICB3b3JsZF9kZWYuZmxvb3JzZWVkID0gbG9jYWxTdG9yYWdlLmN3X2Zsb29yU2VlZDtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJuZXdzZWVkXCIpLnZhbHVlID0gd29ybGRfZGVmLmZsb29yc2VlZDtcblxuICBjdXJyZW50UnVubmVyID0gd29ybGRSdW4od29ybGRfZGVmLCBnZW5lcmF0aW9uU3RhdGUuZ2VuZXJhdGlvbiwgdWlMaXN0ZW5lcnMpO1xuICBjd19kcmF3TWluaU1hcCgpO1xuICBNYXRoLnNlZWRyYW5kb20oKTtcblxuICByZXNldENhclVJKCk7XG4gIGN3X3N0YXJ0U2ltdWxhdGlvbigpO1xufVxuXG5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiI2NvbmZpcm0tcmVzZXRcIikuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGZ1bmN0aW9uKCl7XG4gIGN3X2NvbmZpcm1SZXNldFdvcmxkKClcbn0pXG5cbmZ1bmN0aW9uIGN3X2NvbmZpcm1SZXNldFdvcmxkKCkge1xuICBpZiAoY29uZmlybSgnUmVhbGx5IHJlc2V0IHdvcmxkPycpKSB7XG4gICAgY3dfcmVzZXRXb3JsZCgpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG4vLyBnaG9zdCByZXBsYXkgc3R1ZmZcblxuXG5mdW5jdGlvbiBjd19wYXVzZVNpbXVsYXRpb24oKSB7XG4gIGN3X3BhdXNlZCA9IHRydWU7XG4gIGdob3N0X3BhdXNlKGdob3N0KTtcbn1cblxuZnVuY3Rpb24gY3dfcmVzdW1lU2ltdWxhdGlvbigpIHtcbiAgY3dfcGF1c2VkID0gZmFsc2U7XG4gIGdob3N0X3Jlc3VtZShnaG9zdCk7XG4gIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoZ2FtZUxvb3ApO1xufVxuXG5mdW5jdGlvbiBjd19zdGFydEdob3N0UmVwbGF5KCkge1xuICBpZiAoIWRvRHJhdykge1xuICAgIHRvZ2dsZURpc3BsYXkoKTtcbiAgfVxuICBjd19wYXVzZVNpbXVsYXRpb24oKTtcbiAgY3dfZ2hvc3RSZXBsYXlJbnRlcnZhbCA9IHNldEludGVydmFsKGN3X2RyYXdHaG9zdFJlcGxheSwgTWF0aC5yb3VuZCgxMDAwIC8gc2NyZWVuZnBzKSk7XG59XG5cbmZ1bmN0aW9uIGN3X3N0b3BHaG9zdFJlcGxheSgpIHtcbiAgY2xlYXJJbnRlcnZhbChjd19naG9zdFJlcGxheUludGVydmFsKTtcbiAgY3dfZ2hvc3RSZXBsYXlJbnRlcnZhbCA9IG51bGw7XG4gIGN3X2ZpbmRMZWFkZXIoKTtcbiAgY2FtZXJhLnBvcy54ID0gbGVhZGVyUG9zaXRpb24ueDtcbiAgY2FtZXJhLnBvcy55ID0gbGVhZGVyUG9zaXRpb24ueTtcbiAgY3dfcmVzdW1lU2ltdWxhdGlvbigpO1xufVxuXG5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiI3RvZ2dsZS1naG9zdFwiKS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgZnVuY3Rpb24oZSl7XG4gIGN3X3RvZ2dsZUdob3N0UmVwbGF5KGUudGFyZ2V0KVxufSlcblxuZnVuY3Rpb24gY3dfdG9nZ2xlR2hvc3RSZXBsYXkoYnV0dG9uKSB7XG4gIGlmIChjd19naG9zdFJlcGxheUludGVydmFsID09IG51bGwpIHtcbiAgICBjd19zdGFydEdob3N0UmVwbGF5KCk7XG4gICAgYnV0dG9uLnZhbHVlID0gXCJSZXN1bWUgc2ltdWxhdGlvblwiO1xuICB9IGVsc2Uge1xuICAgIGN3X3N0b3BHaG9zdFJlcGxheSgpO1xuICAgIGJ1dHRvbi52YWx1ZSA9IFwiVmlldyB0b3AgcmVwbGF5XCI7XG4gIH1cbn1cbi8vIGdob3N0IHJlcGxheSBzdHVmZiBFTkRcblxuLy8gaW5pdGlhbCBzdHVmZiwgb25seSBjYWxsZWQgb25jZSAoaG9wZWZ1bGx5KVxuZnVuY3Rpb24gY3dfaW5pdCgpIHtcbiAgLy8gY2xvbmUgc2lsdmVyIGRvdCBhbmQgaGVhbHRoIGJhclxuICB2YXIgbW1tID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeU5hbWUoJ21pbmltYXBtYXJrZXInKVswXTtcbiAgdmFyIGhiYXIgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5TmFtZSgnaGVhbHRoYmFyJylbMF07XG4gIHZhciBnZW5lcmF0aW9uU2l6ZSA9IGdlbmVyYXRpb25Db25maWcuY29uc3RhbnRzLmdlbmVyYXRpb25TaXplO1xuXG4gIGZvciAodmFyIGsgPSAwOyBrIDwgZ2VuZXJhdGlvblNpemU7IGsrKykge1xuXG4gICAgLy8gbWluaW1hcCBtYXJrZXJzXG4gICAgdmFyIG5ld2JhciA9IG1tbS5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgbmV3YmFyLmlkID0gXCJiYXJcIiArIGs7XG4gICAgbmV3YmFyLnN0eWxlLnBhZGRpbmdUb3AgPSBrICogOSArIFwicHhcIjtcbiAgICBtaW5pbWFwaG9sZGVyLmFwcGVuZENoaWxkKG5ld2Jhcik7XG5cbiAgICAvLyBoZWFsdGggYmFyc1xuICAgIHZhciBuZXdoZWFsdGggPSBoYmFyLmNsb25lTm9kZSh0cnVlKTtcbiAgICBuZXdoZWFsdGguZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJESVZcIilbMF0uaWQgPSBcImhlYWx0aFwiICsgaztcbiAgICBuZXdoZWFsdGguY2FyX2luZGV4ID0gaztcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImhlYWx0aFwiKS5hcHBlbmRDaGlsZChuZXdoZWFsdGgpO1xuICB9XG4gIG1tbS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG1tbSk7XG4gIGhiYXIucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChoYmFyKTtcbiAgd29ybGRfZGVmLmZsb29yc2VlZCA9IGJ0b2EoTWF0aC5zZWVkcmFuZG9tKCkpO1xuICBjd19nZW5lcmF0aW9uWmVybygpO1xuICBnaG9zdCA9IGdob3N0X2NyZWF0ZV9naG9zdCgpO1xuICByZXNldENhclVJKCk7XG4gIGN1cnJlbnRSdW5uZXIgPSB3b3JsZFJ1bih3b3JsZF9kZWYsIGdlbmVyYXRpb25TdGF0ZS5nZW5lcmF0aW9uLCB1aUxpc3RlbmVycyk7XG4gIHNldHVwQ2FyVUkoKTtcbiAgY3dfZHJhd01pbmlNYXAoKTtcbiAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZShnYW1lTG9vcCk7XG4gIFxufVxuXG5mdW5jdGlvbiByZWxNb3VzZUNvb3JkcyhldmVudCkge1xuICB2YXIgdG90YWxPZmZzZXRYID0gMDtcbiAgdmFyIHRvdGFsT2Zmc2V0WSA9IDA7XG4gIHZhciBjYW52YXNYID0gMDtcbiAgdmFyIGNhbnZhc1kgPSAwO1xuICB2YXIgY3VycmVudEVsZW1lbnQgPSB0aGlzO1xuXG4gIGRvIHtcbiAgICB0b3RhbE9mZnNldFggKz0gY3VycmVudEVsZW1lbnQub2Zmc2V0TGVmdCAtIGN1cnJlbnRFbGVtZW50LnNjcm9sbExlZnQ7XG4gICAgdG90YWxPZmZzZXRZICs9IGN1cnJlbnRFbGVtZW50Lm9mZnNldFRvcCAtIGN1cnJlbnRFbGVtZW50LnNjcm9sbFRvcDtcbiAgICBjdXJyZW50RWxlbWVudCA9IGN1cnJlbnRFbGVtZW50Lm9mZnNldFBhcmVudFxuICB9XG4gIHdoaWxlIChjdXJyZW50RWxlbWVudCk7XG5cbiAgY2FudmFzWCA9IGV2ZW50LnBhZ2VYIC0gdG90YWxPZmZzZXRYO1xuICBjYW52YXNZID0gZXZlbnQucGFnZVkgLSB0b3RhbE9mZnNldFk7XG5cbiAgcmV0dXJuIHt4OiBjYW52YXNYLCB5OiBjYW52YXNZfVxufVxuSFRNTERpdkVsZW1lbnQucHJvdG90eXBlLnJlbE1vdXNlQ29vcmRzID0gcmVsTW91c2VDb29yZHM7XG5taW5pbWFwaG9sZGVyLm9uY2xpY2sgPSBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgdmFyIGNvb3JkcyA9IG1pbmltYXBob2xkZXIucmVsTW91c2VDb29yZHMoZXZlbnQpO1xuICB2YXIgY3dfY2FyQXJyYXkgPSBBcnJheS5mcm9tKGNhck1hcC52YWx1ZXMoKSk7XG4gIHZhciBjbG9zZXN0ID0ge1xuICAgIHZhbHVlOiBjd19jYXJBcnJheVswXS5jYXIsXG4gICAgZGlzdDogTWF0aC5hYnMoKChjd19jYXJBcnJheVswXS5nZXRQb3NpdGlvbigpLnggKyA2KSAqIG1pbmltYXBzY2FsZSkgLSBjb29yZHMueCksXG4gICAgeDogY3dfY2FyQXJyYXlbMF0uZ2V0UG9zaXRpb24oKS54XG4gIH1cblxuICB2YXIgbWF4WCA9IDA7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgY3dfY2FyQXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgcG9zID0gY3dfY2FyQXJyYXlbaV0uZ2V0UG9zaXRpb24oKTtcbiAgICB2YXIgZGlzdCA9IE1hdGguYWJzKCgocG9zLnggKyA2KSAqIG1pbmltYXBzY2FsZSkgLSBjb29yZHMueCk7XG4gICAgaWYgKGRpc3QgPCBjbG9zZXN0LmRpc3QpIHtcbiAgICAgIGNsb3Nlc3QudmFsdWUgPSBjd19jYXJBcnJheS5jYXI7XG4gICAgICBjbG9zZXN0LmRpc3QgPSBkaXN0O1xuICAgICAgY2xvc2VzdC54ID0gcG9zLng7XG4gICAgfVxuICAgIG1heFggPSBNYXRoLm1heChwb3MueCwgbWF4WCk7XG4gIH1cblxuICBpZiAoY2xvc2VzdC54ID09IG1heFgpIHsgLy8gZm9jdXMgb24gbGVhZGVyIGFnYWluXG4gICAgY3dfc2V0Q2FtZXJhVGFyZ2V0KC0xKTtcbiAgfSBlbHNlIHtcbiAgICBjd19zZXRDYW1lcmFUYXJnZXQoY2xvc2VzdC52YWx1ZSk7XG4gIH1cbn1cblxuXG5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiI211dGF0aW9ucmF0ZVwiKS5hZGRFdmVudExpc3RlbmVyKFwiY2hhbmdlXCIsIGZ1bmN0aW9uKGUpe1xuICB2YXIgZWxlbSA9IGUudGFyZ2V0XG4gIGN3X3NldE11dGF0aW9uKGVsZW0ub3B0aW9uc1tlbGVtLnNlbGVjdGVkSW5kZXhdLnZhbHVlKVxufSlcblxuZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIiNtdXRhdGlvbnNpemVcIikuYWRkRXZlbnRMaXN0ZW5lcihcImNoYW5nZVwiLCBmdW5jdGlvbihlKXtcbiAgdmFyIGVsZW0gPSBlLnRhcmdldFxuICBjd19zZXRNdXRhdGlvblJhbmdlKGVsZW0ub3B0aW9uc1tlbGVtLnNlbGVjdGVkSW5kZXhdLnZhbHVlKVxufSlcblxuZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIiNmbG9vclwiKS5hZGRFdmVudExpc3RlbmVyKFwiY2hhbmdlXCIsIGZ1bmN0aW9uKGUpe1xuICB2YXIgZWxlbSA9IGUudGFyZ2V0XG4gIGN3X3NldE11dGFibGVGbG9vcihlbGVtLm9wdGlvbnNbZWxlbS5zZWxlY3RlZEluZGV4XS52YWx1ZSlcbn0pO1xuXG5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiI2dyYXZpdHlcIikuYWRkRXZlbnRMaXN0ZW5lcihcImNoYW5nZVwiLCBmdW5jdGlvbihlKXtcbiAgdmFyIGVsZW0gPSBlLnRhcmdldFxuICBjd19zZXRHcmF2aXR5KGVsZW0ub3B0aW9uc1tlbGVtLnNlbGVjdGVkSW5kZXhdLnZhbHVlKVxufSlcblxuZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIiNlbGl0ZXNpemVcIikuYWRkRXZlbnRMaXN0ZW5lcihcImNoYW5nZVwiLCBmdW5jdGlvbihlKXtcbiAgdmFyIGVsZW0gPSBlLnRhcmdldFxuICBjd19zZXRFbGl0ZVNpemUoZWxlbS5vcHRpb25zW2VsZW0uc2VsZWN0ZWRJbmRleF0udmFsdWUpXG59KVxuXG5mdW5jdGlvbiBjd19zZXRNdXRhdGlvbihtdXRhdGlvbikge1xuICBnZW5lcmF0aW9uQ29uZmlnLmNvbnN0YW50cy5nZW5fbXV0YXRpb24gPSBwYXJzZUZsb2F0KG11dGF0aW9uKTtcbn1cblxuZnVuY3Rpb24gY3dfc2V0TXV0YXRpb25SYW5nZShyYW5nZSkge1xuICBnZW5lcmF0aW9uQ29uZmlnLmNvbnN0YW50cy5tdXRhdGlvbl9yYW5nZSA9IHBhcnNlRmxvYXQocmFuZ2UpO1xufVxuXG5mdW5jdGlvbiBjd19zZXRNdXRhYmxlRmxvb3IoY2hvaWNlKSB7XG4gIHdvcmxkX2RlZi5tdXRhYmxlX2Zsb29yID0gKGNob2ljZSA9PSAxKTtcbn1cblxuZnVuY3Rpb24gY3dfc2V0R3Jhdml0eShjaG9pY2UpIHtcbiAgd29ybGRfZGVmLmdyYXZpdHkgPSBuZXcgYjJWZWMyKDAuMCwgLXBhcnNlRmxvYXQoY2hvaWNlKSk7XG4gIHZhciB3b3JsZCA9IGN1cnJlbnRSdW5uZXIuc2NlbmUud29ybGRcbiAgLy8gQ0hFQ0sgR1JBVklUWSBDSEFOR0VTXG4gIGlmICh3b3JsZC5HZXRHcmF2aXR5KCkueSAhPSB3b3JsZF9kZWYuZ3Jhdml0eS55KSB7XG4gICAgd29ybGQuU2V0R3Jhdml0eSh3b3JsZF9kZWYuZ3Jhdml0eSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gY3dfc2V0RWxpdGVTaXplKGNsb25lcykge1xuICBnZW5lcmF0aW9uQ29uZmlnLmNvbnN0YW50cy5jaGFtcGlvbkxlbmd0aCA9IHBhcnNlSW50KGNsb25lcywgMTApO1xufVxuXG5jd19pbml0KCk7XG4iLCJ2YXIgcmFuZG9tID0gcmVxdWlyZShcIi4vcmFuZG9tLmpzXCIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgY3JlYXRlR2VuZXJhdGlvblplcm8oc2NoZW1hLCBnZW5lcmF0b3Ipe1xuICAgIHJldHVybiBPYmplY3Qua2V5cyhzY2hlbWEpLnJlZHVjZShmdW5jdGlvbihpbnN0YW5jZSwga2V5KXtcbiAgICAgIHZhciBzY2hlbWFQcm9wID0gc2NoZW1hW2tleV07XG4gICAgICB2YXIgdmFsdWVzID0gcmFuZG9tLmNyZWF0ZU5vcm1hbHMoc2NoZW1hUHJvcCwgZ2VuZXJhdG9yKTtcbiAgICAgIGluc3RhbmNlW2tleV0gPSB2YWx1ZXM7XG4gICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgfSwgeyBpZDogTWF0aC5yYW5kb20oKS50b1N0cmluZygzMikgfSk7XG4gIH0sXG4gIGNyZWF0ZUNyb3NzQnJlZWQoc2NoZW1hLCBwYXJlbnRzLCBwYXJlbnRDaG9vc2VyKXtcbiAgICB2YXIgaWQgPSBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDMyKTtcbiAgICByZXR1cm4gT2JqZWN0LmtleXMoc2NoZW1hKS5yZWR1Y2UoZnVuY3Rpb24oY3Jvc3NEZWYsIGtleSl7XG4gICAgICB2YXIgc2NoZW1hRGVmID0gc2NoZW1hW2tleV07XG4gICAgICB2YXIgdmFsdWVzID0gW107XG4gICAgICBmb3IodmFyIGkgPSAwLCBsID0gc2NoZW1hRGVmLmxlbmd0aDsgaSA8IGw7IGkrKyl7XG4gICAgICAgIHZhciBwID0gcGFyZW50Q2hvb3NlcihpZCwga2V5LCBwYXJlbnRzKTtcbiAgICAgICAgdmFsdWVzLnB1c2gocGFyZW50c1twXVtrZXldW2ldKTtcbiAgICAgIH1cbiAgICAgIGNyb3NzRGVmW2tleV0gPSB2YWx1ZXM7XG4gICAgICByZXR1cm4gY3Jvc3NEZWY7XG4gICAgfSwge1xuICAgICAgaWQ6IGlkLFxuICAgICAgYW5jZXN0cnk6IHBhcmVudHMubWFwKGZ1bmN0aW9uKHBhcmVudCl7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgaWQ6IHBhcmVudC5pZCxcbiAgICAgICAgICBhbmNlc3RyeTogcGFyZW50LmFuY2VzdHJ5LFxuICAgICAgICB9O1xuICAgICAgfSlcbiAgICB9KTtcbiAgfSxcbiAgY3JlYXRlTXV0YXRlZENsb25lKHNjaGVtYSwgZ2VuZXJhdG9yLCBwYXJlbnQsIGZhY3RvciwgY2hhbmNlVG9NdXRhdGUpe1xuICAgIHJldHVybiBPYmplY3Qua2V5cyhzY2hlbWEpLnJlZHVjZShmdW5jdGlvbihjbG9uZSwga2V5KXtcbiAgICAgIHZhciBzY2hlbWFQcm9wID0gc2NoZW1hW2tleV07XG4gICAgICB2YXIgb3JpZ2luYWxWYWx1ZXMgPSBwYXJlbnRba2V5XTtcbiAgICAgIHZhciB2YWx1ZXMgPSByYW5kb20ubXV0YXRlTm9ybWFscyhcbiAgICAgICAgc2NoZW1hUHJvcCwgZ2VuZXJhdG9yLCBvcmlnaW5hbFZhbHVlcywgZmFjdG9yLCBjaGFuY2VUb011dGF0ZVxuICAgICAgKTtcbiAgICAgIGNsb25lW2tleV0gPSB2YWx1ZXM7XG4gICAgICByZXR1cm4gY2xvbmU7XG4gICAgfSwge1xuICAgICAgaWQ6IHBhcmVudC5pZCxcbiAgICAgIGFuY2VzdHJ5OiBwYXJlbnQuYW5jZXN0cnlcbiAgICB9KTtcbiAgfSxcbiAgYXBwbHlUeXBlcyhzY2hlbWEsIHBhcmVudCl7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHNjaGVtYSkucmVkdWNlKGZ1bmN0aW9uKGNsb25lLCBrZXkpe1xuICAgICAgdmFyIHNjaGVtYVByb3AgPSBzY2hlbWFba2V5XTtcbiAgICAgIHZhciBvcmlnaW5hbFZhbHVlcyA9IHBhcmVudFtrZXldO1xuICAgICAgdmFyIHZhbHVlcztcbiAgICAgIHN3aXRjaChzY2hlbWFQcm9wLnR5cGUpe1xuICAgICAgICBjYXNlIFwic2h1ZmZsZVwiIDpcbiAgICAgICAgICB2YWx1ZXMgPSByYW5kb20ubWFwVG9TaHVmZmxlKHNjaGVtYVByb3AsIG9yaWdpbmFsVmFsdWVzKTsgYnJlYWs7XG4gICAgICAgIGNhc2UgXCJmbG9hdFwiIDpcbiAgICAgICAgICB2YWx1ZXMgPSByYW5kb20ubWFwVG9GbG9hdChzY2hlbWFQcm9wLCBvcmlnaW5hbFZhbHVlcyk7IGJyZWFrO1xuICAgICAgICBjYXNlIFwiaW50ZWdlclwiOlxuICAgICAgICAgIHZhbHVlcyA9IHJhbmRvbS5tYXBUb0ludGVnZXIoc2NoZW1hUHJvcCwgb3JpZ2luYWxWYWx1ZXMpOyBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gdHlwZSAke3NjaGVtYVByb3AudHlwZX0gb2Ygc2NoZW1hIGZvciBrZXkgJHtrZXl9YCk7XG4gICAgICB9XG4gICAgICBjbG9uZVtrZXldID0gdmFsdWVzO1xuICAgICAgcmV0dXJuIGNsb25lO1xuICAgIH0sIHtcbiAgICAgIGlkOiBwYXJlbnQuaWQsXG4gICAgICBhbmNlc3RyeTogcGFyZW50LmFuY2VzdHJ5XG4gICAgfSk7XG4gIH0sXG59XG4iLCJ2YXIgY3JlYXRlID0gcmVxdWlyZShcIi4uL2NyZWF0ZS1pbnN0YW5jZVwiKTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGdlbmVyYXRpb25aZXJvOiBnZW5lcmF0aW9uWmVybyxcbiAgbmV4dEdlbmVyYXRpb246IG5leHRHZW5lcmF0aW9uXG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRpb25aZXJvKGNvbmZpZyl7XG4gIHZhciBnZW5lcmF0aW9uU2l6ZSA9IGNvbmZpZy5nZW5lcmF0aW9uU2l6ZSxcbiAgc2NoZW1hID0gY29uZmlnLnNjaGVtYTtcbiAgdmFyIGN3X2NhckdlbmVyYXRpb24gPSBbXTtcbiAgZm9yICh2YXIgayA9IDA7IGsgPCBnZW5lcmF0aW9uU2l6ZTsgaysrKSB7XG4gICAgdmFyIGRlZiA9IGNyZWF0ZS5jcmVhdGVHZW5lcmF0aW9uWmVybyhzY2hlbWEsIGZ1bmN0aW9uKCl7XG4gICAgICByZXR1cm4gTWF0aC5yYW5kb20oKVxuICAgIH0pO1xuICAgIGRlZi5pbmRleCA9IGs7XG4gICAgY3dfY2FyR2VuZXJhdGlvbi5wdXNoKGRlZik7XG4gIH1cbiAgcmV0dXJuIHtcbiAgICBjb3VudGVyOiAwLFxuICAgIGdlbmVyYXRpb246IGN3X2NhckdlbmVyYXRpb24sXG4gIH07XG59XG5cbmZ1bmN0aW9uIG5leHRHZW5lcmF0aW9uKFxuICBwcmV2aW91c1N0YXRlLFxuICBzY29yZXMsXG4gIGNvbmZpZ1xuKXtcbiAgdmFyIGNoYW1waW9uX2xlbmd0aCA9IGNvbmZpZy5jaGFtcGlvbkxlbmd0aCxcbiAgICBnZW5lcmF0aW9uU2l6ZSA9IGNvbmZpZy5nZW5lcmF0aW9uU2l6ZSxcbiAgICBzZWxlY3RGcm9tQWxsUGFyZW50cyA9IGNvbmZpZy5zZWxlY3RGcm9tQWxsUGFyZW50cztcblxuICB2YXIgbmV3R2VuZXJhdGlvbiA9IG5ldyBBcnJheSgpO1xuICB2YXIgbmV3Ym9ybjtcbiAgZm9yICh2YXIgayA9IDA7IGsgPCBjaGFtcGlvbl9sZW5ndGg7IGsrKykge2BgXG4gICAgc2NvcmVzW2tdLmRlZi5pc19lbGl0ZSA9IHRydWU7XG4gICAgc2NvcmVzW2tdLmRlZi5pbmRleCA9IGs7XG4gICAgbmV3R2VuZXJhdGlvbi5wdXNoKHNjb3Jlc1trXS5kZWYpO1xuICB9XG4gIHZhciBwYXJlbnRMaXN0ID0gW107XG4gIGZvciAoayA9IGNoYW1waW9uX2xlbmd0aDsgayA8IGdlbmVyYXRpb25TaXplOyBrKyspIHtcbiAgICB2YXIgcGFyZW50MSA9IHNlbGVjdEZyb21BbGxQYXJlbnRzKHNjb3JlcywgcGFyZW50TGlzdCk7XG4gICAgdmFyIHBhcmVudDIgPSBwYXJlbnQxO1xuICAgIHdoaWxlIChwYXJlbnQyID09IHBhcmVudDEpIHtcbiAgICAgIHBhcmVudDIgPSBzZWxlY3RGcm9tQWxsUGFyZW50cyhzY29yZXMsIHBhcmVudExpc3QsIHBhcmVudDEpO1xuICAgIH1cbiAgICB2YXIgcGFpciA9IFtwYXJlbnQxLCBwYXJlbnQyXVxuICAgIHBhcmVudExpc3QucHVzaChwYWlyKTtcbiAgICBuZXdib3JuID0gbWFrZUNoaWxkKGNvbmZpZyxcbiAgICAgIHBhaXIubWFwKGZ1bmN0aW9uKHBhcmVudCkgeyByZXR1cm4gc2NvcmVzW3BhcmVudF0uZGVmOyB9KVxuICAgICk7XG4gICAgbmV3Ym9ybiA9IG11dGF0ZShjb25maWcsIG5ld2Jvcm4pO1xuICAgIG5ld2Jvcm4uaXNfZWxpdGUgPSBmYWxzZTtcbiAgICBuZXdib3JuLmluZGV4ID0gaztcbiAgICBuZXdHZW5lcmF0aW9uLnB1c2gobmV3Ym9ybik7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGNvdW50ZXI6IHByZXZpb3VzU3RhdGUuY291bnRlciArIDEsXG4gICAgZ2VuZXJhdGlvbjogbmV3R2VuZXJhdGlvbixcbiAgfTtcbn1cblxuXG5mdW5jdGlvbiBtYWtlQ2hpbGQoY29uZmlnLCBwYXJlbnRzKXtcbiAgdmFyIHNjaGVtYSA9IGNvbmZpZy5zY2hlbWEsXG4gICAgcGlja1BhcmVudCA9IGNvbmZpZy5waWNrUGFyZW50O1xuICByZXR1cm4gY3JlYXRlLmNyZWF0ZUNyb3NzQnJlZWQoc2NoZW1hLCBwYXJlbnRzLCBwaWNrUGFyZW50KVxufVxuXG5cbmZ1bmN0aW9uIG11dGF0ZShjb25maWcsIHBhcmVudCl7XG4gIHZhciBzY2hlbWEgPSBjb25maWcuc2NoZW1hLFxuICAgIG11dGF0aW9uX3JhbmdlID0gY29uZmlnLm11dGF0aW9uX3JhbmdlLFxuICAgIGdlbl9tdXRhdGlvbiA9IGNvbmZpZy5nZW5fbXV0YXRpb24sXG4gICAgZ2VuZXJhdGVSYW5kb20gPSBjb25maWcuZ2VuZXJhdGVSYW5kb207XG4gIHJldHVybiBjcmVhdGUuY3JlYXRlTXV0YXRlZENsb25lKFxuICAgIHNjaGVtYSxcbiAgICBnZW5lcmF0ZVJhbmRvbSxcbiAgICBwYXJlbnQsXG4gICAgTWF0aC5tYXgobXV0YXRpb25fcmFuZ2UpLFxuICAgIGdlbl9tdXRhdGlvblxuICApXG59XG4iLCJcblxuY29uc3QgcmFuZG9tID0ge1xuICBzaHVmZmxlSW50ZWdlcnMocHJvcCwgZ2VuZXJhdG9yKXtcbiAgICByZXR1cm4gcmFuZG9tLm1hcFRvU2h1ZmZsZShwcm9wLCByYW5kb20uY3JlYXRlTm9ybWFscyh7XG4gICAgICBsZW5ndGg6IHByb3AubGVuZ3RoIHx8IDEwLFxuICAgICAgaW5jbHVzaXZlOiB0cnVlLFxuICAgIH0sIGdlbmVyYXRvcikpO1xuICB9LFxuICBjcmVhdGVJbnRlZ2Vycyhwcm9wLCBnZW5lcmF0b3Ipe1xuICAgIHJldHVybiByYW5kb20ubWFwVG9JbnRlZ2VyKHByb3AsIHJhbmRvbS5jcmVhdGVOb3JtYWxzKHtcbiAgICAgIGxlbmd0aDogcHJvcC5sZW5ndGgsXG4gICAgICBpbmNsdXNpdmU6IHRydWUsXG4gICAgfSwgZ2VuZXJhdG9yKSk7XG4gIH0sXG4gIGNyZWF0ZUZsb2F0cyhwcm9wLCBnZW5lcmF0b3Ipe1xuICAgIHJldHVybiByYW5kb20ubWFwVG9GbG9hdChwcm9wLCByYW5kb20uY3JlYXRlTm9ybWFscyh7XG4gICAgICBsZW5ndGg6IHByb3AubGVuZ3RoLFxuICAgICAgaW5jbHVzaXZlOiB0cnVlLFxuICAgIH0sIGdlbmVyYXRvcikpO1xuICB9LFxuICBjcmVhdGVOb3JtYWxzKHByb3AsIGdlbmVyYXRvcil7XG4gICAgdmFyIGwgPSBwcm9wLmxlbmd0aDtcbiAgICB2YXIgdmFsdWVzID0gW107XG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGw7IGkrKyl7XG4gICAgICB2YWx1ZXMucHVzaChcbiAgICAgICAgY3JlYXRlTm9ybWFsKHByb3AsIGdlbmVyYXRvcilcbiAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZXM7XG4gIH0sXG4gIG11dGF0ZVNodWZmbGUoXG4gICAgcHJvcCwgZ2VuZXJhdG9yLCBvcmlnaW5hbFZhbHVlcywgbXV0YXRpb25fcmFuZ2UsIGNoYW5jZVRvTXV0YXRlXG4gICl7XG4gICAgcmV0dXJuIHJhbmRvbS5tYXBUb1NodWZmbGUocHJvcCwgcmFuZG9tLm11dGF0ZU5vcm1hbHMoXG4gICAgICBwcm9wLCBnZW5lcmF0b3IsIG9yaWdpbmFsVmFsdWVzLCBtdXRhdGlvbl9yYW5nZSwgY2hhbmNlVG9NdXRhdGVcbiAgICApKTtcbiAgfSxcbiAgbXV0YXRlSW50ZWdlcnMocHJvcCwgZ2VuZXJhdG9yLCBvcmlnaW5hbFZhbHVlcywgbXV0YXRpb25fcmFuZ2UsIGNoYW5jZVRvTXV0YXRlKXtcbiAgICByZXR1cm4gcmFuZG9tLm1hcFRvSW50ZWdlcihwcm9wLCByYW5kb20ubXV0YXRlTm9ybWFscyhcbiAgICAgIHByb3AsIGdlbmVyYXRvciwgb3JpZ2luYWxWYWx1ZXMsIG11dGF0aW9uX3JhbmdlLCBjaGFuY2VUb011dGF0ZVxuICAgICkpO1xuICB9LFxuICBtdXRhdGVGbG9hdHMocHJvcCwgZ2VuZXJhdG9yLCBvcmlnaW5hbFZhbHVlcywgbXV0YXRpb25fcmFuZ2UsIGNoYW5jZVRvTXV0YXRlKXtcbiAgICByZXR1cm4gcmFuZG9tLm1hcFRvRmxvYXQocHJvcCwgcmFuZG9tLm11dGF0ZU5vcm1hbHMoXG4gICAgICBwcm9wLCBnZW5lcmF0b3IsIG9yaWdpbmFsVmFsdWVzLCBtdXRhdGlvbl9yYW5nZSwgY2hhbmNlVG9NdXRhdGVcbiAgICApKTtcbiAgfSxcbiAgbWFwVG9TaHVmZmxlKHByb3AsIG5vcm1hbHMpe1xuICAgIHZhciBvZmZzZXQgPSBwcm9wLm9mZnNldCB8fCAwO1xuICAgIHZhciBsaW1pdCA9IHByb3AubGltaXQgfHwgcHJvcC5sZW5ndGg7XG4gICAgdmFyIHNvcnRlZCA9IG5vcm1hbHMuc2xpY2UoKS5zb3J0KGZ1bmN0aW9uKGEsIGIpe1xuICAgICAgcmV0dXJuIGEgLSBiO1xuICAgIH0pO1xuICAgIHJldHVybiBub3JtYWxzLm1hcChmdW5jdGlvbih2YWwpe1xuICAgICAgcmV0dXJuIHNvcnRlZC5pbmRleE9mKHZhbCk7XG4gICAgfSkubWFwKGZ1bmN0aW9uKGkpe1xuICAgICAgcmV0dXJuIGkgKyBvZmZzZXQ7XG4gICAgfSkuc2xpY2UoMCwgbGltaXQpO1xuICB9LFxuICBtYXBUb0ludGVnZXIocHJvcCwgbm9ybWFscyl7XG4gICAgcHJvcCA9IHtcbiAgICAgIG1pbjogcHJvcC5taW4gfHwgMCxcbiAgICAgIHJhbmdlOiBwcm9wLnJhbmdlIHx8IDEwLFxuICAgICAgbGVuZ3RoOiBwcm9wLmxlbmd0aFxuICAgIH1cbiAgICByZXR1cm4gcmFuZG9tLm1hcFRvRmxvYXQocHJvcCwgbm9ybWFscykubWFwKGZ1bmN0aW9uKGZsb2F0KXtcbiAgICAgIHJldHVybiBNYXRoLnJvdW5kKGZsb2F0KTtcbiAgICB9KTtcbiAgfSxcbiAgbWFwVG9GbG9hdChwcm9wLCBub3JtYWxzKXtcbiAgICBwcm9wID0ge1xuICAgICAgbWluOiBwcm9wLm1pbiB8fCAwLFxuICAgICAgcmFuZ2U6IHByb3AucmFuZ2UgfHwgMVxuICAgIH1cbiAgICByZXR1cm4gbm9ybWFscy5tYXAoZnVuY3Rpb24obm9ybWFsKXtcbiAgICAgIHZhciBtaW4gPSBwcm9wLm1pbjtcbiAgICAgIHZhciByYW5nZSA9IHByb3AucmFuZ2U7XG4gICAgICByZXR1cm4gbWluICsgbm9ybWFsICogcmFuZ2VcbiAgICB9KVxuICB9LFxuICBtdXRhdGVOb3JtYWxzKHByb3AsIGdlbmVyYXRvciwgb3JpZ2luYWxWYWx1ZXMsIG11dGF0aW9uX3JhbmdlLCBjaGFuY2VUb011dGF0ZSl7XG4gICAgdmFyIGZhY3RvciA9IChwcm9wLmZhY3RvciB8fCAxKSAqIG11dGF0aW9uX3JhbmdlXG4gICAgcmV0dXJuIG9yaWdpbmFsVmFsdWVzLm1hcChmdW5jdGlvbihvcmlnaW5hbFZhbHVlKXtcbiAgICAgIGlmKGdlbmVyYXRvcigpID4gY2hhbmNlVG9NdXRhdGUpe1xuICAgICAgICByZXR1cm4gb3JpZ2luYWxWYWx1ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtdXRhdGVOb3JtYWwoXG4gICAgICAgIHByb3AsIGdlbmVyYXRvciwgb3JpZ2luYWxWYWx1ZSwgZmFjdG9yXG4gICAgICApO1xuICAgIH0pO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHJhbmRvbTtcblxuZnVuY3Rpb24gbXV0YXRlTm9ybWFsKHByb3AsIGdlbmVyYXRvciwgb3JpZ2luYWxWYWx1ZSwgbXV0YXRpb25fcmFuZ2Upe1xuICBpZihtdXRhdGlvbl9yYW5nZSA+IDEpe1xuICAgIHRocm93IG5ldyBFcnJvcihcIkNhbm5vdCBtdXRhdGUgYmV5b25kIGJvdW5kc1wiKTtcbiAgfVxuICB2YXIgbmV3TWluID0gb3JpZ2luYWxWYWx1ZSAtIDAuNTtcbiAgaWYgKG5ld01pbiA8IDApIG5ld01pbiA9IDA7XG4gIGlmIChuZXdNaW4gKyBtdXRhdGlvbl9yYW5nZSAgPiAxKVxuICAgIG5ld01pbiA9IDEgLSBtdXRhdGlvbl9yYW5nZTtcbiAgdmFyIHJhbmdlVmFsdWUgPSBjcmVhdGVOb3JtYWwoe1xuICAgIGluY2x1c2l2ZTogdHJ1ZSxcbiAgfSwgZ2VuZXJhdG9yKTtcbiAgcmV0dXJuIG5ld01pbiArIHJhbmdlVmFsdWUgKiBtdXRhdGlvbl9yYW5nZTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlTm9ybWFsKHByb3AsIGdlbmVyYXRvcil7XG4gIGlmKCFwcm9wLmluY2x1c2l2ZSl7XG4gICAgcmV0dXJuIGdlbmVyYXRvcigpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBnZW5lcmF0b3IoKSA8IDAuNSA/XG4gICAgZ2VuZXJhdG9yKCkgOlxuICAgIDEgLSBnZW5lcmF0b3IoKTtcbiAgfVxufVxuIiwiLyogZ2xvYmFscyBidG9hICovXG52YXIgc2V0dXBTY2VuZSA9IHJlcXVpcmUoXCIuL3NldHVwLXNjZW5lXCIpO1xudmFyIGNhclJ1biA9IHJlcXVpcmUoXCIuLi9jYXItc2NoZW1hL3J1blwiKTtcbnZhciBkZWZUb0NhciA9IHJlcXVpcmUoXCIuLi9jYXItc2NoZW1hL2RlZi10by1jYXJcIik7XG5cbm1vZHVsZS5leHBvcnRzID0gcnVuRGVmcztcbmZ1bmN0aW9uIHJ1bkRlZnMod29ybGRfZGVmLCBkZWZzLCBsaXN0ZW5lcnMpIHtcbiAgaWYgKHdvcmxkX2RlZi5tdXRhYmxlX2Zsb29yKSB7XG4gICAgLy8gR0hPU1QgRElTQUJMRURcbiAgICB3b3JsZF9kZWYuZmxvb3JzZWVkID0gYnRvYShNYXRoLnNlZWRyYW5kb20oKSk7XG4gIH1cblxuICB2YXIgc2NlbmUgPSBzZXR1cFNjZW5lKHdvcmxkX2RlZik7XG4gIHNjZW5lLndvcmxkLlN0ZXAoMSAvIHdvcmxkX2RlZi5ib3gyZGZwcywgMjAsIDIwKTtcbiAgY29uc29sZS5sb2coXCJhYm91dCB0byBidWlsZCBjYXJzXCIpO1xuICB2YXIgY2FycyA9IGRlZnMubWFwKChkZWYsIGkpID0+IHtcbiAgICByZXR1cm4ge1xuICAgICAgaW5kZXg6IGksXG4gICAgICBkZWY6IGRlZixcbiAgICAgIGNhcjogZGVmVG9DYXIoZGVmLCBzY2VuZS53b3JsZCwgd29ybGRfZGVmKSxcbiAgICAgIHN0YXRlOiBjYXJSdW4uZ2V0SW5pdGlhbFN0YXRlKHdvcmxkX2RlZilcbiAgICB9O1xuICB9KTtcbiAgdmFyIGFsaXZlY2FycyA9IGNhcnM7XG4gIHJldHVybiB7XG4gICAgc2NlbmU6IHNjZW5lLFxuICAgIGNhcnM6IGNhcnMsXG4gICAgc3RlcDogZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKGFsaXZlY2Fycy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwibm8gbW9yZSBjYXJzXCIpO1xuICAgICAgfVxuICAgICAgc2NlbmUud29ybGQuU3RlcCgxIC8gd29ybGRfZGVmLmJveDJkZnBzLCAyMCwgMjApO1xuICAgICAgbGlzdGVuZXJzLnByZUNhclN0ZXAoKTtcbiAgICAgIGFsaXZlY2FycyA9IGFsaXZlY2Fycy5maWx0ZXIoZnVuY3Rpb24gKGNhcikge1xuICAgICAgICBjYXIuc3RhdGUgPSBjYXJSdW4udXBkYXRlU3RhdGUoXG4gICAgICAgICAgd29ybGRfZGVmLCBjYXIuY2FyLCBjYXIuc3RhdGVcbiAgICAgICAgKTtcbiAgICAgICAgdmFyIHN0YXR1cyA9IGNhclJ1bi5nZXRTdGF0dXMoY2FyLnN0YXRlLCB3b3JsZF9kZWYpO1xuICAgICAgICBsaXN0ZW5lcnMuY2FyU3RlcChjYXIpO1xuICAgICAgICBpZiAoc3RhdHVzID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgY2FyLnNjb3JlID0gY2FyUnVuLmNhbGN1bGF0ZVNjb3JlKGNhci5zdGF0ZSwgd29ybGRfZGVmKTtcbiAgICAgICAgbGlzdGVuZXJzLmNhckRlYXRoKGNhcik7XG5cbiAgICAgICAgdmFyIHdvcmxkID0gc2NlbmUud29ybGQ7XG4gICAgICAgIHZhciB3b3JsZENhciA9IGNhci5jYXI7XG4gICAgICAgIHdvcmxkLkRlc3Ryb3lCb2R5KHdvcmxkQ2FyLmNoYXNzaXMpO1xuXG4gICAgICAgIGZvciAodmFyIHcgPSAwOyB3IDwgd29ybGRDYXIud2hlZWxzLmxlbmd0aDsgdysrKSB7XG4gICAgICAgICAgd29ybGQuRGVzdHJveUJvZHkod29ybGRDYXIud2hlZWxzW3ddKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0pXG4gICAgICBpZiAoYWxpdmVjYXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBsaXN0ZW5lcnMuZ2VuZXJhdGlvbkVuZChjYXJzKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxufVxuIiwiLyogZ2xvYmFscyBiMldvcmxkIGIyVmVjMiBiMkJvZHlEZWYgYjJGaXh0dXJlRGVmIGIyUG9seWdvblNoYXBlICovXG5cbi8qXG5cbndvcmxkX2RlZiA9IHtcbiAgZ3Jhdml0eToge3gsIHl9LFxuICBkb1NsZWVwOiBib29sZWFuLFxuICBmbG9vcnNlZWQ6IHN0cmluZyxcbiAgdGlsZURpbWVuc2lvbnMsXG4gIG1heEZsb29yVGlsZXMsXG4gIG11dGFibGVfZmxvb3I6IGJvb2xlYW5cbn1cblxuKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih3b3JsZF9kZWYpe1xuXG4gIHZhciB3b3JsZCA9IG5ldyBiMldvcmxkKHdvcmxkX2RlZi5ncmF2aXR5LCB3b3JsZF9kZWYuZG9TbGVlcCk7XG4gIHZhciBmbG9vclRpbGVzID0gY3dfY3JlYXRlRmxvb3IoXG4gICAgd29ybGQsXG4gICAgd29ybGRfZGVmLmZsb29yc2VlZCxcbiAgICB3b3JsZF9kZWYudGlsZURpbWVuc2lvbnMsXG4gICAgd29ybGRfZGVmLm1heEZsb29yVGlsZXMsXG4gICAgd29ybGRfZGVmLm11dGFibGVfZmxvb3JcbiAgKTtcblxuICB2YXIgbGFzdF90aWxlID0gZmxvb3JUaWxlc1tcbiAgICBmbG9vclRpbGVzLmxlbmd0aCAtIDFcbiAgXTtcbiAgdmFyIGxhc3RfZml4dHVyZSA9IGxhc3RfdGlsZS5HZXRGaXh0dXJlTGlzdCgpO1xuICB2YXIgbGFzdF90aWxlX3Bvc2l0aW9uID0gbGFzdF90aWxlLkdldFdvcmxkUG9pbnQoXG4gICAgbGFzdF9maXh0dXJlLkdldFNoYXBlKCkubV92ZXJ0aWNlc1szXVxuICApO1xuXG4gIC8vIExvb3AgdGhyb3VnaCBmaXJzdCBzZXZlcmFsIHRpbGVzIHRvIGZpbmQgYSBzYWZlIGhlaWdodCBmb3IgcGxhY2luZyBjYXJzXG4gIHdvcmxkLnN0YXJ0SGVpZ2h0ID0gLTEwO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IDIwOyBpKyspIHtcbiAgICB2YXIgdGlsZSA9IGZsb29yVGlsZXNbaV07XG4gICAgdmFyIGZpeHR1cmUgPSB0aWxlLkdldEZpeHR1cmVMaXN0KCk7XG4gICAgdmFyIHRvcFJpZ2h0VmVydGljZSA9IHRpbGUuR2V0V29ybGRQb2ludChmaXh0dXJlLkdldFNoYXBlKCkubV92ZXJ0aWNlc1szXSk7XG4gICAgdmFyIHRvcExlZnRWZXJ0aWNlID0gdGlsZS5HZXRXb3JsZFBvaW50KGZpeHR1cmUuR2V0U2hhcGUoKS5tX3ZlcnRpY2VzWzBdKTtcbiAgICBpZiAodG9wUmlnaHRWZXJ0aWNlLnkgPiB3b3JsZC5zdGFydEhlaWdodCkge1xuICAgICAgd29ybGQuc3RhcnRIZWlnaHQgPSB0b3BSaWdodFZlcnRpY2UueTtcbiAgICB9XG4gICAgaWYgKHRvcExlZnRWZXJ0aWNlLnkgPiB3b3JsZC5zdGFydEhlaWdodCkge1xuICAgICAgd29ybGQuc3RhcnRIZWlnaHQgPSB0b3BMZWZ0VmVydGljZS55O1xuICAgIH1cbiAgICBpZiAodG9wUmlnaHRWZXJ0aWNlLnggPiAyKSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgd29ybGQuZmluaXNoTGluZSA9IGxhc3RfdGlsZV9wb3NpdGlvbi54O1xuICByZXR1cm4ge1xuICAgIHdvcmxkOiB3b3JsZCxcbiAgICBmbG9vclRpbGVzOiBmbG9vclRpbGVzLFxuICAgIGZpbmlzaExpbmU6IGxhc3RfdGlsZV9wb3NpdGlvbi54XG4gIH07XG59XG5cbmZ1bmN0aW9uIGN3X2NyZWF0ZUZsb29yKHdvcmxkLCBmbG9vcnNlZWQsIGRpbWVuc2lvbnMsIG1heEZsb29yVGlsZXMsIG11dGFibGVfZmxvb3IpIHtcbiAgdmFyIGxhc3RfdGlsZSA9IG51bGw7XG4gIHZhciB0aWxlX3Bvc2l0aW9uID0gbmV3IGIyVmVjMigtNSwgMCk7XG4gIHZhciBjd19mbG9vclRpbGVzID0gW107XG4gIE1hdGguc2VlZHJhbmRvbShmbG9vcnNlZWQpO1xuICBmb3IgKHZhciBrID0gMDsgayA8IG1heEZsb29yVGlsZXM7IGsrKykge1xuICAgIGlmICghbXV0YWJsZV9mbG9vcikge1xuICAgICAgLy8ga2VlcCBvbGQgaW1wb3NzaWJsZSB0cmFja3MgaWYgbm90IHVzaW5nIG11dGFibGUgZmxvb3JzXG4gICAgICBsYXN0X3RpbGUgPSBjd19jcmVhdGVGbG9vclRpbGUoXG4gICAgICAgIHdvcmxkLCBkaW1lbnNpb25zLCB0aWxlX3Bvc2l0aW9uLCAoTWF0aC5yYW5kb20oKSAqIDMgLSAxLjUpICogMS41ICogayAvIG1heEZsb29yVGlsZXNcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGlmIHBhdGggaXMgbXV0YWJsZSBvdmVyIHJhY2VzLCBjcmVhdGUgc21vb3RoZXIgdHJhY2tzXG4gICAgICBsYXN0X3RpbGUgPSBjd19jcmVhdGVGbG9vclRpbGUoXG4gICAgICAgIHdvcmxkLCBkaW1lbnNpb25zLCB0aWxlX3Bvc2l0aW9uLCAoTWF0aC5yYW5kb20oKSAqIDMgLSAxLjUpICogMS4yICogayAvIG1heEZsb29yVGlsZXNcbiAgICAgICk7XG4gICAgfVxuICAgIGN3X2Zsb29yVGlsZXMucHVzaChsYXN0X3RpbGUpO1xuICAgIHZhciBsYXN0X2ZpeHR1cmUgPSBsYXN0X3RpbGUuR2V0Rml4dHVyZUxpc3QoKTtcbiAgICB0aWxlX3Bvc2l0aW9uID0gbGFzdF90aWxlLkdldFdvcmxkUG9pbnQobGFzdF9maXh0dXJlLkdldFNoYXBlKCkubV92ZXJ0aWNlc1szXSk7XG4gIH1cbiAgcmV0dXJuIGN3X2Zsb29yVGlsZXM7XG59XG5cblxuZnVuY3Rpb24gY3dfY3JlYXRlRmxvb3JUaWxlKHdvcmxkLCBkaW0sIHBvc2l0aW9uLCBhbmdsZSkge1xuICB2YXIgYm9keV9kZWYgPSBuZXcgYjJCb2R5RGVmKCk7XG5cbiAgYm9keV9kZWYucG9zaXRpb24uU2V0KHBvc2l0aW9uLngsIHBvc2l0aW9uLnkpO1xuICB2YXIgYm9keSA9IHdvcmxkLkNyZWF0ZUJvZHkoYm9keV9kZWYpO1xuICB2YXIgZml4X2RlZiA9IG5ldyBiMkZpeHR1cmVEZWYoKTtcbiAgZml4X2RlZi5zaGFwZSA9IG5ldyBiMlBvbHlnb25TaGFwZSgpO1xuICBmaXhfZGVmLmZyaWN0aW9uID0gMC41O1xuXG4gIHZhciBjb29yZHMgPSBuZXcgQXJyYXkoKTtcbiAgY29vcmRzLnB1c2gobmV3IGIyVmVjMigwLCAwKSk7XG4gIGNvb3Jkcy5wdXNoKG5ldyBiMlZlYzIoMCwgLWRpbS55KSk7XG4gIGNvb3Jkcy5wdXNoKG5ldyBiMlZlYzIoZGltLngsIC1kaW0ueSkpO1xuICBjb29yZHMucHVzaChuZXcgYjJWZWMyKGRpbS54LCAwKSk7XG5cbiAgdmFyIGNlbnRlciA9IG5ldyBiMlZlYzIoMCwgMCk7XG5cbiAgdmFyIG5ld2Nvb3JkcyA9IGN3X3JvdGF0ZUZsb29yVGlsZShjb29yZHMsIGNlbnRlciwgYW5nbGUpO1xuXG4gIGZpeF9kZWYuc2hhcGUuU2V0QXNBcnJheShuZXdjb29yZHMpO1xuXG4gIGJvZHkuQ3JlYXRlRml4dHVyZShmaXhfZGVmKTtcbiAgcmV0dXJuIGJvZHk7XG59XG5cbmZ1bmN0aW9uIGN3X3JvdGF0ZUZsb29yVGlsZShjb29yZHMsIGNlbnRlciwgYW5nbGUpIHtcbiAgcmV0dXJuIGNvb3Jkcy5tYXAoZnVuY3Rpb24oY29vcmQpe1xuICAgIHJldHVybiB7XG4gICAgICB4OiBNYXRoLmNvcyhhbmdsZSkgKiAoY29vcmQueCAtIGNlbnRlci54KSAtIE1hdGguc2luKGFuZ2xlKSAqIChjb29yZC55IC0gY2VudGVyLnkpICsgY2VudGVyLngsXG4gICAgICB5OiBNYXRoLnNpbihhbmdsZSkgKiAoY29vcmQueCAtIGNlbnRlci54KSArIE1hdGguY29zKGFuZ2xlKSAqIChjb29yZC55IC0gY2VudGVyLnkpICsgY2VudGVyLnksXG4gICAgfTtcbiAgfSk7XG59XG4iXX0=
