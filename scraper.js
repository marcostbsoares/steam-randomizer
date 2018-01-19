var express = require("express")
    , bodyParser = require("body-parser")
    , request = require("request-promise")
    , fs = require("fs")
    , xmljs = require("xml-js")
    , mongoose = require("mongoose");

///////////////////////
// INITIALIZE SETTINGS AND VARIABLES
///////////////////////

var apiKey = "A7D0B730D9B110FE11D87D6BD2975589";


//Connect to DataBase
mongoose.connect("mongodb://localhost/steam_rand");


//Create Schemas and Models
var GameSchema = new mongoose.Schema({
    name: String,
    app_id: Number,
    achievs_parsed : Boolean,
});

var Games = mongoose.model("Game", GameSchema);

var GameSchemaSchema = new mongoose.Schema({
    gameName: String,
    gameVersion: Number,
    app_id: Number,
    availableGameStats: 
     {
        achievements: [ { name: String, defaultvalue: Number, description: String, hidden: Number, icon: String, icongray: String}]
     },
});


//Retrieve API data and add new entries to DB
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

function ParseSchemas(){
    
}

RetrieveApiGameData();
ParseSchemas();