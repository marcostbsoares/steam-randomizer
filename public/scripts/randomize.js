var randomPhrases = [
    "Spinning the Wheel of Fish",
    "Choosing your destiny",
    "Determining your fate",
    "Deciding your future",
    "Calculating optimal fun factor",
    "Selecting a special surprise",
    "Picking a perfect passtime",
]

var isRolling = true;
$("#reroll-btn").css("display", "none");
$("#achiev-card").hide(1);

setTimeout(function()
{
    var storedGameName = $("#gameName").text();
    var randomPhrase = randomPhrases[Math.floor(Math.random() * randomPhrases.length)];
    
    $("#gameName").text(randomPhrase + "...");
    $("#gameName").addClass("show");

    setTimeout(function () 
    {
        $("#gameName").removeClass("show");
        setTimeout(function () 
        {
            $("#gameName").text(storedGameName);
            $("#gameName").addClass("show");
            $("#reroll-btn").show("slow");
            $("#achiev-card").slideToggle("slow");
            isRolling = false;
        }, 1500);

    }, 2000);

}, 1000);

$("#reroll-btn").click(reRoll);

function reRoll()
{
    window.location.reload(true);
}