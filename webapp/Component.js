sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "sap/m/BusyDialog",
    "adobeform/model/models"
], function (UIComponent, JSONModel, BusyDialog, models) {
    "use strict";

    return UIComponent.extend("adobeform.Component", {

        metadata: {
            manifest: "json",
            interfaces: ["sap.ui.core.IAsyncContentCreation"]
        },

        init: function () {
            UIComponent.prototype.init.apply(this, arguments);

            this.setModel(models.createDeviceModel(), "device");

            var oUserDataModel = new JSONModel({
                email: "",
                userId: "",
                userGlobalId: "",
                isHR: false,
                isMgr: false,
                displayName: "",
                initials: "",
                title: "",
                accessDeniedMessage: ""
            });
            this.setModel(oUserDataModel, "mUserDataModel");

            this.aDevelopers = [
                "isabel_miranda@colpal.com",
                "juliana_guevara_vargas@colpal.com",
                "shreya_b_bangera@colpal.com",
                "arlette_almeida@colpal.com",
                "akilan_manivannan@colpal.com"
            ];
            this.aRegularEmployees = [
                "armaan_seelan@colpal.com"
            ];
            this.aManagers = [
                "shilpi_kumar@colpal.com",
                "salvador_cuenca@colpal.com"
            ];
            // proxies
            this.mProxyUserIds = {
                "armaan_seelan@colpal.com": "00149410"
            };
            this.getUserInfo();
        },

        _normalizeEmail: function (sEmail) {
            return String(sEmail || "")
                .trim()
                .toLowerCase()
                .replace(/\.test$/, "");
        },

        _isEmailInList: function (sEmail, aList) {
            var sNormalized = this._normalizeEmail(sEmail);
            return (aList || []).indexOf(sNormalized) !== -1;
        },

        _setShellIdentity: function (sUserId, sEmail) {
            var oUserDataModel = this.getModel("mUserDataModel");
            var sDisplayName = oUserDataModel.getProperty("/displayName");
            if (!sDisplayName) {
                sDisplayName = sUserId || sEmail || "";
                oUserDataModel.setProperty("/displayName", sDisplayName);
            }
            var sInitials = oUserDataModel.getProperty("/initials");
            if (!sInitials) {
                sInitials = String(sDisplayName || sUserId || "?").charAt(0).toUpperCase();
                oUserDataModel.setProperty("/initials", sInitials);
            }
            if (!oUserDataModel.getProperty("/title")) {
                if (oUserDataModel.getProperty("/isHR")) {
                    oUserDataModel.setProperty("/title", "HR Business Partner");
                } else if (oUserDataModel.getProperty("/isMgr")) {
                    oUserDataModel.setProperty("/title", "Manager");
                }
            }
        },

        getUserInfo: function () {
            this._oBusyDialog = new BusyDialog({
                title: "Loading...",
                text: "Please Wait"
            });
            this._oBusyDialog.open();

            var oRoot = this.getRootControl();
            if (oRoot) {
                oRoot.setBusyIndicatorDelay(0);
                oRoot.setBusy(true);
            }

            var sBtpAttributesUrl = "./userapi/attributes";
            var oBtpModel = new JSONModel();

            oBtpModel.attachRequestCompleted(function (oEvent) {
                var oData = oEvent.getSource().getData();
                var sEmail = oData.email || oData.name || "";
                if (!sEmail) {
                    return;
                }
                console.log("Logged in email:", sEmail || "(none)");
                this.fnGetUserAccess(sEmail);
            }.bind(this));

            oBtpModel.attachRequestFailed(function () {
                console.warn("Local environment — using user model");
                var oUserDataModel = this.getModel("mUserDataModel");
                oUserDataModel.setProperty("/email", "local.dev@colpal.com");
                oUserDataModel.setProperty("/userId", "00149410");
                oUserDataModel.setProperty("/userGlobalId", "00149410");
                oUserDataModel.setProperty("/isHR", false);
                oUserDataModel.setProperty("/isMgr", false);
                oUserDataModel.setProperty("/displayName", "Alex Rivera");
                oUserDataModel.setProperty("/initials", "AR");
                oUserDataModel.setProperty("/title", "HR Business Partner");
                this.fnCloseBusyDialog();
                this.getRouter().initialize();
            }.bind(this));

            this.getModel().metadataLoaded().then(function () {
                if (oRoot) {
                    oRoot.setBusy(false);
                }
                oBtpModel.loadData(sBtpAttributesUrl);
            }.bind(this), function () {
            }.bind(this));
        },

        fnGetUserAccess: function (sEmail) {
            var oODataModel = this.getModel();
            var oUserDataModel = this.getModel("mUserDataModel");
            var sEmailKey = this._normalizeEmail(sEmail);

            oODataModel.read("/ZI_QBON_USER_ACCESS", {
                success: function (oData) {
                    var oAccess = (oData.results && oData.results.length > 0)
                        ? oData.results[0]
                        : oData;

                    if (!oAccess || !oAccess.userId) {
                        this.getIllustratedMessage("Could not resolve user access from backend.");
                        return;
                    }

                    var sUserId = oAccess.userId;
                    var sUserGlobalId = oAccess.userGlobalId || sUserId;
                    var bIsHR = String(oAccess.isHR).toUpperCase() === "Y";
                    var bIsMgr = String(oAccess.isMgr).toUpperCase() === "Y";

                    // backend values
                    var sDisplayName = [oAccess.firstName, oAccess.lastName].filter(Boolean).join(" ");
                    var sInitials = [oAccess.firstName, oAccess.lastName]
                        .filter(Boolean)
                        .map(function (s) { return s.charAt(0).toUpperCase(); })
                        .join("");

                    oUserDataModel.setProperty("/email", sEmail);
                    oUserDataModel.setProperty("/userId", sUserId);
                    oUserDataModel.setProperty("/userGlobalId", sUserGlobalId);
                    oUserDataModel.setProperty("/isHR", bIsHR);
                    oUserDataModel.setProperty("/isMgr", bIsMgr);
                    if (sDisplayName) {
                        oUserDataModel.setProperty("/displayName", sDisplayName);
                    }
                    if (sInitials) {
                        oUserDataModel.setProperty("/initials", sInitials);
                    }
                    if (oAccess.title) {
                        oUserDataModel.setProperty("/title", oAccess.title);
                    }

                    var sProxyId = this.mProxyUserIds[sEmailKey];
                    if (sProxyId) {
                        console.log("Proxy override for", sEmailKey, "->", sProxyId);
                        oUserDataModel.setProperty("/userId", sProxyId);
                        oUserDataModel.setProperty("/userGlobalId", sProxyId);
                        sUserId = sProxyId;
                    }

                    if (this._isEmailInList(sEmailKey, this.aRegularEmployees)) {
                        oUserDataModel.setProperty("/isHR", false);
                        oUserDataModel.setProperty("/isMgr", false);
                    } else if (this._isEmailInList(sEmailKey, this.aManagers)) {
                        oUserDataModel.setProperty("/isHR", false);
                        oUserDataModel.setProperty("/isMgr", true);
                    } else if (this._isEmailInList(sEmailKey, this.aDevelopers)) {
                        oUserDataModel.setProperty("/isHR", true);
                    }

                    this._setShellIdentity(sUserId, sEmail);
                    this.fnCloseBusyDialog();
                    this.getRouter().initialize();
                }.bind(this),
                error: function (oError) {
                    console.log("ZI_QBON_USER_ACCESS error:", oError);
                    if (oError && oError.responseText) {
                        console.log("ZI_QBON_USER_ACCESS error responseText:", oError.responseText);
                    }
                    this.getIllustratedMessage("Failed to fetch user access from the backend.");
                }.bind(this)
            });
        },

        getIllustratedMessage: function (sErrorMessage) {
            this.fnCloseBusyDialog();
            var oBundle = this.getModel("i18n").getResourceBundle();
            var sMessage = sErrorMessage || oBundle.getText("ACCESS_DENIED_DESCRIPTION");
            this.getModel("mUserDataModel").setProperty("/accessDeniedMessage", sMessage);
            var oRouter = this.getRouter();
            oRouter.initialize(true);
            oRouter.navTo("RouteAccessDenied", {}, true);
        },

        fnCloseBusyDialog: function () {
            if (this._oBusyDialog) {
                this._oBusyDialog.close();
            }
        }
    });
});
