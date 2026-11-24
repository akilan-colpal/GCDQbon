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

        onFclStateChange: function (oEvent) {
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
            var oDetailModel = this.getOwnerComponent().getModel("mDetailModel");
            if (!oDetailModel || !oDetailModel.getProperty("/isPdfButtonVisible")) {
                this.byId("fcl").setLayout(window.innerWidth > 900 ? "TwoColumnsMidExpanded" : "OneColumn");
            }
        },

        onBack: function () {
            this.onCloseDetail();
            this.getOwnerComponent().getRouter().navTo("RouteStart");
        },

        onSelectQuarter: function (oEvent) {
            var oQuarter = oEvent.getSource().getBindingContext("mQuartersModel").getObject();
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            if (!oQuarter.statement) {
                MessageToast.show(oBundle.getText("NO_RECORDS"));
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

            var aSums = oQuarter.statement.to_qSum || [];
            var aAllKpis = oQuarter.statement.to_KPIs || [];

            var fnBuildKpi = function (oKpi, oSum) {
                var aPoints = [
                    { x: Number(oKpi.kpiResThreshold), y: Number(oKpi.kpiThresholdPercent), show: false },
                    { x: Number(oKpi.kpiResMinPayout), y: Number(oKpi.kpiMinPayoutPercent), show: false },
                    { x: Number(oKpi.kpiResTarget), y: 100, show: false },
                    { x: Number(oKpi.kpiResAchievement), y: Number(oKpi.kpiPayoutPercent), show: true },
                    { x: Number(oKpi.kpiResMaxPayout), y: Number(oKpi.kpiMaxPayoutPercent), show: false }
                ].sort(function (a, b) {
                    return a.x - b.x;
                });

                return Object.assign({}, oKpi, {
                    prorationPercent: oSum.prorationPercent || oSum.paymentPeriod,
                    chartPoints: aPoints
                });
            };

            var oFirstSum = aSums[0] || {};
            var fQuarterlyTargetAmount = 0;
            var aPlans = aSums.map(function (oSum) {
                var aMatchedKpis = aAllKpis.filter(function (oKpi) {
                    return oKpi.startKpiDate === oSum.startQSumDate && oKpi.endKpiDate === oSum.endQSumDate;
                });
                if (aMatchedKpis.length === 0 && aSums.length === 1) {
                    aMatchedKpis = aAllKpis;
                }
                var oFirstKpi = aMatchedKpis[0] || aAllKpis[0] || {};
                fQuarterlyTargetAmount += parseFloat(String(oSum.quarterTargetAmount || "0").trim()) || 0;

                return {
                    periodDays: formatter.formatDateRange(oSum.startQSumDate, oSum.endQSumDate),
                    planType: oSum.planType || "",
                    quarterTargetAmount: oSum.quarterTargetAmount,
                    prorationPercent: oSum.prorationPercent || oSum.paymentPeriod,
                    proratedTarget: oFirstKpi.proratedTarget,
                    segmentAward: oSum.segmentAward,
                    kpis: aMatchedKpis.map(function (oKpi) {
                        return fnBuildKpi(oKpi, oSum);
                    })
                };
            });

            this.getView().setModel(new JSONModel({
                earnings: {
                    bonusableQuarterEarn: oFirstSum.bonusableQuarterEarn || oQuarter.statement.bonusableEarnings,
                    quarterTargetPercent: oFirstSum.quarterTargetPercent,
                    quarterTargetAmount: aSums.length > 1
                        ? String(fQuarterlyTargetAmount)
                        : (oFirstSum.quarterTargetAmount || "0")
                },
                plans: aPlans
            }), "mChartModel");

            var oFcl = this.byId("fcl");
            oFcl.setLayout("TwoColumnsMidExpanded");
            oFcl.toMidColumnPage(this.byId("detailPage"), "slide");
        },

        onCloseDetail: function () {
            var oFcl = this.byId("fcl");
            if (oFcl) {
                oFcl.backToTopMidColumn();
                if (window.innerWidth <= 900) {
                    oFcl.setLayout("OneColumn");
                }
            }
            var oDetailModel = this.getOwnerComponent().getModel("mDetailModel");
            if (oDetailModel) {
                oDetailModel.setProperty("/data", {});
                oDetailModel.setProperty("/isPdfButtonVisible", false);
            }
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
                maximumFractionDigits: 2
            });
        },

        formatPercent: function (sValue) {
            var sFormatted = this.formatCleanNumber(sValue);
            return sFormatted ? sFormatted + "%" : "";
        }
    });
});
