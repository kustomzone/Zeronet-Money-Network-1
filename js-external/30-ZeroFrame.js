// from ZeroNet site development tutorial #1
// https://zeronet.readthedocs.io/en/latest/site_development/zeroframe_api_reference/
// http://127.0.0.1:43110/Blog.ZeroNetwork.bit/?Post:43:ZeroNet+site+development+tutorial+1
// http://127.0.0.1:43110/Blog.ZeroNetwork.bit/data/files/ZeroFrame.coffee

var ZeroFrame,
    bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    slice = [].slice;

ZeroFrame = (function() {
    function ZeroFrame(url) {
        this.onCloseWebsocket = bind(this.onCloseWebsocket, this);
        this.onOpenWebsocket = bind(this.onOpenWebsocket, this);
        this.route = bind(this.route, this);
        this.onMessage = bind(this.onMessage, this);
        this.url = url;
        this.waiting_cb = {};
        this.wrapper_nonce = document.location.href.replace(/.*wrapper_nonce=([A-Za-z0-9]+).*/, "$1");
        this.connect();
        this.next_message_id = 1;
        this.event_callbacks = [] ;
        this.init();
    }

    ZeroFrame.prototype.init = function() {
        return this;
    };

    ZeroFrame.prototype.connect = function() {
        this.target = window.parent;
        window.addEventListener("message", this.onMessage, false);
        this.cmd("innerReady");
    };

    ZeroFrame.prototype.onMessage = function(e) {
        var cmd, message;
        message = e.data;
        cmd = message.cmd;
        if (cmd === "response") {
            if (this.waiting_cb[message.to] != null) {
                this.waiting_cb[message.to](message.result);
            } else {
                this.log("Websocket callback not found:", message);
            }
        } else if (cmd === "wrapperReady") {
            this.cmd("innerReady");
        } else if (cmd === "ping") {
            this.response(message.id, "pong");
        } else if (cmd === "wrapperOpenedWebsocket") {
            this.onOpenWebsocket();
        } else if (cmd === "wrapperClosedWebsocket") {
            this.onCloseWebsocket();
        } else {
            this.route(cmd, message);
        }
    };

    ZeroFrame.prototype.bind_event = function (fnc) {
        if (this.event_callbacks.indexOf(fnc) != -1) return ;
        this.event_callbacks.push(fnc);
    };

    ZeroFrame.prototype.route = function(cmd, message) {
        // this.log("ZeroFrame.prototype.route: cmd = " + cmd + ', message = ' + JSON.stringify(message));
        if (cmd == "setSiteInfo") {
            this.site_info = message.params;
            // this.log("ZeroFrame.prototype.route: site_info = " + JSON.stringify(this.site_info));
            this.checkCertUserId() ;
            // execute any functions waiting for event
            if (message.params.event) {
                for (var i=0 ; i<this.event_callbacks.length ; i++) this.event_callbacks[i].apply(undefined, message.params.event);
            }
            // a little dirty. callback to authCtrl and update ZeroNet ID link in log in page
            var link = document.getElementById('zeronet_cert_changed_link') ;
            if (!link) return ;
            try { link.click()} catch (err) {} ;
        }
        else this.log("ZeroFrame.prototype.route - ignored command", message);
    };

    ZeroFrame.prototype.response = function(to, result) {
        this.send({
            "cmd": "response",
            "to": to,
            "result": result
        });
    };

    ZeroFrame.prototype.cmd = function(cmd, params, cb) {
        if (params == null) {
            params = {};
        }
        if (cb == null) {
            cb = null;
        }
        this.send({
            "cmd": cmd,
            "params": params
        }, cb);
    };

    ZeroFrame.prototype.send = function(message, cb) {
        if (cb == null) {
            cb = null;
        }
        message.wrapper_nonce = this.wrapper_nonce;
        message.id = this.next_message_id;
        this.next_message_id += 1;
        this.target.postMessage(message, "*");
        if (cb) {
            this.waiting_cb[message.id] = cb;
        }
    };

    ZeroFrame.prototype.log = function() {
        var args;
        args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
        console.log.apply(console, ["[ZeroFrame]"].concat(slice.call(args)));
    };

    ZeroFrame.prototype.onOpenWebsocket = function() {
        // get siteInfo at startup
        this.cmd("siteInfo", {}, (function(_this) {
            return function(site_info) {
                _this.site_info = site_info;
                // _this.log("ZeroFrame.prototype.onOpenWebsocket: siteInfo = " + JSON.stringify(site_info));
                _this.checkCertUserId() ;
            };
        })(this));
        this.log("Websocket open");
    };

    ZeroFrame.prototype.checkCertUserId = function() {
        // user must be logged in with a money network cert
        if (this.site_info.cert_user_id) return ; // already logged in
        // login to ZeroNet with an anonymous money network account
        // copy/paste from "Nanasi text board" - http://127.0.0.1:43110/16KzwuSAjFnivNimSHuRdPrYd1pNPhuHqN/
        // short documention can be in posts on "Nanasi text board"
        // http://127.0.0.1:43110/Talk.ZeroNetwork.bit/?Topic:6_13hcYDp4XW3GQo4LMtmPf8qUZLZcxFSmVw
        var bitcoin_public_key = "1D2f1XV3zEDDvhDjcD9ugehNJEzv68Dhmf" ;
        var bitcoin_private_key = "5KDc1KoCEPmxxbjvzNdQNCAguaVrFa89LdtfqCKb1PxeSdtmStC" ;
        var bitcoin_keypair = bitcoin.ECPair.fromWIF(bitcoin_private_key);
        var cert;
        cert = bitcoin.message.sign(bitcoin_keypair, (this.site_info.auth_address + "#web/") + this.site_info.auth_address.slice(0, 13)).toString("base64");
        // console.log(pgm + 'cert = ' + JSON.stringify(cert)) ;
        // add cert - no certSelect dialog - continue with just created money network cert
        // this.log("checkCertUserId: add moneynetwork cert");
        this.cmd("certAdd", ["moneynetwork", "web", this.site_info.auth_address.slice(0, 13), cert], (function(_this) {
            return function (res) {
                var pgm = "checkCertUserId: certAdd callback: ";
                // _this.log(pgm + 'res = ' + JSON.stringify(res));
                if (res.error) { _this.cmd("wrapperNotification", ["error", "Failed to create account: " + res.error, 10000]); return ; }
                // certAdd OK. Recheck site_info. site_info.cert_user_id should be not null now. sometime user must select newly created cert
                _this.cmd("siteInfo", {}, function(site_info) {
                    if (site_info.cert_user_id) return ;
                    _this.cmd("certSelect", [["moneynetwork"]]);
                });

            }
        })(this));
    };


    ZeroFrame.prototype.onCloseWebsocket = function() {
        this.log("Websocket close");
    };

    return ZeroFrame;

})();

window.ZeroFrame = new ZeroFrame;