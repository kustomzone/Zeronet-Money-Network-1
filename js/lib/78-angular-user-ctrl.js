angular.module('MoneyNetwork')
    
    .controller('UserCtrl', ['$scope', '$rootScope', '$timeout', 'MoneyNetworkService', function($scope, $rootScope, $timeout, moneyNetworkService) {
        var self = this;
        var controller = 'UserCtrl';
        if (!MoneyNetworkHelper.getItem('userid')) return ; // not logged in - skip initialization of controller
        console.log(controller + ' loaded');

        self.user_info = moneyNetworkService.get_user_info() ; // array with tags and values from localStorage
        self.tags = moneyNetworkService.get_tags() ; // typeahead autocomplete functionality
        self.privacy_options = moneyNetworkService.get_privacy_options() ; // select options with privacy settings for user info
        self.show_privacy_title = moneyNetworkService.get_show_privacy_title() ; // checkbox - display column with privacy descriptions?

        // search for new ZeroNet contacts and add avatars for new contacts
        var contacts = moneyNetworkService.get_contacts(); // array with contacts from localStorage
        self.zeronet_search_contacts = function () {
            moneyNetworkService.z_contact_search(function () { $scope.$apply() }, null);
        };
        self.zeronet_search_contacts();

        function debug (key, text) {
            MoneyNetworkHelper.debug(key, text) ;
        }

        // quick instructions for newcomers
        self.show_welcome_msg = function () {
            if (!contacts) return true ;
            return (contacts.length == 0) ;
        }; // show_welcome_msg

        // add empty rows to user info table. triggered in privacy field. enter and tab (only for last row)
        self.insert_row = function(row) {
            var pgm = controller + '.insert_row: ' ;
            var index ;
            for (var i=0 ; i<self.user_info.length ; i++) if (self.user_info[i].$$hashKey == row.$$hashKey) index = i ;
            index = index + 1 ;
            self.user_info.splice(index, 0, moneyNetworkService.empty_user_info_line());
            $scope.$apply();
        };
        self.delete_row = function(row) {
            var pgm = controller + '.delete_row: ' ;
            var index ;
            for (var i=0 ; i<self.user_info.length ; i++) if (self.user_info[i].$$hashKey == row.$$hashKey) index = i ;
            // console.log(pgm + 'row = ' + JSON.stringify(row)) ;
            self.user_info.splice(index, 1);
            if (self.user_info.length == 0) self.user_info.splice(index, 0, moneyNetworkService.empty_user_info_line());
        };

        // user_info validations
        self.is_tag_required = function(row) {
            if (row.value) return true ;
            if (row.privary) return true ;
            return false ;
        };
        self.is_value_required = function(row) {
            if (!row.tag) return false ;
            if (row.tag == 'GPS') return false ;
            return true ;
        };
        self.is_privacy_required = function(row) {
            if (row.tag) return true ;
            if (row.value) return true ;
            return false ;
        };

        self.show_privacy_title_changed = function () {
            moneyNetworkService.set_show_privacy_title(self.show_privacy_title)
        };

        self.update_user_info = function () {
            var pgm = controller + '.update_user_info: ' ;
            // console.log(pgm + 'calling moneyNetworkService.save_user_info()');
            moneyNetworkService.save_user_info() ;
            // console.log(pgm) ;
        };
        self.revert_user_info = function () {
            var pgm = controller + '.revert_user_info: ' ;
            moneyNetworkService.load_user_info() ;
            // console.log(pgm) ;
        };

        // manage user avatar
        self.avatar = moneyNetworkService.get_avatar();
        // console.log(controller + ': self.avatar (1) = ' + JSON.stringify(self.avatar)) ;

        // upload_avatar callback function. handle upload
        function handleAvatarUpload (image_base64uri) {
            var ext, image_base64, user_path;
            if (!image_base64uri) return ;
            user_path = "data/users/" + ZeroFrame.site_info.auth_address ;
            ext = moneyNetworkService.get_image_ext_from_base64uri(image_base64uri);
            if (['png','jpg'].indexOf(ext) == -1) {
                ZeroFrame.cmd("wrapperNotification", ["error", "Sorry. Only png, jpg and jpeg images can be used as avatar", 5000]);
                return ;
            }
            ZeroFrame.cmd("fileDelete", user_path + "/avatar.jpg", function (res) {});
            ZeroFrame.cmd("fileDelete", user_path + "/avatar.png", function (res) {});
            image_base64 = image_base64uri != null ? image_base64uri.replace(/.*?,/, "") : void 0;
            ZeroFrame.cmd("fileWrite", [user_path + "/avatar." + ext, image_base64], function(res) {
                var pgm = controller + '.handleAvatarUpload fileWrite callback: ';
                // console.log(pgm + 'res = ' + JSON.stringify(res));
                self.avatar.src = user_path + "/avatar." + ext + '?rev=' + MoneyNetworkHelper.generate_random_password(10);
                $scope.$apply() ;
                moneyNetworkService.zeronet_site_publish() ;
                self.setup.avatar = ext ;
                moneyNetworkService.save_user_setup() ;
                //ZeroFrame.cmd("sitePublish", {inner_path: user_path + '/content.json'}, function (res) {
                //    // empty callback . no error handling. publish for avatar change is not important
                //}); // sitePublish
            }); // fileWrite
        } // handleAvatarUpload
        // avatar click using Uploadable class from ZeroMePlus
        self.upload_avatar = function () {
            var pgm = controller + '.upload_avatar: ';
            var uploadable_avatar = new Uploadable(handleAvatarUpload);
            uploadable_avatar.handleUploadClick() ;
        };

        // get setup with alias and spam settings
        function load_setup () {
            self.setup = moneyNetworkService.get_user_setup();
        }
        load_setup() ;
        function copy_setup() {
            self.setup_copy = JSON.parse(JSON.stringify(self.setup)) ;
        }
        copy_setup() ;

        // manage user alias
        self.editing_alias = false ;
        var edit_alias_notifications = 1 ;
        self.edit_alias = function () {
            self.editing_alias = true;
            if (edit_alias_notifications > 0) {
                ZeroFrame.cmd("wrapperNotification", ["info", "Edit alias. Press ENTER to save. Press ESC to cancel", 5000]);
                edit_alias_notifications--;
            }
            var set_focus = function () {
                document.getElementById('alias_id').focus()
            };
            $timeout(set_focus);
        };
        self.save_alias = function () {
            self.editing_alias = false ;
            self.setup.alias = self.setup_copy.alias ;
            moneyNetworkService.save_user_setup() ;
            copy_setup() ;
            $scope.$apply() ;
        };
        self.cancel_edit_alias = function () {
            self.editing_alias = false ;
            copy_setup();
            $scope.$apply() ;
        };

        // manage spam filter settings: block messages from guests and/or list of ignored contacts
        self.spam_settings_changed = function () {
            var pgm = controller + '.spam_settings_changed: ' ;
            if (self.setup_copy.block_guests != self.setup.block_guests) self.setup.block_guests_at = new Date().getTime() ;
            if (self.setup_copy.block_ignored != self.setup.block_ignored) self.setup.block_ignored_at = new Date().getTime() ;
            moneyNetworkService.save_user_setup() ;
            // console.log(pgm + 'setup = ' + JSON.stringify(self.setup));
            //setup = {
            //    ...
            //    "block_guests": false,
            //    "block_ignored": false,
            //    "block_guests_at": 1479033958082,
            //    "block_ignored_at": 1479033949514
            //};
            copy_setup() ;
        };

        function testcase_message_lost_in_cyberspace() {
            var pgm = controller + '.testcase_message_lost_in_cyberspace: ' ;
            var last_sent_at, last_contact, i, contact, j, message ;
            // insert test data for message lost in cyberspace testcase
            // create outbox message with local_msg_seq 999, status sent, not on zeronet (cleanup) and no feedback from contact
            // next outbox message will request feedback info for message lost in cyberspace
            last_sent_at = 0 ;
            last_contact = null ;
            for (i=0 ; i<contacts.length ; i++) {
                contact = contacts[i] ;
                if (!contact.messages) continue ;
                for (j=0 ; j<contact.messages.length ; j++) {
                    message = contact.messages[j] ;
                    if (message.folder != 'outbox') continue ;
                    if (message.sent_at < last_sent_at) continue ;
                    last_contact = contact ;
                    last_sent_at = message.sent_at ;
                }
            }
            if (!last_contact) {
                ZeroFrame.cmd('wrapperNotification', ['error', 'No last outbox message was found. cannot create message lost in cyberspace testcase', 5000]) ;
                return ;
            }
            // create test data. status sent, no zeronet_msg_id and status cleanup
            var local_msg_seq, sender_sha256, lost_message, js_messages ;
            local_msg_seq = moneyNetworkService.next_local_msg_seq() ;
            sender_sha256 = CryptoJS.SHA256(MoneyNetworkHelper.generate_random_password(200)).toString();
            lost_message =
            {
                "folder": "outbox",
                "message": {"msgtype": "chat msg", "message": "message " + local_msg_seq + " lost in cyberspace"},
                "local_msg_seq": local_msg_seq,
                "sender_sha256": sender_sha256,
                "sent_at": new Date().getTime(),
                "cleanup_at": new Date().getTime()
            } ;
            lost_message.ls_msg_size = JSON.stringify(lost_message).length ;
            debug('lost_message', pgm + 'lost_message = ' + JSON.stringify(lost_message));
            // add message
            js_messages = moneyNetworkService.js_get_messages() ;
            last_contact.messages.push(lost_message) ;
            js_messages.push({contact: last_contact, message: lost_message}) ;
            moneyNetworkService.ls_save_contacts(false) ;
            ZeroFrame.cmd('wrapperNotification', ['info', 'created new outbox msg ' + local_msg_seq + '. Not sent, not on ZeroNet, no feedback info and marked as cleanup', 5000]);
        } // testcase_message_lost_in_cyberspace

        self.debug_settings_changed = function () {
            // create test data
            var old_force_lost_message = self.setup_copy.test && self.setup_copy.test.force_lost_message ;
            var new_force_lost_message = self.setup.test && self.setup.test.force_lost_message ;
            if (!old_force_lost_message && new_force_lost_message) testcase_message_lost_in_cyberspace() ;
            copy_setup() ;
            moneyNetworkService.save_user_setup() ;
            MoneyNetworkHelper.load_user_setup() ;
        };

        if (self.setup.guest) self.guest_password = MoneyNetworkHelper.getItem('password') ;

        self.keysize = 2048 ;
        (function(){
            var encrypt = new JSEncrypt();
            encrypt.setPublicKey(MoneyNetworkHelper.getItem('pubkey'));
            self.keysize = encrypt.key.n.bitLength() ;
        })() ;

        // end UserCtrl
    }])

;
