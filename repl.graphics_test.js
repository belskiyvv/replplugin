define(function(require, exports, module) {
    main.consumes = ["plugin.test", "repl.graphics"];
    main.provides = [];
    return main;

    function main(options, imports, register) {
        var test = imports["plugin.test"];
        var replGraph = imports["repl.graphics"];

        var describe = test.describe;
        var it = test.it;
        var assert = test.assert;

        describe(replGraph.name, function(){
            
        });

        register(null, {});
    }
});