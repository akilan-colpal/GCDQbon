sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Configuration",
    "sap/ui/model/json/JSONModel"
], function (BaseController, Configuration, JSONModel) { 
    "use strict";

    return BaseController.extend("adobeform.controller.App", {
        onInit: function () {
            this.byId("shellBar").setHomeIcon(
                sap.ui.require.toUrl("adobeform/image/ColPal_Icon.svg")
            );
        },

        pressLogo: function () {
            this.getOwnerComponent().getRouter().navTo("RouteGcdStatementFilter");
        },
      
        onLanguageChange: function (oEvent) {
            var sSelectedLang = oEvent.getParameter("selectedItem").getKey();
            Configuration.setLanguage(sSelectedLang);
        }
    });
});