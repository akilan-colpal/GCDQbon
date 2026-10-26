sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox"
], function (Controller, Filter, FilterOperator, MessageBox) {
    "use strict";

    return Controller.extend("adobeform.controller.gcdStatementResults", {

        onInit: function () {
            // Nested XMLView: inherit the filter page model
            var oView = this.getView();
            var oParent = oView.getParent();
            while (oParent && !oParent.getModel()) {
                oParent = oParent.getParent && oParent.getParent();
            }
            if (oParent && oParent.getModel() && oParent.getModel() !== oView.getModel()) {
                oView.setModel(oParent.getModel());
            }
            this.byId("resultsRoot").bindElement("/data");
        },

        // =======================================================
        // AESTHETIC: tier rows + payout curve after search
        // =======================================================
        onDataReady: function () {
            var oModel = this.getView().getModel();
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            var sTarget = oBundle.getText("TIER_TARGET");
            var sAchievement = oBundle.getText("TIER_ACHIEVEMENT");
            var aKpis = ((oModel.getProperty("/data") || {}).to_KPIs || []).slice();

            aKpis.forEach(function (oKpi) {
                var fTarget = parseFloat(oKpi.kpiResTarget) || 0;
                var fAchievement = parseFloat(oKpi.kpiResAchievement) || 0;

                oKpi.tierRows = [
                    {
                        tier: sTarget,
                        kpiResult: oKpi.kpiResTarget,
                        payoutPercent: 100,
                        amount: oKpi.kpiTargetAmount
                    },
                    {
                        tier: sAchievement,
                        kpiResult: oKpi.kpiResAchievement,
                        payoutPercent: oKpi.kpiPayoutPercent,
                        amount: oKpi.kpiPayout
                    }
                ];

                oKpi.payoutCurve = [
                    {
                        category: sTarget + " (" + (this.formatCleanNumber(oKpi.kpiResTarget) || "0") + ")",
                        sortValue: fTarget,
                        payoutPercent: 100
                    },
                    {
                        category: sAchievement + " (" + (this.formatCleanNumber(oKpi.kpiResAchievement) || "0") + ")",
                        sortValue: fAchievement,
                        payoutPercent: parseFloat(oKpi.kpiPayoutPercent) || 0
                    }
                ].sort(function (a, b) {
                    return a.sortValue - b.sortValue;
                });
                oKpi.payoutCurve.unshift({ category: "0", sortValue: 0, payoutPercent: 0 });
            }.bind(this));

            oModel.setProperty("/data/to_KPIs", aKpis);

            var oList = this.byId("kpiDetailList");
            if (oList && oList.getBinding("items")) {
                oList.getBinding("items").refresh(true);
            }
            // Style charts once after binding — not on every accordion expand
            setTimeout(this._stylePayoutCharts.bind(this), 0);
        },

        _stylePayoutCharts: function () {
            var oLabel = { style: { color: "#ffffff" } };
            var oProps = {
                general: { background: { color: "transparent" } },
                plotArea: {
                    background: { color: "transparent" },
                    dataLabel: { visible: true, style: { color: "#ffffff" } },
                    colorPalette: ["#53BFEC"],
                    gridline: { color: "rgba(255,255,255,0.2)" }
                },
                title: { visible: false },
                legend: { visible: false },
                categoryAxis: { title: { visible: false }, label: oLabel, color: "#ffffff" },
                valueAxis: { title: { visible: false }, label: oLabel, color: "#ffffff" }
            };
            this.getView().findAggregatedObjects(true, function (oControl) {
                return oControl.isA && oControl.isA("sap.viz.ui5.controls.VizFrame");
            }).forEach(function (oChart) {
                if (oChart.data("chartStyled")) {
                    return;
                }
                oChart.setUiConfig({ applicationSet: "fiori" });
                oChart.setVizProperties(oProps);
                oChart.data("chartStyled", true);
            });
        },

        // VizFrame needs a laid-out container — wait for panel expand animation to finish
        onKpiPanelExpand: function (oEvent) {
            if (!oEvent.getParameter("expand")) {
                return;
            }
            var aCharts = oEvent.getSource().findAggregatedObjects(true, function (oControl) {
                return oControl.isA && oControl.isA("sap.viz.ui5.controls.VizFrame");
            });
            setTimeout(function () {
                aCharts.forEach(function (oChart) {
                    oChart.invalidate();
                });
            }, 300);
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
            if (!sValue && sValue !== 0) {
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
