sap.ui.define([
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "adobeform/model/formatter"
], function (Filter, FilterOperator, formatter) {
    "use strict";

    var MIN_BONUS_YEAR = 2024;
    var QUARTER_RANK = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };
    var iPeriodRequest = 0;
    var iStatementRequest = 0;

    function read(oModel, sPath, mParameters) {
        return new Promise(function (resolve, reject) {
            oModel.read(sPath, {
                filters: mParameters && mParameters.filters,
                urlParameters: mParameters && mParameters.urlParameters,
                success: function (oData) {
                    resolve(oData);
                },
                error: function (oError) {
                    reject(oError);
                }
            });
        });
    }

    function asText(vValue) {
        if (vValue === undefined || vValue === null) {
            return vValue;
        }
        return String(vValue);
    }

    return {
        createData: function () {
            return {
                role: "employee",
                actingUserId: "",
                selectedEmployeeId: "",
                selectedEmployeeLabel: "",
                years: [],
                year: "",
                quarters: [],
                quarterStatements: {},
                quarterCards: [],
                ytdAmount: "0",
                currency: "MXP",
                periodsLoading: false,
                summariesLoading: false,
                orgTree: [],
                detail: null,
                detailCriteria: { globalId: "", year: "", quarter: "" },
                pdfLoading: false,
                allPeriods: []
            };
        },

        loadPeriods: function (oComponent, sEmployeeId) {
            var oJourney = oComponent.getModel("journey");
            iPeriodRequest = iPeriodRequest + 1;
            iStatementRequest = iStatementRequest + 1;
            var iRequest = iPeriodRequest;

            oJourney.setProperty("/periodsLoading", true);
            oJourney.setProperty("/allPeriods", []);
            oJourney.setProperty("/years", []);
            oJourney.setProperty("/year", "");
            oJourney.setProperty("/quarters", []);
            oJourney.setProperty("/quarterCards", []);
            oJourney.setProperty("/quarterStatements", {});
            oJourney.setProperty("/ytdAmount", "0");
            oJourney.setProperty("/detail", null);

            if (!sEmployeeId) {
                oJourney.setProperty("/periodsLoading", false);
                oJourney.setProperty("/summariesLoading", false);
                return Promise.resolve();
            }

            var oSFModel = oComponent.getModel("mSuccessFactorsModel");
            return read(oSFModel, "/cust_VarPayEmpHistData", {
                filters: [new Filter("externalCode", FilterOperator.EQ, sEmployeeId)],
                urlParameters: {
                    "fromDate": "1900-01-01",
                    "toDate": "9999-12-31",
                    "$select": "cust_VarPayTemplateName",
                    "$orderby": "cust_VarPayTemplateName desc"
                }
            }).then(function (oData) {
                if (iRequest !== iPeriodRequest) {
                    return;
                }
                var aResults = oData.results || [];
                var aPeriods = [];
                var aYears = [];
                var i;
                for (i = 0; i < aResults.length; i++) {
                    var sTemplateName = aResults[i].cust_VarPayTemplateName;
                    if (!sTemplateName) {
                        continue;
                    }
                    var aMatch = sTemplateName.match(/(\d{4})\s+(Q[1-4])/i);
                    if (!aMatch) {
                        continue;
                    }
                    var sYear = aMatch[1];
                    var sQuarter = aMatch[2].toUpperCase();
                    if (parseInt(sYear, 10) < MIN_BONUS_YEAR) {
                        continue;
                    }
                    aPeriods.push({
                        bonusYear: sYear,
                        bonusQuarter: sQuarter,
                        templateName: sTemplateName
                    });
                    if (!aYears.some(function (oYear) { return oYear.year === sYear; })) {
                        aYears.push({ year: sYear });
                    }
                }
                aYears.sort(function (a, b) {
                    return a.year.localeCompare(b.year);
                });
                oJourney.setProperty("/allPeriods", aPeriods);
                oJourney.setProperty("/years", aYears);
                oJourney.setProperty("/year", aYears.length ? aYears[aYears.length - 1].year : "");
                oJourney.setProperty("/periodsLoading", false);
                return this.loadQuarterStatements(oComponent);
            }.bind(this)).catch(function (oError) {
                if (iRequest !== iPeriodRequest) {
                    return;
                }
                oJourney.setProperty("/periodsLoading", false);
                oJourney.setProperty("/summariesLoading", false);
                oJourney.setProperty("/allPeriods", []);
                oJourney.setProperty("/years", []);
                oJourney.setProperty("/year", "");
                throw oError;
            });
        },

        loadQuarterStatements: function (oComponent) {
            var oJourney = oComponent.getModel("journey");
            var sEmployeeId = oJourney.getProperty("/selectedEmployeeId");
            var sYear = oJourney.getProperty("/year");
            var aPeriods = oJourney.getProperty("/allPeriods") || [];
            var aQuarters = [];
            var i;

            for (i = 0; i < aPeriods.length; i++) {
                if (aPeriods[i].bonusYear === sYear && aQuarters.indexOf(aPeriods[i].bonusQuarter) === -1) {
                    aQuarters.push(aPeriods[i].bonusQuarter);
                }
            }
            aQuarters.sort();
            oJourney.setProperty("/quarters", aQuarters);

            if (!sEmployeeId || !sYear || aQuarters.length === 0) {
                oJourney.setProperty("/quarterStatements", {});
                oJourney.setProperty("/quarterCards", []);
                oJourney.setProperty("/ytdAmount", "0");
                oJourney.setProperty("/summariesLoading", false);
                return Promise.resolve();
            }

            iStatementRequest = iStatementRequest + 1;
            var iRequest = iStatementRequest;
            oJourney.setProperty("/summariesLoading", true);

            var oModel = oComponent.getModel();
            var aPromises = [];
            aQuarters.forEach(function (sQuarter) {
                aPromises.push(read(oModel, "/ZI_QBON_DD", {
                    filters: [
                        new Filter("global_id", FilterOperator.EQ, sEmployeeId),
                        new Filter("bonusYear", FilterOperator.EQ, sYear),
                        new Filter("bonusQuarter", FilterOperator.EQ, sQuarter)
                    ],
                    urlParameters: {
                        "$expand": "to_KPIs,to_qSum"
                    }
                }).then(function (oData) {
                    var oRow = oData.results && oData.results[0] ? oData.results[0] : null;
                    return { quarter: sQuarter, row: oRow };
                }, function () {
                    return { quarter: sQuarter, row: null };
                }));
            });

            return Promise.all(aPromises).then(function (aEntries) {
                if (iRequest !== iStatementRequest) {
                    return;
                }
                var oStatements = {};
                var aCards = [];
                var sYtdAmount = "0";
                var sCurrency = "MXP";
                var iBestRank = -1;
                var iEntry;

                for (iEntry = 0; iEntry < aEntries.length; iEntry++) {
                    var sQuarter = aEntries[iEntry].quarter;
                    var oRow = aEntries[iEntry].row;
                    var sPeriod = "";
                    var sAward = "0";
                    var sCardCurrency = sCurrency;

                    if (oRow) {
                        if (oRow.to_KPIs && oRow.to_KPIs.results) {
                            oRow.to_KPIs = oRow.to_KPIs.results;
                        }
                        if (!oRow.to_KPIs) {
                            oRow.to_KPIs = [];
                        }
                        if (oRow.to_qSum && oRow.to_qSum.results) {
                            oRow.to_qSum = oRow.to_qSum.results;
                        }
                        if (!oRow.to_qSum) {
                            oRow.to_qSum = [];
                        }

                        oRow.totalQuarterAward = asText(oRow.totalQuarterAward);
                        oRow.totalBonusYTD = asText(oRow.totalBonusYTD);
                        oRow.bonusableEarnings = asText(oRow.bonusableEarnings);

                        var iKpi;
                        for (iKpi = 0; iKpi < oRow.to_KPIs.length; iKpi++) {
                            var oKpi = oRow.to_KPIs[iKpi];
                            if (!oKpi.KPIName) {
                                oKpi.KPIName = "KPI " + (iKpi + 1);
                            }
                            oKpi.proratedTarget = asText(oKpi.proratedTarget);
                            oKpi.kpiWeight = asText(oKpi.kpiWeight);
                            oKpi.kpiTargetAmount = asText(oKpi.kpiTargetAmount);
                            oKpi.kpiPayoutPercent = asText(oKpi.kpiPayoutPercent);
                            oKpi.kpiPayout = asText(oKpi.kpiPayout);
                            oKpi.kpiResTarget = asText(oKpi.kpiResTarget);
                            oKpi.kpiResAchievement = asText(oKpi.kpiResAchievement);

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
                            var fPayoutY = fPayout <= 1 ? fPayout * 100 : fPayout;
                            oKpi.chartPoints = [
                                { x: 0, y: 0 },
                                { x: fTarget, y: 100 },
                                { x: fAchievement, y: fPayoutY }
                            ];
                        }

                        var iSum;
                        for (iSum = 0; iSum < oRow.to_qSum.length; iSum++) {
                            var oSum = oRow.to_qSum[iSum];
                            oSum.bonusableQuarterEarn = asText(oSum.bonusableQuarterEarn);
                            oSum.quarterTargetPercent = asText(oSum.quarterTargetPercent);
                            oSum.paymentPeriod = asText(oSum.paymentPeriod);
                            oSum.quarterTargetAmount = asText(oSum.quarterTargetAmount);
                            oSum.segmentAward = asText(oSum.segmentAward);
                        }

                        oStatements[sQuarter] = oRow;
                        sPeriod = formatter.spanPeriodRangeForQuarter(oRow.to_qSum, sQuarter);
                        sAward = oRow.totalQuarterAward || "0";
                        sCardCurrency = oRow.currency || "MXP";

                        var iRank = QUARTER_RANK[sQuarter] || 0;
                        if (iRank >= iBestRank) {
                            iBestRank = iRank;
                            sYtdAmount = oRow.totalBonusYTD || "0";
                            sCurrency = sCardCurrency;
                        }
                    }

                    aCards.push({
                        quarter: sQuarter,
                        periodDays: sPeriod,
                        totalQuarterAward: sAward,
                        currency: sCardCurrency,
                        statement: oRow
                    });
                }

                oJourney.setProperty("/quarterStatements", oStatements);
                oJourney.setProperty("/quarterCards", aCards);
                oJourney.setProperty("/ytdAmount", sYtdAmount);
                oJourney.setProperty("/currency", sCurrency);
                oJourney.setProperty("/summariesLoading", false);
            });
        },

        loadManagerTree: function (oComponent, sRootUserId) {
            var oJourney = oComponent.getModel("journey");
            var oSFModel = oComponent.getModel("mSuccessFactorsModel");
            return read(oSFModel, "/User('" + sRootUserId + "')", {
                urlParameters: {
                    "$select": "userId,firstName,lastName,directReports/userId,directReports/firstName,directReports/lastName,directReports/directReports/userId,directReports/directReports/firstName,directReports/directReports/lastName,directReports/directReports/directReports/userId,directReports/directReports/directReports/firstName,directReports/directReports/directReports/lastName",
                    "$expand": "directReports,directReports/directReports,directReports/directReports/directReports"
                }
            }).then(function (oUserData) {
                var aDirectReports = (oUserData.directReports && oUserData.directReports.results) ? oUserData.directReports.results : [];
                var oRoot = {
                    empid: oUserData.userId,
                    firstname: oUserData.firstName || "",
                    lastname: oUserData.lastName || "",
                    title: ((oUserData.firstName || "") + " " + (oUserData.lastName || "")).trim() + " (" + oUserData.userId + ")",
                    nodes: []
                };

                var i;
                for (i = 0; i < aDirectReports.length; i++) {
                    var oDirect = aDirectReports[i];
                    var aSubReports = (oDirect.directReports && oDirect.directReports.results) ? oDirect.directReports.results : [];
                    var oDirectNode = {
                        empid: oDirect.userId,
                        firstname: oDirect.firstName || "",
                        lastname: oDirect.lastName || "",
                        title: ((oDirect.firstName || "") + " " + (oDirect.lastName || "")).trim() + " (" + oDirect.userId + ")",
                        nodes: []
                    };
                    var j;
                    for (j = 0; j < aSubReports.length; j++) {
                        var oSub = aSubReports[j];
                        var aSubSubReports = (oSub.directReports && oSub.directReports.results) ? oSub.directReports.results : [];
                        var oSubNode = {
                            empid: oSub.userId,
                            firstname: oSub.firstName || "",
                            lastname: oSub.lastName || "",
                            title: ((oSub.firstName || "") + " " + (oSub.lastName || "")).trim() + " (" + oSub.userId + ")",
                            nodes: []
                        };
                        var k;
                        for (k = 0; k < aSubSubReports.length; k++) {
                            var oLeaf = aSubSubReports[k];
                            oSubNode.nodes.push({
                                empid: oLeaf.userId,
                                firstname: oLeaf.firstName || "",
                                lastname: oLeaf.lastName || "",
                                title: ((oLeaf.firstName || "") + " " + (oLeaf.lastName || "")).trim() + " (" + oLeaf.userId + ")",
                                nodes: []
                            });
                        }
                        oDirectNode.nodes.push(oSubNode);
                    }
                    oRoot.nodes.push(oDirectNode);
                }

                oJourney.setProperty("/orgTree", [oRoot]);
            });
        },

        openPdf: function (oComponent) {
            var oJourney = oComponent.getModel("journey");
            var oCriteria = oJourney.getProperty("/detailCriteria") || {};
            var sLang = oComponent.getModel("appSettings").getProperty("/language") || "en";
            var oModel = oComponent.getModel();

            return read(oModel, "/ZI_QBON_DD", {
                filters: [
                    new Filter("global_id", FilterOperator.EQ, oCriteria.globalId),
                    new Filter("bonusYear", FilterOperator.EQ, oCriteria.year),
                    new Filter("bonusQuarter", FilterOperator.EQ, oCriteria.quarter),
                    new Filter("generatePdfRequest", FilterOperator.EQ, sLang)
                ]
            }).then(function (oData) {
                var sBase64 = oData.results && oData.results[0] && oData.results[0].PdfContent;
                if (!sBase64) {
                    return Promise.reject(new Error("PDF_FAILED"));
                }
                var sClean = String(sBase64).replace(/\s/g, "");
                var sBinary = window.atob(sClean);
                var aBytes = new Uint8Array(sBinary.length);
                var i;
                for (i = 0; i < sBinary.length; i++) {
                    aBytes[i] = sBinary.charCodeAt(i);
                }
                var oBlob = new Blob([aBytes], { type: "application/pdf" });
                var sUrl = URL.createObjectURL(oBlob);
                var oTab = window.open(sUrl, "_blank");
                if (!oTab) {
                    return Promise.reject(new Error("PDF_POPUP_BLOCKED"));
                }
            });
        }
    };
});
