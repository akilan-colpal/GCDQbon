sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/base/i18n/Localization"
], function (Controller, Filter, FilterOperator, MessageBox, Localization) {
    "use strict";

    return Controller.extend("adobeform.controller.gcdStatementResults", {

        onInit: function () {
            this.byId("resultsRoot").bindElement("/data");
            var oChart = this.byId("kpiChart");
            if (oChart) {
                oChart.setUiConfig({ applicationSet: "fiori" });
                oChart.setVizProperties({
                    plotArea: {
                        dataLabel: { visible: true }
                    },
                    title: { visible: false },
                    legend: { visible: true },
                    categoryAxis: { title: { visible: false } },
                    valueAxis: { title: { visible: false } }
                });
                this._applyChartTexts();
                Localization.attachChange(this._applyChartTexts, this);
            }
        },

        onExit: function () {
            Localization.detachChange(this._applyChartTexts, this);
        },

        _applyChartTexts: function () {
            var oI18nModel = this.getView().getModel("i18n");
            if (!oI18nModel) {
                return;
            }
            var oBundle = oI18nModel.getResourceBundle();
            var sTarget = oBundle.getText("CHART_KPI_TARGET");
            var sAchievement = oBundle.getText("CHART_KPI_ACHIEVEMENT");
            var oTargetMeasure = this.byId("kpiTargetMeasure");
            var oAchievementMeasure = this.byId("kpiAchievementMeasure");
            var oValueFeed = this.byId("kpiValueFeed");

            if (oTargetMeasure) {
                oTargetMeasure.setName(sTarget);
            }
            if (oAchievementMeasure) {
                oAchievementMeasure.setName(sAchievement);
            }
            if (oValueFeed) {
                oValueFeed.setValues([sTarget, sAchievement]);
            }
            var oChart = this.byId("kpiChart");
            if (oChart) {
                oChart.invalidate();
            }
        },

        onDataReady: function () {
            var oChart = this.byId("kpiChart");
            if (!oChart) {
                return;
            }
            setTimeout(function () {
                oChart.invalidate();
            }, 200);
        },

        // =======================================================
        // PDF GENERATION
        // =======================================================
        onGeneratePress: function () {
            var oView = this.getView();
            var oModel = oView.getModel();
            var oCriteria = oModel.getProperty("/searchCriteria") || {};
            var sGlobalId = oCriteria.globalId || "";
            var sYear = oCriteria.year || "";
            var sQuarter = oCriteria.quarter || "";

            if (!sGlobalId || !sYear || !sQuarter) {
                MessageBox.error("Missing search criteria to generate PDF.");
                return;
            }

            var aFilters = [
                new Filter("global_id", FilterOperator.EQ, sGlobalId),
                new Filter("bonusYear", FilterOperator.EQ, sYear),
                new Filter("bonusQuarter", FilterOperator.EQ, sQuarter),
                new Filter("generatePdfRequest", FilterOperator.EQ, "Y")
            ];

            var oODataModel = this.getOwnerComponent().getModel();

            oView.setBusy(true);
            oODataModel.read("/ZI_QBON_DD", {
                filters: aFilters,
                success: function (oData) {
                    oView.setBusy(false);

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
        }
    });
});
