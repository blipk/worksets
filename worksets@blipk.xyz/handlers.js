/*
 * Worksets extension for Gnome 3
 * This file is part of the worksets extension for Gnome 3
 * Copyright 2019 Anthony D - blipk.xyz
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope this it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * 
 * Credits:
 * This extension was created by using the following gnome-shell extensions
 * as a source for code and/or a learning resource
 * - dash-to-panel@jderose9.github.com.v16.shell-extension
 * - clipboard-indicator@tudmotu.com
 * - workspaces-to-dock@passingthru67.gmail.com
 * - workspace-isolated-dash@n-yuki.v14.shell-extension
 * - historymanager-prefix-search@sustmidown.centrum.cz
 * - minimum-workspaces@philbot9.github.com.v9.shell-extension
 * 
 * Many thanks to those great extensions.
 */

//External imports
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Gettext = imports.gettext;

//Internal imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.utils;
const debug = Me.imports.devUtils;
const scopeName = "handlers";

// Simplify global signals and function injections handling
// Abstract class
var BasicHandler = new Lang.Class({
    Name: 'Worksets.BasicHandler',

    _init: function(){
        this._storage = new Object();
    },

    add: function(/*unlimited 3-long array arguments*/){

        // convert arguments object to array, concatenate with generic
        let args = Array.concat('generic', Array.slice(arguments));
        // call addWithLabel with ags as if they were passed arguments
        this.addWithLabel.apply(this, args);
    },

    destroy: function() {
        for( let label in this._storage )
            this.removeWithLabel(label);
    },

    addWithLabel: function( label /* plus unlimited 3-long array arguments*/) {

        if(this._storage[label] == undefined)
            this._storage[label] = new Array();

        // skip first element of the arguments
        for( let i = 1; i < arguments.length; i++ ) {
            let item = this._storage[label];
            let handlers = this._create(arguments[i]);

            for (let j = 0, l = handlers.length; j < l; ++j) {
                item.push(handlers[j]);
            }
        }

    },

    removeWithLabel: function(label){

        if(this._storage[label]) {
            for( let i = 0; i < this._storage[label].length; i++ ) {
                this._remove(this._storage[label][i]);
            }

            delete this._storage[label];
        }
    },

    /* Virtual methods to be implemented by subclass */
    // create single element to be stored in the storage structure
    _create: function(item){
      throw new Error('no implementation of _create in ' + this);
    },

    // correctly delete single element
    _remove: function(item){
      throw new Error('no implementation of _remove in ' + this);
    }
});

// Manage global signals
var GlobalSignalsHandler = new Lang.Class({
    Name: 'Worksets.GlobalSignalsHandler',
    Extends: BasicHandler,

    _create: function(item) {
        let handlers = [];

        item[1] = [].concat(item[1]);

        for (let i = 0, l = item[1].length; i < l; ++i) {
            let object = item[0];
            let event = item[1][i];
            let callback = item[2]
            let id = object.connect(event, callback);

            handlers.push([object, id]);
        }

        return handlers;
    },

    _remove: function(item){
       item[0].disconnect(item[1]);
    }
});

//Manage function injection: both instances and prototype can be overridden and restored
var InjectionsHandler = new Lang.Class({
    Name: 'Worksets.InjectionsHandler',
    Extends: BasicHandler,

    _create: function(item) {
        let object = item[0];
        let name = item[1];
        let injectedFunction = item[2];
        let original = object[name];
        
        object[name] = injectedFunction;
        return [[object, name, injectedFunction, original]];
    },

    _remove: function(item) {
        let object = item[0];
        let name = item[1];
        let original = item[3];
        object[name] = original;
    }
});

//Manage timeouts: the added timeouts have their id reset on completion
var TimeoutsHandler = new Lang.Class({
    Name: 'Worksets.TimeoutsHandler',
    Extends: BasicHandler,

    _create: function(item) {
        let name = item[0];
        let delay = item[1];
        let timeoutHandler = item[2];
        let reiterate = (typeof item[3] === 'boolean' ? item[3] : false);

        //debug.log(scopeName+arguments.callee.name, "Creating loop "+name+" delay="+delay+"ms reiterate="+reiterate);
        //this[name] = 0; this._remove(item);
        if (reiterate === false) {this._remove(item);}
        
        this[name] = Mainloop.timeout_add(delay, () => {
            timeoutHandler();
            //debug.log(scopeName+arguments.callee.name, "Loop ("+name+") has completed with handler function ("+timeoutHandler.constructor.constructor.name.toString()+") after delay="+delay+"ms & reiterate="+reiterate);
            if (reiterate === false) {this[name] = 0;}
            return reiterate;
        });

        return [[name]];
    },

    remove: function(name) {
        this._remove([name])
    },

    _remove: function(item) {
        //debug.log(scopeName+arguments.callee.name, " removing loop "+item[0]+"..");
        let name = item[0];

        if (this[name]) {
            Mainloop.source_remove(this[name]);
            this[name] = 0;
            //debug.log(scopeName+arguments.callee.name, " loop has been removed", item[0]);
        }
    },
    getId: function(name) {
        return this[name] ? this[name] : 0;
    }
});