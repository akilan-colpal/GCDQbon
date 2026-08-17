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
            var oPdfModel = this.getOwnerComponent().getModel("pdfModel");
            var sBase64 = oPdfModel ? oPdfModel.getProperty("/PdfContent") : null;

            if (sBase64) {
                try {
                    var sCleanBase64 = sBase64.replace(/\s/g, '');

                    var sBinaryString = window.atob(sCleanBase64);
                    var iBinaryLen = sBinaryString.length;
                    var aBytes = new Uint8Array(iBinaryLen);
                    
                    for (var i = 0; i < iBinaryLen; i++) {
                        aBytes[i] = sBinaryString.charCodeAt(i);
                    }

                    var oBlob = new Blob([aBytes], { type: "application/pdf" });
                    var sBlobUrl = URL.createObjectURL(oBlob);
                    
                    var oViewModel = new JSONModel({
                        pdfSource: sBlobUrl
                    });
                    this.getView().setModel(oViewModel, "view");

                } catch (e) {
                    console.error("PDF Conversion Error:", e);
                    MessageToast.show("Error generating the PDF file.");
                }
            } else {
                MessageToast.show("No PDF data found. Please generate the PDF first.");
            }
        },

        onNavBack: function () {
            var oHistory = History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                var oRouter = this.getOwnerComponent().getRouter();
                oRouter.navTo("RouteadobeForm", {}, true);
            }
        }

    });
});