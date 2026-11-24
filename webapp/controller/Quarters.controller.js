sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "adobeform/model/formatter"
], function (Controller, JSONModel, Filter, FilterOperator, MessageToast, MessageBox, formatter) {
    "use strict";

    return Controller.extend("adobeform.controller.Quarters", {

        onInit: function () {
            this.getOwnerComponent().getRouter().getRoute("RouteQuarters").attachPatternMatched(this.onRouteMatched, this);
        },

        onFlexColStateChange: function (oEvent) {
            var bIsPhone = oEvent.getParameter("isPhone");
            var oDetailModel = this.getOwnerComponent().getModel("mDetailModel");
            var bDetailOpen = oDetailModel && oDetailModel.getProperty("/isPdfButtonVisible");
            if (bDetailOpen) {
                return;
            }
            this.byId("fcl").setLayout(!bIsPhone && window.innerWidth > 900 ? "TwoColumnsMidExpanded" : "OneColumn");
        },

        onRouteMatched: function () {
            var oQuartersModel = this.getOwnerComponent().getModel("mQuartersModel");
            var sYear = oQuartersModel && oQuartersModel.getProperty("/searchCriteria/year");
            var aCards = (oQuartersModel && oQuartersModel.getProperty("/quarterCards")) || [];
            if (!sYear || aCards.length === 0) {
                this.getOwnerComponent().getRouter().navTo("RouteStart", {}, true);
                return;
            }
            this.onCloseDetail();
            this.byId("fcl").setLayout(window.innerWidth > 900 ? "TwoColumnsMidExpanded" : "OneColumn");
        },

        onBack: function () {
            this.onCloseDetail();
            this.getOwnerComponent().getRouter().navTo("RouteStart");
        },

        onSelectQuarter: function (oEvent) {
            var oList = oEvent.getSource();
            var oItem = oEvent.getParameter("listItem");
            var oQuarter = oItem.getBindingContext("mQuartersModel").getObject();
            var oLang = this.getView().getModel("i18n").getResourceBundle();
            if (!oQuarter.statement) {
                oList.removeSelections(true);
                MessageToast.show(oLang.getText("NO_RECORDS"));
                return;
            }

            var oQuartersModel = this.getOwnerComponent().getModel("mQuartersModel");
            var oDetailModel = this.getOwnerComponent().getModel("mDetailModel");
            var oCriteria = oQuartersModel.getProperty("/searchCriteria");

            oDetailModel.setProperty("/searchCriteria", {
                globalId: oCriteria.globalId,
                year: oCriteria.year,
                quarter: oQuarter.quarter
            });
            oDetailModel.setProperty("/data", oQuarter.statement);
            oDetailModel.setProperty("/isPdfButtonVisible", true);

            var aQuarterSummaries = oQuarter.statement.to_qSum || [];
            var aAllKpis = oQuarter.statement.to_KPIs || [];

            var sCurrency = oQuarter.statement.currency || "";
            var fQuarterlyTargetAmount = 0;
            var aPlans = aQuarterSummaries.map(function (oSummary) {
                var aMatchedKpis = aAllKpis.filter(function (oKpi) {
                    return oKpi.startKpiDate === oSummary.startQSumDate && oKpi.endKpiDate === oSummary.endQSumDate;
                });
                if (aMatchedKpis.length === 0 && aQuarterSummaries.length === 1) {
                    aMatchedKpis = aAllKpis;
                }
                var oFirstKpi = aMatchedKpis[0] || aAllKpis[0] || {};
                fQuarterlyTargetAmount += parseFloat(String(oSummary.quarterTargetAmount || "0").trim()) || 0;

                return {
                    periodDays: formatter.formatDateRange(oSummary.startQSumDate, oSummary.endQSumDate),
                    planType: oSummary.planType || "",
                    quarterTargetAmount: oSummary.quarterTargetAmount,
                    prorationPercent: oSummary.prorationPercent || oSummary.paymentPeriod,
                    proratedTarget: oFirstKpi.proratedTarget,
                    segmentAward: oSummary.segmentAward,
                    showCalc: false,
                    kpis: aMatchedKpis.map(function (oKpi) {
                        return Object.assign({}, oKpi, {
                            prorationPercent: oSummary.prorationPercent || oSummary.paymentPeriod
                        }, this._buildKpiChartData(oKpi, sCurrency, oLang));
                    }.bind(this))
                };
            }.bind(this));

            this.getView().setModel(new JSONModel({
                earnings: {
                    bonusableQuarterEarn: aQuarterSummaries[0]?.bonusableQuarterEarn || oQuarter.statement.bonusableEarnings,
                    quarterTargetPercent: aQuarterSummaries[0]?.quarterTargetPercent,
                    quarterTargetAmount: aQuarterSummaries.length > 1
                        ? String(fQuarterlyTargetAmount)
                        : (aQuarterSummaries[0]?.quarterTargetAmount || "0"),
                    showCalc: false
                },
                plans: aPlans
            }), "mChartModel");

            var oFcl = this.byId("fcl");
            oFcl.setLayout("TwoColumnsMidExpanded");
            oFcl.toMidColumnPage(this.byId("detailPage"), "slide");
        },

        onCloseDetail: function () {
            var oList = this.byId("quarterList");
            if (oList) {
                oList.removeSelections(true);
            }
            var oFcl = this.byId("fcl");
            if (oFcl) {
                oFcl.backToTopMidColumn();
                if (window.innerWidth <= 900) {
                    oFcl.setLayout("OneColumn");
                }
            }
            var oDetailPage = this.byId("detailPage");
            if (oDetailPage && oDetailPage.scrollTo) {
                oDetailPage.scrollTo(0, 0);
            }
            this.getView().setModel(new JSONModel({}), "mChartModel");
            var oDetailModel = this.getOwnerComponent().getModel("mDetailModel");
            if (oDetailModel) {
                oDetailModel.setProperty("/data", {});
                oDetailModel.setProperty("/isPdfButtonVisible", false);
            }
        },

        // =======================================================
        // CHART DATA
        // =======================================================
        _buildKpiChartData: function (oKpi, sCurrency, oLang) {
            var aRawPoints = [
                { val: parseFloat(oKpi.kpiResThreshold), y: parseFloat(oKpi.kpiThresholdPercent) },
                { val: parseFloat(oKpi.kpiResTarget), y: 100 },
                { val: parseFloat(oKpi.kpiResAchievement), y: parseFloat(oKpi.kpiPayoutPercent) },
                { val: parseFloat(oKpi.kpiResMaxPayout), y: parseFloat(oKpi.kpiMaxPayoutPercent) }
            ].filter(function (oPoint) {
                return !isNaN(oPoint.val) && !isNaN(oPoint.y);
            }).sort(function (a, b) {
                return a.val - b.val;
            });

            if (aRawPoints.length > 0 && aRawPoints[0].y > 0) {
                aRawPoints.unshift({ val: 0, y: 0 });
            }

            var aPoints = aRawPoints.map(function (oPoint) {
                return {
                    label: oPoint.val === 0 ? "0" : this.formatCleanNumber(oPoint.val),
                    payoutPercent: oPoint.y
                };
            }.bind(this));

            var sAchievementLabel = this.formatCleanNumber(oKpi.kpiResAchievement);

            return {
                chartPoints: aPoints,
                vizProperties: {
                    title: { visible: false },
                    legend: { visible: false },
                    categoryAxis: {
                        title: {
                            visible: true,
                            text: sCurrency
                                ? oLang.getText("KPI_RESULT") + " (" + sCurrency + ")"
                                : oLang.getText("KPI_RESULT")
                        },
                        label: {
                            visible: true,
                            hideSubLevels: false,
                            style: { fontSize: "11px" }
                        }
                    },
                    valueAxis: {
                        title: { visible: true, text: oLang.getText("PAYOUT_PERCENT") }
                    },
                    plotArea: {
                        colorPalette: ["#ABC2DB"],
                        dataLabel: { visible: false },
                        marker: { visible: true, size: 5 },
                        dataPointStyle: sAchievementLabel ? {
                            rules: [{
                                dataContext: { "KPI result": sAchievementLabel },
                                properties: { color: "#0068FF", size: 10 },
                                displayName: oLang.getText("ACHIEVEMENT")
                            }],
                            others: {
                                properties: { color: "#ABC2DB" },
                                displayName: oLang.getText("PAYOUT_PERCENT")
                            }
                        } : {}
                    },
                    interaction: {
                        selectability: { mode: "none" }
                    },
                    tooltip: { visible: true }
                }
            };
        },

        // =======================================================
        // PDF GENERATION
        // =======================================================
        onGeneratePress: function () {
            var oView = this.getView();
            var oDetailModel = this.getOwnerComponent().getModel("mDetailModel");
            var oCriteria = oDetailModel.getProperty("/searchCriteria") || {};
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

            oDetailModel.setProperty("/pdfLoading", true);
            oView.setBusy(true);
            oODataModel.read("/ZI_QBON_DD", {
                filters: aFilters,
                success: function (oData) {
                    oView.setBusy(false);
                    oDetailModel.setProperty("/pdfLoading", false);

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
                    oDetailModel.setProperty("/pdfLoading", false);
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
            var fValue = parseFloat(String(sValue).trim());
            if (isNaN(fValue)) {
                return sValue;
            }
            return fValue.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 20
            });
        },

        formatPercent: function (sValue) {
            var sFormatted = this.formatCleanNumber(sValue);
            return sFormatted ? sFormatted + "%" : "";
        }
    });
});
