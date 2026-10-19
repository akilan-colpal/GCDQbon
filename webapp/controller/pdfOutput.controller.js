sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/routing/History",
    "sap/m/MessageToast",
    "sap/base/security/URLListValidator"
], function (Controller, JSONModel, History, MessageToast, URLListValidator) { 
    "use strict";

    return Controller.extend("adobeform.controller.pdfOutput", {

        onInit: function () {
            URLListValidator.add("blob");

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RoutePdfOutput").attachMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function () {
        },
    });
});