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
    achievs_parsed : Boolean,
});

var Games = mongoose.model("Game", GameSchema);

var GameDataSchema = new mongoose.Schema({
    gameName: String,
    gameVersion: Number,
    app_id: Number,
    achievements: [ { name: String, defaultvalue: Number, description: String, hidden: Number, icon: String, icongray: String}],
    hasAchievements: Boolean,
});

var GameData = mongoose.model("GameSchema", GameDataSchema);

var NonGameAppSchema = new mongoose.Schema({
    app_id: Number,
});

var NonGameApp = mongoose.model("NonGameApp", NonGameAppSchema);

//Lists all games and apps in steam and add new entries to DB
function RetrieveApiGameData()
{
    request("http://api.steampowered.com/ISteamApps/GetAppList/v0002/?key=" + apiKey + "&format=json", function(err, response)
    {
        if(!err)
        {
            var resp = JSON.parse(response.body);
            resp.applist.apps.forEach(app => 
            {
                //Check if entry exists in database
                Games.findOne({"app_id" : app.appid}, function(err, res)
                {
                    if(err || res == null)
                    {
                        //Create new entry if none was found matching the requested app id
                        var newObj = { name: app.name, app_id: app.appid, achievs_parsed: false };
                        Games.create(newObj, function(err, resp)
                        {
                            if(!err)
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

async function ParseSchemas(){
    //Get list of all games from DB
    Games.find(async function(err, res)
    {
        if(!err && res !== null)
        {
            //For each game in Games collection
            for(let i = 0; i < res.length; i+= 10)
            {
                //TODO: Optimize for parallel requests
                let promises = [];
                for(let n = 0; n < 10; n++)
                {
                    promises[n] = GetGameData(res[i + n]);
                }

                for (let n = 0; n < 10; n++) {
                    await promises[n];
                }
            }
        }
    });
}

async function GetGameData(model)
{
    //Check if GameDataSchema exists on database for that app id
    let dbResponse = null;

    //Search in non-game app list
    await NonGameApp.findOne({ "app_id": model.app_id }, function (err, res) {
        dbResponse = res;
        return;
    });

    //Search in game list if none were found
    if(dbResponse == null) await GameData.findOne({ "app_id": model.app_id }, function (err, res) {
        dbResponse = res;
        return;
    });

    if(dbResponse == null) await request("http://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=" + apiKey + "&appid=" + model.app_id, function (err, response) {
        if (!err && response != null) {
            try
            {
                let resp = JSON.parse(response.body).game;
                if (Object.keys(resp).length == 0)
                {
                    //console.log("Empty Object");
                    NonGameApp.create({ app_id : model.app_id});
                }
                else
                {
                    let newGameData = { gameName: resp.gameName, gameVersion: resp.gameVersion, app_id : model.app_id };
                    if (resp.availableGameStats != null && resp.availableGameStats.achievements != null) 
                    {
                        newGameData.achievements = resp.availableGameStats.achievements;
                        newGameData.hasAchievements = true;
                    }
                    else { newGameData.hasAchievements = false; }
                    GameData.create(newGameData);
                    console.log("New GameData entry created with id " + newGameData.app_id);
                }
            }
            catch(exception){
                //console.log("Error parsing game with id " + model.app_id);
            }
        }
    }).catch(function(err) { console.log(err)});
}

//RetrieveApiGameData();
ParseSchemas();