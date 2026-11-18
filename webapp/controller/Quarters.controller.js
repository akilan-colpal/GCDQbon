sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, Filter, FilterOperator, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("adobeform.controller.Quarters", {

        onInit: function () {
            var that = this;
            var oStatementModel = this.getOwnerComponent().getModel("mStatementModel");
            if (oStatementModel) {
                this.getView().setModel(oStatementModel);
            }

            this.getOwnerComponent().getRouter().getRoute("RouteQuarters").attachPatternMatched(this.onRouteMatched, this);
            this._pDetail = this.loadFragment({
                name: "adobeform.fragment.DetailSheet"
            }).then(function (oDialog) {
                oDialog.attachAfterOpen(that.onDetailAfterOpen, that);
                oDialog.attachAfterClose(that.onDetailAfterClose, that);
                return oDialog;
            });
        },

        onRouteMatched: function () {
            var oModel = this.getOwnerComponent().getModel("mStatementModel");
            var sYear = oModel && oModel.getProperty("/searchCriteria/year");
            if (!sYear) {
                this.getOwnerComponent().getRouter().navTo("RouteStart", {}, true);
            }
        },

        onBack: function () {
            this.onCloseDetail();
            this.getOwnerComponent().getRouter().navTo("RouteStart");
        },

        onSelectQuarter: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            if (!oContext) {
                oContext = oEvent.getSource().getBindingContext("mStatementModel");
            }
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

            this._prepareKpiCharts(oStatement);

            var oModel = this.getOwnerComponent().getModel("mStatementModel");
            var oCriteria = oModel.getProperty("/searchCriteria") || {};
            oModel.setProperty("/searchCriteria", {
                globalId: oCriteria.globalId || "",
                year: oCriteria.year || "",
                quarter: oCard.quarter
            });
            oModel.setProperty("/data", oStatement);
            oModel.setProperty("/isPdfButtonVisible", true);

            var iKpiLength = oStatement.to_KPIs ? oStatement.to_KPIs.length : 1;
            var iSumLength = oStatement.to_qSum ? oStatement.to_qSum.length : 1;
            oModel.setProperty("/kpiRowCount", iKpiLength || 1);
            oModel.setProperty("/summaryRowCount", iSumLength || 1);

            this._pDetail.then(function (oDialog) {
                oDialog.open();
            });
        },

        _prepareKpiCharts: function (oStatement) {
            var aKpis = oStatement.to_KPIs || [];
            aKpis.forEach(function (oKpi, iIndex) {
                if (!oKpi.KPIName) {
                    oKpi.KPIName = "KPI " + (iIndex + 1);
                }
                var fTarget = parseFloat(oKpi.kpiResTarget);
                var fAchievement = parseFloat(oKpi.kpiResAchievement);
                var fPayout = parseFloat(oKpi.kpiPayoutPercent);
                if (isNaN(fTarget)) {
                    fTarget = 0;
                }
                if (isNaN(fAchievement)) {
                    fAchievement = 0;
                }
                if (isNaN(fPayout)) {
                    fPayout = 0;
                }
                var fTargetAmt = parseFloat(oKpi.kpiTargetAmount);
                var fPayoutAmt = parseFloat(oKpi.kpiPayout);
                var fPayoutY = fPayout <= 1 ? fPayout * 100 : fPayout;
                if (fPayout > 1 && fPayout < 10 && fTargetAmt > 0 && fPayoutAmt > 0 && Math.abs((fPayoutAmt / fTargetAmt) - fPayout) < 0.05) {
                    fPayoutY = fPayout * 100;
                }
                oKpi.chartPoints = [
                    { x: 0, y: 0 },
                    { x: fTarget, y: 100 },
                    { x: fAchievement, y: fPayoutY }
                ];
            });
        },

        onDetailAfterOpen: function () {
            var oBlockLayer = document.getElementById("sap-ui-blocklayer-popup");
            if (!oBlockLayer) {
                return;
            }
            if (this._fnBlockLayerClick) {
                oBlockLayer.removeEventListener("click", this._fnBlockLayerClick);
            }
            this._fnBlockLayerClick = this.onCloseDetail.bind(this);
            oBlockLayer.addEventListener("click", this._fnBlockLayerClick);
        },

        onDetailAfterClose: function () {
            var oBlockLayer = document.getElementById("sap-ui-blocklayer-popup");
            if (oBlockLayer && this._fnBlockLayerClick) {
                oBlockLayer.removeEventListener("click", this._fnBlockLayerClick);
            }
            this._fnBlockLayerClick = null;
            var oModel = this.getOwnerComponent().getModel("mStatementModel");
            if (oModel) {
                oModel.setProperty("/data", {});
            }
        },

        onCloseDetail: function () {
            var oDialog = this.byId("detailDialog");
            if (oDialog && oDialog.isOpen()) {
                oDialog.close();
            }
        },

        // =======================================================
        // PDF GENERATION
        // =======================================================
        onGeneratePress: function () {
            var oView = this.getView();
            var oModel = this.getOwnerComponent().getModel("mStatementModel");
            var oCriteria = oModel.getProperty("/searchCriteria") || {};
            var sGlobalId = oCriteria.globalId || "";
            var sYear = oCriteria.year || "";
            var sQuarter = oCriteria.quarter || "";

            if (!sGlobalId || !sYear || !sQuarter) {
                MessageBox.error("Missing search criteria to generate PDF.");
                return;
            }

            var oAppSettings = this.getOwnerComponent().getModel("appSettings");
            var sPdfLanguage = (oAppSettings && oAppSettings.getProperty("/language")) || "en";

            var aFilters = [
                new Filter("global_id", FilterOperator.EQ, sGlobalId),
                new Filter("bonusYear", FilterOperator.EQ, sYear),
                new Filter("bonusQuarter", FilterOperator.EQ, sQuarter),
                new Filter("generatePdfRequest", FilterOperator.EQ, sPdfLanguage)
            ];

            var oODataModel = this.getOwnerComponent().getModel();

            oModel.setProperty("/pdfLoading", true);
            oView.setBusy(true);
            oODataModel.read("/ZI_QBON_DD", {
                filters: aFilters,
                success: function (oData) {
                    oView.setBusy(false);
                    oModel.setProperty("/pdfLoading", false);

                    if (oData.results && oData.results.length > 0 && oData.results[0].PdfContent) {
                        try {
                            var sBase64 = oData.results[0].PdfContent;
                            var sCleanBase64 = sBase64.replace(/\s/g, "");
                            var sBinaryString = window.atob(sCleanBase64);
                            var iBinaryLen = sBinaryString.length;
                            var aBytes = new Uint8Array(iBinaryLen);

                            for (var i = 0; i < iBinaryLen; i++) {
                                aBytes[i] = sBinaryString.charCodeAt(i);
                            }

                            var oBlob = new Blob([aBytes], { type: "application/pdf" });
                            var sBlobUrl = URL.createObjectURL(oBlob);
                            var oNewTab = window.open("", "_blank");
                            if (oNewTab) {
                                oNewTab.location.href = sBlobUrl;
                            } else {
                                MessageBox.error("Unable to open PDF. Please allow pop-ups for this site.");
                            }
                        } catch (e) {
                            MessageBox.error("An error occurred while generating the PDF file locally.");
                        }
                    } else {
                        MessageBox.error("No PDF data returned from the backend.");
                    }
                },
                error: function () {
                    oView.setBusy(false);
                    oModel.setProperty("/pdfLoading", false);
                    MessageBox.error("Failed to fetch the PDF from the backend.");
                }
            });
        },

        // =======================================================
        // FORMATTERS
        // =======================================================
        formatCleanNumber: function (sValue) {
            if (!sValue) {
                return "";
            }
            var fValue = parseFloat(sValue);
            if (isNaN(fValue)) {
                return sValue;
            }
            return fValue.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            });
        },

        formatPercent: function (sValue) {
            var sFormatted = this.formatCleanNumber(sValue);
            return sFormatted ? sFormatted + "%" : "";
        }
    });
});
