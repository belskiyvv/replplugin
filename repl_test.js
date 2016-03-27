define(function(require, exports, module) {
    main.consumes = ["plugin.test", "repl"];
    main.provides = [];
    return main;

    function main(options, imports, register) {
        var test = imports["plugin.test"];
        var repl = imports["repl"];

        var describe = test.describe;
        var it = test.it;
        var assert = test.assert;

        describe(repl.name, function(){
        });

        register(null, {});
    }
});