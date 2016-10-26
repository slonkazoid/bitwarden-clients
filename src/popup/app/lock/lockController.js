﻿angular
    .module('bit.lock')

    .controller('lockController', function ($scope, $state, $analytics, i18nService, loginService, cryptoService, toastr,
        userService, SweetAlert) {
        $scope.i18n = i18nService;
        $('#master-password').focus();

        $scope.logOut = function () {
            SweetAlert.swal({
                title: 'Log Out',
                text: 'Are you sure you want to log out?',
                showCancelButton: true,
                confirmButtonText: 'Yes',
                cancelButtonText: 'Cancel'
            }, function (confirmed) {
                if (confirmed) {
                    loginService.logOut(function () {
                        $analytics.eventTrack('Logged Out');
                        $state.go('home');
                    });
                }
            });
        };

        $scope.submit = function () {
            userService.getEmail(function (email) {
                var key = cryptoService.makeKey($scope.masterPassword, email);
                cryptoService.hashPassword($scope.masterPassword, key, function (keyHash) {
                    cryptoService.getKeyHash(true, function (storedKeyHash) {
                        if (storedKeyHash && keyHash && storedKeyHash === keyHash) {
                            cryptoService.setKey(key, function () {
                                chrome.runtime.sendMessage({ command: 'unlocked' });
                                $state.go('tabs.current');
                            });
                        }
                        else {
                            toastr.error(i18nService.invalidMasterPassword, i18nService.errorsHaveOccurred);
                        }
                    });
                });
            });
        };
    });
