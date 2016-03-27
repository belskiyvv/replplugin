define(function(require, exports, module) {
    main.consumes = ["Plugin", "commands", "tabManager", 'Dialog', 'Form', 'settings', 'fs', 'info'];
    main.provides = ["repl"];
    return main;

    function main(options, imports, register) {
        console.log(options);
        
        var Plugin = imports.Plugin,
            commands = imports.commands,
            tabs = imports.tabManager,
            Dialog = imports.Dialog,
            Form = imports.Form,
            settings = imports.settings,
            fs = imports.fs,
            info = imports.info,
            replTab,
            replTabs = {},
            execs = {},
            userSettings = [],
            mainExecs = {};


        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);

        function load() {
            var parsedReplTabs = settings.get('state/replPlugin/replTabs'),
                parsedActiveReplTab = settings.get('state/replPlugin/activeReplTab'),
                openedTabs = tabs.getTabs(),
                tabEntity;

            execs = settings.get('state/replPlugin/execs') || {};
            userSettings = settings.get('user/repl/@repls');

            if (parsedReplTabs && typeof parsedReplTabs === 'object') {
                for (var type in parsedReplTabs) {
                    replTabs[type] = {};
                    for (var id in parsedReplTabs[type]) {
                        tabEntity = openedTabs.filter(function(tab) {
                            return tab.name === parsedReplTabs[type][id].name;
                        })[0];

                        if (tabEntity) {
                            replTabs[type][id] = parsedReplTabs[type][id];
                            replTabs[type][id].entity = tabEntity;

                            addHandlers(replTabs[type][id].entity, type, id);
                        }
                    }
                }
            }

            if (parsedActiveReplTab && typeof parsedActiveReplTab === 'object') {
                replTab = replTabs[parsedActiveReplTab.type][parsedActiveReplTab.id];
            }

            settings.on('write', function() {
                var parsedActiveReplTab = replTab && {
                    name: replTab.name,
                    type: replTab.type,
                    id: replTab.id,
                    htmlDir: replTab.htmlDir
                };

                settings.set('state/replPlugin/replTabs', parseReplTabsForSave(replTabs));
                settings.set('state/replPlugin/activeReplTab', parsedActiveReplTab);
                settings.set('state/replPlugin/execs', execs);
            });

            if (Object.prototype.toString.call(userSettings) === '[object Array]') {
                userSettings.forEach(function(item) {
                    item.regexp = new RegExp('^' + item.extensions.replace(/[-[\]{}()+?.,\\^$|#\s]/g, "\\$&").replace(/\*/, '.*') + '$');

                    mainExecs[item.id] = item.exec;
                });


            }
        }
        
         commands.addCommand({
            name: "repl_run",
            bindKey: {
                mac: "Command-Enter",
                win: "Ctrl-Enter"
            },
            exec: function(editor) {
                function runText() {
                    var terminal = replTab.entity.editor,
                        text = getText(editor);

                    replTab.entity.activate();
                    terminal.write(text + " \n");
                }

                findRepl(editor, editor.activeDocument.tab.path, function(state, config) {
                    switch (state) {
                        case 'found':
                            replTab = config.replTab;
                            runText();
                            break;
                        case 'created':
                            runText();
                            break;
                        case 'notfound':
                            commands.exec('repl_show_config');
                            break;
                    }
                });
            },
            isAvailable: function(editor) {
                return !!editor.ace;
            }
        }, plugin);

        commands.addCommand({
            name: "repl_show_config",
            bindKey: {
                mac: "Command-Alt-Enter",
                win: "Ctrl-Alt-Enter"
            },
            exec: function(editor) {
                function runText() {
                    var terminal = replTab.entity.editor,
                        text = getText(editor);

                    replTab.entity.activate();
                    terminal.write(text + " \n");
                }


                showConfigDialog(editor, runText);

            },
            isAvailable: function(editor) {
                return !!editor.ace;
            }
        }, plugin);


        /***** Methods *****/
        
        function getText(editor) {
            var text = editor.ace.getSelectedText();

            if (!text) {
                var row = editor.ace.selection.getRange().start.row,
                    currentLine = editor.ace.selection.doc.getLine(row);

                text = currentLine;
            }

            return text;
        }


        function createNewReplTab(editor, type, firstCommand, htmlDir, callback) {
            var pane = tabs.findPane('pane1');

            type = type.toLowerCase();

            replTabs[type] = replTabs[type] || {};

            var ids = Object.keys(replTabs[type]);

            var id = ids.length ? 1 + (+ids[ids.length - 1]) : 1;

            // watchToDirectory(htmlDir);
            var pane = editor.pane.vsplit(true);

            tabs.open({
                    editorType: 'terminal',
                    pane: pane,
                    active: true
                }
                /*)
                            tabs.openEditor('terminal', true*/
                ,
                function(err, currentTab) {
                    if (err) throw err;

                    var newTab = {
                        path: firstCommand,
                        entity: currentTab,
                        type: type,
                        id: id,
                        name: currentTab.name,
                        htmlDir: htmlDir
                    };

                    replTabs[type][id] = newTab;

                    replTab = newTab;

                    settings.save();

                    addHandlers(currentTab, type, id);

                    firstCommand = firstCommand.replace(/\$replid/, type + id);
                    firstCommand = firstCommand.replace(/\$user/, info.getUser().name);

                    var terminal = currentTab.editor;
                    terminal.write(firstCommand + " \n");

                    callback();
                });
        }

        function showConfigDialog(editor, callback) {
            var configDialog = new Dialog("", main.consumes, {
                name: 'repl-config-dialog',
                title: 'REPL Configuration',
                allowClose: true,
                elements: [{
                    type: "button",
                    id: "ok",
                    color: "green",
                    caption: "OK",
                    "default": true,
                    onclick: function() {
                        var form = configForm.toJson();

                        commands.bindKey({
                            win: form.hotkey,
                            mac: form.hotkey
                        }, commands.commands['repl_run']);


                        commands.bindKey({
                            win: form.altHotkey,
                            mac: form.altHotkey
                        }, commands.commands['repl_show_config']);

                        if (form.replTab === 'new') {
                            showCreateDialog(editor, callback);

                            // createNewReplTab('matlab', callback);
                        }
                        else {
                            var selectedValue = dropdownValues[form.replTab].value;
                            replTab = replTabs[selectedValue.type][selectedValue.id];
                            callback();
                        }

                        configDialog.hide();
                    }
                }]
            });

            var configForm,
                dropdownValues;

            configDialog.on('draw', function(element) {
                configForm = new Form({});

                dropdownValues = [];

                for (var type in replTabs) {
                    for (var id in replTabs[type]) {
                        dropdownValues.push({
                            caption: type + ' ' + id,
                            value: {
                                type: type,
                                id: id
                            }
                        });
                    }
                }

                configForm.add([{
                    name: 'hotkey',
                    title: 'Hotkey 1',
                    type: 'textbox',
                    defaultValue: commands.commands['repl_run'].bindKey.win
                }, {
                    name: 'altHotkey',
                    title: 'Hotkey 2',
                    type: 'textbox',
                    defaultValue: commands.commands['repl_show_config'].bindKey.win
                }, {
                    name: 'replTab',
                    title: 'Select a repl window',
                    type: 'dropdown',
                    defaultValue: 'new',
                    items: dropdownValues.map(function(value, index) {
                        return {
                            caption: value.caption,
                            value: index
                        };
                    }).concat([{
                        caption: 'Create New',
                        value: 'new'
                    }])
                }]);

                configForm.attachTo(element.html);
            });

            configDialog.on('show', function() {
                configForm.reset();
            });


            configDialog.show();
        }

        function showCreateDialog(editor, callback) {
            var dialog = new Dialog("", main.consumes, {
                name: 'repl-create-dialog',
                title: 'New repl window configuration',
                allowClose: true,
                elements: [{
                    type: "button",
                    id: "ok",
                    color: "green",
                    caption: "OK",
                    "default": true,
                    onclick: function() {
                        var entered = form.toJson();

                        createNewReplTab(editor, entered.replId, entered.exec || entered.replId, entered.htmlDir, callback);
                        form.getElement('replId').childNodes[1].off('keyup', addDefaultPath);

                        if (!mainExecs[entered.replId]) {
                            execs[entered.replId] = entered.exec;
                        }

                        dialog.hide();
                    }
                }]
            });

            var form;
            dialog.on('draw', function(element) {
                var defaultId = 'matlab';
                form = new Form({});

                form.add([{
                    name: 'replId',
                    title: 'REPL id',
                    type: 'textbox',
                    defaultValue: defaultId
                }, {
                    name: 'exec',
                    title: 'Exec',
                    type: 'textbox',
                    defaultValue: mainExecs[defaultId] || execs[defaultId] || ''
                }, {
                    name: 'htmlDir',
                    title: 'HTML directory',
                    type: 'textbox',
                    defaultValue: ''
                }]);

                form.attachTo(element.html);

                form.getElement('replId').childNodes[1].on('keyup', addDefaultPath);
            });

            function addDefaultPath() {
                var inputValue = form.getElement('replId').childNodes[1].getValue(),
                    execValue = mainExecs[inputValue] || execs[inputValue];

                if (inputValue && execValue) {
                    form.getElement('exec').childNodes[1].setValue(execValue);
                }
            }

            dialog.on('show', function() {
                form.reset();
            });


            dialog.show();
        }

        function parseReplTabsForSave(replTabs) {
            var parsed = {};

            replTabsForEach(replTabs, function(tab, type, id) {
                parsed[type] = parsed[type] || {};
                parsed[type][id] = {
                    name: tab.name,
                    type: tab.type,
                    id: tab.id,
                    htmlDir: tab.htmlDir
                };
            });

            return parsed;
        }

        function replTabsForEach(tabs, callback) {
            for (var type in tabs) {
                for (var id in tabs[type]) {
                    callback(tabs[type][id], type, id);
                }
            }
        }

        function addHandlers(tab, type, id) {
            tab.on('close', function() {

                if (replTabs && replTabs[type] && replTabs[type][id]) {
                    fs.unwatch(replTabs[type][id].htmlDir, function() {});
                }

                for (var i in replTabs[type]) {
                    if (replTabs[type][i].id == id) {
                        delete replTabs[type][i];

                        if (replTab && replTab.type == type && replTab.id == id) {
                            replTab = null;
                        }

                        settings.save();

                        break;
                    }
                }
            });

            tab.document.on('setTitle', function(e) {
                var title = type + ' ' + id;

                if (e.title === title) {
                    return;
                }

                tab.document.title = title;
            });

            tab.on('afterReparent', function() {
                bindShortcuts();
            })


            function bindShortcuts() {
                tab.activate();
                if (tab.editor && tab.editor.ace && tab.editor.ace.commands) {
                    tab.editor.ace.commands.addCommand({
                        name: 'pasteTerminal',
                        bindKey: commands.commands.paste.bindKey,
                        exec: commands.commands.paste.exec,
                        isAvailable: function(editor) {
                            return editor && editor.type == 'terminal';
                        }
                    });
                    tab.editor.ace.commands.addCommand({
                        name: 'copyTerminal',
                        bindKey: commands.commands.copy.bindKey,
                        exec: commands.commands.copy.exec,
                        isAvailable: function(editor) {
                            return editor && editor.type == 'terminal';
                        }
                    });
                    tab.editor.ace.commands.addCommand({
                        name: 'cutTerminal',
                        bindKey: commands.commands.cut.bindKey,
                        exec: commands.commands.cut.exec,
                        isAvailable: function(editor) {
                            return editor && editor.type == 'terminal';
                        }
                    });
                }
            }

            bindShortcuts();


            if (replTabs && replTabs[type] && replTabs[type][id]) {
                watchToDirectory(replTabs[type][id].htmlDir);
            }
        }

        function createBrowserTab(filepath) {
            tabs.open({
                editorType: "repl.graphics",
                active: true,
                name: 'repl' + filepath,
                document: {
                    'repl.graphics': {
                        path: filepath
                    }
                }
            }, function(err, tab) {
                if (err) throw err;

                tab.classList.add('loading');
            });
        }

        function findRepl(editor, filepath, callback) {
            if (!userSettings) {
                return false;
            }

            var filename = filepath.split('/');
            filename = filename[filename.length - 1];

            for (var i = 0; i < userSettings.length; i++) {
                if (filename.match(userSettings[i].regexp)) {

                    if (replTab && replTab.type === userSettings[i].id) {
                        callback('found', {
                            replTab: replTab
                        });
                        return replTab;
                    }

                    if (replTabs[userSettings[i].id]) {
                        for (var id in replTabs[userSettings[i].id]) {
                            callback('found', {
                                replTab: replTabs[userSettings[i].id][id]
                            });
                            return replTabs[userSettings[i].id][id]
                        }
                    }

                    return createNewReplTab(editor, userSettings[i].id, userSettings[i].exec || userSettings[i].id, userSettings[i].htmlDir, function() {
                        callback('created', {
                            'arguments': arguments
                        });
                    });
                }
            }

            callback('notfound', {});
        }

        function watchToDirectory(directoryPath) {
            if (!directoryPath) {
                return;
            }

            fs.stat(directoryPath, function(err) {
                if (err) {
                    return;
                }

                fs.watch(directoryPath, function(err, event, filename) {
                    if (err) throw err;
                    var filePath;

                    switch (event) {
                        case 'init':
                            break;
                        case 'directory':
                            if (filename.match(/\.html$/)) {

                                filePath = directoryPath + '/' + filename;

                                fs.stat(filePath, function(err) {
                                    if (!err && !tabs.findTab('repl' + filePath)) {
                                        createBrowserTab(filePath);
                                    }
                                })

                            }
                            break;
                    }
                });
            });
        }

        /***** Lifecycle *****/

        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {});

        /***** Register and define API *****/

        plugin.freezePublicAPI({

        });

        register(null, {
            "repl": plugin
        });
    }
});