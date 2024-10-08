
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

  if (myCar.is_all_time_best) {
    ctx.strokeStyle = "#00FF00";
    ctx.fillStyle = "#00AA00";
  } else if (myCar.is_elite) {
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
