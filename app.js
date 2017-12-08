
//////////////////////
// REQUIRED LIBRARIES
//////////////////////
var express = require("express")
,   bodyParser = require("body-parser")
,   request = require("request-promise")
,   fs = require("fs")
,   xmljs = require("xml-js");

var namesDB = JSON.parse(fs.readFileSync("private/steamdb.json", { encoding: "utf-8"}));

///////////////////////
// INITIALIZE SETTINGS AND VARIABLES
///////////////////////
var app = express();
app.set("view engine", "ejs");
app.use(bodyParser({ extended: true}));
app.use(express.static("public"));

var apiKey = "A7D0B730D9B110FE11D87D6BD2975589";
///////////////////////
// DATABASE CONNECTION
///////////////////////



//////////
// ROUTES
//////////

app.get("/", function(req, res){
    res.render("home")
})

app.get("/randomize", getRandomize);


////////////////
// START SERVER
////////////////
app.listen(3000, function(){
    console.log("Steam Randomizer is UP and RUNNING!")
});

///////////////
// UTILITIES
///////////////

var utils = {

    ignoreWords: [" beta", " test", " obsolete", " trial", " demo", " free"],
    
    validateName: function(name){
        name = name.toLowerCase();
        this.ignoreWords.forEach(function(word){
            if(name.includes(word))
                return false;
        });

        return true;
    },
};

///////////////////////////
///Randomize Page Functions
///////////////////////////
function getRandomize(req, res){
    getRandomizeAsync(req,res);
}

async function getRandomizeAsync(req, res)
{
    if (req.query.id === undefined) {
        res.send("Empty queries not allowed.")
        return;
    }

    let maxPlaytime = 0;

    //Default max playtime to zero if not specified
    if(req.query.min === undefined || req.query.min == ""){
        maxPlaytime = 0;
    }
    else{
        maxPlaytime = Math.max([0, Number(req.query.min)]);
    }

    //Extract id from query
    let userID = req.query.id;

    try
    {
        userID = await validateID(userID);
        if(userID !== null)
        {
            //Obtain game list
            let gameList = await requestGamesList(userID, maxPlaytime);

            //Randomize a game from the list
            let game = gameList[Math.floor(Math.random() * gameList.length)];
            let achievStats = await getAchievData(game.appID, userID);

            res.render("randomize", { data: gameList });    
        }
        else
        {
            res.send("<h1>Invalid ID or URL. Please check your input and try again</h1>");
        }
    }
    catch(err)
    {
        res.send("<h1>Error<h1><br>" + err);
    }
}

//Extracts a SteamID64 from a string containing the ID or custom URL in any format
async function validateID(userID) {

    //Is URL with ID64 in it
    var id64UrlPattern = /^\S*steamcommunity.com?\/profiles\/(\d{16,18})\/?.*$/;
    if(id64UrlPattern.test(userID))
        return id64UrlPattern.exec(userID)["1"];

    //Is id64?
    var id64Pattern = /^\d{ 16, 18}$/;
    if (id64Pattern.test(userID))
        return userID;

    //Probably is custom URL. Try fetching data from xml
    //Is full URL? Extract username from it. If not, assume it's already the username by itself.
    var parsedURL = userID;
    var fullUrlPattern = /^\S+\/steamcommunity.com\/id\/([^\/]+)\/?\S*/;
    if (fullUrlPattern.test(userID)) {
        var results = fullUrlPattern.exec(userID);
        parsedURL = results["1"];
    }

    var xmlProfile = {};

    //Try requesting profile in XML format
    try{
        let finalID = await getIdFromURL(parsedURL);
        return finalID;
    }
    catch(err){
        return null;
    }

    return null;
}

//Obtains a SteamID64 from a custom URL xml, returns null if unable to obtain
async function getIdFromURL(parsedURL){
    
    var finalURL;
    try{
    await request("http://steamcommunity.com/id/" + parsedURL + "/?xml=1", function (err, response, body) {
        if (!err && response.statusCode == 200) 
        {
            xmlProfile = xmljs.xml2js(body, { compact: true});
            try{
                finalURL = xmlProfile.profile.steamID64._text;
                return finalURL;
            }
            catch(err){
                finalURL = null;
                return null;
            }
        }
        else {
            finalURL = null;
            return null;
        }
    });
    }
    catch(err){
        finalURL = null;
        return null;
    }

    return finalURL;
    
}

async function requestGamesList(finalID, maxPlaytime){
    let gamesList = [];
    await(request("http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=" + apiKey + "&steamid=" + finalID + "&format=json", function (error, code, body) 
    {
        if (error) 
        {
            console.log("Error on requesting games list from API");
            return null;
        }  
        try 
        {
            data = JSON.parse(body);

            data.response.games.forEach(function (game)
             {
                if (game.playtime_forever > maxPlaytime)
                {
                    return;
                }

                let id = String(game.appid);

                if (namesDB.data[id] !== undefined) 
                {
                    let name = namesDB.data[id];
                    if (utils.validateName(name)) 
                    {
                        let newGame = { name: name, appID: id}
                        gamesList.push(newGame);
                    }
                }
            });
        }
        catch(err)
        {
            return null;
        }
        return gamesList;
    }));

    //gamesList.sort();
    return gamesList;
}

//Obtains Global Achievement Data, User Stats and Game Schema from Steam API
async function getAchievData(appID, userID)
{
    let fullAchievData = {
        globalAchievData: {},
        userAchievData: {},
        gameSchema: {},
    }

    fullAchievData.globalAchievData = await getGlobalAchievementDataAsync(appID);
    fullAchievData.userAchievData = await getUserAchievementDataAsync(appID, userID);
    fullAchievData.gameSchema = await getGameSchema(appID);

    return fullAchievData;
}

async function getGlobalAchievementDataAsync(appID){

    let achievData = {};
    let achievObject = [];

    await request("http://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=" + appID + "&format=json", function(err, response, body){
        if(!err && response.statusCode == 200)
        {
            achievData = JSON.parse(body);
        }
        else{
            achievData = null;
        }
    });

    //Separates achievements into tiers based on percentage of all users completed
    if(achievData != null)
    {
        achievData.achievementpercentages.achievements.forEach(function(achievement){
            let newAchiev = { tier: "", name: achievement.name};

            if(achievement.percent <= 5)
                newAchiev.tier = "expert";
            else if (achievement.percent <= 15)
                newAchiev.tier = "hard";
            else if (achievement.percent <= 30)
                newAchiev.tier = "medium";
            else
                newAchiev.tier = "easy";
            
            achievObject.push(newAchiev);
        });
    }

    return achievObject;
}

async function getUserAchievementDataAsync(appID, userID){
    let userStats = {};
    await request("http://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v0002/?appid=" + appID + "&key=" + apiKey + "&steamid=" + userID, function(error, response, body){
        if (!error && response.statusCode == 200)
            userStats = JSON.parse(body);
    });
}

async function getGameSchema(appID){
    let gameSchema = {};
    await request("http://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=" + apiKey + "&appid=" + appID, function(error, response, body){
        if(!error && response.statusCode == 200)
        {
            gameSchema = JSON.parse(body);
        }
    });
    return gameSchema;
}
