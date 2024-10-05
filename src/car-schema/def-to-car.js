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
      car_def.wheel_density[i]
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

function createWheel(world, radius, density) {
  var body_def = new b2BodyDef();
  body_def.type = b2Body.b2_dynamicBody;
  body_def.position.Set(0, 0);

  var body = world.CreateBody(body_def);

  var fix_def = new b2FixtureDef();
  fix_def.shape = new b2CircleShape(radius);
  fix_def.density = density;
  fix_def.friction = 1;
  fix_def.restitution = 0.2;
  fix_def.filter.groupIndex = -1;

  body.CreateFixture(fix_def);
  return body;
}
