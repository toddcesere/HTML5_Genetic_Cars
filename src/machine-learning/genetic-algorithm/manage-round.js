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
