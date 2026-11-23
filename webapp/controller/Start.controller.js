sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/BusyDialog",
    "adobeform/controller/HRValueHelpHandler.controller",
    "adobeform/controller/EmployeeValueHelpHandler.controller",
    "adobeform/model/formatter"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, BusyDialog, HRValueHelpHandler, EmployeeValueHelpHandler, formatter) {
    "use strict";

    return Controller.extend("adobeform.controller.Start", {

        onInit: function () {
            var oQuartersModel = this.getOwnerComponent().getModel("mQuartersModel");

            this.oValueHelpHandler = new HRValueHelpHandler(this);
            this.oEmployeeTreeHandler = new EmployeeValueHelpHandler(this);

            var oUserDataModel = this.getOwnerComponent().getModel("mUserDataModel");
            var bIsHR = oUserDataModel.getProperty("/isHR");
            var bIsMgr = oUserDataModel.getProperty("/isMgr");

            if (bIsMgr && !bIsHR) {
                this._preloadTreeData();
            } else {
                var sEmpId = oUserDataModel.getProperty("/userId");
                var sDisplayName = oUserDataModel.getProperty("/displayName");
                oQuartersModel.setProperty("/selectedEmployeeLabel", this._formatEmployeeLabel(sDisplayName, sEmpId));
                oQuartersModel.setProperty("/searchCriteria/globalId", sEmpId);
                this._updateSearchEnabled();
                this._loadDropdownData(sEmpId);
            }
        },

        _formatEmployeeLabel: function (sName, sId) {
            if (sName && sName !== sId) {
                return sName + " (" + sId + ")";
            }
            return sId || "";
        },

        // =======================================================
        // SUCCESSFACTORS HELPERS
        // =======================================================
        _fetchSFData: function (sPath, oUrlParams) {
            var oSFModel = this.getOwnerComponent().getModel("mSuccessFactorsModel");
            return new Promise(function (resolve, reject) {
                oSFModel.read(sPath, {
                    urlParameters: oUrlParams,
                    success: function (oData) { resolve(oData); },
                    error: function (oError) { reject(oError); }
                });
            });
        },

        _mapTreeNode: function (oUser) {
            var aReports = (oUser.directReports && oUser.directReports.results) ? oUser.directReports.results : [];
            return {
                empid: oUser.userId,
                firstname: oUser.firstName,
                lastname: oUser.lastName,
                nodes: aReports.map(this._mapTreeNode.bind(this))
            };
        },

        // =======================================================
        // TREE DATA LOAD
        // =======================================================
        _preloadTreeData: async function () {
            var oView = this.getView();
            var oViewModel = this.getOwnerComponent().getModel("mQuartersModel");
            var oUserDataModel = this.getOwnerComponent().getModel("mUserDataModel");
            var sRootEmpId = oUserDataModel.getProperty("/userId");

            oViewModel.setProperty("/selectedEmployeeLabel", this._formatEmployeeLabel(oUserDataModel.getProperty("/displayName"), sRootEmpId));
            oViewModel.setProperty("/searchCriteria/globalId", sRootEmpId);
            this._updateSearchEnabled();

            try {
                var oUserData = await this._fetchSFData("/User('" + sRootEmpId + "')", {
                    "$select": "userId,firstName,lastName,directReports/userId,directReports/firstName,directReports/lastName,directReports/directReports/userId,directReports/directReports/firstName,directReports/directReports/lastName,directReports/directReports/directReports/userId,directReports/directReports/directReports/firstName,directReports/directReports/directReports/lastName",
                    "$expand": "directReports,directReports/directReports,directReports/directReports/directReports"
                });

                var oUserNode = this._mapTreeNode(oUserData);

                var sRootName = [oUserData.firstName, oUserData.lastName].filter(Boolean).join(" ");
                if (sRootName) {
                    oViewModel.setProperty("/selectedEmployeeLabel", this._formatEmployeeLabel(sRootName, sRootEmpId));
                }
                oViewModel.setProperty("/treeHierarchy", [oUserNode]);
                this._loadDropdownData(sRootEmpId);
            } catch (oError) {
                console.error("Tree Load Error:", oError);
                MessageBox.error("Failed to load employee hierarchy.");
            } finally {
                oView.setBusy(false);
            }
        },

        // =======================================================
        // EMPLOYEE VALUE HELP DIALOG
        // =======================================================
        onEmployeeValueHelp: function (oEvent) {
            var oUserDataModel = this.getOwnerComponent().getModel("mUserDataModel");
            if (oUserDataModel.getProperty("/isHR")) {
                this.onHREmployeeValueHelp(oEvent);
            } else if (oUserDataModel.getProperty("/isMgr")) {
                this.onEmployeeTreeValueHelp(oEvent);
            }
        },

        _selectEmployee: function (sSelectedId, sLabel) {
            var oViewModel = this.getOwnerComponent().getModel("mQuartersModel");
            oViewModel.setProperty("/selectedEmployeeLabel", sLabel || sSelectedId);
            oViewModel.setProperty("/searchCriteria/globalId", sSelectedId);
            this.byId("bonusYearInput").setSelectedKey("");
            oViewModel.setProperty("/isYearEnabled", false);
            this._updateSearchEnabled();
            this._loadDropdownData(sSelectedId);
        },

        onEmployeeTreeValueHelp: function (oEvent) {
            this.oEmployeeTreeHandler.openTreeDialog(oEvent, function (sSelectedId, oInputBox, sLabel) {
                this._selectEmployee(sSelectedId, sLabel);
            }.bind(this));
        },

        // =======================================================
        // HR MULTI-INPUT VALUE HELP
        // =======================================================
        onHREmployeeValueHelp: function (oEvent) {
            var oConfig = {
                entitySet: "User",
                key: "userId",
                description: "lastName",
                parameters: {
                    "select": "userId,firstName,lastName"
                },
                columns: [
                    { label: "Employee ID", template: "userId" },
                    { label: "First Name", template: "firstName" },
                    { label: "Last Name", template: "lastName" }
                ],
                title: "Employees",
                aFilters: [],
                aSorters: []
            };

            this.oValueHelpHandler.openValueHelpDialog(oEvent, oConfig, "mSuccessFactorsModel", function (aSelectedTokens) {
                if (aSelectedTokens && aSelectedTokens.length > 0) {
                    var oToken = aSelectedTokens[0];
                    var sId = oToken.getKey();
                    var oRow = oToken.data("row");
                    var sName = oRow ? [oRow.firstName, oRow.lastName].filter(Boolean).join(" ") : "";
                    this._selectEmployee(sId, this._formatEmployeeLabel(sName, sId));
                }
            }.bind(this));
        },

        _openBusyDialog: function () {
            if (!this._oBusyDialog) {
                this._oBusyDialog = new BusyDialog({
                    title: "Loading...",
                    text: "Please Wait"
                });
            }
            this._oBusyDialog.open();
        },

        _closeBusyDialog: function () {
            if (this._oBusyDialog) {
                this._oBusyDialog.close();
            }
        },

        onExit: function () {
            if (this._oBusyDialog) {
                this._oBusyDialog.destroy();
                this._oBusyDialog = null;
            }
        },

        // =======================================================
        // LOAD DROPDOWNS
        // =======================================================
        _loadDropdownData: function (sEmployeeId) {
            var oView = this.getView();
            var oViewModel = this.getOwnerComponent().getModel("mQuartersModel");
            var oSFModel = this.getOwnerComponent().getModel("mSuccessFactorsModel");

            oViewModel.setProperty("/quarterCards", []);
            oViewModel.setProperty("/ytdAmount", "0");
            oViewModel.setProperty("/summariesLoading", false);
            this._openBusyDialog();
            oViewModel.setProperty("/searchCriteria", {
                globalId: sEmployeeId,
                year: ""
            });
            var oDetailModel = this.getOwnerComponent().getModel("mDetailModel");
            oDetailModel.setProperty("/data", {});
            oDetailModel.setProperty("/isPdfButtonVisible", false);
            oDetailModel.setProperty("/pdfLoading", false);
            oDetailModel.setProperty("/searchCriteria", {
                globalId: sEmployeeId,
                year: "",
                quarter: ""
            });
            this.byId("bonusYearInput").setSelectedKey("");
            oViewModel.setProperty("/isYearEnabled", false);
            this._updateSearchEnabled();

            var aFilters = [
                new Filter("externalCode", FilterOperator.EQ, sEmployeeId)
            ];
            oSFModel.read("/cust_VarPayEmpHistData", {
                filters: aFilters,
                urlParameters: {
                    "fromDate": "1900-01-01",
                    "toDate": "9999-12-31",
                    "$select": "cust_VarPayTemplateName",
                    "$orderby": "cust_VarPayTemplateName desc"
                },
                success: function (oData) {
                    var aResults = oData.results || [];
                    var aYears = [];
                    var aParsedPeriods = [];

                    aResults.forEach(function (item) {
                        var sTemplateName = item.cust_VarPayTemplateName;

                        if (sTemplateName) {
                            var aMatch = sTemplateName.match(/(\d{4})\s+(Q[1-4])/i);
                            if (aMatch) {
                                var sYear = aMatch[1];
                                var sQuarter = aMatch[2].toUpperCase();

                                if (parseInt(sYear, 10) < 2025) {
                                    return;
                                }

                                aParsedPeriods.push({
                                    bonusYear: sYear,
                                    bonusQuarter: sQuarter,
                                    templateName: sTemplateName
                                });

                                if (!aYears.some(function (y) { return y.year === sYear; })) {
                                    aYears.push({ year: sYear });
                                }
                            }
                        }
                    });

                    aYears.sort(function (a, b) {
                        return a.year.localeCompare(b.year);
                    });

                    oViewModel.setProperty("/allPeriods", aParsedPeriods);
                    oViewModel.setProperty("/availableYears", aYears);
                    this._closeBusyDialog();

                    if (aYears.length > 0) {
                        var sLatestYear = aYears[aYears.length - 1].year;
                        var aQuarters = this._getQuartersForYear(aParsedPeriods, sLatestYear);

                        oViewModel.setProperty("/availableQuarters", aQuarters);
                        oViewModel.setProperty("/isYearEnabled", true);

                        this.byId("bonusYearInput").setSelectedKey(sLatestYear);
                        oViewModel.setProperty("/searchCriteria/year", sLatestYear);
                        this._updateSearchEnabled();
                    } else {
                        oViewModel.setProperty("/availableQuarters", []);
                        oViewModel.setProperty("/isYearEnabled", false);
                        this.byId("bonusYearInput").setSelectedKey("");
                        this._updateSearchEnabled();
                        var sEmployeeLabel = oViewModel.getProperty("/selectedEmployeeLabel") || sEmployeeId;
                        MessageBox.warning("No statements found for " + sEmployeeLabel);
                        oView.setBusy(false);
                    }
                }.bind(this),
                error: function () {
                    oView.setBusy(false);
                    this._closeBusyDialog();
                    oViewModel.setProperty("/isYearEnabled", false);
                    this._updateSearchEnabled();
                }.bind(this)
            });
        },

        // =======================================================
        // YEAR / QUARTER DROPDOWNS
        // =======================================================
        _getQuartersForYear: function (aPeriods, sYear) {
            var aQuarters = [];
            (aPeriods || []).forEach(function (item) {
                if (item.bonusYear === sYear &&
                    !aQuarters.some(function (q) { return q.quarter === item.bonusQuarter; })) {
                    aQuarters.push({ quarter: item.bonusQuarter });
                }
            });
            aQuarters.sort(function (a, b) {
                return a.quarter.localeCompare(b.quarter);
            });
            return aQuarters;
        },

        onYearChange: function (oEvent) {
            var oViewModel = this.getOwnerComponent().getModel("mQuartersModel");
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (!oSelectedItem) {
                return;
            }
            var sSelectedYear = oSelectedItem.getKey();
            var aAllPeriods = oViewModel.getProperty("/allPeriods") || [];
            var aQuarters = this._getQuartersForYear(aAllPeriods, sSelectedYear);

            oViewModel.setProperty("/availableQuarters", aQuarters);
            oViewModel.setProperty("/searchCriteria/year", sSelectedYear);
            oViewModel.setProperty("/quarterCards", []);
            oViewModel.setProperty("/ytdAmount", "0");
            this._updateSearchEnabled();
        },

        // =======================================================
        // STATEMENT SEARCH
        // =======================================================
        _updateSearchEnabled: function () {
            var oViewModel = this.getOwnerComponent().getModel("mQuartersModel");
            var oYearSelect = this.byId("bonusYearInput");
            var sGlobalId = oViewModel.getProperty("/searchCriteria/globalId") || "";
            var bYearSelected = !!(oYearSelect && oYearSelect.getSelectedItem());
            var bSummariesLoading = oViewModel.getProperty("/summariesLoading");

            oViewModel.setProperty(
                "/isSearchEnabled",
                !!(sGlobalId && bYearSelected && !bSummariesLoading)
            );
        },

        onContinue: async function () {
            var oView = this.getView();
            var oViewModel = this.getOwnerComponent().getModel("mQuartersModel");
            var sGlobalId = oViewModel.getProperty("/searchCriteria/globalId") || "";
            var sYear = this.byId("bonusYearInput").getSelectedKey();
            var aQuarters = oViewModel.getProperty("/availableQuarters") || [];
            var oODataModel = this.getOwnerComponent().getModel();

            if (!sGlobalId || !sYear || aQuarters.length === 0) {
                return;
            }

            oView.setBusy(true);
            oViewModel.setProperty("/summariesLoading", true);
            this._updateSearchEnabled();

            try {
                var aResponses = await Promise.all(aQuarters.map(function (oQ) {
                    return new Promise(function (resolve) {
                        oODataModel.read("/ZI_QBON_DD", {
                            filters: [
                                new Filter("global_id", FilterOperator.EQ, sGlobalId),
                                new Filter("bonusYear", FilterOperator.EQ, sYear),
                                new Filter("bonusQuarter", FilterOperator.EQ, oQ.quarter)
                            ],
                            urlParameters: { "$expand": "to_KPIs,to_qSum" },
                            success: function (oData) {
                                resolve({ quarter: oQ.quarter, results: oData.results || [] });
                            },
                            error: function () {
                                resolve({ quarter: oQ.quarter, results: [] });
                            }
                        });
                    });
                }));

                var aCards = [];
                var oLatest = aResponses[aResponses.length - 1];
                var oLatestRecord = oLatest && oLatest.results && oLatest.results[0];
                var sYtdAmount = (oLatestRecord && oLatestRecord.totalBonusYTD) || "0";
                var sCurrency = (oLatestRecord && oLatestRecord.currency) || "MXP";

                aResponses.forEach(function (oRes) {
                    var sQuarter = oRes.quarter;
                    var oRecord = oRes.results[0];

                    if (!oRecord) {
                        aCards.push({
                            quarter: sQuarter,
                            periodDays: "",
                            totalQuarterAward: "0",
                            currency: sCurrency,
                            statement: null
                        });
                        return;
                    }

                    oRecord.to_KPIs = (oRecord.to_KPIs && oRecord.to_KPIs.results) || oRecord.to_KPIs || [];
                    oRecord.to_qSum = (oRecord.to_qSum && oRecord.to_qSum.results) || oRecord.to_qSum || [];

                    if (oRecord.currency) {
                        sCurrency = oRecord.currency;
                    }

                    // Backend returns YTD summaries (Q1..QX); keep only this quarter's rows.
                    var aSums = oRecord.to_qSum.filter(function (oSum) {
                        return String(oSum.summaryQuarter || "").toUpperCase() === sQuarter;
                    }).sort(function (a, b) {
                        return (a.startQSumDate || "") < (b.startQSumDate || "") ? -1 : 1;
                    });

                    var sPeriodDays = "";
                    if (aSums.length > 0) {
                        sPeriodDays = formatter.formatDateRange(
                            aSums[0].startQSumDate,
                            aSums[aSums.length - 1].endQSumDate
                        );
                    }

                    aCards.push({
                        quarter: sQuarter,
                        periodDays: sPeriodDays,
                        totalQuarterAward: oRecord.totalQuarterAward || "0",
                        currency: oRecord.currency || sCurrency,
                        statement: Object.assign({}, oRecord, {
                            to_qSum: aSums
                        })
                    });
                });

                oViewModel.setProperty("/searchCriteria/year", sYear);
                oViewModel.setProperty("/quarterCards", aCards);
                oViewModel.setProperty("/ytdAmount", sYtdAmount);
                oViewModel.setProperty("/currency", sCurrency);
                this.getOwnerComponent().getRouter().navTo("RouteQuarters");
            } finally {
                oViewModel.setProperty("/summariesLoading", false);
                oView.setBusy(false);
                this._updateSearchEnabled();
            }
        }
    });
});
