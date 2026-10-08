sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "sap/m/BusyDialog",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (UIComponent, JSONModel, BusyDialog, Filter, FilterOperator) {
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
                "akilan_manivannan@colpal.com"
            ];
            this.getUserInfo();
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
            
            var oUserDataModel = this.getModel("mUserDataModel");
            var sBtpAttributesUrl = "./userapi/attributes"; 
            var oBtpModel = new JSONModel();

            oBtpModel.attachRequestCompleted(function (oEvent) {
                var oData = oEvent.getSource().getData();
                var sEmail = oData.email || oData.name;
                
                if (sEmail) {
                    var sLowerEmail = sEmail.toLowerCase();
                    var bIsDeveloper = this.aDevelopers.includes(sLowerEmail);
                                        
                    this.fnGetGlobalId(sEmail, bIsDeveloper);
                } 
            }.bind(this));

            oBtpModel.attachRequestFailed(function () {
                console.warn("Local environment");                
                oUserDataModel.setProperty("/email", "local.dev@colpal.com");
                oUserDataModel.setProperty("/userId", "00006077");
                oUserDataModel.setProperty("/userGlobalId", "00006077");
                oUserDataModel.setProperty("/isHR", true); 
                oUserDataModel.setProperty("/isMgr", false);
                
                this.fnCloseBusyDialog();
                this.getRouter().initialize();
            }.bind(this));
            this.getModel("mSuccessFactorsModel").metadataLoaded().then(function () {
                if (oRoot) {
                    oRoot.setBusy(false);
                }
                oBtpModel.loadData(sBtpAttributesUrl);
            }.bind(this));
        },

        fnGetGlobalId: function (sEmail, bIsDeveloper) {
            var oSFModel = this.getModel("mSuccessFactorsModel");
            var oUserDataModel = this.getModel("mUserDataModel");

            var sLowerEmail = sEmail.toLowerCase();

            var oEmailFilter = new Filter({
                path: "email",
                operator: FilterOperator.Contains, 
                value1: sLowerEmail,
                caseSensitive: false 
            });

            oSFModel.read("/User", {
                filters: [oEmailFilter],
                urlParameters: {
                    "$select": "userId,email, totalTeamSize" 
                },
                success: function (oData) {
                    if (oData.results && oData.results.length > 0) {
                        var sRawUserId = oData.results[0].userId;
                        var sUserGlobalId = "";
                        var sUserId = "lol";
                        var bIsMgr = parseInt(oData.results[0].totalTeamSize, 10) > 0;
                        
                        if (sRawUserId.includes("BP") || sRawUserId.includes("GP")) {
                            sUserGlobalId = sRawUserId.slice(2);
                            sUserId = sRawUserId;
                        } else if (sRawUserId.length === 8 && !isNaN(sRawUserId)) {
                            sUserGlobalId = sRawUserId;
                            sUserId = sRawUserId;
                        } else {
                            sUserGlobalId = sRawUserId;
                            sUserId = sRawUserId;
                        }

                        oUserDataModel.setProperty("/email", sEmail);
                        oUserDataModel.setProperty("/userId", sUserId);
                        oUserDataModel.setProperty("/userGlobalId", sUserGlobalId);
                        oUserDataModel.setProperty("/isMgr", bIsMgr);
                        
                        if (bIsDeveloper) {
                            oUserDataModel.setProperty("/isHR", true);
                            this.fnCloseBusyDialog();
                            this.getRouter().initialize();
                        } else {                           
                            var sIdForRoles = sUserId.includes("BP") ? sUserId : sUserGlobalId;
                            this.fnValidateUserRoles(sIdForRoles);
                        }

                    } else {
                        this.getIllustratedMessage("Could not find a SuccessFactors profile for email: " + sEmail);
                    }
                }.bind(this),
                error: function () {
                    this.getIllustratedMessage("Failed to connect to SuccessFactors OData service.");
                }.bind(this)
            });
        },

        fnValidateUserRoles: function (sUserId) {
            var oSFModel = this.getModel("mSuccessFactorsModel");
            var oUserDataModel = this.getModel("mUserDataModel");

            oSFModel.read("/User('" + sUserId + "')", {
                urlParameters: {
                    "$select": "userId,custom05"
                },
                success: function (oData) {
                    var sCustom05 = oData.custom05 || "";
                    var bIsHR = sCustom05.indexOf("(06)") !== -1;

                    oUserDataModel.setProperty("/isHR", bIsHR);
                    console.log(oData.custom05)
                    this.fnCloseBusyDialog();

                    this.getRouter().initialize();

                }.bind(this),
                error: function () {
                    this.getIllustratedMessage("Failed to fetch user roles.");
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
