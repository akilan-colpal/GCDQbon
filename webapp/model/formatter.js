sap.ui.define([], function () {
    "use strict";

    var QUARTER_MONTHS = {
        Q1: [1, 2, 3],
        Q2: [4, 5, 6],
        Q3: [7, 8, 9],
        Q4: [10, 11, 12]
    };

    return {
        formatPercent: function (vValue) {
            if (vValue === null || vValue === undefined || vValue === "") {
                return "0%";
            }
            var fNumber = parseFloat(vValue);
            if (isNaN(fNumber)) {
                return String(vValue);
            }
            var fPercent = fNumber;
            if (Math.abs(fNumber) <= 1 && String(vValue).indexOf(".") !== -1) {
                fPercent = fNumber * 100;
            }
            return fPercent.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            }) + "%";
        },

        /**
         * Date span for one bonus quarter. Prefers rows tagged with that quarter,
         * otherwise rows whose dates fall in the quarter's months.
         */
        spanPeriodRangeForQuarter: function (aRows, sQuarter) {
            var sQuarterKey = String(sQuarter || "").toUpperCase();
            var aMonths = QUARTER_MONTHS[sQuarterKey] || [];
            var aByLabel = [];
            var aByMonth = [];
            var i;

            function readDate(vValue) {
                if (vValue === null || vValue === undefined || vValue === "") {
                    return "";
                }
                if (typeof vValue === "number" && isFinite(vValue)) {
                    if (vValue > 1e11) {
                        var oEpoch = new Date(vValue);
                        var sEpoch = String(oEpoch.getUTCFullYear())
                            + String(oEpoch.getUTCMonth() + 1).padStart(2, "0")
                            + String(oEpoch.getUTCDate()).padStart(2, "0");
                        return sEpoch;
                    }
                    var sDigits = String(Math.trunc(vValue));
                    if (/^\d{8}$/.test(sDigits)) {
                        return sDigits;
                    }
                }
                var sRaw = String(vValue).trim();
                if (/^\d{8}$/.test(sRaw)) {
                    return sRaw;
                }
                if (/^\d{14}$/.test(sRaw)) {
                    return sRaw.slice(0, 8);
                }
                var aEdm = sRaw.match(/\/Date\((-?\d+)/);
                if (aEdm) {
                    var oEdm = new Date(Number(aEdm[1]));
                    return String(oEdm.getUTCFullYear())
                        + String(oEdm.getUTCMonth() + 1).padStart(2, "0")
                        + String(oEdm.getUTCDate()).padStart(2, "0");
                }
                var aIso = sRaw.match(/^(\d{4})-(\d{2})-(\d{2})/);
                if (aIso) {
                    return aIso[1] + aIso[2] + aIso[3];
                }
                var oParsed = new Date(sRaw);
                if (!isNaN(oParsed.getTime())) {
                    return String(oParsed.getUTCFullYear())
                        + String(oParsed.getUTCMonth() + 1).padStart(2, "0")
                        + String(oParsed.getUTCDate()).padStart(2, "0");
                }
                return "";
            }

            for (i = 0; i < aRows.length; i++) {
                var oRow = aRows[i];
                var sLabel = String(oRow.summaryQuarter || "").toUpperCase();
                if (sLabel.indexOf(sQuarterKey) !== -1) {
                    aByLabel.push(oRow);
                }
                var sStartKey = readDate(oRow.startQSumDate);
                var sEndKey = readDate(oRow.endQSumDate);
                var bStartInQuarter = sStartKey && aMonths.indexOf(Number(sStartKey.slice(4, 6))) !== -1;
                var bEndInQuarter = sEndKey && aMonths.indexOf(Number(sEndKey.slice(4, 6))) !== -1;
                if (bStartInQuarter || bEndInQuarter) {
                    aByMonth.push(oRow);
                }
            }

            var aUse = aRows;
            if (aByLabel.length) {
                aUse = aByLabel;
            } else if (aByMonth.length) {
                aUse = aByMonth;
            }

            var sStart = "";
            var sEnd = "";
            for (i = 0; i < aUse.length; i++) {
                var sRowStart = readDate(aUse[i].startQSumDate);
                var sRowEnd = readDate(aUse[i].endQSumDate);
                if (sRowStart && (!sStart || sRowStart < sStart)) {
                    sStart = sRowStart;
                }
                if (sRowEnd && (!sEnd || sRowEnd > sEnd)) {
                    sEnd = sRowEnd;
                }
            }

            function shortDate(sKey) {
                if (!sKey) {
                    return "";
                }
                var oDate = new Date(Date.UTC(
                    Number(sKey.slice(0, 4)),
                    Number(sKey.slice(4, 6)) - 1,
                    Number(sKey.slice(6, 8))
                ));
                return oDate.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC"
                });
            }

            var sStartText = shortDate(sStart);
            var sEndText = shortDate(sEnd);
            if (sStartText && sEndText) {
                return sStartText + " - " + sEndText;
            }
            return sStartText || sEndText || "";
        }
    };
});
