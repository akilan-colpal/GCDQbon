sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "adobeform/model/journey"
], function (Controller, MessageToast, MessageBox, journey) {
    "use strict";

    return Controller.extend("adobeform.controller.Quarters", {

        onInit: function () {
            this.getOwnerComponent().getRouter().getRoute("RouteQuarters").attachPatternMatched(this.onRouteMatched, this);
            this._pDetail = this.loadFragment({
                name: "adobeform.fragment.DetailSheet"
            });
        },

        onRouteMatched: function () {
            var sYear = this.getOwnerComponent().getModel("journey").getProperty("/year");
            if (!sYear) {
                this.getOwnerComponent().getRouter().navTo("RouteStart", {}, true);
            }
        },

        onBack: function () {
            this.getOwnerComponent().getRouter().navTo("RouteStart");
        },

        onSelectQuarter: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("journey");
            var oCard = oContext.getObject();
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            if (!oCard.statement) {
                MessageToast.show(oBundle.getText("NO_RECORDS"));
                return;
            }

            var oStatement = oCard.statement;
            var oSummary = (oStatement.to_qSum && oStatement.to_qSum[0]) ? oStatement.to_qSum[0] : {};
            var aKpis = oStatement.to_KPIs || [];
            if (aKpis.length && aKpis[0].proratedTarget !== undefined && aKpis[0].proratedTarget !== null && aKpis[0].proratedTarget !== "") {
                oStatement.proratedTargetAmount = aKpis[0].proratedTarget;
            } else {
                oStatement.proratedTargetAmount = oSummary.quarterTargetAmount;
            }
            if (oStatement.bonusableEarnings === undefined || oStatement.bonusableEarnings === null || oStatement.bonusableEarnings === "") {
                oStatement.bonusableEarnings = oSummary.bonusableQuarterEarn;
            }
            if (!oStatement.VarPayTemplateName) {
                oStatement.VarPayTemplateName = oBundle.getText("BONUS_STATEMENT");
            }
            oStatement.summary = oSummary;

            var oJourneyModel = this.getOwnerComponent().getModel("journey");
            oJourneyModel.setProperty("/detailCriteria", {
                globalId: oJourneyModel.getProperty("/selectedEmployeeId"),
                year: oJourneyModel.getProperty("/year"),
                quarter: oCard.quarter
            });
            oJourneyModel.setProperty("/detail", oStatement);

            this._pDetail.then(function (oDialog) {
                oDialog.open();
            });
        },

        onCloseDetail: function () {
            var oDialog = this.byId("detailDialog");
            if (oDialog) {
                oDialog.close();
            }
            this.getOwnerComponent().getModel("journey").setProperty("/detail", null);
        },

        onGeneratePdf: function () {
            var oComponent = this.getOwnerComponent();
            var oJourneyModel = oComponent.getModel("journey");
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            oJourneyModel.setProperty("/pdfLoading", true);
            journey.openPdf(oComponent).catch(function (oError) {
                var sKey = "PDF_FAILED";
                if (oError && oError.message === "PDF_POPUP_BLOCKED") {
                    sKey = "PDF_POPUP_BLOCKED";
                }
                MessageBox.error(oBundle.getText(sKey));
            }).finally(function () {
                oJourneyModel.setProperty("/pdfLoading", false);
            });
        }
    });
});
