define(function(require, exports, module) {
    main.consumes = ["Editor", "editors", "ui", "settings", "layout", "fs", 'commands', 'vfs'];
    main.provides = ["repl.graphics"];
    return main;

    function main(options, imports, register) {
        var Editor = imports.Editor;
        var editors = imports.editors;
        var settings = imports.settings;
        var layout = imports.layout;
        var ui = imports.ui;
        var fs = imports.fs;
        var commands = imports.commands;
        var vfs = imports.vfs;
        var currentSession;

        var basename = require("path").basename;

        // Set extensions if any for your editor
        var extensions = [];

        // Register the editor
        var handle = editors.register("repl.graphics", "repl.graphics", Graphics, extensions);

        commands.addCommand({
            name: 'repl.graphics',
            exec: function() {
                console.log('fdgsdgfsdgf');
            }
        }, handle);

        function Graphics() {
            var plugin = new Editor("", main.consumes, extensions);

            var container, contents;
            var currentSession, currentDocument;

            plugin.on("draw", function(e) {
                container = e.htmlNode;

                ui.insertHtml(container, '', plugin);
            });

            plugin.on("documentLoad", function(e) {
                var doc = e.doc;
                var session = doc.getSession();
                var tab = doc.tab;
                var path = session.path = e.state.path || session.path;
                var editor = e.editor;

                if (currentSession && currentSession.iframe) {
                    currentSession.iframe.style.display = "none";
                }

                currentSession = session;


                if (session.iframe) {
                    tab.classList.add('loading');
                    session.editor = editor;
                    container.appendChild(session.iframe);
                    return;
                }

                var pathArray = path.split('/');


                doc.title = pathArray[pathArray.length - 1];
                tab.classList.add("loading");


                var iframe = session.iframe = document.createElement('iframe');
                iframe.style.width = "100%";
                iframe.style.height = "100%";
                iframe.style.border = 0;
                iframe.style.backgroundColor = "rgba(255, 255, 255, 0.88)";


                fs.watch(path, function(err, event) {
                    if (err) throw err;

                    switch (event) {
                        case 'init':
                            break;
                        case 'change':
                            //refresh iframe
                            tab.classList.add("loading");
                            var tmp_src = iframe.src;
                            iframe.src = '';
                            iframe.src = tmp_src;
                            break;
                    }
                });

                iframe.src = vfs.url(path);

                iframe.addEventListener("load", function() {
                    tab.classList.remove("loading");
                });



                container.appendChild(session.iframe);

                // Define a way to update the state for the session
                session.update = function() {};

            });
            
            plugin.on("documentActivate", function(e) {
                if (currentSession) {
                    currentSession.iframe.style.display = "none";
                }

                currentSession = e.doc.getSession();
                currentSession.iframe.style.display = "block";
            });
            
            plugin.on("documentUnload", function(e) {
                var doc = e.doc;
                var session = doc.getSession();

                session.iframe.remove();
            });

            plugin.on("getState", function(e) {
                var session = e.doc.getSession();

                e.state.path = session.path;
            });
            
            plugin.on("setState", function(e) {
                var session = e.doc.getSession();

                if (e.state.path) {
                    session.path = e.state.path;
                }
            });


            plugin.freezePublicAPI({

            });

            plugin.load(null, "repl.graphics");

            return plugin;
        }

        register(null, {
            "repl.graphics": handle
        });
    }
});
