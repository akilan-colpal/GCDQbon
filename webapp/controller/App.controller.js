sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Configuration",
    "sap/ui/model/json/JSONModel"
], function (BaseController, Configuration, JSONModel) { 
    "use strict";

    return BaseController.extend("adobeform.controller.App", {
        onInit: function () {
            var sLanguage = (Configuration.getLanguage() || "en").toLowerCase();
            var sAppLang = sLanguage.indexOf("es") === 0 ? "es" : "en";

            this.getOwnerComponent().setModel(new JSONModel({
                language: sAppLang
            }), "appSettings");
        },

        pressLogo: function () {
            this.getOwnerComponent().getRouter().navTo("RouteGcdStatementFilter");
        },
      
        onLanguageChange: function (oEvent) {
            var sSelectedLang = oEvent.getParameter("selectedItem").getKey();
            this.getOwnerComponent().getModel("appSettings").setProperty("/language", sSelectedLang);
            Configuration.setLanguage(sSelectedLang);
        }
    });
});