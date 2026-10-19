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
            var oModel = this.getView().getModel();
            if (oModel && !oModel.getProperty("/ui")) {
                oModel.setProperty("/ui", {
                    selectedKpiName: "",
                    selectedKpiChart: []
                });
            }

            var oChart = this.byId("kpiChart");
            if (oChart) {
                oChart.setUiConfig({ applicationSet: "fiori" });
                oChart.setVizProperties({
                    plotArea: {
                        dataLabel: { visible: true },
                        colorPalette: ["#5BC5E5", "#1E9D8F"]
                    },
                    title: { visible: false },
                    legend: { visible: false },
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
            var sValue = oBundle.getText("VALUE");
            var oMeasure = this.byId("kpiDetailMeasure");
            var oValueFeed = this.byId("kpiValueFeed");
            if (oMeasure) {
                oMeasure.setName(sValue);
            }
            if (oValueFeed) {
                oValueFeed.setValues([sValue]);
            }
            var oChart = this.byId("kpiChart");
            if (oChart) {
                oChart.invalidate();
            }
        },

        onDataReady: function () {
            var oModel = this.getView().getModel();
            oModel.setProperty("/ui/selectedKpiName", "");
            oModel.setProperty("/ui/selectedKpiChart", []);
            var oNav = this.byId("resultsNav");
            if (oNav) {
                oNav.to(this.byId("summaryPage"));
            }
            this._refreshChart();
        },

        onKpiPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            if (!oContext) {
                return;
            }
            this._openKpiDetail(oContext.getObject());
        },

        onKpiPanelExpand: function (oEvent) {
            if (!oEvent.getParameter("expand")) {
                return;
            }
            var oContext = oEvent.getSource().getBindingContext();
            if (!oContext) {
                return;
            }
            this._selectKpi(oContext.getObject());
        },

        onNavBackToSummary: function () {
            this.byId("resultsNav").back();
        },

        _openKpiDetail: function (oKpi) {
            this._selectKpi(oKpi);
            this.byId("resultsNav").to(this.byId("kpiDetailPage"));
            this._syncPanelExpansion(oKpi.KPIName);
            this._refreshChart();
        },

        _selectKpi: function (oKpi) {
            var oModel = this.getView().getModel();
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            oModel.setProperty("/ui/selectedKpiName", oKpi.KPIName || "");
            oModel.setProperty("/ui/selectedKpiChart", [
                {
                    metric: oBundle.getText("CHART_KPI_TARGET"),
                    value: this._toNumber(oKpi.kpiResTarget)
                },
                {
                    metric: oBundle.getText("CHART_KPI_ACHIEVEMENT"),
                    value: this._toNumber(oKpi.kpiResAchievement)
                }
            ]);
        },

        _syncPanelExpansion: function (sKpiName) {
            var oList = this.byId("kpiDetailList");
            if (!oList) {
                return;
            }
            setTimeout(function () {
                oList.getItems().forEach(function (oItem) {
                    var aContent = oItem.getContent ? oItem.getContent() : [];
                    var oPanel = aContent[0];
                    if (!oPanel || !oPanel.setExpanded) {
                        return;
                    }
                    var oCtx = oPanel.getBindingContext();
                    var sName = oCtx && oCtx.getProperty("KPIName");
                    oPanel.setExpanded(sName === sKpiName);
                });
            }, 0);
        },

        _refreshChart: function () {
            var oChart = this.byId("kpiChart");
            if (!oChart) {
                return;
            }
            setTimeout(function () {
                oChart.invalidate();
            }, 200);
        },

        _toNumber: function (sValue) {
            var fValue = parseFloat(sValue);
            return isNaN(fValue) ? 0 : fValue;
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
            if (sValue === null || sValue === undefined || sValue === "") {
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
            var sNumber = this.formatCleanNumber(sValue);
            return sNumber === "" ? "" : sNumber + "%";
        },

        formatMoneyWithCurrency: function (sValue) {
            var sNumber = this.formatCleanNumber(sValue);
            if (!sNumber) {
                return "";
            }
            var oData = this.getView().getModel().getProperty("/data") || {};
            var sCurrency = oData.currency || "";
            return "$" + sNumber + (sCurrency ? " " + sCurrency : "");
        }
    });
});
