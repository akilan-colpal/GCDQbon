sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/base/i18n/Localization",
    "sap/ui/core/format/DateFormat"
], function (Controller, Filter, FilterOperator, MessageBox, Localization, DateFormat) {
    "use strict";

    return Controller.extend("adobeform.controller.gcdStatementResults", {

        onInit: function () {
            var oView = this.getView();
            var oParent = oView.getParent();
            while (oParent && !oParent.getModel()) {
                oParent = oParent.getParent && oParent.getParent();
            }
            if (oParent && oParent.getModel() && oParent.getModel() !== oView.getModel()) {
                oView.setModel(oParent.getModel());
            }

            this.byId("resultsRoot").bindElement("/data");
            var oModel = oView.getModel();
            if (oModel && !oModel.getProperty("/ui")) {
                oModel.setProperty("/ui", {
                    selectedKpiName: "",
                    selectedKpiChart: [],
                    quarterProgressChart: []
                });
            }

            this._initCharts();
            Localization.attachChange(this._applyChartTexts, this);
        },

        onExit: function () {
            Localization.detachChange(this._applyChartTexts, this);
        },

        _initCharts: function () {
            var oKpiChart = this.byId("kpiCompareChart");
            if (oKpiChart) {
                oKpiChart.setUiConfig({ applicationSet: "fiori" });
                oKpiChart.setVizProperties({
                    plotArea: {
                        dataLabel: { visible: true },
                        colorPalette: ["#5BC5E5", "#1E9D8F"]
                    },
                    title: { visible: false },
                    legend: { visible: false },
                    categoryAxis: { title: { visible: false } },
                    valueAxis: { title: { visible: false } }
                });
            }

            var oProgressChart = this.byId("quarterProgressChart");
            if (oProgressChart) {
                oProgressChart.setUiConfig({ applicationSet: "fiori" });
                oProgressChart.setVizProperties({
                    plotArea: {
                        dataLabel: { visible: true },
                        colorPalette: ["#5BC5E5", "#4E67B0"]
                    },
                    title: { visible: false },
                    legend: {
                        visible: true,
                        position: "bottom"
                    },
                    categoryAxis: { title: { visible: false } },
                    valueAxis: { title: { visible: false } }
                });
            }

            this._applyChartTexts();
        },

        _applyChartTexts: function () {
            var oI18nModel = this.getView().getModel("i18n");
            if (!oI18nModel) {
                return;
            }
            var oBundle = oI18nModel.getResourceBundle();
            var sValue = oBundle.getText("VALUE");
            var sSegment = oBundle.getText("CHART_SEGMENT_AWARD");
            var sTarget = oBundle.getText("CHART_QUARTER_TARGET");

            var oMeasure = this.byId("kpiDetailMeasure");
            var oValueFeed = this.byId("kpiValueFeed");
            if (oMeasure) {
                oMeasure.setName(sValue);
            }
            if (oValueFeed) {
                oValueFeed.setValues([sValue]);
            }

            var oSegmentMeasure = this.byId("segmentAwardMeasure");
            var oTargetMeasure = this.byId("quarterTargetMeasure");
            var oSegmentFeed = this.byId("segmentAwardFeed");
            var oTargetFeed = this.byId("quarterTargetFeed");
            if (oSegmentMeasure) {
                oSegmentMeasure.setName(sSegment);
            }
            if (oTargetMeasure) {
                oTargetMeasure.setName(sTarget);
            }
            if (oSegmentFeed) {
                oSegmentFeed.setValues([sSegment]);
            }
            if (oTargetFeed) {
                oTargetFeed.setValues([sTarget]);
            }

            this._refreshChart("kpiCompareChart");
            this._refreshChart("quarterProgressChart");
        },

        onDataReady: function () {
            var oModel = this.getView().getModel();
            var oData = oModel.getProperty("/data") || {};
            var aKpis = oData.to_KPIs || [];
            var aQSum = oData.to_qSum || [];

            oModel.setProperty("/ui/quarterProgressChart", this._prepareQuarterProgressChart(aQSum));
            oModel.setProperty("/ui/selectedKpiName", "");
            oModel.setProperty("/ui/selectedKpiChart", []);

            if (aKpis.length > 0) {
                this._selectKpi(aKpis[0]);
                this._syncPanelExpansion(aKpis[0].KPIName);
            }

            this._refreshChart("kpiCompareChart");
            this._refreshChart("quarterProgressChart");
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
            this._refreshChart("kpiCompareChart");
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

        _prepareQuarterProgressChart: function (aQSum) {
            if (!Array.isArray(aQSum)) {
                return [];
            }

            return aQSum
                .slice()
                .sort(function (a, b) {
                    var sA = String(a.startQSumDate || a.summaryQuarter || "");
                    var sB = String(b.startQSumDate || b.summaryQuarter || "");
                    return sA.localeCompare(sB);
                })
                .map(function (oRow) {
                    var sQuarter = oRow.summaryQuarter || "";
                    var sStart = this._formatKpiDate(oRow.startQSumDate);
                    var sEnd = this._formatKpiDate(oRow.endQSumDate);
                    var sPeriod = sStart && sEnd ? sStart + "–" + sEnd : (sStart || sEnd || "");
                    var sCategory = sQuarter;
                    if (sPeriod) {
                        sCategory = sQuarter ? sQuarter + " · " + sPeriod : sPeriod;
                    }
                    if (oRow.planType) {
                        sCategory = sCategory ? sCategory + " (" + oRow.planType + ")" : oRow.planType;
                    }

                    return {
                        category: sCategory || "—",
                        segmentAward: this._toNumber(oRow.segmentAward),
                        quarterTargetAmount: this._toNumber(oRow.quarterTargetAmount)
                    };
                }.bind(this));
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

        _refreshChart: function (sId) {
            var oChart = this.byId(sId);
            if (!oChart) {
                return;
            }
            setTimeout(function () {
                oChart.invalidate();
            }, 200);
        },

        _formatKpiDate: function (sValue) {
            if (!sValue) {
                return "";
            }
            var oParse = DateFormat.getDateInstance({ pattern: "yyyyMMdd", UTC: true });
            var oDate = oParse.parse(String(sValue));
            if (!oDate) {
                return "";
            }
            var oDisplay = DateFormat.getDateInstance({ pattern: "MMM dd", UTC: true });
            return oDisplay.format(oDate);
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

            var oAppSettings = this.getOwnerComponent().getModel("appSettings");
            var sPdfLanguage = (oAppSettings && oAppSettings.getProperty("/language")) || "en";

            var aFilters = [
                new Filter("global_id", FilterOperator.EQ, sGlobalId),
                new Filter("bonusYear", FilterOperator.EQ, sYear),
                new Filter("bonusQuarter", FilterOperator.EQ, sQuarter),
                new Filter("generatePdfRequest", FilterOperator.EQ, sPdfLanguage)
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
        },

        formatCompareTitle: function (sLabel, sKpiName) {
            if (!sKpiName) {
                return sLabel || "";
            }
            return (sLabel || "") + ": " + sKpiName;
        }
    });
});
