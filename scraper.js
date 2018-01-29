var express = require("express")
    , bodyParser = require("body-parser")
    , request = require("request-promise")
    , fs = require("fs")
    , xmljs = require("xml-js")
    , mongoose = require("mongoose");

///////////////////////
// INITIALIZE SETTINGS AND VARIABLES
///////////////////////

var config = JSON.parse(fs.readFileSync("config.json"));
var apiKey = config.apiKey;

//Connect to DataBase
mongoose.connect(config.dbConnection);


//Create Schemas and Models
var GameSchema = new mongoose.Schema({
    name: String,
    app_id: Number,
    achievs_parsed: Boolean,
});

var Games = mongoose.model("Game", GameSchema);

var GameDataSchema = new mongoose.Schema({
    gameName: String,
    gameVersion: Number,
    app_id: Number,
    achievements: [{ name: String, defaultvalue: Number, description: String, hidden: Number, icon: String, icongray: String, achievementDifficulty: String, percentCompleted: Number }],
    hasAchievements: Boolean,
});

var GameData = mongoose.model("GameSchema", GameDataSchema);

var NonGameAppSchema = new mongoose.Schema({
    app_id: Number,
});

var NonGameApp = mongoose.model("NonGameApp", NonGameAppSchema);

//Lists all games and apps in steam and add new entries to DB
function retrieveApiGameData() {
    request("http://api.steampowered.com/ISteamApps/GetAppList/v0002/?key=" + apiKey + "&format=json", function (err, response) {
        if (!err) {
            var resp = JSON.parse(response.body);
            resp.applist.apps.forEach(app => {
                //Check if entry exists in database
                Games.findOne({ "app_id": app.appid }, function (err, res) {
                    if (err || res == null) {
                        //Create new entry if none was found matching the requested app id
                        var newObj = { name: app.name, app_id: app.appid, achievs_parsed: false };
                        Games.create(newObj, function (err, resp) {
                            if (!err)
                                console.log("Object Created!" + resp);
                            else
                                console.log(err);
                        });
                    }
                });
            })
        }
    })
}

async function parseSchemas() {
    //Get list of all games from DB
    Games.find(async function (err, res) {
        if (!err && res !== null) {
            //For each game in Games collection
            for (let i = res.length; i >= 0; i -= 10) {
                let promises = [];
                for (let n = 0; n < 10; n++) {
                    //Start batch of simultaneous requests
                    promises[n] = getGameData(res[i + n]);
                }

                //Await for batch to finish before starting a new one
                for (let n = 0; n < 10; n++) {
                    await promises[n];
                }
            }
        }
    });
}

async function getGameData(model) {
    //Check if GameDataSchema exists on database for that app id
    let dbResponse = null;

    //Search in non-game app list
    await NonGameApp.findOne({ "app_id": model.app_id }, function (err, res) {
        dbResponse = res;
        return;
    });

    //Search in game list if none were found
    if (dbResponse == null) await GameData.findOne({ "app_id": model.app_id }, function (err, res) {
        dbResponse = res;
        return;
    });

    //Request game schema information from Steam API
    if (dbResponse == null) await request("http://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=" + apiKey + "&appid=" + model.app_id, function (err, response) {
        if (!err && response != null) {
            try {
                let resp = JSON.parse(response.body).game;
                //If object does not contain game data, store in NonGameApp DB
                if (Object.keys(resp).length == 0) {
                    NonGameApp.create({ app_id: model.app_id });
                }
                else {
                    //Create new GameData DB Entry for a new game

                    let newGameData = { gameName: resp.gameName, gameVersion: resp.gameVersion, app_id: model.app_id };
                    if (resp.availableGameStats != null && resp.availableGameStats.achievements != null) {
                        newGameData.achievements = resp.availableGameStats.achievements;
                        newGameData.hasAchievements = true;
                    }
                    else { newGameData.hasAchievements = false; }
                    GameData.create(newGameData);
                    console.log("New GameData entry created with id " + newGameData.app_id);
                }
            }
            catch (exception) {

            }
        }
    }).catch(function (err) { console.log(err) });
}

//Obtain Achievement percentages from API and update existing achievements to reflect that
async function retrieveAchievementPercentages() {

    let cursor = GameData.find({ "hasAchievements": true }).cursor();
    let finished = false;

    while(!finished)
    {
        var doc = null;
        await cursor.next(function(err, obj)
        {
            if(!err)
            {
                doc = obj;
                if(obj == null)
                {
                    finished = true;
                }
            }
        });

        if(finished)
            break;

        let apiResult = null;
        await request("http://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=" + doc.app_id, function (error, response) {
            if (!error)
                apiResult = JSON.parse(response.body);
            else
                console.log(error);
        }).catch(function(error)
        { 
            console.log("Error parsing APP with ID " + doc.app_id + " / " + doc.gameName);
            console.log(error); 
        });

        if(apiResult == null || apiResult.achievementpercentages == undefined)
            continue;

        let newAchievArray = [];
        
        doc.achievements.forEach(achiev => {
            let resultAchiev = apiResult.achievementpercentages.achievements.find( el => {return el.name == achiev.name});
            if(resultAchiev == undefined)
                return;

            let percent = resultAchiev.percent.toFixed(2);
            let difficulty = (percent <= 5) ? "EXPERT" : (percent <= 15) ? "HARD" : (percent <= 30) ? "NORMAL" : "EASY";
            let updatedAchievData = 
            {
                name: achiev.name, 
                defaultvalue: achiev.defaultvalue, 
                description: achiev.description, 
                hidden: achiev.hidden, 
                icon: achiev.icon, 
                icongray: achiev.icongray, 
                achievementDifficulty: difficulty,
                percentCompleted: percent,

            };
            newAchievArray.push(updatedAchievData);
        });

        GameData.findByIdAndUpdate(doc._id, { achievements: newAchievArray}, function(err, res){
            if(doc != null)
                console.log("Game achievs parsed for " + doc.gameName);
            else
                console.log("WHAT THE FUCK");
        });
    };
    console.log("FINISHED");
}

//RetrieveApiGameData();
//ParseSchemas();
retrieveAchievementPercentages();
