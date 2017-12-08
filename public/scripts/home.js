$(".hint").popover();

$(".hint").click(function(){
    $(this).popover();
})

$("#gauntlet_title").click(toggleAchievDiv);
$("#gauntlet_div").hide(1);

function toggleAchievDiv(){
    $("#gauntlet_div").slideToggle(500, function(obj){
        $("#gauntlet_title svg").toggleClass("flip_vertical")
    });
}