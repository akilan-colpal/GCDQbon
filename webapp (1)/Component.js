sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "sap/m/BusyDialog"
], function (UIComponent, JSONModel, BusyDialog) {
    "use strict";

    return UIComponent.extend("adobeform.Component", { 

        metadata: {
            manifest: "json",
            interfaces: ["sap.ui.core.IAsyncContentCreation"]
        },

        init: function () {
            UIComponent.prototype.init.apply(this, arguments);

            var oUserDataModel = new JSONModel({
                email: "",
                userId: "",
                userGlobalId: "", 
                isHR: false,       
                isMgr: false,
                accessDeniedMessage: ""
            });
            this.setModel(oUserDataModel, "mUserDataModel");

            this.aDevelopers = [
                "isabel_miranda@colpal.com",
                "juliana_guevara_vargas@colpal.com",
                "shreya_b_bangera@colpal.com",
                "arlette_almeida@colpal.com"
            ];
            this.aRegularEmployees = [
                "armaan_seelan@colpal.com"
            ];
            this.aManagers = [
                "akilan_manivannan@colpal.com",
                "shilpi_kumar@colpal.com",
                "salvador_cuenca@colpal.com"
            ];
            // proxies
            this.mProxyUserIds = {
                "armaan_seelan@colpal.com": "00149410",
                "shilpi_kumar@colpal.com": "00110564",
                "salvador_cuenca@colpal.com": "00002002",
                "akilan_manivannan@colpal.com": "00002002"
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
                console.log("userapi attributes:", oData);
                var sEmail = oData.email || oData.name || "";
                if (!sEmail) {
                    console.log("No email found in userapi attributes");
                    return;
                }
                console.log("Logged in email:", sEmail || "(none)");
                this.fnGetUserAccess(sEmail);
            }.bind(this));

            oBtpModel.attachRequestFailed(function () {
                console.warn("Local environment — using hardcoded user model");
                var oUserDataModel = this.getModel("mUserDataModel");
                oUserDataModel.setProperty("/email", "local.dev@colpal.com");
                oUserDataModel.setProperty("/userId", "00024611");
                oUserDataModel.setProperty("/userGlobalId", "00024611");
                oUserDataModel.setProperty("/isHR", true);
                oUserDataModel.setProperty("/isMgr", false);
                this.fnCloseBusyDialog();
                this.getRouter().initialize();
            }.bind(this));

            this.getModel().metadataLoaded().then(function () {
                console.log("Main OData metadata loaded — calling ZI_QBON_USER_ACCESS");
                if (oRoot) {
                    oRoot.setBusy(false);
                }
                oBtpModel.loadData(sBtpAttributesUrl);
            }.bind(this), function (oError) {
                console.log("Main OData metadata failed:", oError);
            }.bind(this));
        },

        fnGetUserAccess: function (sEmail) {
            var oODataModel = this.getModel();
            var oUserDataModel = this.getModel("mUserDataModel");
            var sEmailKey = this._normalizeEmail(sEmail);

            console.log("Calling /ZI_QBON_USER_ACCESS");

            oODataModel.read("/ZI_QBON_USER_ACCESS", {
                success: function (oData) {
                    console.log("ZI_QBON_USER_ACCESS response:", oData);

                    var oAccess = (oData.results && oData.results.length > 0)
                        ? oData.results[0]
                        : oData;

                    console.log("ZI_QBON_USER_ACCESS entity:", {
                        userId: oAccess && oAccess.userId,
                        userGlobalId: oAccess && oAccess.userGlobalId,
                        isHR: oAccess && oAccess.isHR,
                        isMgr: oAccess && oAccess.isMgr
                    });

                    if (!oAccess || !oAccess.userId) {
                        console.log("ZI_QBON_USER_ACCESS returned no usable userId");
                        this.getIllustratedMessage("Could not resolve user access from backend.");
                        return;
                    }

                    var sUserId = oAccess.userId;
                    var sUserGlobalId = oAccess.userGlobalId || sUserId;
                    var bIsHR = String(oAccess.isHR).toUpperCase() === "Y";
                    var bIsMgr = String(oAccess.isMgr).toUpperCase() === "Y";

                    // Default: backend values
                    oUserDataModel.setProperty("/email", sEmail);
                    oUserDataModel.setProperty("/userId", sUserId);
                    oUserDataModel.setProperty("/userGlobalId", sUserGlobalId);
                    oUserDataModel.setProperty("/isHR", bIsHR);
                    oUserDataModel.setProperty("/isMgr", bIsMgr);

                    // Overwrite only when the logged-in email is a known proxy
                    var sProxyId = this.mProxyUserIds[sEmailKey];
                    if (sProxyId) {
                        console.log("Proxy override for", sEmailKey, "->", sProxyId);
                        oUserDataModel.setProperty("/userId", sProxyId);
                        oUserDataModel.setProperty("/userGlobalId", sProxyId);
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

                    console.log("Final user access:", oUserDataModel.getData());

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
