sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "sap/m/BusyDialog",
    "sap/m/MessageBox",
    "sap/base/i18n/Localization",
    "adobeform/model/models",
    "adobeform/model/journey"
], function (UIComponent, JSONModel, BusyDialog, MessageBox, Localization, models, journey) {
    "use strict";

    return UIComponent.extend("adobeform.Component", {

        metadata: {
            manifest: "json",
            interfaces: ["sap.ui.core.IAsyncContentCreation"]
        },

        init: function () {
            UIComponent.prototype.init.apply(this, arguments);

            this.setModel(models.createDeviceModel(), "device");
            this.setModel(new JSONModel(journey.createData()), "journey");

            var sLanguage = Localization.getLanguage() || "en";
            if (sLanguage.toLowerCase().indexOf("es") === 0) {
                sLanguage = "es";
            } else {
                sLanguage = "en";
            }
            this.setModel(new JSONModel({ language: sLanguage }), "appSettings");

            var oUserDataModel = new JSONModel({
                email: "",
                userId: "",
                userGlobalId: "",
                isHR: false,
                isMgr: false,
                firstName: "",
                lastName: "",
                title: "",
                displayName: "",
                initials: "",
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
            this.mProxyUserIds = {
                "armaan_seelan@colpal.com": "00149410"
            };

            this.getUserInfo();
        },

        getUserInfo: function () {
            var oBundle = this.getModel("i18n").getResourceBundle();
            this._oBusyDialog = new BusyDialog({
                title: oBundle.getText("LOADING"),
                text: oBundle.getText("PLEASE_WAIT")
            });
            this._oBusyDialog.open();

            var oRoot = this.getRootControl();
            if (oRoot) {
                oRoot.setBusyIndicatorDelay(0);
                oRoot.setBusy(true);
            }

            var fnLoadUser = function () {
                fetch("./userapi/attributes").then(function (oResponse) {
                    if (!oResponse.ok) {
                        throw new Error("userapi");
                    }
                    return oResponse.json();
                }).then(function (oData) {
                    var sEmail = oData.email || oData.name || "";
                    if (!sEmail) {
                        this.showAccessDenied(oBundle.getText("ACCESS_DENIED_DESCRIPTION"));
                        return;
                    }
                    this.fnGetUserAccess(sEmail);
                }.bind(this)).catch(function () {
                    console.warn("Local environment — using user model");
                    this.fnApplyAccess({
                        email: "local.dev@colpal.com",
                        userId: "00006077",
                        userGlobalId: "00006077",
                        isHR: "Y",
                        isMgr: "Y",
                        firstName: "",
                        lastName: "",
                        title: ""
                    }, "local.dev@colpal.com");
                }.bind(this));
            }.bind(this);
            this.getModel().metadataLoaded().then(fnLoadUser, fnLoadUser);
        },

        fnGetUserAccess: function (sEmail) {
            var oODataModel = this.getModel();
            var sEmailKey = String(sEmail || "").trim().toLowerCase().replace(/\.test$/, "");

            oODataModel.read("/ZI_QBON_USER_ACCESS", {
                success: function (oData) {
                    var oAccess = (oData.results && oData.results.length > 0) ? oData.results[0] : oData;
                    if (!oAccess || !oAccess.userId) {
                        this.showAccessDenied(this.getModel("i18n").getResourceBundle().getText("ACCESS_DENIED_DESCRIPTION"));
                        return;
                    }
                    this.fnApplyAccess(oAccess, sEmailKey);
                }.bind(this),
                error: function () {
                    this.showAccessDenied(this.getModel("i18n").getResourceBundle().getText("ACCESS_FAILED"));
                }.bind(this)
            });
        },

        fnApplyAccess: function (oAccess, sEmailKey) {
            var oUserDataModel = this.getModel("mUserDataModel");
            var sUserId = String(oAccess.userId);
            var sUserGlobalId = String(oAccess.userGlobalId || sUserId);
            var bIsHR = String(oAccess.isHR).toUpperCase() === "Y" || oAccess.isHR === true;
            var bIsMgr = String(oAccess.isMgr).toUpperCase() === "Y" || oAccess.isMgr === true;
            var sFirstName = oAccess.firstName || oAccess.FirstName || "";
            var sLastName = oAccess.lastName || oAccess.LastName || "";
            var sTitle = oAccess.title || oAccess.Title || "";

            if (sEmailKey && this.mProxyUserIds[sEmailKey]) {
                sUserId = this.mProxyUserIds[sEmailKey];
                sUserGlobalId = sUserId;
            }
            if (sEmailKey && this.aRegularEmployees.indexOf(sEmailKey) !== -1) {
                bIsHR = false;
                bIsMgr = false;
            } else if (sEmailKey && this.aManagers.indexOf(sEmailKey) !== -1) {
                bIsHR = false;
                bIsMgr = true;
            } else if (sEmailKey && this.aDevelopers.indexOf(sEmailKey) !== -1) {
                bIsHR = true;
            }

            var sRole = "employee";
            if (bIsHR) {
                sRole = "hr";
            } else if (bIsMgr) {
                sRole = "manager";
            }

            var sDisplayName = (sFirstName + " " + sLastName).trim();
            var sLabel = sDisplayName || sUserId;
            if (sUserId !== String(oAccess.userId)) {
                sLabel = sUserId;
            }
            var aNameParts = sDisplayName.split(" ").filter(function (sPart) {
                return sPart;
            });
            var sInitials = "";
            if (aNameParts[0]) {
                sInitials = aNameParts[0].charAt(0).toUpperCase();
            }
            if (aNameParts[1]) {
                sInitials = sInitials + aNameParts[1].charAt(0).toUpperCase();
            }
            if (!sInitials) {
                sInitials = sUserId.charAt(0);
            }

            oUserDataModel.setProperty("/email", oAccess.email || sEmailKey || "");
            oUserDataModel.setProperty("/userId", sUserId);
            oUserDataModel.setProperty("/userGlobalId", sUserGlobalId);
            oUserDataModel.setProperty("/isHR", bIsHR);
            oUserDataModel.setProperty("/isMgr", bIsMgr);
            oUserDataModel.setProperty("/firstName", sFirstName);
            oUserDataModel.setProperty("/lastName", sLastName);
            oUserDataModel.setProperty("/title", sTitle);
            oUserDataModel.setProperty("/displayName", sDisplayName || sUserId);
            oUserDataModel.setProperty("/initials", sInitials);

            var oJourney = this.getModel("journey");
            oJourney.setProperty("/role", sRole);
            oJourney.setProperty("/actingUserId", sUserId);
            oJourney.setProperty("/selectedEmployeeId", sUserId);
            oJourney.setProperty("/selectedEmployeeLabel", sLabel);

            this.fnCloseBusyDialog();
            this.getRouter().initialize();

            var oBundle = this.getModel("i18n").getResourceBundle();
            journey.loadPeriods(this, sUserId).catch(function () {
                MessageBox.error(oBundle.getText("PERIODS_FAILED"));
            });
            if (sRole === "manager") {
                journey.loadManagerTree(this, sUserId).catch(function () {
                    MessageBox.error(oBundle.getText("TREE_FAILED"));
                });
            }
        },

        showAccessDenied: function (sMessage) {
            this.fnCloseBusyDialog();
            var oBundle = this.getModel("i18n").getResourceBundle();
            this.getModel("mUserDataModel").setProperty("/accessDeniedMessage", sMessage || oBundle.getText("ACCESS_DENIED_DESCRIPTION"));
            var oRouter = this.getRouter();
            oRouter.initialize(true);
            oRouter.navTo("RouteAccessDenied", {}, true);
        },

        fnCloseBusyDialog: function () {
            if (this._oBusyDialog) {
                this._oBusyDialog.close();
            }
            var oRoot = this.getRootControl();
            if (oRoot) {
                oRoot.setBusy(false);
            }
        }
    });
});
