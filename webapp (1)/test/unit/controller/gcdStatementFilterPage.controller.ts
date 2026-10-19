/*global QUnit*/
import Controller from "adobeform/controller/gcdStatementFilter.controller";

QUnit.module("gcdStatementFilter Controller");

QUnit.test("I should test the gcdStatementFilter controller", function (assert: Assert) {
	const oAppController = new Controller("gcdStatementFilter");
	oAppController.onInit();
	assert.ok(oAppController);
});
